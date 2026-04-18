import React from 'react';
import { Text } from 'ink';
import { theme } from '../../theme';
import { Card, Metric } from './primitives';
import type { RotationConfig, FuzzDurationConfig } from '../../../trading/config';

export function MarketCard({
  displaySymbol,
  rotation,
  fuzz,
  dryRun,
  duration,
  stake,
  currency,
}: {
  displaySymbol: string;
  rotation: RotationConfig;
  fuzz: FuzzDurationConfig;
  dryRun: boolean;
  duration: number;
  stake: number;
  currency: string;
}) {
  return (
    <Card title="MARKET" icon="◈" accent={theme.accent}>
      <Metric label="Symbol">
        <Text color={theme.accent} bold>
          {displaySymbol}
        </Text>
        {rotation.enabled && (
          <Text color={theme.accent2}>
            {`  ⟳ ${rotation.pool.length}`}
          </Text>
        )}
      </Metric>
      <Metric label="Mode">
        {dryRun ? (
          <Text color={theme.warn} bold>
            ◆ DRY RUN
          </Text>
        ) : (
          <Text color={theme.ok} bold>
            ● LIVE
          </Text>
        )}
      </Metric>
      <Metric label="Duration">
        {fuzz.enabled ? (
          <>
            <Text color={theme.accent2} bold>
              {fuzz.minTicks}..{fuzz.maxTicks}
            </Text>
            <Text color={theme.dim}> ticks · fuzz</Text>
          </>
        ) : (
          <>
            <Text color={theme.fg} bold>
              {duration}
            </Text>
            <Text color={theme.dim}> ticks</Text>
          </>
        )}
      </Metric>
      <Metric label="Stake">
        <Text color={theme.fg} bold>
          {stake.toFixed(2)}
        </Text>
        {currency && <Text color={theme.dim}> {currency}</Text>}
      </Metric>
    </Card>
  );
}
