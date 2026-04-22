import { useStore } from '../state/store';
import type { TraderConfig } from './config';

function roundStake(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface MartingaleDeps {
  getConfig: () => TraderConfig;
  onStop: () => void;
}

export class MartingaleController {
  private mgStep = 0;
  private mgConsecLosses = 0;

  constructor(private deps: MartingaleDeps) {}

  reset(): void {
    this.mgStep = 0;
    this.mgConsecLosses = 0;
    this.pushRuntime();
  }

  get step(): number {
    return this.mgStep;
  }

  nextStake(): number {
    const cfg = this.deps.getConfig();
    const base = roundStake(cfg.stake);
    // Sniper mode owns its own martingale switch; when it's off, skip stake
    // scaling regardless of the global --mg setting.
    if (cfg.sniper.enabled && !cfg.sniper.martingaleEnabled) return base;
    const mg = cfg.martingale;
    if (mg.mode === 'off' || this.mgStep === 0) return base;
    const scaled = cfg.stake * Math.pow(mg.multiplier, this.mgStep);
    return Number.isFinite(scaled) ? roundStake(scaled) : base;
  }

  pushRuntime(): void {
    useStore.getState().updateMartingale({
      step: this.mgStep,
      consecLosses: this.mgConsecLosses,
      nextStake: this.nextStake(),
      armed: this.mgStep > 0,
    });
  }

  private applyOnCap(reason: string): void {
    const mg = this.deps.getConfig().martingale;
    this.mgStep = 0;
    this.mgConsecLosses = 0;
    const store = useStore.getState();
    store.append('warn', `mg cap hit (${reason}) · ${mg.onCap}`);
    this.pushRuntime();
    if (mg.onCap === 'pause') {
      store.setPaused(true);
    } else if (mg.onCap === 'stop') {
      this.deps.onStop();
    }
  }

  checkSessionGuards(): boolean {
    const mg = this.deps.getConfig().martingale;
    const store = useStore.getState();
    const pnl = store.session.totalProfit;
    if (mg.stopLoss != null && pnl <= -mg.stopLoss) {
      store.append('warn', `mg stop-loss hit (${pnl.toFixed(2)}) · stopping`);
      this.deps.onStop();
      return true;
    }
    if (mg.takeProfit != null && pnl >= mg.takeProfit) {
      store.append('info', `mg take-profit hit (+${pnl.toFixed(2)}) · stopping`);
      this.deps.onStop();
      return true;
    }
    return false;
  }

  onTradeResolved(won: boolean, profit: number): void {
    const cfg = this.deps.getConfig();
    const mg = cfg.martingale;
    const store = useStore.getState();

    // Sniper-with-mg-off: still enforce session stop-loss/take-profit but skip
    // all step/streak state changes so the sniper cycle stays clean.
    if (cfg.sniper.enabled && !cfg.sniper.martingaleEnabled) {
      this.mgStep = 0;
      this.mgConsecLosses = 0;
      this.pushRuntime();
      this.checkSessionGuards();
      return;
    }

    if (mg.mode === 'off') {
      this.mgStep = 0;
      this.mgConsecLosses = 0;
      this.pushRuntime();
      this.checkSessionGuards();
      return;
    }

    if (won) {
      if (this.mgStep > 0) {
        store.append(
          'info',
          `mg recovered · +${profit.toFixed(2)} · reset to base ${cfg.stake.toFixed(2)}`,
        );
      }
      this.mgStep = 0;
      this.mgConsecLosses = 0;
      this.pushRuntime();
      this.checkSessionGuards();
      return;
    }

    // loss
    if (this.mgStep === 0) {
      this.mgConsecLosses++;
      const threshold = mg.armAfterLosses;
      const shouldArm = threshold === 0 ? true : this.mgConsecLosses >= threshold;
      if (shouldArm) {
        this.mgStep = 1;
        this.mgConsecLosses = 0;
        const nextStake = this.nextStake();
        if (mg.maxStake != null && nextStake > mg.maxStake) {
          this.applyOnCap('max-stake');
        } else if (this.mgStep > mg.maxSteps) {
          this.applyOnCap('max-steps');
        } else {
          store.append(
            'info',
            `mg armed after ${threshold} ${threshold === 1 ? 'loss' : 'losses'} · step 1/${mg.maxSteps} · next ${nextStake.toFixed(2)}`,
          );
          this.pushRuntime();
        }
      } else {
        store.append('info', `mg dormant (${this.mgConsecLosses}/${threshold})`);
        this.pushRuntime();
      }
    } else {
      // already armed
      const nextStep = this.mgStep + 1;
      const projectedStake = cfg.stake * Math.pow(mg.multiplier, nextStep);
      if (nextStep > mg.maxSteps) {
        this.applyOnCap('max-steps');
      } else if (mg.maxStake != null && projectedStake > mg.maxStake) {
        this.applyOnCap('max-stake');
      } else {
        this.mgStep = nextStep;
        store.append(
          'info',
          `mg step ${this.mgStep}/${mg.maxSteps} · next ${this.nextStake().toFixed(2)}`,
        );
        this.pushRuntime();
      }
    }

    this.checkSessionGuards();
  }
}
