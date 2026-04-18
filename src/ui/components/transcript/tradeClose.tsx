import React from 'react';
import { Text } from 'ink';
import { theme, fmtMoney } from '../../theme';
import { renderKeyValuePairs } from './kv';

const TRADE_CLOSE_RE =
  /^(DRY\s+)?(WIN|LOSS)\s+(CALL|PUT)\s+([+-]?[\d.]+)(\s+[A-Z]{3})?\s*(?:\((.+)\))?\s*$/;

export function renderTradeClose(text: string): React.ReactNode {
  const m = TRADE_CLOSE_RE.exec(text);
  if (!m) return <Text color={theme.value}>{text}</Text>;
  const [, dry, result, type, profit, ccy, paren] = m;
  const typeColor = type === 'CALL' ? theme.upBright : theme.downBright;
  const profitN = Number(profit);
  const profitColor = profitN >= 0 ? theme.upBright : theme.downBright;
  const profitText = fmtMoney(profitN, '').trim();
  return (
    <Text>
      {dry ? (
        <Text color={theme.warn} bold>
          DRY{' '}
        </Text>
      ) : null}
      <Text color={result === 'WIN' ? theme.upBright : theme.downBright} bold>
        {result}
      </Text>
      <Text color={theme.dim}>  </Text>
      <Text color={typeColor} bold>
        {type}
      </Text>
      <Text>   </Text>
      <Text color={profitColor} bold>
        {profitText}
      </Text>
      {ccy ? <Text color={theme.dim}>{ccy}</Text> : null}
      {paren ? (
        <Text>
          <Text color={theme.dim}>   </Text>
          {renderCloseDetail(paren)}
        </Text>
      ) : null}
    </Text>
  );
}

function renderCloseDetail(detail: string): React.ReactNode {
  const idMatch = detail.match(/^id=(\S+)$/);
  if (idMatch) {
    return (
      <Text color={theme.muted}>
        #<Text color={theme.dim}>{idMatch[1]}</Text>
      </Text>
    );
  }
  return renderKeyValuePairs(detail);
}
