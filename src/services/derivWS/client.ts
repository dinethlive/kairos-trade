import {
  PING_INTERVAL_MS,
  SESSION_ROLLOVER_MS,
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  RECONNECT_MAX_ATTEMPTS,
} from '../../constants/api';
import {
  listAccounts,
  getOtpUrl,
  pickDefaultAccount,
  type DerivAccount,
} from '../derivRest';
import {
  toNum,
  normalizeBalance,
  normalizeContract,
  normalizeTick,
  normalizeTransaction,
  normalizeBuy,
} from './normalize';
import { parseActiveSymbols } from './activeSymbols';
import type {
  ActiveSymbol,
  BalancePayload,
  BuyResult,
  ContractUpdate,
  DerivWSOptions,
  PortfolioContract,
  TickPayload,
  TransactionPayload,
} from './types';

type Json = Record<string, unknown>;

interface PendingRequest {
  resolve: (data: Json) => void;
  reject: (err: Error) => void;
}

type EventMap = {
  tick: (t: TickPayload) => void;
  balance: (b: BalancePayload) => void;
  contract: (c: ContractUpdate) => void;
  transaction: (tx: TransactionPayload) => void;
  status: (s: 'connecting' | 'open' | 'reconnecting' | 'closed' | 'error') => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  // Fired after a successful rollover or reactive reconnect — listeners must
  // re-issue any subscriptions (ticks, balance, proposal_open_contract) since
  // the new socket has none. Open-contract ids the caller still cares about
  // are passed via the Trader's own bookkeeping, not here.
  reconnect: () => void;
};

export class DerivWS {
  private ws: WebSocket | null = null;
  private reqId = 0;
  private pending = new Map<number, PendingRequest>();
  private listeners: { [K in keyof EventMap]: Set<EventMap[K]> } = {
    tick: new Set(),
    balance: new Set(),
    contract: new Set(),
    transaction: new Set(),
    status: new Set(),
    error: new Set(),
    info: new Set(),
    reconnect: new Set(),
  };
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private rolloverTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private reconnecting = false;
  private reconnectAttempts = 0;
  private selectedAccount: DerivAccount | null = null;

  constructor(private opts: DerivWSOptions) {}

  getAccount(): DerivAccount | null {
    return this.selectedAccount;
  }

  on<K extends keyof EventMap>(event: K, handler: EventMap[K]): () => void {
    this.listeners[event].add(handler as never);
    return () => this.listeners[event].delete(handler as never);
  }

  private emit<K extends keyof EventMap>(event: K, ...args: Parameters<EventMap[K]>): void {
    for (const h of this.listeners[event]) {
      (h as (...a: unknown[]) => void)(...args);
    }
  }

  async connect(): Promise<DerivAccount> {
    this.intentionalClose = false;
    this.reconnectAttempts = 0;
    this.emit('status', 'connecting');

    const accounts = await listAccounts(this.opts.appId, this.opts.token);
    if (accounts.length === 0) {
      throw new Error('no accounts returned for this token');
    }

    let account: DerivAccount | null;
    if (this.opts.accountId) {
      account = accounts.find((a) => a.account_id === this.opts.accountId) ?? null;
      if (!account) {
        throw new Error(
          `account ${this.opts.accountId} not found — available: ${accounts.map((a) => a.account_id).join(', ')}`,
        );
      }
    } else {
      account = pickDefaultAccount(accounts);
      if (!account) throw new Error('no active account found');
    }

    this.selectedAccount = account;
    const wsUrl = await getOtpUrl(this.opts.appId, this.opts.token, account.account_id);
    this.ws = await this.openSocket(wsUrl);
    this.startPing();
    this.scheduleRollover();
    this.emit('status', 'open');
    return account;
  }

