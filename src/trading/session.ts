import type { ClosedTrade, SessionStats } from '../types';

export function emptySession(): SessionStats {
  return {
    trades: 0,
    wins: 0,
    losses: 0,
    totalProfit: 0,
    largestWin: 0,
    largestLoss: 0,
    startedAt: Date.now(),
  };
}

export function updateSession(stats: SessionStats, trade: ClosedTrade): SessionStats {
  const wins = trade.result === 'win' ? stats.wins + 1 : stats.wins;
  const losses = trade.result === 'loss' ? stats.losses + 1 : stats.losses;
  return {
    ...stats,
    trades: stats.trades + 1,
    wins,
    losses,
    totalProfit: stats.totalProfit + trade.profit,
    largestWin: Math.max(stats.largestWin, trade.profit > 0 ? trade.profit : 0),
    largestLoss: Math.min(stats.largestLoss, trade.profit < 0 ? trade.profit : 0),
  };
}

export function winRate(stats: SessionStats): number {
  if (stats.trades === 0) return 0;
  return stats.wins / stats.trades;
}
