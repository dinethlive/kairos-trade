import { describe, test, expect } from 'bun:test';
import { AdaptiveThresholdEngine } from '../../src/engine/adaptiveThreshold';
import { WARMUP_TICKS } from '../../src/constants/api';

describe('AdaptiveThresholdEngine — warmup', () => {
  test('isWarming is true until WARMUP_TICKS ticks seen', () => {
    const eng = new AdaptiveThresholdEngine();
    expect(eng.isWarming).toBe(true);
    for (let i = 0; i < WARMUP_TICKS - 1; i++) eng.processTick(100 + i * 0.01, 1.5);
    expect(eng.isWarming).toBe(true);
    eng.processTick(200, 1.5);
    expect(eng.isWarming).toBe(false);
  });

  test('first tick returns null (no prevQuote)', () => {
    const eng = new AdaptiveThresholdEngine();
    expect(eng.processTick(100, 1.5)).toBeNull();
  });

  test('exceeded is false during warmup even for big deltas', () => {
    const eng = new AdaptiveThresholdEngine();
    eng.processTick(100, 1.5);
    const r = eng.processTick(999, 1.5);
    expect(r).not.toBeNull();
    expect(r!.exceeded).toBe(false);
  });
});

describe('AdaptiveThresholdEngine — Welford / EWMA', () => {
  test('constant series produces ~zero mean delta', () => {
    const eng = new AdaptiveThresholdEngine();
    for (let i = 0; i < 30; i++) eng.processTick(100, 1.5);
    expect(eng.currentMean).toBeCloseTo(0, 6);
  });

  test('linear series: mean delta approximates the step', () => {
    const eng = new AdaptiveThresholdEngine();
    for (let i = 0; i < 50; i++) eng.processTick(100 + i * 0.05, 1.5);
    // 49 deltas of exactly 0.05 each (first tick is seed, second produces first delta)
    expect(eng.currentMean).toBeCloseTo(0.05, 3);
    expect(eng.currentStddev).toBeLessThan(0.01);
  });

  test('tickCount increments per processed tick', () => {
    const eng = new AdaptiveThresholdEngine();
    for (let i = 0; i < 10; i++) eng.processTick(100 + i, 1.5);
    expect(eng.ticksSeen).toBe(10);
  });
});

describe('AdaptiveThresholdEngine — exceed / spike', () => {
  test('delta exceeding threshold flags exceeded post-warmup', () => {
    const eng = new AdaptiveThresholdEngine();
    // Feed small deltas to build baseline
    for (let i = 0; i < WARMUP_TICKS + 20; i++) {
      eng.processTick(100 + (i % 2 === 0 ? 0.01 : -0.01), 1.5);
    }
    const r = eng.processTick(110, 1.5); // huge jump
    expect(r).not.toBeNull();
    expect(r!.exceeded).toBe(true);
    expect(r!.delta).toBeGreaterThan(r!.threshold);
  });

  test('CUSUM fires on sustained regime shift', () => {
    const eng = new AdaptiveThresholdEngine();
    // baseline: tiny deltas
    for (let i = 0; i < 50; i++) eng.processTick(100 + (i % 2) * 0.001, 1.5);
    // regime shift: much larger deltas, sustained
    let cusumFired = false;
    let price = 100;
    for (let i = 0; i < 30; i++) {
      price += 0.5 * (i % 2 === 0 ? 1 : -1);
      const r = eng.processTick(price, 1.5);
      if (r && (r.cusumUp || r.cusumDown)) cusumFired = true;
    }
    expect(cusumFired).toBe(true);
  });
});

describe('AdaptiveThresholdEngine — reset', () => {
  test('reset clears all state', () => {
    const eng = new AdaptiveThresholdEngine();
    for (let i = 0; i < 30; i++) eng.processTick(100 + i, 1.5);
    eng.reset();
    expect(eng.ticksSeen).toBe(0);
    expect(eng.isWarming).toBe(true);
    expect(eng.currentMean).toBe(0);
    expect(eng.processTick(100, 1.5)).toBeNull(); // prevQuote cleared
  });
});

describe('AdaptiveThresholdEngine — seedHistory', () => {
  test('preloads stats so first live tick is post-warmup', () => {
    const eng = new AdaptiveThresholdEngine();
    const prices = Array.from({ length: 500 }, (_, i) => 100 + Math.sin(i * 0.1) * 0.5);
    eng.seedHistory(prices);
    expect(eng.ticksSeen).toBe(500);
    expect(eng.isWarming).toBe(false);
  });

  test('empty history leaves engine in warmup', () => {
    const eng = new AdaptiveThresholdEngine();
    eng.seedHistory([]);
    expect(eng.isWarming).toBe(true);
  });
});
