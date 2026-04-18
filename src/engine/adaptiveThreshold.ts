import type { WelfordState, EWMAState, CUSUMState } from '../types';
import { ROLLING_WINDOW, WARMUP_TICKS } from '../constants/api';

const EWMA_SPAN = 20;
const EWMA_ALPHA = 2 / (EWMA_SPAN + 1);

export interface ThresholdResult {
  delta: number;
  welfordMean: number;
  welfordStddev: number;
  ewmaMean: number;
  ewmaStddev: number;
  threshold: number;
  exceeded: boolean;
  cusumUp: boolean;
  cusumDown: boolean;
  bandwidth: number;
  squeezeActive: boolean;
}

export class AdaptiveThresholdEngine {
  private welford: WelfordState = { n: 0, mean: 0, M2: 0 };
  private ewma: EWMAState = { mean: 0, variance: 0, initialized: false };
  private cusum: CUSUMState = { sHigh: 0, sLow: 0 };

  private rollingDeltas: number[] = [];
  private rollingIndex = 0;
  private rollingFull = false;

  private bandwidthMin = Infinity;
  private bandwidthWindow: number[] = [];
  private bandwidthIdx = 0;
  private bandwidthFull = false;

  private prevQuote: number | null = null;
  private tickCount = 0;

  get isWarming(): boolean {
    return this.tickCount < WARMUP_TICKS;
  }

  get currentMean(): number {
    return this.welford.mean;
  }

  get currentStddev(): number {
    return this.getWelfordStddev();
  }

  get ticksSeen(): number {
    return this.tickCount;
  }

  reset(): void {
    this.welford = { n: 0, mean: 0, M2: 0 };
    this.ewma = { mean: 0, variance: 0, initialized: false };
    this.cusum = { sHigh: 0, sLow: 0 };
    this.rollingDeltas = [];
    this.rollingIndex = 0;
    this.rollingFull = false;
    this.bandwidthMin = Infinity;
    this.bandwidthWindow = [];
    this.bandwidthIdx = 0;
    this.bandwidthFull = false;
    this.prevQuote = null;
    this.tickCount = 0;
  }

  processTick(quote: number, sensitivityMultiplier: number): ThresholdResult | null {
    if (this.prevQuote === null) {
      this.prevQuote = quote;
      this.tickCount++;
      return null;
    }

    const delta = Math.abs(quote - this.prevQuote);
    this.prevQuote = quote;
    this.tickCount++;

    this.updateWelfordRolling(delta);
    this.updateEWMA(delta);

    const wStd = this.getWelfordStddev();
    const wMean = this.welford.mean;
    const effectiveWStd = Math.max(wStd, wMean * 0.001);

    const eStd = Math.sqrt(Math.max(0, this.ewma.variance));
    const eMean = this.ewma.mean;
    const effectiveEStd = Math.max(eStd, eMean * 0.001);

    const welfordThreshold = wMean + sensitivityMultiplier * effectiveWStd;
    const ewmaThreshold = eMean + sensitivityMultiplier * effectiveEStd;

    const threshold = Math.min(welfordThreshold, ewmaThreshold);

    const mu = eMean;
    const allowance = 0.5 * effectiveEStd;
    const decisionH = 4.0 * effectiveEStd;

    this.cusum.sHigh = Math.max(0, this.cusum.sHigh + (delta - mu) - allowance);
    this.cusum.sLow = Math.max(0, this.cusum.sLow + (-delta + mu) - allowance);

    let cusumUp = false;
    let cusumDown = false;
    if (this.cusum.sHigh > decisionH) {
      cusumUp = true;
      this.cusum.sHigh = 0;
    }
    if (this.cusum.sLow > decisionH) {
      cusumDown = true;
      this.cusum.sLow = 0;
    }

    const bandwidth =
      effectiveWStd > 0 ? (2 * sensitivityMultiplier * effectiveWStd) / Math.max(wMean, 1e-10) : 0;
    this.updateBandwidth(bandwidth);
    const squeezeActive = bandwidth < this.bandwidthMin * 1.2 && this.bandwidthFull;

    const exceeded = delta > threshold && !this.isWarming;

    return {
      delta,
      welfordMean: wMean,
      welfordStddev: effectiveWStd,
      ewmaMean: eMean,
      ewmaStddev: effectiveEStd,
      threshold,
      exceeded,
      cusumUp,
      cusumDown,
      bandwidth,
      squeezeActive,
    };
  }

  private updateWelfordRolling(newValue: number): void {
    if (this.rollingFull) {
      const oldValue = this.rollingDeltas[this.rollingIndex]!;
      this.rollingDeltas[this.rollingIndex] = newValue;
      this.rollingIndex = (this.rollingIndex + 1) % ROLLING_WINDOW;

      const n = ROLLING_WINDOW;
      const oldMean = this.welford.mean;
      const newMean = oldMean + (newValue - oldValue) / n;
      this.welford.M2 += (newValue - oldValue) * (newValue - newMean + oldValue - oldMean);
      this.welford.mean = newMean;
      if (this.welford.M2 < 0) this.welford.M2 = 0;
    } else {
      this.rollingDeltas.push(newValue);
      this.rollingIndex = this.rollingDeltas.length;

      const n = this.rollingDeltas.length;
      const delta = newValue - this.welford.mean;
      const newMean = this.welford.mean + delta / n;
      const delta2 = newValue - newMean;
      this.welford.n = n;
      this.welford.mean = newMean;
      this.welford.M2 += delta * delta2;

      if (n >= ROLLING_WINDOW) {
        this.rollingFull = true;
        this.rollingIndex = 0;
      }
    }
  }

  private updateEWMA(value: number): void {
    if (!this.ewma.initialized) {
      this.ewma.mean = value;
      this.ewma.variance = 0;
      this.ewma.initialized = true;
      return;
    }
    const diff = value - this.ewma.mean;
    this.ewma.mean = EWMA_ALPHA * value + (1 - EWMA_ALPHA) * this.ewma.mean;
    this.ewma.variance = (1 - EWMA_ALPHA) * (this.ewma.variance + EWMA_ALPHA * diff * diff);
  }

  private getWelfordStddev(): number {
    const n = this.rollingFull ? ROLLING_WINDOW : this.welford.n;
    return n < 2 ? 0 : Math.sqrt(this.welford.M2 / n);
  }

  private updateBandwidth(bw: number): void {
    const BW_WINDOW = 50;
    if (this.bandwidthFull) {
      this.bandwidthWindow[this.bandwidthIdx] = bw;
      this.bandwidthIdx = (this.bandwidthIdx + 1) % BW_WINDOW;
      this.bandwidthMin = Math.min(...this.bandwidthWindow);
    } else {
      this.bandwidthWindow.push(bw);
      this.bandwidthIdx = this.bandwidthWindow.length;
      if (bw < this.bandwidthMin) this.bandwidthMin = bw;
      if (this.bandwidthWindow.length >= BW_WINDOW) {
        this.bandwidthFull = true;
        this.bandwidthIdx = 0;
      }
    }
  }

  seedHistory(prices: number[]): void {
    for (let i = 1; i < prices.length; i++) {
      const delta = Math.abs(prices[i]! - prices[i - 1]!);
      this.updateWelfordRolling(delta);
      this.updateEWMA(delta);
    }
    this.prevQuote = prices[prices.length - 1] ?? null;
    this.tickCount = prices.length;
  }
}
