import React from 'react';
import { Text } from 'ink';
import { theme, fmtMoney } from '../../theme';
import { Card, Metric, WinRateBar } from './primitives';
import { winRate } from '../../../trading/session';
import type { SessionStats, Account } from '../../../types';

export function SessionCard({
  account,
  session,
}: {
  account: Account | null;
  session: SessionStats;
}) {
  const pnl = fmtMoney(session.totalProfit, account?.currency ?? '');
  const wrPct = session.trades === 0 ? 0 : winRate(session);
  const wrLabel = session.trades === 0 ? '—' : `${(wrPct * 100).toFixed(0)}%`;
  const profitUp = session.totalProfit >= 0;
  const sessionAccent = session.trades === 0 ? theme.dim : profitUp ? theme.up : theme.down;
  const icon = session.trades === 0 ? '○' : profitUp ? '▲' : '▼';
  return (
    <Card title="SESSION" icon={icon} accent={sessionAccent}>
      <Metric label="Account">
        {account ? (
          <Text color={account.isVirtual ? theme.warn : theme.ok} bold>
            {account.isVirtual ? 'DEMO' : 'REAL'}
          </Text>
        ) : (
          <Text color={theme.dim}>—</Text>
        )}
      </Metric>
      <Metric label="Balance">
        {account ? (
          <>
            <Text color={theme.ok} bold>
              {account.balance.toFixed(2)}
            </Text>
            <Text color={theme.dim}> {account.currency}</Text>
          </>
        ) : (
          <Text color={theme.dim}>—</Text>
        )}
      </Metric>
      <Metric label="Profit">
        <Text color={profitUp ? theme.up : theme.down} bold>
          {pnl}
        </Text>
      </Metric>
      <Metric label="Win Rate">
        <WinRateBar pct={wrPct} hasTrades={session.trades > 0} />
        <Text color={theme.accent} bold>
          {' '}
          {wrLabel}
        </Text>
        <Text color={theme.dim}> · {session.trades} tr</Text>
      </Metric>
    </Card>
  );
}
