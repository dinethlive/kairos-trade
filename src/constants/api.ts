export const DERIV_REST_BASE = 'https://api.derivws.com/trading/v1/options';
export const DEFAULT_APP_ID = '331jnczBJfg53USa1NUZm';

export const PING_INTERVAL_MS = 30_000;

// Session rollover: Deriv caps an authenticated WS session around ~1h (OAuth
// access-token lifetime). Mint a fresh OTP and swap sockets before the server
// drops us so trading never pauses on a forced disconnect.
export const SESSION_ROLLOVER_MS = 50 * 60 * 1_000;

// Reactive reconnect (unexpected close): exponential backoff capped at
// RECONNECT_MAX_MS; give up after RECONNECT_MAX_ATTEMPTS consecutive failures.
export const RECONNECT_BASE_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;
export const RECONNECT_MAX_ATTEMPTS = 10;

export const HISTORY_COUNT = 500;
export const ROLLING_WINDOW = 100;
export const WARMUP_TICKS = 20;

export const MAX_TRANSCRIPT = 400;
export const TRANSCRIPT_VISIBLE = 30;

export const DEFAULT_SYMBOL = '1HZ100V';
export const DEFAULT_STAKE = 0.35;
export const DEFAULT_DURATION_TICKS = 5;
export const DEFAULT_SENSITIVITY = 'medium' as const;
export const DEFAULT_MIN_STRENGTH = 2;

// Adaptive duration: per-signal hold selected from signal features.
// Floor is Deriv's minimum tick-duration for CALL/PUT on synthetics.
export const MIN_TRADE_DURATION = 5;
export const DEFAULT_ADAPTIVE_DURATION = true;
export const DEFAULT_COOLDOWN_TICKS = 3;

// Symbol rotation + fuzzy duration
export const DEFAULT_ROTATION_ENABLED = false;
// Curated pool of synthetic indices that support CALL/PUT (rise/fall).
// Refreshed live via WS `active_symbols` when the user runs `/pool refresh`.
export const DEFAULT_ROTATION_POOL: string[] = [
  '1HZ10V',
  '1HZ25V',
  '1HZ50V',
  '1HZ75V',
  '1HZ100V',
  'R_10',
  'R_25',
  'R_50',
  'R_75',
  'R_100',
  'JD10',
  'JD25',
  'JD50',
  'JD75',
  'JD100',
];

export const DEFAULT_FUZZ_DURATION_ENABLED = false;
export const DEFAULT_FUZZ_DURATION_MIN = 5;
export const DEFAULT_FUZZ_DURATION_MAX = 10;

export const DEFAULT_MG_MODE = 'classic' as const;
export const DEFAULT_MG_MULTIPLIER = 2.2;
export const DEFAULT_MG_MAX_STEPS = 8;
export const DEFAULT_MG_ARM_AFTER = 2;
export const DEFAULT_MG_ON_CAP = 'reset' as const;
export const DEFAULT_MG_STOP_LOSS = 200;

// Sniper mode: simulate trades off the tick stream until N consecutive sim
// losses accumulate, then promote the next signal to a real buy. Rotation is
// disabled while sniper is on. Its own martingale toggle decides whether the
// promoted trade scales stake.
export const DEFAULT_SNIPER_ENABLED = false;
export const DEFAULT_SNIPER_LOSS_THRESHOLD = 5;
export const DEFAULT_SNIPER_MARTINGALE_ENABLED = false;
