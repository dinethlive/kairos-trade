import { describe, test, expect } from 'bun:test';
import { emptySession, updateSession, winRate } from '../../src/trading/session';
import type { ClosedTrade } from '../../src/types';

function trade(profit: number, result: 'win' | 'loss' = profit > 0 ? 'win' : 'loss'): ClosedTrade {
  return {
    contractId: 1,
    type: 'CALL',
    symbol: '1HZ100V',
    stake: 0.35,
    payout: 0.7,
    profit,
    result,
    durationTicks: 10,
    closedAt: Date.now(),
    signalId: 'sig_1',
  };
}

describe('emptySession', () => {
  test('starts with zero counters', () => {
    const s = emptySession();
    expect(s.trades).toBe(0);
    expect(s.wins).toBe(0);
    expect(s.losses).toBe(0);
    expect(s.totalProfit).toBe(0);
    expect(s.largestWin).toBe(0);
    expect(s.largestLoss).toBe(0);
    expect(s.startedAt).toBeLessThanOrEqual(Date.now());
  });
});

describe('updateSession', () => {
  test('single win increments wins and totalProfit', () => {
    const s = updateSession(emptySession(), trade(0.35));
    expect(s.trades).toBe(1);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(0);
    expect(s.totalProfit).toBe(0.35);
    expect(s.largestWin).toBe(0.35);
    expect(s.largestLoss).toBe(0);
  });

  test('single loss increments losses and subtracts from totalProfit', () => {
    const s = updateSession(emptySession(), trade(-0.35));
    expect(s.losses).toBe(1);
    expect(s.totalProfit).toBe(-0.35);
    expect(s.largestLoss).toBe(-0.35);
  });

  test('accumulates wins and losses correctly', () => {
    let s = emptySession();
    s = updateSession(s, trade(1.0));
    s = updateSession(s, trade(-0.5));
    s = updateSession(s, trade(0.75));
    expect(s.trades).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.totalProfit).toBeCloseTo(1.25, 6);
    expect(s.largestWin).toBe(1.0);
    expect(s.largestLoss).toBe(-0.5);
  });

  test('totalProfit stays numeric even under long sequences (no string concat regression)', () => {
    let s = emptySession();
    for (let i = 0; i < 50; i++) {
      s = updateSession(s, trade(i % 2 === 0 ? 0.35 : -0.35));
    }
    expect(typeof s.totalProfit).toBe('number');
    expect(Number.isFinite(s.totalProfit)).toBe(true);
  });

  test('largestWin tracks max positive, not absolute', () => {
    let s = emptySession();
    s = updateSession(s, trade(0.5));
    s = updateSession(s, trade(-2.0));
    expect(s.largestWin).toBe(0.5);
  });

  test('largestLoss tracks min (most negative)', () => {
    let s = emptySession();
    s = updateSession(s, trade(-0.3));
    s = updateSession(s, trade(-1.5));
    s = updateSession(s, trade(-0.1));
    expect(s.largestLoss).toBe(-1.5);
  });

  test('breakeven (profit=0) counts as loss per current logic', () => {
    const s = updateSession(emptySession(), trade(0, 'loss'));
    expect(s.trades).toBe(1);
    expect(s.wins).toBe(0);
    expect(s.losses).toBe(1);
  });
});

describe('winRate', () => {
  test('zero trades returns 0 (no divide-by-zero)', () => {
    expect(winRate(emptySession())).toBe(0);
  });

  test('all wins returns 1.0', () => {
    let s = emptySession();
    s = updateSession(s, trade(0.5));
    s = updateSession(s, trade(0.5));
    expect(winRate(s)).toBe(1);
  });

  test('2 wins out of 3 returns 0.666...', () => {
    let s = emptySession();
    s = updateSession(s, trade(0.5));
    s = updateSession(s, trade(-0.5));
    s = updateSession(s, trade(0.5));
    expect(winRate(s)).toBeCloseTo(2 / 3, 6);
  });
});
