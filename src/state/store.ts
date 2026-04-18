import { create } from 'zustand';
import type {
  Account,
  ClosedTrade,
  ConnectionStatus,
  OpenTrade,
  SessionStats,
  TranscriptKind,
  TranscriptLine,
} from '../types';
import {
  MAX_TRANSCRIPT,
  DEFAULT_MG_MODE,
  DEFAULT_MG_MULTIPLIER,
  DEFAULT_MG_MAX_STEPS,
  DEFAULT_MG_ARM_AFTER,
  DEFAULT_MG_ON_CAP,
  DEFAULT_ADAPTIVE_DURATION,
  DEFAULT_COOLDOWN_TICKS,
  DEFAULT_ROTATION_ENABLED,
  DEFAULT_ROTATION_POOL,
  DEFAULT_FUZZ_DURATION_ENABLED,
  DEFAULT_FUZZ_DURATION_MIN,
  DEFAULT_FUZZ_DURATION_MAX,
} from '../constants/api';
import { emptySession, updateSession } from '../trading/session';
import type { TraderConfig } from '../trading/trader';
import type { MenuDefinition } from '../ui/menu';

let transcriptSeq = 0;

const placeholderConfig: TraderConfig = {
  token: '',
  appId: '',
  accountId: null,
  symbol: '',
  stake: 0,
  duration: 0,
  sensitivity: 'medium',
  minStrength: 2,
  maxConcurrent: 1,
  dryRun: false,
  adaptiveDuration: DEFAULT_ADAPTIVE_DURATION,
  cooldownTicks: DEFAULT_COOLDOWN_TICKS,
  martingale: {
    mode: DEFAULT_MG_MODE,
    multiplier: DEFAULT_MG_MULTIPLIER,
    maxSteps: DEFAULT_MG_MAX_STEPS,
    armAfterLosses: DEFAULT_MG_ARM_AFTER,
    maxStake: null,
    stopLoss: null,
    takeProfit: null,
    onCap: DEFAULT_MG_ON_CAP,
  },
  rotation: {
    enabled: DEFAULT_ROTATION_ENABLED,
    pool: [...DEFAULT_ROTATION_POOL],
  },
  fuzzDuration: {
    enabled: DEFAULT_FUZZ_DURATION_ENABLED,
    minTicks: DEFAULT_FUZZ_DURATION_MIN,
    maxTicks: DEFAULT_FUZZ_DURATION_MAX,
  },
};

export interface MartingaleRuntime {
  step: number;
  consecLosses: number;
  nextStake: number;
  armed: boolean;
}

const emptyMartingale = (): MartingaleRuntime => ({
  step: 0,
  consecLosses: 0,
  nextStake: 0,
  armed: false,
});

export interface BotState {
  config: TraderConfig;
  status: ConnectionStatus;
  error: string | null;
  paused: boolean;
  account: Account | null;

  activeSymbol: string | null;

  lastTickQuote: number | null;
  lastTickEpoch: number | null;
  lastDelta: number;
  threshold: number;
  warming: boolean;
  ticksSeen: number;

  openTrades: OpenTrade[];
  session: SessionStats;

  martingale: MartingaleRuntime;

  menuStack: MenuDefinition[];

  transcript: TranscriptLine[];

  setConfig: (c: TraderConfig) => void;
  setActiveSymbol: (s: string | null) => void;
  setStatus: (s: ConnectionStatus) => void;
  setError: (msg: string | null) => void;
  setPaused: (p: boolean) => void;
  setAccount: (a: Account) => void;
  updateBalance: (balance: number, currency?: string) => void;
  updateTick: (quote: number, epoch: number) => void;
  updateThreshold: (delta: number, threshold: number, warming: boolean, ticksSeen: number) => void;
  addOpenTrade: (t: OpenTrade) => void;
  updateOpenTrade: (contractId: number, patch: Partial<OpenTrade>) => void;
  closeTrade: (contractId: number, trade: ClosedTrade) => void;

  updateMartingale: (patch: Partial<MartingaleRuntime>) => void;

  pushMenu: (menu: MenuDefinition) => void;
  replaceTopMenu: (menu: MenuDefinition) => void;
  popMenu: () => void;
  clearMenus: () => void;

  append: (kind: TranscriptKind, text: string) => void;
  clearTranscript: () => void;
  resetRuntime: () => void;
}

export const useStore = create<BotState>((set) => ({
  config: placeholderConfig,
  status: 'idle',
  error: null,
  paused: false,
  account: null,

  activeSymbol: null,

  lastTickQuote: null,
  lastTickEpoch: null,
  lastDelta: 0,
  threshold: 0,
  warming: true,
  ticksSeen: 0,

  openTrades: [],
  session: emptySession(),

  martingale: emptyMartingale(),

  menuStack: [],

  transcript: [],

  setConfig: (config) => set({ config }),
  setActiveSymbol: (activeSymbol) => set({ activeSymbol }),
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  setPaused: (paused) => set({ paused }),
  setAccount: (account) => set({ account }),
  updateBalance: (balance, currency) =>
    set((st) =>
      st.account
        ? { account: { ...st.account, balance, currency: currency ?? st.account.currency } }
        : {},
    ),
  updateTick: (quote, epoch) => set({ lastTickQuote: quote, lastTickEpoch: epoch }),
  updateThreshold: (lastDelta, threshold, warming, ticksSeen) =>
    set({ lastDelta, threshold, warming, ticksSeen }),

  addOpenTrade: (t) => set((st) => ({ openTrades: [...st.openTrades, t] })),

  updateOpenTrade: (contractId, patch) =>
    set((st) => ({
      openTrades: st.openTrades.map((t) =>
        t.contractId === contractId ? { ...t, ...patch } : t,
      ),
    })),

  closeTrade: (contractId, trade) =>
    set((st) => ({
      openTrades: st.openTrades.filter((t) => t.contractId !== contractId),
      session: updateSession(st.session, trade),
      account: st.account
        ? { ...st.account, balance: st.account.balance + trade.profit }
        : null,
    })),

  append: (kind, text) =>
    set((st) => {
      const line: TranscriptLine = { id: ++transcriptSeq, ts: Date.now(), kind, text };
      const next =
        st.transcript.length >= MAX_TRANSCRIPT
          ? [...st.transcript.slice(st.transcript.length - MAX_TRANSCRIPT + 1), line]
          : [...st.transcript, line];
      return { transcript: next };
    }),

  updateMartingale: (patch) =>
    set((st) => ({ martingale: { ...st.martingale, ...patch } })),

  pushMenu: (menu) => set((st) => ({ menuStack: [...st.menuStack, menu] })),
  replaceTopMenu: (menu) =>
    set((st) =>
      st.menuStack.length === 0
        ? { menuStack: [menu] }
        : { menuStack: [...st.menuStack.slice(0, -1), menu] },
    ),
  popMenu: () => set((st) => ({ menuStack: st.menuStack.slice(0, -1) })),
  clearMenus: () => set({ menuStack: [] }),

  clearTranscript: () => set({ transcript: [] }),

  resetRuntime: () =>
    set({
      status: 'idle',
      error: null,
      paused: false,
      account: null,
      activeSymbol: null,
      lastTickQuote: null,
      lastTickEpoch: null,
      lastDelta: 0,
      threshold: 0,
      warming: true,
      ticksSeen: 0,
      openTrades: [],
      session: emptySession(),
      martingale: emptyMartingale(),
    }),
}));
