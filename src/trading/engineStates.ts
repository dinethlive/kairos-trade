import { AdaptiveThresholdEngine } from '../engine/adaptiveThreshold';
import { SignalScorer } from '../engine/signalScorer';
import { HISTORY_COUNT } from '../constants/api';
import { useStore } from '../state/store';

// Per-symbol signal-engine state. One entry is created per tracked symbol; a
// pool-wide warm-up pre-populates every entry at /start so rotation can swap
// symbols without re-fetching history.
export interface EngineState {
  engine: AdaptiveThresholdEngine;
  scorer: SignalScorer;
  prevQuote: number | null;
}

export function makeEngineState(): EngineState {
  return {
    engine: new AdaptiveThresholdEngine(),
    scorer: new SignalScorer(),
    prevQuote: null,
  };
}

export interface EngineStatesDeps {
  getTicksHistory: (symbol: string, count: number) => Promise<number[]>;
}

export class EngineStates {
  private map = new Map<string, EngineState>();

  constructor(private deps: EngineStatesDeps) {}

  has(symbol: string): boolean {
    return this.map.has(symbol);
  }

  get(symbol: string): EngineState | undefined {
    return this.map.get(symbol);
  }

  set(symbol: string, state: EngineState): void {
    this.map.set(symbol, state);
  }

  delete(symbol: string): void {
    this.map.delete(symbol);
  }

  ensureState(symbol: string): EngineState {
    let s = this.map.get(symbol);
    if (!s) {
      s = makeEngineState();
      this.map.set(symbol, s);
    }
    return s;
  }

  async warmSymbol(symbol: string): Promise<void> {
    const state = this.ensureState(symbol);
    state.engine.reset();
    state.scorer.reset();
    state.prevQuote = null;
    const history = await this.deps.getTicksHistory(symbol, HISTORY_COUNT);
    if (history.length > 1) {
      state.engine.seedHistory(history);
      state.prevQuote = history[history.length - 1] ?? null;
    }
  }

  async warmPool(symbols: string[]): Promise<{ ok: string[]; failed: string[] }> {
    const unique = Array.from(new Set(symbols));
    const results = await Promise.allSettled(unique.map((s) => this.warmSymbol(s)));
    const ok: string[] = [];
    const failed: string[] = [];
    results.forEach((r, i) => {
      const sym = unique[i]!;
      if (r.status === 'fulfilled') ok.push(sym);
      else {
        failed.push(sym);
        this.map.delete(sym);
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        useStore.getState().append('warn', `warm ${sym} failed: ${msg}`);
      }
    });
    return { ok, failed };
  }
}
