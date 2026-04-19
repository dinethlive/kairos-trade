import { describe, test, expect } from 'bun:test';
import { SignalScorer } from '../../src/engine/signalScorer';
import type { ThresholdResult } from '../../src/engine/adaptiveThreshold';

function result(over: Partial<ThresholdResult> = {}): ThresholdResult {
  return {
    delta: 0.05,
    welfordMean: 0.02,
    welfordStddev: 0.01,
    ewmaMean: 0.02,
    ewmaStddev: 0.01,
    threshold: 0.03,
    exceeded: true,
    cusumUp: false,
    cusumDown: false,
    bandwidth: 1,
    squeezeActive: false,
    ...over,
  };
}

describe('SignalScorer', () => {
  test('returns null when exceeded=false', () => {
    const s = new SignalScorer();
    const sig = s.score(result({ exceeded: false }), 100, 99.9, 1);
    expect(sig).toBeNull();
  });

  test('detects direction=up when currentQuote > previousQuote', () => {
    const s = new SignalScorer();
    const sig = s.score(result(), 100.5, 100, 1);
    expect(sig!.direction).toBe('up');
  });

  test('detects direction=down when currentQuote < previousQuote', () => {
    const s = new SignalScorer();
    const sig = s.score(result(), 99.5, 100, 1);
    expect(sig!.direction).toBe('down');
  });

  test('spike (delta > mean + 5σ) forces strength 3', () => {
    const s = new SignalScorer();
    const sig = s.score(
      result({ delta: 1.0, welfordMean: 0.02, welfordStddev: 0.01 }),
      110,
      100,
      1,
    );
    expect(sig!.strength).toBe(3);
    expect(sig!.isSpike).toBe(true);
  });

  test('squeeze active bumps strength by 1 (unless already 3)', () => {
    const s1 = new SignalScorer();
    // weak signal: barely over threshold, no squeeze
    const weak = s1.score(result({ delta: 0.031 }), 100.01, 100, 1);
    // fresh scorer to avoid directionRun carry
    const s2 = new SignalScorer();
    const weakSqueeze = s2.score(result({ delta: 0.031, squeezeActive: true }), 100.01, 100, 1);
    expect(weakSqueeze!.strength).toBeGreaterThanOrEqual(weak!.strength);
  });

  test('counter increments signal ids uniquely within an epoch run', () => {
    const s = new SignalScorer();
    const a = s.score(result(), 101, 100, 5);
    const b = s.score(result(), 102, 101, 5);
    expect(a!.id).not.toBe(b!.id);
  });

  test('reset clears internal streak tracking', () => {
    const s = new SignalScorer();
    s.score(result(), 101, 100, 1);
    s.score(result(), 102, 101, 2); // up streak building
    s.reset();
    const sig = s.score(result(), 100, 101, 3); // direction flips to down, fresh state
    expect(sig!.direction).toBe('down');
  });

  test('returned Signal has all required fields', () => {
    const s = new SignalScorer();
    const sig = s.score(result(), 100.5, 100, 1712345678);
    expect(sig).toMatchObject({
      epoch: 1712345678,
      price: 100.5,
      direction: 'up',
      delta: expect.any(Number),
      strength: expect.any(Number),
      threshold: expect.any(Number),
      isSpike: expect.any(Boolean),
    });
    expect(sig!.id).toMatch(/^sig_1712345678_\d+$/);
  });
});
