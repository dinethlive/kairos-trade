import { describe, test, expect, beforeEach } from 'bun:test';
import { useStore } from '../../src/state/store';
import type { Account, ClosedTrade, OpenTrade } from '../../src/types';

const baseAccount: Account = {
  loginId: 'VRTC001',
  currency: 'USD',
  balance: 10000,
  isVirtual: true,
};

function openTrade(contractId = 1): OpenTrade {
  return {
    contractId,
    type: 'CALL',
    symbol: '1HZ100V',
    stake: 0.35,
    payout: 0.7,
    durationTicks: 10,
    tickStream: 0,
    purchasedAt: Date.now(),
    signalId: 'sig_1',
  };
}

function closedTrade(contractId: number, profit: number): ClosedTrade {
  return {
    contractId,
    type: 'CALL',
    symbol: '1HZ100V',
    stake: 0.35,
    payout: 0.7,
    profit,
    result: profit > 0 ? 'win' : 'loss',
    durationTicks: 10,
    closedAt: Date.now(),
    signalId: 'sig_1',
  };
}

beforeEach(() => {
  useStore.getState().resetRuntime();
  useStore.getState().clearTranscript();
});

describe('setAccount / updateBalance', () => {
  test('setAccount stores the account', () => {
    useStore.getState().setAccount(baseAccount);
    expect(useStore.getState().account).toEqual(baseAccount);
  });

  test('updateBalance mutates balance numerically', () => {
    useStore.getState().setAccount(baseAccount);
    useStore.getState().updateBalance(9876.54);
    expect(useStore.getState().account!.balance).toBe(9876.54);
  });

  test('updateBalance is a no-op when no account set', () => {
    useStore.getState().updateBalance(123);
    expect(useStore.getState().account).toBeNull();
  });

  test('updateBalance can change currency', () => {
    useStore.getState().setAccount(baseAccount);
    useStore.getState().updateBalance(100, 'BTC');
    expect(useStore.getState().account!.currency).toBe('BTC');
  });
});

describe('open/close trade lifecycle', () => {
  test('addOpenTrade appends', () => {
    useStore.getState().addOpenTrade(openTrade(1));
    useStore.getState().addOpenTrade(openTrade(2));
    expect(useStore.getState().openTrades).toHaveLength(2);
  });

  test('updateOpenTrade patches by contractId', () => {
    useStore.getState().addOpenTrade(openTrade(1));
    useStore.getState().updateOpenTrade(1, { profit: 0.5, currentSpot: 1234.5 });
    const t = useStore.getState().openTrades[0]!;
    expect(t.profit).toBe(0.5);
    expect(t.currentSpot).toBe(1234.5);
  });

  test('closeTrade removes from openTrades and updates session + balance', () => {
    useStore.getState().setAccount({ ...baseAccount, balance: 100 });
    useStore.getState().addOpenTrade(openTrade(1));
    useStore.getState().closeTrade(1, closedTrade(1, 0.35));
    const s = useStore.getState();
    expect(s.openTrades).toHaveLength(0);
    expect(s.session.trades).toBe(1);
    expect(s.session.totalProfit).toBe(0.35);
    expect(s.account!.balance).toBeCloseTo(100.35, 6);
  });

  test('totalProfit stays numeric across many closeTrade calls (regression)', () => {
    useStore.getState().setAccount({ ...baseAccount, balance: 100 });
    for (let i = 0; i < 10; i++) {
      useStore.getState().addOpenTrade(openTrade(i + 1));
      useStore.getState().closeTrade(i + 1, closedTrade(i + 1, i % 2 === 0 ? 0.35 : -0.35));
    }
    const s = useStore.getState();
    expect(typeof s.session.totalProfit).toBe('number');
    expect(Number.isFinite(s.session.totalProfit)).toBe(true);
    expect(typeof s.account!.balance).toBe('number');
    expect(Number.isFinite(s.account!.balance)).toBe(true);
  });
});

describe('resetRuntime', () => {
  test('clears runtime state but preserves config', () => {
    const store = useStore.getState();
    const originalConfig = store.config;
    store.setAccount(baseAccount);
    store.addOpenTrade(openTrade(1));
    store.append('info', 'hello');

    store.resetRuntime();

    const after = useStore.getState();
    expect(after.account).toBeNull();
    expect(after.openTrades).toHaveLength(0);
    expect(after.session.trades).toBe(0);
    expect(after.config).toBe(originalConfig);
  });
});

describe('transcript', () => {
  test('appends lines with increasing ids', () => {
    useStore.getState().append('info', 'one');
    useStore.getState().append('info', 'two');
    const t = useStore.getState().transcript;
    expect(t).toHaveLength(2);
    expect(t[1]!.id).toBeGreaterThan(t[0]!.id);
  });

  test('clearTranscript empties', () => {
    useStore.getState().append('info', 'one');
    useStore.getState().clearTranscript();
    expect(useStore.getState().transcript).toHaveLength(0);
  });
});
