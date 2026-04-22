import { DerivWS, type ContractUpdate, type TickPayload, type TransactionPayload } from '../services/derivWS';
import { RotationScheduler, pickFuzzDuration } from '../engine/rotation';
import { SENSITIVITY_LEVELS } from '../constants/sensitivity';
import { useStore } from '../state/store';
import type { ClosedTrade, SniperPhase } from '../types';
import type { TraderConfig } from './config';
import { EngineStates, type EngineState } from './engineStates';
import { MartingaleController } from './martingale';
import { TradeExecutor } from './placeTrade';
import { Reconciler } from './reconciler';

export type {
  MartingaleMode,
  MartingaleOnCap,
  MartingaleConfig,
  RotationConfig,
  FuzzDurationConfig,
  SniperConfig,
  TraderConfig,
} from './config';

function samePool(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export class Trader {
  private ws: DerivWS;
  private engines: EngineStates;
  private activeState: EngineState;
  private currency = 'USD';
  private openContractIds = new Set<number>();
  private stopped = false;
  private started = false;
  private rotation: RotationScheduler;
  private currentSymbol: string;
  private rotationInFlight = false;

  private reconnecting = false;
  // Count of placeTrade() calls dispatched but not yet registered in
  // openContractIds (the buy is still mid-flight: proposal + buy ≈ 100-500ms).
  // Without this, a second signal on the next tick passes the maxConcurrent
  // gate because the first trade's contract_id hasn't landed yet, and we'd
  // place two concurrent trades when maxConcurrent=1.
  private pendingPlacements = 0;
  // Dry-run resolve timers. Tracked so /stop can cancel them — otherwise the
  // timer fires after stop and writes spurious trade-close events into the
  // store (and bumps martingale state for a trade nobody's running).
  private dryRunTimers = new Set<ReturnType<typeof setTimeout>>();
  // Sniper sim timers. Cancelled on /stop for the same reason as dryRunTimers —
  // a post-stop resolve would corrupt the sniper streak counter.
  private simTimers = new Set<ReturnType<typeof setTimeout>>();
  // Sniper streak counter. Increments on each sim loss; resets on sim win or
  // after a real-promotion closes. When consecLosses >= lossThreshold at
  // signal time, the next signal is promoted to a real buy.
  private sniperConsecLosses = 0;
  // Contracts already open on the account when /start ran. Anything in this
  // set is someone else's (web UI, prior session) and must never be adopted
  // into our bookkeeping during a reconnect reconcile.
  private preExistingContractIds = new Set<number>();

  private mg: MartingaleController;
  private executor: TradeExecutor;
  private reconciler: Reconciler;

  constructor(private config: TraderConfig) {
    this.ws = new DerivWS({
      appId: config.appId,
      token: config.token,
      accountId: config.accountId ?? undefined,
    });
    this.currentSymbol = config.symbol;
    this.rotation = new RotationScheduler(config.rotation.pool);
    this.engines = new EngineStates({
      getTicksHistory: (symbol, count) => this.ws.getTicksHistory(symbol, count),
    });
    const initial = this.engines.ensureState(config.symbol);
    this.activeState = initial;

    this.mg = new MartingaleController({
      getConfig: () => this.config,
      onStop: () => {
        void this.stop();
      },
    });
    this.executor = new TradeExecutor({
      ws: this.ws,
      mg: this.mg,
      getConfig: () => this.config,
      getCurrency: () => this.currency,
      getCurrentSymbol: () => this.currentSymbol,
      isDryRun: () => this.config.dryRun,
      isStopped: () => this.stopped,
      openContractIds: this.openContractIds,
      dryRunTimers: this.dryRunTimers,
      simTimers: this.simTimers,
      decrementPending: () => {
        this.pendingPlacements--;
      },
      setError: (msg) => useStore.getState().setError(msg),
      scheduleRotation: (reason) => this.scheduleRotation(reason),
      onSniperResolved: (phase, won) => this.onSniperResolved(phase, won),
    });
    this.reconciler = new Reconciler({
      ws: this.ws,
      isStopped: () => this.stopped,
      getCurrentSymbol: () => this.currentSymbol,
      openContractIds: this.openContractIds,
      preExistingContractIds: this.preExistingContractIds,
      setReconnecting: (v) => {
        this.reconnecting = v;
      },
    });

    this.mg.pushRuntime();
    this.pushSniperRuntime();
  }

  updateConfig(next: TraderConfig): void {
    const prev = this.config;
    this.config = next;
    if (!samePool(prev.rotation.pool, next.rotation.pool)) {
      this.rotation.setPool(next.rotation.pool);
      // Background-warm any newly added pool members so a future rotation can
      // swap instantly. Removed symbols are kept in the engines map until stop
      // (their state is cheap and might be re-added).
      if (this.started && !this.stopped) {
        const added = next.rotation.pool.filter((s) => !this.engines.has(s));
        if (added.length > 0) {
          void this.engines.warmPool(added).then(({ ok }) => {
            if (ok.length > 0) {
              useStore
                .getState()
                .append('info', `background-warmed ${ok.length}: ${ok.join(', ')}`);
            }
          });
        }
      }
    }
    if (prev.rotation.enabled && !next.rotation.enabled) {
      this.rotation.reset();
    }
    // Sniper toggled off → clear the streak so a re-enable starts fresh.
    if (prev.sniper.enabled && !next.sniper.enabled) {
      this.sniperConsecLosses = 0;
    }
    this.mg.pushRuntime();
    this.pushSniperRuntime();
  }

  resetMartingaleRuntime(): void {
    this.mg.reset();
  }

  async start(): Promise<void> {
    if (this.started) throw new Error('trader already started');
    this.started = true;

    const store = useStore.getState();

    this.ws.on('status', (s) => {
      if (this.stopped) return;
      if (s === 'connecting') store.setStatus('connecting');
      else if (s === 'reconnecting') {
        this.reconnecting = true;
        store.setStatus('connecting');
      } else if (s === 'error') store.setStatus('error');
      else if (s === 'closed' && !this.stopped) {
        // Terminal close (user disconnect or reconnect gave up).
        this.stopped = true;
        store.setStatus('stopped');
      }
    });

    this.ws.on('error', (msg) => {
      store.setError(msg);
      useStore.getState().append('error', msg);
    });

    this.ws.on('info', (msg) => {
      useStore.getState().append('status', msg);
    });

    this.ws.on('reconnect', () => {
      if (this.stopped) return;
      void this.reconciler.resubscribeAfterReconnect();
    });

    this.ws.on('tick', (t) => this.onTick(t));
    this.ws.on('balance', (b) => store.updateBalance(b.balance, b.currency));
    this.ws.on('contract', (c) => this.onContract(c));
    this.ws.on('transaction', (tx) => this.onTransaction(tx));

    store.setStatus('connecting');
    useStore.getState().append('status', 'fetching account & OTP…');
    const account = await this.ws.connect();
    this.currency = account.currency;
    store.setAccount({
      loginId: account.account_id,
      currency: account.currency,
      balance: account.balance,
      isVirtual: account.account_type === 'demo',
      email: account.email,
    });
    useStore
      .getState()
      .append(
        'status',
        `connected ${account.account_type === 'demo' ? 'DEMO' : 'REAL'} ${account.account_id} · bal ${account.balance.toFixed(2)} ${account.currency}`,
      );

    await this.ws.subscribeBalance();

    // Order is load-bearing: the preExistingContractIds set must be populated
    // before subscribeTransactions opens the stream, otherwise an early buy
    // notification would see an empty set, miss that the contract is external,
    // and trigger a reconcile that adopts somebody else's trade.
    try {
      const existing = await this.ws.getPortfolio();
      for (const c of existing) this.preExistingContractIds.add(c.contract_id);
      if (existing.length > 0) {
        useStore.getState().append(
          'info',
          `ignoring ${existing.length} pre-existing contract${existing.length === 1 ? '' : 's'} on account`,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useStore.getState().append('warn', `portfolio snapshot failed: ${msg}`);
    }

    try {
      await this.ws.subscribeTransactions();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useStore.getState().append('warn', `transaction stream unavailable: ${msg}`);
    }

    // Sniper mode owns the symbol — rotation is a no-op while it's on because
    // the sim streak has to stay on a single market for the signal to mean
    // anything. If the user has both toggled on, we honor sniper and log it.
    const rotationOn =
      !this.config.sniper.enabled &&
      this.config.rotation.enabled &&
      this.config.rotation.pool.length > 0;
    if (this.config.sniper.enabled && this.config.rotation.enabled) {
      useStore
        .getState()
        .append('warn', 'sniper mode is on — ignoring rotation');
    }

    // Decide which symbols to warm. With rotation, warm the entire pool in
    // parallel so later rotations are zero-latency swaps. Otherwise just the
    // single configured symbol.
    const symbolsToWarm = rotationOn
      ? [...this.config.rotation.pool]
      : [this.config.symbol];

    store.setStatus('warming');
    if (rotationOn) {
      useStore.getState().append(
        'status',
        `warming ${symbolsToWarm.length} symbols in parallel…`,
      );
    } else {
      useStore.getState().append('status', `warming on ${this.config.symbol}…`);
    }

    const warmStart = Date.now();
    const { ok, failed } = await this.engines.warmPool(symbolsToWarm);
    const warmMs = Date.now() - warmStart;

    if (ok.length === 0) {
      throw new Error(
        `warm-up failed for every symbol (${failed.length}). try /pool refresh or /symbol <sym>`,
      );
    }

    if (rotationOn && failed.length > 0) {
      // Shrink the rotation to the pool we could actually warm.
      this.rotation.setPool(ok);
    }

    // Pick the starting symbol: with rotation, first from the shuffled queue
    // (restricted to successfully-warmed symbols); otherwise the configured one.
    if (rotationOn) {
      const first = this.rotation.next();
      this.currentSymbol = first ?? ok[0]!;
    } else {
      this.currentSymbol = this.config.symbol;
    }

    this.activeState = this.engines.ensureState(this.currentSymbol);

    if (rotationOn) {
      useStore.getState().append(
        'info',
        `pool warmed: ${ok.length}/${symbolsToWarm.length} in ${warmMs}ms${failed.length ? ` (skipped: ${failed.join(', ')})` : ''}`,
      );
    }

    store.updateThreshold(
      0,
      0,
      this.activeState.engine.isWarming,
      this.activeState.engine.ticksSeen,
    );

    await this.ws.subscribeTicks(this.currentSymbol);
    store.setActiveSymbol(this.currentSymbol);
    store.setStatus('live');
    useStore.getState().append(
      'status',
      rotationOn
        ? `live — watching ${this.currentSymbol} · pool ${ok.length} pre-warmed`
        : `live — watching ${this.currentSymbol}`,
    );
  }

  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    for (const t of this.dryRunTimers) clearTimeout(t);
    this.dryRunTimers.clear();
    for (const t of this.simTimers) clearTimeout(t);
    this.simTimers.clear();
    try {
      await this.ws.forgetAll(['ticks', 'balance', 'proposal_open_contract']);
    } catch {
      /* ignore */
    }
    this.ws.disconnect();
    useStore.getState().setActiveSymbol(null);
    useStore.getState().setStatus('stopped');
    useStore.getState().append('status', 'stopped');
  }

  async changeSymbol(newSymbol: string): Promise<void> {
    if (this.stopped) return;
    const store = useStore.getState();
    try {
      await this.ws.forgetAll(['ticks']);
    } catch {
      /* ignore */
    }
    this.currentSymbol = newSymbol;

    // Use a pre-warmed engine when available (the rotation path) so the swap
    // is instant. Otherwise fall back to on-demand history fetch.
    let state = this.engines.get(newSymbol);
    const needsWarm = !state || state.engine.isWarming;
    if (needsWarm) {
      store.setStatus('warming');
      store.updateThreshold(0, 0, true, 0);
      useStore.getState().append('status', `warming on ${newSymbol}…`);
      await this.engines.warmSymbol(newSymbol);
      state = this.engines.get(newSymbol);
    }
    this.activeState = state ?? this.engines.ensureState(newSymbol);

    await this.ws.subscribeTicks(newSymbol);
    if (this.stopped) return;
    store.setActiveSymbol(newSymbol);
    store.updateThreshold(
      0,
      0,
      this.activeState.engine.isWarming,
      this.activeState.engine.ticksSeen,
    );
    store.setStatus('live');
    useStore.getState().append(
      'status',
      this.activeState.engine.isWarming
        ? `warming on ${newSymbol}…`
        : `live — watching ${newSymbol} (pre-warmed)`,
    );
  }

  private dispatchSignal(
    signalId: string,
    direction: 'up' | 'down',
    spot: number,
    duration: number,
  ): void {
    const sn = this.config.sniper;
    if (!sn.enabled) {
      void this.executor.placeTrade(signalId, direction, spot, duration);
      return;
    }
    const armed = this.sniperConsecLosses >= sn.lossThreshold;
    if (armed) {
      // Fire real and consume the streak. The real outcome is independent of
      // the sim history — we reset after the promotion regardless of win/loss.
      useStore
        .getState()
        .append(
          'info',
          `sniper armed (${this.sniperConsecLosses}/${sn.lossThreshold}) · promoting to real`,
        );
      this.sniperConsecLosses = 0;
      this.pushSniperRuntime();
      void this.executor.placeTrade(signalId, direction, spot, duration, 'real');
      return;
    }
    this.executor.placeSim(signalId, direction, spot, duration);
  }

  private onSniperResolved(phase: SniperPhase, won: boolean): void {
    // If the user turned sniper off while this trade was in flight, don't
    // retroactively touch the runtime — the off-toggle already cleared it.
    if (!this.config.sniper.enabled) return;
    const store = useStore.getState();
    if (phase === 'sim') {
      if (won) {
        this.sniperConsecLosses = 0;
        store.updateSniper({
          simTrades: store.sniper.simTrades + 1,
          simWins: store.sniper.simWins + 1,
        });
      } else {
        this.sniperConsecLosses++;
        store.updateSniper({
          simTrades: store.sniper.simTrades + 1,
          simLosses: store.sniper.simLosses + 1,
        });
      }
    } else {
      // Real promotion already reset the streak at fire time; keep it at 0
      // here so a quick-fire real → loss doesn't arm the next sim-to-real.
      this.sniperConsecLosses = 0;
      store.updateSniper({ realTrades: store.sniper.realTrades + 1 });
    }
    this.pushSniperRuntime();
  }

  private pushSniperRuntime(): void {
    const sn = this.config.sniper;
    useStore.getState().updateSniper({
      consecLosses: this.sniperConsecLosses,
      armed: sn.enabled && this.sniperConsecLosses >= sn.lossThreshold,
    });
  }

  resetSniperRuntime(): void {
    this.sniperConsecLosses = 0;
    useStore.getState().updateSniper({
      consecLosses: 0,
      armed: false,
      simTrades: 0,
      simWins: 0,
      simLosses: 0,
      realTrades: 0,
    });
  }

  private scheduleRotation(reason: string): void {
    if (this.config.sniper.enabled) return;
    if (!this.config.rotation.enabled) return;
    if (this.config.rotation.pool.length < 2) return;
    if (this.rotationInFlight) return;
    const nextSymbol = this.rotation.next();
    if (!nextSymbol || nextSymbol === this.currentSymbol) return;
    this.rotationInFlight = true;
    queueMicrotask(() => {
      void (async () => {
        try {
          useStore
            .getState()
            .append('status', `rotating → ${nextSymbol} (${reason})`);
          await this.changeSymbol(nextSymbol);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          useStore.getState().append('error', `rotation failed: ${msg}`);
        } finally {
          this.rotationInFlight = false;
        }
      })();
    });
  }

  private onTick(t: TickPayload): void {
    const store = useStore.getState();
    store.updateTick(t.quote, t.epoch);

    // Route ticks only to the active symbol's engine. Stray ticks from a
    // previous (not-yet-forgotten) subscription are ignored.
    if (t.symbol && t.symbol !== this.currentSymbol) return;

    const state = this.activeState;
    const prev = state.prevQuote;
    const multiplier = SENSITIVITY_LEVELS[this.config.sensitivity].multiplier;
    const result = state.engine.processTick(t.quote, multiplier);

    if (!result) {
      state.prevQuote = t.quote;
      return;
    }

    store.updateThreshold(
      result.delta,
      result.threshold,
      state.engine.isWarming,
      state.engine.ticksSeen,
    );

    if (result.exceeded && prev !== null) {
      const signal = state.scorer.score(
        result,
        t.quote,
        prev,
        t.epoch,
        state.engine.ticksSeen,
        {
          cooldownTicks: this.config.cooldownTicks,
          maxDuration: this.config.duration,
        },
      );
      if (signal) {
        const fuzz = this.config.fuzzDuration;
        // Precedence: fuzz (explicit randomization) > adaptive (signal-derived)
        // > fixed config. Fuzz wins because adaptive's suggestedDuration is
        // usually pinned to the floor, which would silently neuter the fuzz range.
        let tradeDuration: number;
        if (fuzz.enabled) {
          tradeDuration = pickFuzzDuration(fuzz.minTicks, fuzz.maxTicks);
        } else if (this.config.adaptiveDuration) {
          tradeDuration = signal.suggestedDuration;
        } else {
          tradeDuration = this.config.duration;
        }
        const arrow = signal.direction === 'up' ? '↑' : '↓';
        const tag = signal.isSpike ? ' SPIKE' : '';
        const durTag =
          this.config.adaptiveDuration || fuzz.enabled ? ` dur=${tradeDuration}t` : '';
        store.append(
          'signal',
          `${arrow} ${signal.direction.toUpperCase()} @ ${t.quote.toFixed(3)} · Δ=${signal.delta.toFixed(4)} thr=${signal.threshold.toFixed(4)} · str=${signal.strength}${tag}${durTag}`,
        );
        if (
          !store.paused &&
          !this.stopped &&
          !this.reconnecting &&
          signal.strength >= this.config.minStrength &&
          this.openContractIds.size + this.pendingPlacements < this.config.maxConcurrent
        ) {
          // Reserve the slot synchronously so the next tick's gate sees it.
          this.pendingPlacements++;
          this.dispatchSignal(signal.id, signal.direction, t.quote, tradeDuration);
        }
      }
    }

    state.prevQuote = t.quote;
  }

  // Fires on every buy/sell/deposit/withdrawal on the authorized account. We
  // use it for two things: (1) user-visible logs of off-bot activity; (2) a
  // defensive reconcile trigger when the server confirms a buy we don't know
  // about. Skipped when pendingPlacements > 0 — that buy is likely ours and
  // the normal flow will add its contract_id in a moment.
  private onTransaction(tx: TransactionPayload): void {
    const store = useStore.getState();

    if (tx.action === 'buy' && tx.contract_id != null) {
      if (this.openContractIds.has(tx.contract_id)) return;
      if (this.preExistingContractIds.has(tx.contract_id)) return;
      if (this.pendingPlacements > 0) return;
      store.append(
        'warn',
        `unknown buy on account (id=${tx.contract_id}${tx.contract_type ? ' ' + tx.contract_type : ''}) — reconciling`,
      );
      void this.reconciler.reconcilePortfolio();
      return;
    }

    if (
      tx.action === 'deposit' ||
      tx.action === 'withdrawal' ||
      tx.action === 'adjustment' ||
      tx.action === 'transfer'
    ) {
      const amt = tx.amount != null ? tx.amount.toFixed(2) : '?';
      const currency = tx.currency ? ' ' + tx.currency : '';
      store.append('info', `${tx.action}: ${amt}${currency}`);
    }
  }

  private onContract(c: ContractUpdate): void {
    const store = useStore.getState();
    if (!this.openContractIds.has(c.contract_id)) return;

    store.updateOpenTrade(c.contract_id, {
      currentSpot: c.current_spot,
      entrySpot: c.entry_spot,
      profit: c.profit,
      tickStream: c.tick_count ?? 0,
    });

    if (c.is_sold === 1) {
      const existing = useStore
        .getState()
        .openTrades.find((t) => t.contractId === c.contract_id);
      if (!existing) return;

      const profit = c.profit ?? 0;
      const won = profit > 0 || c.status === 'won';
      const closed: ClosedTrade = {
        contractId: c.contract_id,
        type: existing.type,
        symbol: existing.symbol,
        stake: existing.stake,
        payout: c.payout ?? existing.payout,
        profit,
        result: won ? 'win' : 'loss',
        durationTicks: existing.durationTicks,
        entrySpot: c.entry_spot ?? existing.entrySpot,
        exitSpot: c.exit_tick ?? c.current_spot,
        closedAt: Date.now(),
        signalId: existing.signalId,
        sniperPhase: existing.sniperPhase,
      };
      this.openContractIds.delete(c.contract_id);
      store.closeTrade(c.contract_id, closed);
      const sniperTag = existing.sniperPhase === 'real' ? ' · SNIPER' : '';
      store.append(
        'trade-close',
        `${closed.result.toUpperCase()} ${existing.type} ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} ${this.currency} (id=${c.contract_id})${sniperTag}`,
      );
      this.mg.onTradeResolved(won, profit);
      if (existing.sniperPhase === 'real') {
        this.onSniperResolved('real', won);
      }
    }
  }
}
