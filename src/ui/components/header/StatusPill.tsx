import React from 'react';
import { Text } from 'ink';
import { theme } from '../../theme';

export function StatusPill({
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
  let color: string = theme.dim;
  let glyph = '○';
  let label: string = status;
  if (paused) {
    color = theme.warn;
    glyph = '❚❚';
    label = 'paused';
  } else {
    switch (status) {
      case 'idle':
        color = theme.dim;
        glyph = '○';
        label = 'idle · /start';
        break;
      case 'live':
        color = warming ? theme.warn : theme.ok;
        glyph = warming ? '◐' : '●';
        label = warming ? `warming ${ticksSeen}/20` : 'live';
        break;
      case 'connecting':
      case 'authorizing':
      case 'warming':
      case 'reconnecting':
        color = theme.warn;
        glyph = '◐';
        label = status;
        break;
      case 'error':
        color = theme.err;
        glyph = '✕';
        label = 'error';
        break;
      case 'stopped':
        color = theme.dim;
        glyph = '■';
        label = 'stopped';
        break;
    }
  }
  return (
    <Text color={color} bold>
      {glyph} {label}
    </Text>
  );
}
