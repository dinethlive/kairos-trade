import React from 'react';
import { Text } from 'ink';
import { theme } from '../../theme';
import { renderKeyValuePairs } from './kv';

const TRADE_OPEN_RE =
  /^(DRY\s+)?(CALL|PUT)\s+(\S+)\s+(.+?)(\s+·\s+mg\s+step\s+\d+)?\s*$/;

export function renderTradeOpen(text: string): React.ReactNode {
  const m = TRADE_OPEN_RE.exec(text);
  if (!m) return <Text color={theme.value}>{text}</Text>;
  const [, dry, type, symbol, rest, mgTail] = m;
  const typeColor = type === 'CALL' ? theme.upBright : theme.downBright;
  return (
    <Text>
      {dry ? (
        <Text color={theme.warn} bold>
          DRY{' '}
        </Text>
      ) : null}
      <Text color={typeColor} bold>
        {type}
      </Text>
      <Text color={theme.dim}> on </Text>
      <Text color={theme.accent} bold>
        {symbol}
      </Text>
      <Text>  </Text>
      {renderKeyValuePairs(rest)}
      {mgTail ? renderMgTail(mgTail) : null}
    </Text>
  );
}

function renderMgTail(tail: string): React.ReactNode {
  const m = tail.match(/mg\s+step\s+(\d+)/i);
  if (!m) return <Text color={theme.violet}>{tail}</Text>;
  return (
    <Text>
      <Text color={theme.muted}>  ·  </Text>
      <Text color={theme.violet} bold>
        ⟐ step {m[1]}
      </Text>
    </Text>
  );
}
