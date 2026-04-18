export { DerivWS } from './derivWS/client';
export type {
  BuyResult,
  ContractUpdate,
  TickPayload,
  BalancePayload,
  TransactionPayload,
  PortfolioContract,
  ActiveSymbol,
  DerivWSOptions,
} from './derivWS/types';
export { fetchActiveSymbolsPublic } from './derivWS/activeSymbols';

import {
  toNum,
  normalizeContract,
  normalizeBuy,
  normalizeBalance,
  normalizeTick,
  normalizeTransaction,
} from './derivWS/normalize';

export const __test__ = { toNum, normalizeContract, normalizeBuy, normalizeBalance, normalizeTick, normalizeTransaction };
