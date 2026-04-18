import { theme } from '../../theme';
import type { TranscriptKind } from '../../../types';

export interface LabelMeta {
  label: string;
  color: string;
}

export function labelFor(kind: TranscriptKind, text: string): LabelMeta {
  switch (kind) {
    case 'cmd':
      return { label: 'CMD', color: theme.accent };
    case 'signal':
      return { label: 'SIG', color: theme.accent2 };
    case 'trade-open':
      return { label: 'BUY', color: theme.gold };
    case 'trade-close': {
      const lead = text.replace(/^DRY\s+/i, '').trim().toUpperCase();
      if (lead.startsWith('WIN')) return { label: 'WIN', color: theme.upBright };
      if (lead.startsWith('LOSS')) return { label: 'LOSS', color: theme.downBright };
      return { label: 'CLOS', color: theme.accent };
    }
    case 'error':
      return { label: 'ERR', color: theme.err };
    case 'warn':
      return { label: 'WARN', color: theme.warn };
    case 'status':
      return { label: 'STAT', color: theme.ok };
    case 'info':
      if (/^mg\b/i.test(text)) return { label: 'MG', color: theme.violet };
      return { label: 'INFO', color: theme.accent };
    case 'system':
    default:
      return { label: 'SYS', color: theme.dim };
  }
}
