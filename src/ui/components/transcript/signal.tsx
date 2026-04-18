import React from 'react';
import { Text } from 'ink';
import { theme } from '../../theme';

const SIGNAL_RE =
  /^(↑|↓)\s+(UP|DOWN)\s+@\s+(\S+)\s+·\s+Δ=([\d.+-eE]+)\s+thr=([\d.+-eE]+)\s+·\s+str=([123])(\s+SPIKE)?\s*$/;

export function renderSignal(text: string): React.ReactNode {
  const m = SIGNAL_RE.exec(text);
  if (!m) return <Text color={theme.value}>{text}</Text>;
  const [, arrow, dir, price, delta, thr, str, spike] = m;
  const dirColor = dir === 'UP' ? theme.upBright : theme.downBright;
  const strN = Number(str);
  return (
    <Text>
      <Text color={dirColor} bold>
        {arrow} {dir}
      </Text>
      <Text color={theme.dim}>  @ </Text>
      <Text color={theme.value} bold>
        {price}
      </Text>
      <Text color={theme.dim}>   Δ </Text>
      <Text color={theme.ice}>{delta}</Text>
      <Text color={theme.dim}>   thr </Text>
      <Text color={theme.valueDim}>{thr}</Text>
      <Text>   </Text>
      <Stars n={strN} spike={Boolean(spike)} />
      {spike ? (
        <Text color={theme.gold} bold>
          {'  ⚡ SPIKE'}
        </Text>
      ) : null}
    </Text>
  );
}

function Stars({ n, spike }: { n: number; spike: boolean }) {
  const total = 3;
  const filledColor = spike ? theme.gold : n >= 3 ? theme.gold : n === 2 ? theme.warn : theme.dim;
  return (
    <Text>
      <Text color={filledColor} bold>
        {'★'.repeat(Math.max(0, Math.min(total, n)))}
      </Text>
      <Text color={theme.muted}>{'☆'.repeat(Math.max(0, total - n))}</Text>
    </Text>
  );
}
