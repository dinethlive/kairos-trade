export const theme = {
  bg: 'black',
  fg: 'white',
  dim: 'gray',
  accent: 'cyan',
  accent2: 'magentaBright',
  up: 'green',
  upBright: 'greenBright',
  down: 'red',
  downBright: 'redBright',
  warn: 'yellow',
  ok: 'greenBright',
  err: 'redBright',
  muted: '#6b7280',
  border: 'gray',
  // transcript value highlights
  value: '#e5e7eb',
  valueDim: '#9ca3af',
  gold: '#f5b301',
  ice: '#7dd3fc',
  violet: '#c4b5fd',
} as const;

export function fmtMoney(n: number, currency = 'USD'): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return `— ${currency}`.trimEnd();
  const sign = n > 0 ? '+' : n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return `${sign}${abs.toFixed(2)} ${currency}`;
}

export function fmtPrice(n: number | null, digits = 3): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toFixed(digits);
}

export function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toTimeString().slice(0, 8);
}

export function fmtDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function fmtEpoch(epoch: number | null): string {
  if (!epoch) return '—';
  return fmtTime(epoch * 1000);
}
