import type { DerivWS } from '../services/derivWS';
import { useStore } from '../state/store';
import type { OpenTrade, TradeContractType } from '../types';

export interface ReconcilerDeps {
  ws: DerivWS;
  isStopped: () => boolean;
  getCurrentSymbol: () => string;
  openContractIds: Set<number>;
  preExistingContractIds: Set<number>;
  setReconnecting: (v: boolean) => void;
}

export class Reconciler {
  // Serializes concurrent reconcile requests — the transaction stream can fire
  // several unknown-buy notifications in quick succession and each triggers a
  // reconcile.
  private reconcileInFlight = false;

  constructor(private deps: ReconcilerDeps) {}

  // Called after DerivWS finishes a rollover or reactive reconnect. The fresh
  // socket has no subscriptions, so re-issue balance + ticks, re-attach to
  // every open contract's status stream, then reconcile with the server-side
  // portfolio to adopt any phantom contracts (buy requests that the server
  // executed but whose pending Promise was rejected by the swap).
  async resubscribeAfterReconnect(): Promise<void> {
    const store = useStore.getState();
    try {
      await this.deps.ws.subscribeBalance();
      const currentSymbol = this.deps.getCurrentSymbol();
      if (currentSymbol) {
        await this.deps.ws.subscribeTicks(currentSymbol);
      }
      const openIds = Array.from(this.deps.openContractIds);
      let resubscribed = 0;
      for (const id of openIds) {
        if (id < 0) continue; // dry-run fake id
        try {
          await this.deps.ws.subscribeOpenContract(id);
          resubscribed++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          useStore.getState().append('warn', `could not resume contract ${id}: ${msg}`);
        }
      }

      await this.reconcilePortfolio();

      // Subscribe to transactions last so the defensive handler doesn't fire
      // on buys we were about to reconcile anyway — avoids redundant reconcile
      // triggers and spurious "unknown buy" warnings during the resync.
      try {
        await this.deps.ws.subscribeTransactions();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        useStore.getState().append('warn', `transaction stream unavailable: ${msg}`);
      }

      store.setStatus('live');
      const trailing = resubscribed > 0 ? ` · resumed ${resubscribed} contract${resubscribed === 1 ? '' : 's'}` : '';
      useStore.getState().append(
        'status',
        `resubscribed ticks on ${this.deps.getCurrentSymbol()}${trailing}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useStore.getState().append('error', `resubscribe failed: ${msg}`);
    } finally {
      // Always clear reconnecting. If subscribes failed from a dead socket, the
      // next reactive reconnect's 'reconnect' event will fire this method
      // again. If they failed for some other reason (rate limit, server
      // hiccup), we'd otherwise stay permanently flagged and never place
      // another trade even though the WS is healthy.
      this.deps.setReconnecting(false);
    }
  }

  // Adopt contracts that exist server-side but not in our local state. These
  // are "phantom" buys — the proposal+buy round-trip was rejected by the
  // reconnect, but the server already executed the trade. Without this the
  // money is committed yet we'd keep placing more trades (wrong maxConcurrent
  // view) and never see the resolve (wrong martingale).
  async reconcilePortfolio(): Promise<void> {
    if (this.reconcileInFlight) return;
    this.reconcileInFlight = true;
    try {
      await this.doReconcilePortfolio();
    } finally {
      this.reconcileInFlight = false;
    }
  }

  private async doReconcilePortfolio(): Promise<void> {
    let portfolio;
    try {
      portfolio = await this.deps.ws.getPortfolio();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      useStore.getState().append('warn', `portfolio reconcile failed: ${msg}`);
      return;
    }

    const adopted: number[] = [];
    for (const c of portfolio) {
      if (this.deps.preExistingContractIds.has(c.contract_id)) continue;
      if (this.deps.openContractIds.has(c.contract_id)) continue;
      if (c.contract_type !== 'CALL' && c.contract_type !== 'PUT') continue;

      const stub: OpenTrade = {
        contractId: c.contract_id,
        type: c.contract_type as TradeContractType,
        symbol: c.symbol ?? this.deps.getCurrentSymbol(),
        stake: c.buy_price,
        payout: c.payout,
        durationTicks: 0, // unknown; POC stream will fill in tick_count
        tickStream: 0,
        purchasedAt: (c.purchase_time ?? Math.floor(Date.now() / 1000)) * 1000,
        shortcode: c.shortcode,
        signalId: `adopted-${c.contract_id}`,
      };
      this.deps.openContractIds.add(c.contract_id);
      useStore.getState().addOpenTrade(stub);
      adopted.push(c.contract_id);
      try {
        await this.deps.ws.subscribeOpenContract(c.contract_id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        useStore.getState().append('warn', `adopt ${c.contract_id}: subscribe failed: ${msg}`);
      }
    }

    if (adopted.length > 0) {
      useStore.getState().append(
        'warn',
        `adopted ${adopted.length} phantom contract${adopted.length === 1 ? '' : 's'} from server: ${adopted.join(', ')}`,
      );
    }
  }
}
