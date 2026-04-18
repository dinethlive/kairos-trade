import React from 'react';
import { Box, Text } from 'ink';
import { COMMANDS, type Command } from '../../commands/registry';
import { theme } from '../theme';

interface Props {
  query: string;
  highlight: number;
}

const VISIBLE = 8;

export function CommandMenu({ query, highlight }: Props) {
  const matches = matchCommands(query);
  if (matches.length === 0) return null;

  const safeIdx = Math.max(0, Math.min(highlight, matches.length - 1));

  let windowStart = 0;
  if (matches.length > VISIBLE) {
    if (safeIdx < VISIBLE - 1) {
      windowStart = 0;
    } else if (safeIdx >= matches.length - 1) {
      windowStart = matches.length - VISIBLE;
    } else {
      windowStart = safeIdx - Math.floor(VISIBLE / 2) + 1;
      windowStart = Math.max(0, Math.min(windowStart, matches.length - VISIBLE));
    }
  }
  const windowEnd = Math.min(matches.length, windowStart + VISIBLE);
  const visible = matches.slice(windowStart, windowEnd);

  const hiddenAbove = windowStart;
  const hiddenBelow = matches.length - windowEnd;

  // Alignment: input row is `<Box paddingX=1> > {value}…`, so '/' sits at column 3.
  // Here we use the same paddingX=1 and one indicator char → '/' lands at column 3.
  return (
    <Box flexDirection="column" paddingX={1}>
      {hiddenAbove > 0 && (
        <Text color={theme.dim}>↑ {hiddenAbove} more…</Text>
      )}
      {visible.map((c, i) => {
        const absIdx = windowStart + i;
        const selected = absIdx === safeIdx;
        return (
          <Box key={c.name}>
            <Text color={selected ? theme.accent : theme.dim} bold={selected}>
              {selected ? '›' : ' '}
            </Text>
            <Text color={selected ? theme.accent : theme.fg} bold={selected}>
              {'/' + c.name.padEnd(14)}
            </Text>
            <Text color={theme.dim}>{c.description}</Text>
          </Box>
        );
      })}
      {hiddenBelow > 0 && (
        <Text color={theme.dim}>↓ {hiddenBelow} more…</Text>
      )}
      <Text color={theme.dim}>
        ↑↓ navigate · Tab complete · Enter run · Esc clear · {safeIdx + 1}/{matches.length}
      </Text>
    </Box>
  );
}

export function matchCommands(query: string): Command[] {
  if (!query.startsWith('/')) return [];
  if (query.includes(' ')) return [];
  const q = query.slice(1).toLowerCase();
  return COMMANDS.filter(
    (c) => c.name.startsWith(q) || c.aliases?.some((a) => a.startsWith(q)),
  );
}
