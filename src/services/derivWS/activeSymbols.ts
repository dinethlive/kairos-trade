import { toNum } from './normalize';
import type { ActiveSymbol } from './types';

export function parseActiveSymbols(list: unknown[]): ActiveSymbol[] {
  const out: ActiveSymbol[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const sym = String(r.underlying_symbol ?? r.symbol ?? '');
    if (!sym) continue;
    out.push({
      symbol: sym,
      displayName: String(r.underlying_symbol_name ?? r.display_name ?? sym),
      market: String(r.market ?? ''),
      submarket: String(r.submarket ?? ''),
      exchangeIsOpen: Number(r.exchange_is_open) === 1,
      isSuspended: Number(r.is_trading_suspended) === 1,
      pipSize: toNum(r.pip_size) ?? 0,
    });
  }
  return out;
}

// Fetch the list of active symbols via Deriv's unauthenticated public WS.
// Used by the REPL to refresh the rotation pool without minting an OTP.
export function fetchActiveSymbolsPublic(
  contractTypes: Array<'CALL' | 'PUT'> = ['CALL', 'PUT'],
  timeoutMs = 10_000,
): Promise<ActiveSymbol[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');
    const timer = setTimeout(() => {
      try { ws.close(); } catch { /* ignore */ }
      reject(new Error('active_symbols timed out'));
    }, timeoutMs);
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* ignore */ }
      fn();
    };
    ws.onopen = () => {
      ws.send(JSON.stringify({ active_symbols: 'brief', contract_type: contractTypes, req_id: 1 }));
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string) as Record<string, unknown>;
        const err = data.error as { code?: string; message?: string } | undefined;
        if (err) {
          settle(() => reject(new Error(`[${err.code ?? 'Error'}] ${err.message ?? 'active_symbols failed'}`)));
          return;
        }
        const list = data.active_symbols as unknown[] | undefined;
        if (Array.isArray(list)) {
          const parsed = parseActiveSymbols(list);
          settle(() => resolve(parsed));
        }
      } catch (err) {
        settle(() => reject(err instanceof Error ? err : new Error(String(err))));
      }
    };
    ws.onerror = () => {
      settle(() => reject(new Error('active_symbols ws error')));
    };
    ws.onclose = () => {
      if (!settled) settle(() => reject(new Error('active_symbols ws closed')));
    };
  });
}
