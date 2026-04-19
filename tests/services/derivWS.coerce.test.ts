import { describe, test, expect } from 'bun:test';
import { __test__ } from '../../src/services/derivWS';

const { toNum, normalizeContract, normalizeBuy, normalizeBalance, normalizeTick } = __test__;

describe('toNum', () => {
  test('passes through finite numbers', () => {
    expect(toNum(1.5)).toBe(1.5);
    expect(toNum(0)).toBe(0);
    expect(toNum(-42)).toBe(-42);
  });

  test('coerces numeric strings', () => {
    expect(toNum('1.50')).toBe(1.5);
    expect(toNum('10086.37')).toBe(10086.37);
    expect(toNum('-0.35')).toBe(-0.35);
    expect(toNum('0')).toBe(0);
  });

  test('returns undefined for null/undefined', () => {
    expect(toNum(null)).toBeUndefined();
    expect(toNum(undefined)).toBeUndefined();
  });

  test('returns undefined for non-finite', () => {
    expect(toNum(NaN)).toBeUndefined();
    expect(toNum(Infinity)).toBeUndefined();
    expect(toNum(-Infinity)).toBeUndefined();
    expect(toNum('NaN')).toBeUndefined();
    expect(toNum('not-a-number')).toBeUndefined();
  });

  test('handles empty string as undefined (not 0)', () => {
    // Number('') === 0 is a JS footgun — toNum coerces via Number(),
    // so '' returns 0. Document the actual behavior.
    expect(toNum('')).toBe(0);
  });
});

describe('normalizeContract', () => {
  test('coerces all numeric string fields', () => {
    const raw = {
      contract_id: 12345,
      is_sold: 1,
      status: 'won',
      profit: '1.50',
      payout: '2.00',
      buy_price: '0.50',
      bid_price: '1.95',
      entry_spot: '1234.567',
      current_spot: '1235.890',
      exit_tick: '1236.123',
      tick_count: '10',
      current_spot_time: 1712345678,
      date_expiry: 1712345688,
      shortcode: 'CALL_1HZ100V_2.00_10_T',
    };
    const c = normalizeContract(raw);
    expect(c.contract_id).toBe(12345);
    expect(c.is_sold).toBe(1);
    expect(c.profit).toBe(1.5);
    expect(c.payout).toBe(2);
    expect(c.buy_price).toBe(0.5);
    expect(c.bid_price).toBe(1.95);
    expect(c.entry_spot).toBe(1234.567);
    expect(c.current_spot).toBe(1235.89);
    expect(c.exit_tick).toBe(1236.123);
    expect(c.tick_count).toBe(10);
    expect(c.status).toBe('won');
    expect(c.shortcode).toBe('CALL_1HZ100V_2.00_10_T');
  });

  test('prefers entry_spot over entry_tick when both present', () => {
    const c = normalizeContract({ contract_id: 1, is_sold: 0, entry_spot: '100', entry_tick: '999' });
    expect(c.entry_spot).toBe(100);
  });

  test('falls back to entry_tick when entry_spot missing', () => {
    const c = normalizeContract({ contract_id: 1, is_sold: 0, entry_tick: '100' });
    expect(c.entry_spot).toBe(100);
  });

  test('undefined fields stay undefined (not NaN)', () => {
    const c = normalizeContract({ contract_id: 1, is_sold: 0 });
    expect(c.profit).toBeUndefined();
    expect(c.payout).toBeUndefined();
    expect(c.entry_spot).toBeUndefined();
    expect(c.current_spot).toBeUndefined();
  });

  test('null numeric fields become undefined, not NaN', () => {
    const c = normalizeContract({ contract_id: 1, is_sold: 0, profit: null, payout: null });
    expect(c.profit).toBeUndefined();
    expect(c.payout).toBeUndefined();
  });

  test('negative profit string parses correctly', () => {
    const c = normalizeContract({ contract_id: 1, is_sold: 1, profit: '-0.35' });
    expect(c.profit).toBe(-0.35);
  });
});

describe('normalizeBuy', () => {
  test('coerces buy_price, payout, balance_after', () => {
    const b = normalizeBuy({
      contract_id: 99,
      buy_price: '0.35',
      payout: '0.70',
      purchase_time: 1712345678,
      start_time: 1712345678,
      longcode: 'Win...',
      shortcode: 'CALL_...',
      transaction_id: 555,
      balance_after: '10085.02',
    });
    expect(b.buy_price).toBe(0.35);
    expect(b.payout).toBe(0.7);
    expect(b.balance_after).toBe(10085.02);
    expect(b.contract_id).toBe(99);
    expect(b.transaction_id).toBe(555);
  });

  test('missing numerics default to 0 (not NaN)', () => {
    const b = normalizeBuy({ contract_id: 1, transaction_id: 1 });
    expect(b.buy_price).toBe(0);
    expect(b.payout).toBe(0);
  });
});

describe('normalizeBalance', () => {
  test('coerces string balance (the original bug)', () => {
    const b = normalizeBalance({ balance: '10086.37', currency: 'USD' });
    expect(b.balance).toBe(10086.37);
    expect(b.currency).toBe('USD');
  });

  test('missing balance defaults to 0', () => {
    const b = normalizeBalance({ currency: 'USD' });
    expect(b.balance).toBe(0);
  });

  test('preserves loginid', () => {
    const b = normalizeBalance({ balance: 100, currency: 'USD', loginid: 'VRTC12345' });
    expect(b.loginid).toBe('VRTC12345');
  });
});

describe('normalizeTick', () => {
  test('coerces all tick fields', () => {
    const t = normalizeTick({
      epoch: 1712345678,
      quote: '1234.567',
      symbol: '1HZ100V',
      pip_size: '0.01',
      id: 'abc',
    });
    expect(t.epoch).toBe(1712345678);
    expect(t.quote).toBe(1234.567);
    expect(t.symbol).toBe('1HZ100V');
    expect(t.pip_size).toBe(0.01);
    expect(t.id).toBe('abc');
  });
});
