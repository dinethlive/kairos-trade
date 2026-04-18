import React from 'react';
import { Text } from 'ink';
import { theme } from '../../theme';
import { WS_SPLIT } from './constants';

export function renderMartingale(text: string): React.ReactNode {
  const body = text.replace(/^mg\s*/i, '');
  const parts = body.split(WS_SPLIT);
  return (
    <Text>
      {parts.map((p, i) => {
        if (/^\s+$/.test(p)) return <Text key={i}>{p}</Text>;
        if (p === '·') return <Text key={i} color={theme.muted}>·</Text>;
        if (/^[+-]?\d+(\.\d+)?$/.test(p)) {
          const n = Number(p);
          const color = p.startsWith('+') ? theme.upBright : p.startsWith('-') ? theme.downBright : theme.gold;
          return (
            <Text key={i} color={color} bold>
              {p}
            </Text>
          );
        }
        if (/^\d+\/\d+$/.test(p)) {
          return (
            <Text key={i} color={theme.gold} bold>
              {p}
            </Text>
          );
        }
        if (/^(armed|recovered)$/i.test(p)) {
          return (
            <Text key={i} color={theme.warn} bold>
              {p}
            </Text>
          );
        }
        if (/^(dormant|reset)$/i.test(p)) {
          return (
            <Text key={i} color={theme.dim}>
              {p}
            </Text>
          );
        }
        return <Text key={i} color={theme.value}>{p}</Text>;
      })}
    </Text>
  );
}
