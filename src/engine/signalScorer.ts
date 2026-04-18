import type { Signal, SignalStrength } from '../types';
import type { ThresholdResult } from './adaptiveThreshold';
import { MIN_TRADE_DURATION } from '../constants/api';

export interface ScoreOptions {
  cooldownTicks: number;
  maxDuration: number;
}

export class SignalScorer {
  private counter = 0;
  private prevDelta = 0;
  private directionRun = 0;
  private lastDirection: 'up' | 'down' | null = null;
  private lastFireTick: number | null = null;

  reset(): void {
    this.counter = 0;
    this.prevDelta = 0;
    this.directionRun = 0;
    this.lastDirection = null;
    this.lastFireTick = null;
  }

  score(
    result: ThresholdResult,
    currentQuote: number,
    previousQuote: number,
    epoch: number,
    tickCount: number,
    opts: ScoreOptions,
  ): Signal | null {
    if (!result.exceeded) return null;

    if (
      this.lastFireTick !== null &&
      tickCount - this.lastFireTick < Math.max(0, opts.cooldownTicks)
    ) {
      return null;
    }

    const { delta, threshold, welfordStddev, ewmaStddev, squeezeActive } = result;
    const direction: 'up' | 'down' = currentQuote > previousQuote ? 'up' : 'down';
    const stddev = Math.min(welfordStddev, ewmaStddev);
    const safeStddev = Math.max(stddev, 1e-10);

    const magnitudeRaw = (delta - threshold) / safeStddev;
    const magnitudeScore = 2 * sigmoid(magnitudeRaw) - 1;

    const velocity = delta - this.prevDelta;
    const velocityNorm = velocity / safeStddev;
    const velocityScore = sigmoid(velocityNorm);

    if (direction === this.lastDirection) this.directionRun++;
    else this.directionRun = 1;
    this.lastDirection = direction;
    const consistencyScore = Math.min(this.directionRun / 5, 1.0);

    const squeezeBonus = squeezeActive ? 0.15 : 0;
    const cusumBonus = result.cusumUp || result.cusumDown ? 0.1 : 0;

    const composite =
      0.5 * magnitudeScore +
      0.2 * velocityScore +
      0.15 * consistencyScore +
      squeezeBonus +
      cusumBonus;

    this.prevDelta = delta;

    const spikeThreshold = result.welfordMean + 5 * welfordStddev;
    const isSpike = delta > spikeThreshold;

    let strength: SignalStrength;
    if (isSpike || composite >= 0.7) strength = 3;
    else if (composite >= 0.4) strength = 2;
    else strength = 1;

    if (squeezeActive && strength < 3) {
      strength = (strength + 1) as SignalStrength;
    }

    this.counter++;
    this.lastFireTick = tickCount;

    const suggestedDuration = computeSuggestedDuration(
      result,
      this.directionRun,
      isSpike,
      squeezeActive,
      opts.maxDuration,
    );

    return {
      id: `sig_${epoch}_${this.counter}`,
      epoch,
      price: currentQuote,
      direction,
      delta,
      strength,
      threshold,
      isSpike,
      directionRun: this.directionRun,
      suggestedDuration,
    };
  }
}

// Per-signal hold based on feature shape.
// Spikes/squeezes revert fast on random-walk synthetics — take the floor.
// CUSUM-confirmed regime shifts have genuine persistence — extend hold.
// Long direction runs mean the trend is already aging — shorten.
function computeSuggestedDuration(
  result: ThresholdResult,
  directionRun: number,
  isSpike: boolean,
  squeezeActive: boolean,
  maxDuration: number,
): number {
  const floor = MIN_TRADE_DURATION;
  const cap = Math.max(floor, maxDuration);

  if (isSpike || squeezeActive) return Math.min(floor, cap);

  let d = floor;
  if (result.cusumUp || result.cusumDown) d += 3;
  if (directionRun >= 4) d = Math.max(floor, d - 2);

  return Math.max(floor, Math.min(cap, d));
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}
