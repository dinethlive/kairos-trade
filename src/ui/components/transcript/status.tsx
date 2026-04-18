import React from 'react';
import { Text } from 'ink';
import { theme } from '../../theme';
import { WS_SPLIT } from './constants';

export function renderStatus(text: string): React.ReactNode {
  const parts = text.split(WS_SPLIT);
  return (
    <Text>
      {parts.map((p, i) => {
        if (/^\s+$/.test(p)) return <Text key={i}>{p}</Text>;
        if (p === 'DEMO') return <Text key={i} color={theme.warn} bold>DEMO</Text>;
        if (p === 'REAL') return <Text key={i} color={theme.upBright} bold>REAL</Text>;
        if (p === 'live' || p === 'live—' || p === 'live,') {
          return <Text key={i} color={theme.upBright} bold>{p}</Text>;
        }
        if (p === 'stopped') return <Text key={i} color={theme.dim} bold>stopped</Text>;
        if (/^\d+(\.\d+)?$/.test(p)) {
          return <Text key={i} color={theme.value} bold>{p}</Text>;
        }
        if (/^[A-Z0-9]{4,}$/.test(p) && /[A-Z]/.test(p) && /\d/.test(p)) {
          return <Text key={i} color={theme.accent} bold>{p}</Text>;
        }
        return <Text key={i} color={theme.value}>{p}</Text>;
      })}
    </Text>
  );
}
