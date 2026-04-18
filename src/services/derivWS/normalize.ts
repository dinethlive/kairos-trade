import type {
  BuyResult,
  ContractUpdate,
  TickPayload,
  BalancePayload,
  TransactionPayload,
} from './types';

export function toNum(x: unknown): number | undefined {
  if (x === null || x === undefined) return undefined;
  if (typeof x === 'number') return Number.isFinite(x) ? x : undefined;
  const n = typeof x === 'string' ? Number(x) : Number(x as never);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeContract(c: Record<string, unknown>): ContractUpdate {
  return {
    contract_id: Number(c.contract_id),
    is_sold: Number(c.is_sold) || 0,
    status: c.status as ContractUpdate['status'],
    profit: toNum(c.profit),
    payout: toNum(c.payout),
    buy_price: toNum(c.buy_price),
    bid_price: toNum(c.bid_price),
    entry_spot: toNum(c.entry_spot ?? c.entry_tick),
    current_spot: toNum(c.current_spot),
    exit_tick: toNum(c.exit_tick),
    tick_count: toNum(c.tick_count),
    current_spot_time: toNum(c.current_spot_time),
    date_expiry: toNum(c.date_expiry),
    shortcode: c.shortcode as string | undefined,
  };
}

export function normalizeBuy(b: Record<string, unknown>): BuyResult {
  return {
    contract_id: Number(b.contract_id),
    buy_price: toNum(b.buy_price) ?? 0,
    payout: toNum(b.payout) ?? 0,
    purchase_time: Number(b.purchase_time) || 0,
    start_time: Number(b.start_time) || 0,
    longcode: String(b.longcode ?? ''),
    shortcode: String(b.shortcode ?? ''),
    transaction_id: Number(b.transaction_id) || 0,
    balance_after: toNum(b.balance_after),
  };
}

export function normalizeBalance(b: Record<string, unknown>): BalancePayload {
  return {
    balance: toNum(b.balance) ?? 0,
    currency: String(b.currency ?? ''),
    loginid: b.loginid as string | undefined,
  };
}

export function normalizeTick(t: Record<string, unknown>): TickPayload {
  return {
    epoch: Number(t.epoch) || 0,
    quote: toNum(t.quote) ?? 0,
    symbol: String(t.symbol ?? ''),
    pip_size: toNum(t.pip_size) ?? 0,
    id: t.id as string | undefined,
  };
}

export function normalizeTransaction(t: Record<string, unknown>): TransactionPayload {
  const sym =
    typeof t.symbol === 'string'
      ? (t.symbol as string)
      : typeof t.underlying_symbol === 'string'
        ? (t.underlying_symbol as string)
        : undefined;
  return {
    action: typeof t.action === 'string' ? (t.action as string) : undefined,
    transaction_id: toNum(t.transaction_id),
    contract_id: toNum(t.contract_id),
    amount: toNum(t.amount),
    balance: toNum(t.balance),
    symbol: sym,
    contract_type: typeof t.contract_type === 'string' ? (t.contract_type as string) : undefined,
    transaction_time: toNum(t.transaction_time),
    longcode: typeof t.longcode === 'string' ? (t.longcode as string) : undefined,
    currency: typeof t.currency === 'string' ? (t.currency as string) : undefined,
  };
}