  // Open one WebSocket and settle on the first open/error/close. Post-open
  // events (unexpected close) are routed to handleClose so the lifecycle logic
  // (reactive reconnect) lives in one place and can't re-reject this promise.
  private openSocket(url: string): Promise<WebSocket> {
    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(url);
      let settled = false;

      ws.onopen = () => {
        if (!settled) {
          settled = true;
          resolve(ws);
        }
      };
      ws.onmessage = (ev) => {
        try {
          this.handleMessage(JSON.parse(ev.data as string));
        } catch {
          /* ignore */
        }
      };
      ws.onerror = (ev) => {
        const detail =
          (ev as unknown as { message?: string }).message ??
          (ev as unknown as { error?: { message?: string } }).error?.message ??
          '';
        if (!settled) {
          settled = true;
          reject(new Error(`ws error during open${detail ? ': ' + detail : ''}`));
          return;
        }
        // Post-open errors are informational — a close event will follow.
        if (detail) this.emit('error', `ws error: ${detail}`);
      };
      ws.onclose = (ev) => {
        const code = (ev as CloseEvent).code ?? null;
        const reason = (ev as CloseEvent).reason ?? '';
        if (!settled) {
          settled = true;
          const detail = [
            code !== null ? `code=${code}` : null,
            reason ? `reason="${reason}"` : null,
          ]
            .filter(Boolean)
            .join(' ');
          reject(new Error(`WebSocket connection failed${detail ? ' (' + detail + ')' : ''}`));
          return;
        }
        this.handleClose(ws, code, reason);
      };
    });
  }

  // Only act when the just-closed socket is still the current one. During a
  // rollover we swap this.ws to the new socket *before* closing the old, so
  // the old socket's close event arrives with `ws !== this.ws` and is ignored.
  private handleClose(ws: WebSocket, code: number | null, reason: string): void {
    if (ws !== this.ws) return;
    this.stopPing();
    this.clearRolloverTimer();
    if (this.intentionalClose) {
      this.emit('status', 'closed');
      return;
    }
    const detail = code !== null ? `code=${code}${reason ? ' ' + reason : ''}` : 'unexpected close';
    this.emit('info', `connection lost (${detail}) — reconnecting…`);
    this.scheduleReactiveReconnect();
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.stopPing();
    this.clearRolloverTimer();
    this.clearReconnectTimer();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        /* noop */
      }
      this.ws = null;
    }
    for (const p of this.pending.values()) {
      p.reject(new Error('WebSocket closed'));
    }
    this.pending.clear();
  }

  // ─── Reconnect lifecycle ───────────────────────────────────────────
  //
  // Two paths share the rebind plumbing:
  //   • rollover — proactive, on a timer, before Deriv's ~1h session cap.
  //   • reactive — on unexpected close, exponential backoff.
  // Both end by pointing this.ws at a freshly-authed socket, restarting the
  // ping, re-arming the rollover timer, and emitting 'reconnect' so the
  // Trader re-issues its subscriptions.

  private scheduleRollover(): void {
    this.clearRolloverTimer();
    this.rolloverTimer = setTimeout(() => {
      void this.performRollover();
    }, SESSION_ROLLOVER_MS);
  }

  private clearRolloverTimer(): void {
    if (this.rolloverTimer) {
      clearTimeout(this.rolloverTimer);
      this.rolloverTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async performRollover(): Promise<void> {
    if (this.intentionalClose || this.reconnecting) return;
    if (!this.selectedAccount) return;
    this.reconnecting = true;
    this.emit('status', 'reconnecting');
    this.emit('info', 'session rollover — refreshing OTP');
    const oldWs = this.ws;
    try {
      const wsUrl = await getOtpUrl(
        this.opts.appId,
        this.opts.token,
        this.selectedAccount.account_id,
      );
      if (this.intentionalClose) return;
      const newWs = await this.openSocket(wsUrl);
      if (this.intentionalClose) {
        try { newWs.close(); } catch { /* noop */ }
        return;
      }
      // Swap *first* so the old socket's impending close is ignored by handleClose.
      this.ws = newWs;
      this.stopPing();
      this.startPing();
      this.reconnectAttempts = 0;
      this.rejectPending('session rolled over');
      if (oldWs) {
        try {
          oldWs.close();
        } catch {
          /* noop */
        }
      }
      this.scheduleRollover();
      this.emit('status', 'open');
      this.emit('info', 'session rollover complete');
      this.emit('reconnect');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.emit('error', `rollover failed: ${msg}`);
      // Fall through to reactive path — the old socket may still be healthy,
      // but if it isn't, reactive reconnect will take over on its close.
      if (!oldWs || oldWs.readyState !== 1) {
        this.scheduleReactiveReconnect();
      } else {
        // Old socket still open: try again sooner than SESSION_ROLLOVER_MS.
        this.clearRolloverTimer();
        this.rolloverTimer = setTimeout(() => {
          void this.performRollover();
        }, RECONNECT_MAX_MS);
      }
    } finally {
      this.reconnecting = false;
    }
  }

  private scheduleReactiveReconnect(): void {
    if (this.intentionalClose) return;
    this.clearReconnectTimer();
    if (this.reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      this.emit('error', `reconnect gave up after ${RECONNECT_MAX_ATTEMPTS} attempts`);
      this.emit('status', 'closed');
      return;
    }
    const attempt = this.reconnectAttempts++;
    const delay = Math.min(RECONNECT_BASE_MS * Math.pow(2, attempt), RECONNECT_MAX_MS);
    this.emit('status', 'reconnecting');
    this.emit('info', `reconnect attempt ${attempt + 1}/${RECONNECT_MAX_ATTEMPTS} in ${Math.round(delay / 100) / 10}s`);
    this.reconnectTimer = setTimeout(() => {
      void this.attemptReactiveReconnect();
    }, delay);
  }

  private async attemptReactiveReconnect(): Promise<void> {
    if (this.intentionalClose || this.reconnecting) return;
    if (!this.selectedAccount) {
      this.emit('error', 'cannot reconnect: no selected account');
      this.emit('status', 'closed');
      return;
    }
    this.reconnecting = true;
    try {
      const wsUrl = await getOtpUrl(
        this.opts.appId,
        this.opts.token,
        this.selectedAccount.account_id,
      );
      if (this.intentionalClose) return;
      const newWs = await this.openSocket(wsUrl);
      if (this.intentionalClose) {
        try { newWs.close(); } catch { /* noop */ }
        return;
      }
      this.ws = newWs;
      this.startPing();
      this.reconnectAttempts = 0;
      this.rejectPending('reconnected');
      this.scheduleRollover();
      this.emit('status', 'open');
      this.emit('info', 'reconnected');
      this.emit('reconnect');
    } catch (err) {
      if (this.intentionalClose) return;
      const msg = err instanceof Error ? err.message : String(err);
      this.emit('error', `reconnect failed: ${msg}`);
      this.scheduleReactiveReconnect();
    } finally {
      this.reconnecting = false;
    }
  }

  private rejectPending(reason: string): void {
    for (const p of this.pending.values()) {
      p.reject(new Error(reason));
    }
    this.pending.clear();
  }

  private startPing(): void {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      this.raw({ ping: 1 });
    }, PING_INTERVAL_MS);
  }

  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private raw(payload: Json): void {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  send(payload: Json): Promise<Json> {
    const req_id = ++this.reqId;
    return new Promise<Json>((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== 1) {
        reject(new Error('WebSocket not open'));
        return;
      }
      this.pending.set(req_id, { resolve, reject });
      this.ws.send(JSON.stringify({ ...payload, req_id }));
    });
  }

  private handleMessage(data: Json): void {
    const reqId = data.req_id as number | undefined;
    const msgType = data.msg_type as string | undefined;
    const err = data.error as { code?: string; message?: string } | undefined;

    if (reqId && this.pending.has(reqId)) {
      const pend = this.pending.get(reqId)!;
      if (err) {
        pend.reject(new Error(`[${err.code ?? 'Error'}] ${err.message ?? 'Unknown error'}`));
        this.pending.delete(reqId);
        return;
      }
      pend.resolve(data);
      this.pending.delete(reqId);
    }

    if (err && !reqId) {
      this.emit('error', `${err.code ?? 'Error'}: ${err.message ?? 'Unknown'}`);
    }

    switch (msgType) {
      case 'tick': {
        const raw = data.tick as Record<string, unknown> | undefined;
        if (raw) this.emit('tick', normalizeTick(raw));
        break;
      }
      case 'balance': {
        const raw = data.balance as Record<string, unknown> | undefined;
        if (raw) this.emit('balance', normalizeBalance(raw));
        break;
      }
      case 'proposal_open_contract': {
        const raw = data.proposal_open_contract as Record<string, unknown> | undefined;
        if (raw) this.emit('contract', normalizeContract(raw));
        break;
      }
      case 'transaction': {
        const raw = data.transaction as Record<string, unknown> | undefined;
        if (raw) this.emit('transaction', normalizeTransaction(raw));
        break;
      }
      default:
        break;
    }
  }

  // ─── High-level helpers ────────────────────────────────────────────

  async getBalance(): Promise<BalancePayload> {
    const res = await this.send({ balance: 1 });
    return normalizeBalance((res.balance ?? {}) as Record<string, unknown>);
  }

  async subscribeBalance(): Promise<void> {
    await this.send({ balance: 1, subscribe: 1 });
  }

  // Real-time notifications of every buy/sell/deposit/withdrawal/adjustment on
  // the authorized account. Used for observability (user sees external activity
  // in the transcript) and as a defensive trigger: an unknown buy during a
  // healthy session fires a portfolio reconcile. Not a primary phantom catcher
  // — phantoms from a dropped socket lose this notification too.
  async subscribeTransactions(): Promise<void> {
    await this.send({ transaction: 1, subscribe: 1 });
  }

  async getTicksHistory(symbol: string, count: number): Promise<number[]> {
    const res = await this.send({
      ticks_history: symbol,
      end: 'latest',
      count,
      style: 'ticks',
    });
    const history = res.history as { prices?: unknown[] } | undefined;
    const prices = history?.prices ?? [];
    return prices.map((p) => toNum(p) ?? NaN).filter((n) => Number.isFinite(n));
  }

  async subscribeTicks(symbol: string): Promise<void> {
    await this.send({ ticks: symbol, subscribe: 1 });
  }

  async getProposal(params: {
    amount: number;
    currency: string;
    contract_type: 'CALL' | 'PUT';
    duration: number;
    duration_unit: 't' | 's' | 'm' | 'h' | 'd';
    symbol: string;
    basis?: 'stake' | 'payout';
  }): Promise<{ id: string; ask_price: number; payout: number; spot: number }> {
    const res = await this.send({
      proposal: 1,
      amount: params.amount,
      basis: params.basis ?? 'stake',
      contract_type: params.contract_type,
      currency: params.currency,
      duration: params.duration,
      duration_unit: params.duration_unit,
      underlying_symbol: params.symbol,
    });
    const p = (res.proposal ?? {}) as Record<string, unknown>;
    const id = typeof p.id === 'string' ? p.id : '';
    if (!id) throw new Error('proposal: missing id in response');
    return {
      id,
      ask_price: toNum(p.ask_price) ?? 0,
      payout: toNum(p.payout) ?? 0,
      spot: toNum(p.spot) ?? 0,
    };
  }

  async buyContract(params: {
    amount: number;
    currency: string;
    contract_type: 'CALL' | 'PUT';
    duration: number;
    duration_unit: 't' | 's' | 'm' | 'h' | 'd';
    symbol: string;
    basis?: 'stake' | 'payout';
  }): Promise<BuyResult> {
    const proposal = await this.getProposal(params);
    const res = await this.send({
      buy: proposal.id,
      price: proposal.ask_price,
      subscribe: 1,
    });
    return normalizeBuy((res.buy ?? {}) as Record<string, unknown>);
  }

  async forgetAll(streams: Array<'ticks' | 'balance' | 'proposal_open_contract'>): Promise<void> {
    await this.send({ forget_all: streams });
  }

  // Re-attach to an in-flight contract's status stream. Used after a reconnect
  // to resume the proposal_open_contract updates that were implicitly torn
  // down with the previous socket.
  async subscribeOpenContract(contractId: number): Promise<void> {
    await this.send({ proposal_open_contract: 1, contract_id: contractId, subscribe: 1 });
  }

  // Snapshot of all currently-open contracts on the authorized account. Used on
  // /start to record the set of pre-existing contracts we should ignore, and on
  // reconnect to detect phantom contracts (a buyContract whose pending Promise
  // was rejected by rollover/reconnect but which the server actually executed).
  async getPortfolio(): Promise<PortfolioContract[]> {
    const res = await this.send({ portfolio: 1 });
    const portfolio = res.portfolio as { contracts?: unknown[] } | undefined;
    const list = portfolio?.contracts;
    if (!Array.isArray(list)) return [];
    const out: PortfolioContract[] = [];
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const c = raw as Record<string, unknown>;
      const id = Number(c.contract_id);
      if (!Number.isFinite(id) || id <= 0) continue;
      out.push({
        contract_id: id,
        contract_type: String(c.contract_type ?? ''),
        buy_price: toNum(c.buy_price) ?? 0,
        payout: toNum(c.payout) ?? 0,
        symbol:
          typeof c.symbol === 'string'
            ? c.symbol
            : typeof c.underlying_symbol === 'string'
              ? (c.underlying_symbol as string)
              : undefined,
        longcode: typeof c.longcode === 'string' ? (c.longcode as string) : undefined,
        shortcode: typeof c.shortcode === 'string' ? (c.shortcode as string) : undefined,
        purchase_time: toNum(c.purchase_time),
        expiry_time: toNum(c.expiry_time),
      });
    }
    return out;
  }

  async getActiveSymbols(
    contractTypes: Array<'CALL' | 'PUT'> = ['CALL', 'PUT'],
  ): Promise<ActiveSymbol[]> {
    const res = await this.send({
      active_symbols: 'brief',
      contract_type: contractTypes,
    });
    const list = res.active_symbols as unknown[] | undefined;
    if (!Array.isArray(list)) return [];
    return parseActiveSymbols(list);
  }
}
