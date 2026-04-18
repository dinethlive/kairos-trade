export interface BuyResult {
  contract_id: number;
  buy_price: number;
  payout: number;
  purchase_time: number;
  start_time: number;
  longcode: string;
  shortcode: string;
  transaction_id: number;
  balance_after?: number;
}

export interface ContractUpdate {
  contract_id: number;
  is_sold: number;
  status?: 'open' | 'won' | 'lost' | 'sold' | 'cancelled';
  profit?: number;
  payout?: number;
  buy_price?: number;
  bid_price?: number;
  entry_spot?: number;
  current_spot?: number;
  exit_tick?: number;
  tick_count?: number;
  current_spot_time?: number;
  date_expiry?: number;
  shortcode?: string;
}

export interface TickPayload {
  epoch: number;
  quote: number;
  symbol: string;
  pip_size: number;
  id?: string;
}

export interface BalancePayload {
  balance: number;
  currency: string;
  loginid?: string;
}

export interface TransactionPayload {
  action?: string;
  transaction_id?: number;
  contract_id?: number;
  amount?: number;
  balance?: number;
  symbol?: string;
  contract_type?: string;
  transaction_time?: number;
  longcode?: string;
  currency?: string;
}

export interface PortfolioContract {
  contract_id: number;
  contract_type: string;
  buy_price: number;
  payout: number;
  symbol?: string;
  longcode?: string;
  shortcode?: string;
  purchase_time?: number;
  expiry_time?: number;
}

export interface ActiveSymbol {
  symbol: string;
  displayName: string;
  market: string;
  submarket: string;
  exchangeIsOpen: boolean;
  isSuspended: boolean;
  pipSize: number;
}

export interface DerivWSOptions {
  appId: string;
  token: string;
  accountId?: string;
}
