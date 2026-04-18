import React from 'react';
import { Text } from 'ink';
import { theme } from '../../theme';
import type { TranscriptKind } from '../../../types';
import { renderSignal } from './signal';
import { renderTradeOpen } from './tradeOpen';
import { renderTradeClose } from './tradeClose';
import { renderMartingale } from './martingale';
import { renderStatus } from './status';

export function renderBody(kind: TranscriptKind, text: string): React.ReactNode {
  switch (kind) {
    case 'signal':
      return renderSignal(text);
    case 'trade-open':
      return renderTradeOpen(text);
    case 'trade-close':
      return renderTradeClose(text);
    case 'info':
      if (/^mg\b/i.test(text)) return renderMartingale(text);
      return <Text color={theme.value}>{text}</Text>;
    case 'status':
      return renderStatus(text);
    case 'cmd':
      return (
        <Text color={theme.value} bold>
          {text}
        </Text>
      );
    case 'warn':
      return <Text color={theme.warn}>{text}</Text>;
    case 'error':
      return (
        <Text color={theme.err} bold>
          {text}
        </Text>
      );
    case 'system':
      return <Text color={theme.dim}>{text}</Text>;
    default:
      return <Text color={theme.value}>{text}</Text>;
  }
}
