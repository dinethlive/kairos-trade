import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme';
import { Metric, Gauge } from './primitives';

export function MartingaleCard(props: {
  mode: string;
  multiplier: number;
  maxSteps: number;
  armAfterLosses: number;
  maxStake: number | null | undefined;
  stopLoss: number | null | undefined;
  takeProfit: number | null | undefined;
  armed: boolean;
  step: number;
  consecLosses: number;
  nextStake: number;
  currency: string;
}) {
  const {
    mode,
    multiplier,
    maxSteps,
    armAfterLosses,
    maxStake,
    stopLoss,
    takeProfit,
    armed,
    step,
    consecLosses,
    nextStake,
    currency,
  } = props;
  const accent = armed ? theme.warn : theme.muted;
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={accent}
      paddingX={1}
      flexGrow={1}
      flexBasis={0}
    >
      <Box>
        <Text color={accent} bold>
          ⟐ MARTINGALE
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="row">
        <Box flexDirection="column" flexGrow={1} flexBasis={0}>
          <Metric label="Mode">
            <Text color={theme.accent2} bold>
              {mode.toUpperCase()}
            </Text>
            <Text color={theme.dim}> ×{multiplier}</Text>
          </Metric>
          <Metric label="State">
            {armed ? (
              <>
                <Gauge filled={step} total={maxSteps} color={theme.warn} />
                <Text color={theme.warn} bold>
                  {' '}
                  ARMED
                </Text>
                <Text color={theme.dim}>
                  {' · step '}
                  {step}/{maxSteps}
                </Text>
              </>
            ) : (
              <>
                <Gauge filled={consecLosses} total={armAfterLosses} color={theme.dim} />
                <Text color={theme.dim}>
                  {' dormant · '}
                  {consecLosses}/{armAfterLosses}
                </Text>
              </>
            )}
          </Metric>
          <Metric label="Next Stake">
            <Text color={theme.fg} bold>
              {nextStake.toFixed(2)}
            </Text>
            {currency && <Text color={theme.dim}> {currency}</Text>}
          </Metric>
        </Box>
        <Box flexDirection="column" flexGrow={1} flexBasis={0}>
          <Metric label="Stake Cap">
            {maxStake != null ? (
              <Text color={theme.fg}>{maxStake.toFixed(2)}</Text>
            ) : (
              <Text color={theme.muted}>—</Text>
            )}
          </Metric>
          <Metric label="Stop Loss">
            {stopLoss != null ? (
              <Text color={theme.down} bold>
                −{stopLoss}
              </Text>
            ) : (
              <Text color={theme.muted}>—</Text>
            )}
          </Metric>
          <Metric label="Take Profit">
            {takeProfit != null ? (
              <Text color={theme.up} bold>
                +{takeProfit}
              </Text>
            ) : (
              <Text color={theme.muted}>—</Text>
            )}
          </Metric>
        </Box>
      </Box>
    </Box>
  );
}
