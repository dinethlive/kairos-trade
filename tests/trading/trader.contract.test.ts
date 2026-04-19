import { describe, test, expect, beforeEach } from 'bun:test';
import { Trader, type TraderConfig } from '../../src/trading/trader';
import { __test__ as ws__test__ } from '../../src/services/derivWS';
import { useStore } from '../../src/state/store';
import type { OpenTrade } from '../../src/types';
import {
  DEFAULT_MG_MODE,
  DEFAULT_MG_MULTIPLIER,
  DEFAULT_MG_MAX_STEPS,
  DEFAULT_MG_ARM_AFTER,
  DEFAULT_MG_ON_CAP,
} from '../../src/constants/api';

const baseConfig: TraderConfig = {
  token: '',
  appId: '',
  accountId: null,
  symbol: '1HZ100V',
  stake: 0.35,
  duration: 10,
  sensitivity: 'medium',
  minStrength: 2,
  maxConcurrent: 1,
  dryRun: true,
  martingale: {
    mode: DEFAULT_MG_MODE,
    multiplier: DEFAULT_MG_MULTIPLIER,
    maxSteps: DEFAULT_MG_MAX_STEPS,
    armAfterLosses: DEFAULT_MG_ARM_AFTER,
    maxStake: null,
    stopLoss: null,
    takeProfit: null,
    onCap: DEFAULT_MG_ON_CAP,
  },
};

function addOpen(contractId: number): OpenTrade {
  const t: OpenTrade = {
    contractId,
    type: 'CALL',
    symbol: '1HZ100V',
    stake: 0.35,
    payout: 0.7,
    durationTicks: 10,
    tickStream: 0,
    purchasedAt: Date.now(),
    signalId: `sig_${contractId}`,
  };
  useStore.getState().addOpenTrade(t);
  return t;
}

beforeEach(() => {
  useStore.getState().resetRuntime();
  useStore.getState().setAccount({
    loginId: 'VRTC001',
    currency: 'USD',
    balance: 10000,
    isVirtual: true,
  });
});

describe('Trader.onContract — full lifecycle', () => {
  test('close with numeric profit updates session and balance numerically', () => {
    const trader = new Trader({ ...baseConfig });
    // access private onContract + openContractIds
    const t = trader as unknown as {
      onContract: (c: unknown) => void;
      openContractIds: Set<number>;
    };
    addOpen(101);
    t.openContractIds.add(101);

    // Normalized ContractUpdate (post-WS boundary coercion)
    const sold = ws__test__.normalizeContract({
      contract_id: 101,
      is_sold: 1,
      status: 'won',
      profit: '0.35',
      payout: '0.70',
      entry_spot: '1234.567',
      exit_tick: '1235.123',
    });
    t.onContract(sold);

    const s = useStore.getState();
    expect(s.openTrades).toHaveLength(0);
    expect(s.session.trades).toBe(1);
    expect(s.session.wins).toBe(1);
    expect(s.session.totalProfit).toBe(0.35);
    expect(typeof s.session.totalProfit).toBe('number');
    expect(s.account!.balance).toBeCloseTo(10000.35, 6);
  });

  test('multi-trade sequence keeps totalProfit numeric (NaN USD regression)', () => {
    const trader = new Trader({ ...baseConfig });
    const t = trader as unknown as {
      onContract: (c: unknown) => void;
      openContractIds: Set<number>;
    };

    // three trades: win, loss, win — with stringy profits (as Deriv actually sends)
    const sequence: Array<{ id: number; profit: string; status: 'won' | 'lost' }> = [
      { id: 1, profit: '0.35', status: 'won' },
      { id: 2, profit: '-0.35', status: 'lost' },
      { id: 3, profit: '0.50', status: 'won' },
    ];

    for (const { id, profit, status } of sequence) {
      addOpen(id);
      t.openContractIds.add(id);
      const c = ws__test__.normalizeContract({
        contract_id: id,
        is_sold: 1,
        status,
        profit,
        payout: '0.70',
      });
      t.onContract(c);
    }

    const s = useStore.getState();
    expect(s.session.trades).toBe(3);
    expect(s.session.wins).toBe(2);
    expect(s.session.losses).toBe(1);
    expect(typeof s.session.totalProfit).toBe('number');
    expect(Number.isFinite(s.session.totalProfit)).toBe(true);
    expect(s.session.totalProfit).toBeCloseTo(0.5, 6);
  });

  test('in-flight update (is_sold=0) patches openTrade, does not close', () => {
    const trader = new Trader({ ...baseConfig });
    const t = trader as unknown as {
      onContract: (c: unknown) => void;
      openContractIds: Set<number>;
    };
    addOpen(42);
    t.openContractIds.add(42);

    const live = ws__test__.normalizeContract({
      contract_id: 42,
      is_sold: 0,
      status: 'open',
      profit: '0.10',
      current_spot: '1234.8',
      entry_spot: '1234.5',
      tick_count: '3',
    });
    t.onContract(live);

    const s = useStore.getState();
    expect(s.openTrades).toHaveLength(1);
    expect(s.openTrades[0]!.profit).toBe(0.1);
    expect(s.openTrades[0]!.currentSpot).toBe(1234.8);
    expect(s.openTrades[0]!.entrySpot).toBe(1234.5);
    expect(s.session.trades).toBe(0);
  });

  test('ignores updates for contracts we do not own', () => {
    const trader = new Trader({ ...baseConfig });
    const t = trader as unknown as {
      onContract: (c: unknown) => void;
      openContractIds: Set<number>;
    };
    // no addOpen, no openContractIds.add
    const c = ws__test__.normalizeContract({ contract_id: 999, is_sold: 1, profit: '5.0' });
    t.onContract(c);

    expect(useStore.getState().session.trades).toBe(0);
  });
});
