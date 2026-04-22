import type { DerivWS } from '../services/derivWS';
import { useStore } from '../state/store';
import type { ClosedTrade, OpenTrade, SniperPhase } from '../types';
import type { MartingaleController } from './martingale';
import type { TraderConfig } from './config';

export interface TradeExecutorDeps {
  ws: DerivWS;
  mg: MartingaleController;
  getConfig: () => TraderConfig;
  getCurrency: () => string;
  getCurrentSymbol: () => string;
  isDryRun: () => boolean;
  isStopped: () => boolean;
  openContractIds: Set<number>;
  dryRunTimers: Set<ReturnType<typeof setTimeout>>;
  simTimers: Set<ReturnType<typeof setTimeout>>;
  decrementPending: () => void;
  setError: (msg: string) => void;
  scheduleRotation: (reason: string) => void;
  onSniperResolved: (phase: SniperPhase, won: boolean) => void;
}

function roundStake(v: number): number {
  return Math.round(v * 100) / 100;
}

export class TradeExecutor {
  constructor(private deps: TradeExecutorDeps) {}

  async placeTrade(
    signalId: string,
    direction: 'up' | 'down',
    spot: number,
    duration: number,
    sniperPhase?: SniperPhase,
  ): Promise<void> {
    const store = useStore.getState();
    const contractType = direction === 'up' ? 'CALL' : 'PUT';

    const stake = this.deps.mg.nextStake();
    const mgTag = this.deps.mg.step > 0 ? ` · mg step ${this.deps.mg.step}` : '';
    const sniperTag = sniperPhase === 'real' ? ' · SNIPER FIRE' : '';

    const tradeSymbol = this.deps.getCurrentSymbol();

    if (this.deps.isDryRun()) {
      const fakeId = -Math.floor(Math.random() * 1_000_000);
      const open: OpenTrade = {
        contractId: fakeId,
        type: contractType,
        symbol: tradeSymbol,
        stake,
        payout: stake * 1.95,
        entrySpot: spot,
        currentSpot: spot,
        durationTicks: duration,
        tickStream: 0,
        purchasedAt: Date.now(),
        shortcode: `DRY_${contractType}_${tradeSymbol}`,
        signalId,
        sniperPhase,
      };
      this.deps.openContractIds.add(fakeId);
      // Slot transfers from pending → openContractIds; total "taken" unchanged.
      this.deps.decrementPending();
      store.addOpenTrade(open);
      store.append(
        'trade-open',
        `DRY ${contractType} ${tradeSymbol} stake=${stake.toFixed(2)} dur=${duration}t @ ${spot.toFixed(3)}${mgTag}${sniperTag}`,
      );
      const timer = setTimeout(() => {
        this.deps.dryRunTimers.delete(timer);
        if (this.deps.isStopped()) return;
        this.resolveDryRun(fakeId, open, direction);
      }, duration * 1000);
      this.deps.dryRunTimers.add(timer);
      this.deps.scheduleRotation('dry-run trade');
      return;
    }

    try {
      const res = await this.deps.ws.buyContract({
        amount: stake,
        currency: this.deps.getCurrency(),
        contract_type: contractType,
        duration,
        duration_unit: 't',
        symbol: tradeSymbol,
      });

      const open: OpenTrade = {
        contractId: res.contract_id,
        type: contractType,
        symbol: tradeSymbol,
        stake: res.buy_price,
        payout: res.payout,
        durationTicks: duration,
        tickStream: 0,
        purchasedAt: Date.now(),
        shortcode: res.shortcode,
        signalId,
        sniperPhase,
      };
      this.deps.openContractIds.add(res.contract_id);
      // Slot transfers from pending → openContractIds; total "taken" unchanged.
      this.deps.decrementPending();
      store.addOpenTrade(open);
      store.append(
        'trade-open',
        `${contractType} ${tradeSymbol} stake=${res.buy_price.toFixed(2)} payout=${res.payout.toFixed(2)} id=${res.contract_id}${mgTag}${sniperTag}`,
      );
      this.deps.scheduleRotation('live trade');
    } catch (err) {
      // Buy failed — release the reserved slot so the next signal isn't blocked.
      this.deps.decrementPending();
      const msg = err instanceof Error ? err.message : 'Trade failed';
      store.setError(msg);
      store.append('error', `trade failed: ${msg}`);
    }
  }

