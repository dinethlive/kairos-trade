export interface Tick {
  symbol: string;
  epoch: number;
  quote: number;
  pip_size: number;
  id?: string;
}

export interface WelfordState {
  n: number;
  mean: number;
  M2: number;
}

export interface EWMAState {
  mean: number;
  variance: number;
  initialized: boolean;
}

export interface CUSUMState {
  sHigh: number;
  sLow: number;
}

export type SignalDirection = 'up' | 'down';
export type SignalStrength = 1 | 2 | 3;

export interface Signal {
  id: string;
  epoch: number;
  price: number;
  direction: SignalDirection;
  delta: number;
  strength: SignalStrength;
  threshold: number;
  isSpike: boolean;
  directionRun: number;
  suggestedDuration: number;
}

export type ConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'warming'
  | 'live'
  | 'paused'
  | 'error'
  | 'stopped';

export interface Account {
  loginId: string;
  currency: string;
  balance: number;
  isVirtual: boolean;
  email?: string;
}

export type TradeContractType = 'CALL' | 'PUT';

// In sniper mode, 'sim' trades are never placed on the account — they're
// tick-stream simulations used to decide when to promote. 'real' marks a
// promoted trade that went through the normal buy path.
export type SniperPhase = 'sim' | 'real';

export interface OpenTrade {
  contractId: number;
  type: TradeContractType;
  symbol: string;
  stake: number;
  payout: number;
  entrySpot?: number;
  currentSpot?: number;
  profit?: number;
  durationTicks: number;
  tickStream: number;
  purchasedAt: number;
  shortcode?: string;
  signalId: string;
  sniperPhase?: SniperPhase;
}

export interface ClosedTrade {
  contractId: number;
  type: TradeContractType;
  symbol: string;
  stake: number;
  payout: number;
  profit: number;
  result: 'win' | 'loss';
  durationTicks: number;
  entrySpot?: number;
  exitSpot?: number;
  closedAt: number;
  signalId: string;
  sniperPhase?: SniperPhase;
}

export type TranscriptKind =
  | 'system'
  | 'cmd'
  | 'info'
  | 'signal'
  | 'trade-open'
  | 'trade-close'
  | 'error'
  | 'warn'
  | 'status';

export interface TranscriptLine {
  id: number;
  ts: number;
  kind: TranscriptKind;
  text: string;
}

export interface SessionStats {
  trades: number;
  wins: number;
  losses: number;
  totalProfit: number;
  largestWin: number;
  largestLoss: number;
  startedAt: number;
}
