import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme';
import { BANNER_LETTERS, LETTER_COLORS, TAGLINE, SUBTAG, VERSION } from '../../../cli/banner';
import { StatusPill } from './StatusPill';

export function Banner({
  status,
  paused,
  warming,
  ticksSeen,
}: {
  status: string;
  paused: boolean;
  warming: boolean;
  ticksSeen: number;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.accent}
      paddingX={2}
      paddingY={0}
    >
      <Box flexDirection="row" justifyContent="space-between" alignItems="flex-start">
        <Box flexDirection="column">
          {BANNER_LETTERS.map((row, r) => (
            <Text key={r} bold>
              {row.map((letter, i) => (
                <Text key={i} color={LETTER_COLORS[i]}>
                  {letter}
                </Text>
              ))}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column" alignItems="flex-end" marginLeft={2}>
          <Text color={theme.accent2} bold>
            ◆ kairos-trade
          </Text>
          <Text color={theme.dim}>v{VERSION}</Text>
          <Box marginTop={1}>
            <StatusPill status={status} paused={paused} warming={warming} ticksSeen={ticksSeen} />
          </Box>
        </Box>
      </Box>

      <Box marginTop={1} flexDirection="row" justifyContent="space-between" alignItems="flex-end">
        <Box flexDirection="column">
          <Text>
            <Text color={theme.fg} bold>
              {TAGLINE}
            </Text>
          </Text>
          <Text color={theme.dim}>{SUBTAG}</Text>
        </Box>
        <Text>
          <Text color="#FF444F" bold>
            ◆ deriv
          </Text>
          <Text color={theme.muted}>  ·  </Text>
          <Text color={theme.fg}>Partnerships</Text>
        </Text>
      </Box>
    </Box>
  );
}