  // Sniper simulation: a synthetic trade resolved off the tick stream that
  // never hits the Deriv account. Used to gauge recent signal performance
  // before promoting to a real buy. Does not touch session P&L, balance, or
  // martingale — the real trade (placeTrade) will do that when promoted.
  placeSim(
    signalId: string,
    direction: 'up' | 'down',
    spot: number,
    duration: number,
  ): void {
    const store = useStore.getState();
    const contractType = direction === 'up' ? 'CALL' : 'PUT';
    const tradeSymbol = this.deps.getCurrentSymbol();
    // Sim trades always use base stake — P&L here is cosmetic.
    const stake = roundStake(this.deps.getConfig().stake);
    const fakeId = -Math.floor(Math.random() * 1_000_000);
    const snCfg = this.deps.getConfig().sniper;
    const streakTag = ` · streak ${useStore.getState().sniper.consecLosses}/${snCfg.lossThreshold}`;

    const open: OpenTrade = {
      contractId: fakeId,
      type: contractType,
      symbol: tradeSymbol,
      stake,
      payout: stake * 1.95,
      entrySpot: spot,
      currentSpot: spot,
      durationTicks: duration,
      tickStream: 0,
      purchasedAt: Date.now(),
      shortcode: `SIM_${contractType}_${tradeSymbol}`,
      signalId,
      sniperPhase: 'sim',
    };
    this.deps.openContractIds.add(fakeId);
    this.deps.decrementPending();
    store.addOpenTrade(open);
    store.append(
      'trade-open',
      `SIM ${contractType} ${tradeSymbol} stake=${stake.toFixed(2)} dur=${duration}t @ ${spot.toFixed(3)}${streakTag}`,
    );
    const timer = setTimeout(() => {
      this.deps.simTimers.delete(timer);
      if (this.deps.isStopped()) return;
      this.resolveSim(fakeId, open, direction);
    }, duration * 1000);
    this.deps.simTimers.add(timer);
    // No rotation — sniper mode ignores rotation; doing nothing also keeps
    // the active symbol stable for the sim streak to build a clean picture.
  }

  resolveDryRun(contractId: number, open: OpenTrade, direction: 'up' | 'down'): void {
    const store = useStore.getState();
    const last = store.lastTickQuote ?? open.entrySpot ?? 0;
    const entry = open.entrySpot ?? last;
    const won = direction === 'up' ? last > entry : last < entry;
    const profit = won ? open.payout - open.stake : -open.stake;
    const sniperTag = open.sniperPhase === 'real' ? ' · SNIPER' : '';
    const closed: ClosedTrade = {
      contractId,
      type: open.type,
      symbol: open.symbol,
      stake: open.stake,
      payout: open.payout,
      profit,
      result: won ? 'win' : 'loss',
      durationTicks: open.durationTicks,
      entrySpot: entry,
      exitSpot: last,
      closedAt: Date.now(),
      signalId: open.signalId,
      sniperPhase: open.sniperPhase,
    };
    this.deps.openContractIds.delete(contractId);
    store.closeTrade(contractId, closed);
    store.append(
      'trade-close',
      `DRY ${closed.result.toUpperCase()} ${open.type} ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} (entry=${entry.toFixed(3)} exit=${last.toFixed(3)})${sniperTag}`,
    );
    this.deps.mg.onTradeResolved(won, profit);
    if (open.sniperPhase === 'real') {
      this.deps.onSniperResolved('real', won);
    }
  }

  private resolveSim(contractId: number, open: OpenTrade, direction: 'up' | 'down'): void {
    const store = useStore.getState();
    const last = store.lastTickQuote ?? open.entrySpot ?? 0;
    const entry = open.entrySpot ?? last;
    const won = direction === 'up' ? last > entry : last < entry;
    const profit = won ? open.payout - open.stake : -open.stake;
    this.deps.openContractIds.delete(contractId);
    store.removeOpenTrade(contractId);
    store.append(
      'trade-close',
      `SIM ${won ? 'WIN' : 'LOSS'} ${open.type} ${profit >= 0 ? '+' : ''}${profit.toFixed(2)} (entry=${entry.toFixed(3)} exit=${last.toFixed(3)})`,
    );
    this.deps.onSniperResolved('sim', won);
  }
}
