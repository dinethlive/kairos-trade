import { Trader, type TraderConfig } from './trader';
import { useStore } from '../state/store';

export class BotController {
  private trader: Trader | null = null;

  get config(): TraderConfig {
    return useStore.getState().config;
  }

  private setConfig(c: TraderConfig): void {
    useStore.getState().setConfig(c);
  }

  isRunning(): boolean {
    return this.trader !== null;
  }

  async start(): Promise<void> {
    if (this.trader) throw new Error('bot is already running — use /stop first');
    const cfg = this.config;
    if (!cfg.token) throw new Error('missing Deriv token — set KAIROS_TRADE_TOKEN or pass --token on launch');
    useStore.getState().resetRuntime();
    const t = new Trader(cfg);
    this.trader = t;
    try {
      await t.start();
    } catch (err) {
      try {
        await t.stop();
      } catch {
        /* ignore */
      }
      this.trader = null;
      throw err;
    }
  }

  async stop(): Promise<void> {
    const t = this.trader;
    this.trader = null;
    if (t) await t.stop();
  }

  async updateConfig(patch: Partial<TraderConfig>): Promise<void> {
    const prev = this.config;
    const next: TraderConfig = { ...prev, ...patch };
    this.setConfig(next);
    if (this.trader) {
      this.trader.updateConfig(next);
      if (patch.symbol && patch.symbol !== prev.symbol) {
        await this.trader.changeSymbol(patch.symbol);
      }
    }
  }

  resetMartingale(): void {
    this.trader?.resetMartingaleRuntime();
    useStore.getState().updateMartingale({
      step: 0,
      consecLosses: 0,
      nextStake: this.config.stake,
      armed: false,
    });
  }

  resetSniper(): void {
    if (this.trader) {
      this.trader.resetSniperRuntime();
      return;
    }
    useStore.getState().updateSniper({
      consecLosses: 0,
      armed: false,
      simTrades: 0,
      simWins: 0,
      simLosses: 0,
      realTrades: 0,
    });
  }
}
