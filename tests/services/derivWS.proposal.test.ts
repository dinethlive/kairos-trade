import { describe, test, expect } from 'bun:test';
import { DerivWS } from '../../src/services/derivWS';

type Json = Record<string, unknown>;
type SendStub = (payload: Json) => Promise<Json>;

function makeWs(send: SendStub): { ws: DerivWS; calls: Json[] } {
  const ws = new DerivWS({ appId: 'app', token: 'tok' });
  const calls: Json[] = [];
  (ws as unknown as { send: SendStub }).send = async (payload) => {
    calls.push(payload);
    return send(payload);
  };
  return { ws, calls };
}

describe('DerivWS.getProposal — v1 wire format', () => {
  test('sends proposal:1 with underlying_symbol (NOT legacy `symbol`)', async () => {
    const { ws, calls } = makeWs(async () => ({
      proposal: { id: 'prop-abc', ask_price: '0.35', payout: '0.70', spot: '1234.5' },
    }));

    const p = await ws.getProposal({
      amount: 0.35,
      currency: 'USD',
      contract_type: 'CALL',
      duration: 5,
      duration_unit: 't',
      symbol: '1HZ100V',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({
      proposal: 1,
      amount: 0.35,
      basis: 'stake',
      contract_type: 'CALL',
      currency: 'USD',
      duration: 5,
      duration_unit: 't',
      underlying_symbol: '1HZ100V',
    });
    // Ensure no legacy field names leak in
    expect((calls[0] as Json).symbol).toBeUndefined();
    expect((calls[0] as Json).parameters).toBeUndefined();

    expect(p.id).toBe('prop-abc');
    expect(p.ask_price).toBe(0.35);
    expect(p.payout).toBe(0.7);
    expect(p.spot).toBe(1234.5);
  });

  test('basis override is forwarded', async () => {
    const { ws, calls } = makeWs(async () => ({
      proposal: { id: 'x', ask_price: 1 },
    }));

    await ws.getProposal({
      amount: 1,
      currency: 'USD',
      contract_type: 'PUT',
      duration: 5,
      duration_unit: 't',
      symbol: '1HZ100V',
      basis: 'payout',
    });

    expect((calls[0] as Json).basis).toBe('payout');
  });

  test('throws when proposal response has no id', async () => {
    const { ws } = makeWs(async () => ({ proposal: { ask_price: 1 } }));

    await expect(
      ws.getProposal({
        amount: 1,
        currency: 'USD',
        contract_type: 'CALL',
        duration: 5,
        duration_unit: 't',
        symbol: '1HZ100V',
      }),
    ).rejects.toThrow(/missing id/);
  });

  test('coerces stringy ask_price/payout/spot to numbers', async () => {
    const { ws } = makeWs(async () => ({
      proposal: { id: 'pid', ask_price: '0.42', payout: '0.84', spot: '999.99' },
    }));

    const p = await ws.getProposal({
      amount: 0.42,
      currency: 'USD',
      contract_type: 'CALL',
      duration: 5,
      duration_unit: 't',
      symbol: '1HZ100V',
    });

    expect(p.ask_price).toBe(0.42);
    expect(p.payout).toBe(0.84);
    expect(p.spot).toBe(999.99);
  });
});

describe('DerivWS.buyContract — v1 proposal→buy flow', () => {
  test('two-step: proposal first, then buy with proposal.id, ask_price, subscribe:1', async () => {
    const { ws, calls } = makeWs(async (payload) => {
      if ('proposal' in payload) {
        return {
          proposal: {
            id: 'prop-xyz',
            ask_price: '0.35',
            payout: '0.70',
            spot: '100',
          },
        };
      }
      if ('buy' in payload) {
        return {
          buy: {
            contract_id: 12345678,
            buy_price: '0.35',
            payout: '0.70',
            purchase_time: 1712345678,
            start_time: 1712345678,
            longcode: 'Win payout if Volatility 100 Index ...',
            shortcode: 'CALL_1HZ100V_0.70_10_T',
            transaction_id: 87654321,
            balance_after: '9999.65',
          },
        };
      }
      throw new Error('unexpected payload');
    });

    const result = await ws.buyContract({
      amount: 0.35,
      currency: 'USD',
      contract_type: 'CALL',
      duration: 5,
      duration_unit: 't',
      symbol: '1HZ100V',
    });

    expect(calls).toHaveLength(2);

    // 1) proposal: v1 uses `underlying_symbol`
    expect(calls[0]).toMatchObject({
      proposal: 1,
      basis: 'stake',
      contract_type: 'CALL',
      currency: 'USD',
      duration: 5,
      duration_unit: 't',
      underlying_symbol: '1HZ100V',
    });

    // 2) buy: proposal id + ask_price + subscribe (streams POC updates).
    //    NO legacy `parameters` or `buy:'1'` shortcut.
    expect(calls[1]).toEqual({
      buy: 'prop-xyz',
      price: 0.35,
      subscribe: 1,
    });

    // BuyResult is fully normalized
    expect(result.contract_id).toBe(12345678);
    expect(result.buy_price).toBe(0.35);
    expect(result.payout).toBe(0.7);
    expect(result.transaction_id).toBe(87654321);
    expect(result.balance_after).toBeCloseTo(9999.65, 6);
    expect(result.shortcode).toBe('CALL_1HZ100V_0.70_10_T');
  });

  test('does NOT use legacy buy:1 + parameters shortcut', async () => {
    const { ws, calls } = makeWs(async (payload) => {
      if ('proposal' in payload) return { proposal: { id: 'pid', ask_price: 1 } };
      return {
        buy: {
          contract_id: 1,
          buy_price: 1,
          payout: 2,
          purchase_time: 0,
          start_time: 0,
          longcode: '',
          shortcode: '',
          transaction_id: 0,
        },
      };
    });

    await ws.buyContract({
      amount: 1,
      currency: 'USD',
      contract_type: 'PUT',
      duration: 5,
      duration_unit: 't',
      symbol: '1HZ100V',
    });

    const buyCall = calls.find((c) => 'buy' in c) as Json;
    expect(buyCall).toBeDefined();
    expect(buyCall.buy).not.toBe(1);
    expect(buyCall.buy).not.toBe('1');
    expect(buyCall.parameters).toBeUndefined();
  });

  test('price sent to buy is the proposal ask_price (max willing to pay)', async () => {
    const { ws, calls } = makeWs(async (payload) => {
      if ('proposal' in payload) {
        // Server quotes a price different from the requested amount.
        return { proposal: { id: 'pid', ask_price: '0.36', payout: '0.72' } };
      }
      return {
        buy: {
          contract_id: 5, buy_price: '0.36', payout: '0.72',
          purchase_time: 0, start_time: 0,
          longcode: '', shortcode: '', transaction_id: 0,
        },
      };
    });

    await ws.buyContract({
      amount: 0.35, // requested stake
      currency: 'USD',
      contract_type: 'CALL',
      duration: 5,
      duration_unit: 't',
      symbol: '1HZ100V',
    });

    const buyCall = calls.find((c) => 'buy' in c) as Json;
    expect(buyCall.price).toBe(0.36); // ask_price from proposal, not the original 0.35
  });

  test('subscribe:1 on buy means no separate proposal_open_contract subscribe is sent', async () => {
    const { ws, calls } = makeWs(async (payload) => {
      if ('proposal' in payload) return { proposal: { id: 'pid', ask_price: 1 } };
      return {
        buy: {
          contract_id: 7, buy_price: 1, payout: 2,
          purchase_time: 0, start_time: 0,
          longcode: '', shortcode: '', transaction_id: 0,
        },
      };
    });

    await ws.buyContract({
      amount: 1,
      currency: 'USD',
      contract_type: 'CALL',
      duration: 5,
      duration_unit: 't',
      symbol: '1HZ100V',
    });

    // Exactly two calls: proposal + buy. No extra POC subscribe.
    expect(calls).toHaveLength(2);
    expect(calls.some((c) => 'proposal_open_contract' in c)).toBe(false);
  });

  test('propagates proposal failure (e.g. invalid symbol) without sending buy', async () => {
    const { ws, calls } = makeWs(async () => {
      throw new Error('[InputValidationFailed] invalid underlying_symbol');
    });

    await expect(
      ws.buyContract({
        amount: 1,
        currency: 'USD',
        contract_type: 'CALL',
        duration: 5,
        duration_unit: 't',
        symbol: 'BOGUS',
      }),
    ).rejects.toThrow(/InputValidationFailed/);

    // Only the proposal attempt was made; no buy followed.
    expect(calls.some((c) => 'buy' in c)).toBe(false);
  });
});
