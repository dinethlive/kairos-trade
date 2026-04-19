# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`kairos-trade` is a Bun + Ink (React-in-terminal) REPL CLI that auto-trades Deriv synthetic indices (default: Volatility 100 1s, `1HZ100V`). The launcher drops you into a slash-command REPL (inspired by Claude Code); you run `/start` to connect + warm up + begin auto-trading. The engine streams ticks over Deriv's WebSocket, detects adaptive price-jump signals, scores them, and buys `CALL`/`PUT` contracts of configurable tick duration. Signals + trade lifecycle are logged to a scrolling in-memory transcript.

## Commands

The runtime is **Bun** (not Node). Scripts use Bun's native TS/JSX handling.

- `bun install` — install deps
- `bun run start` — run the CLI (also: `bun src/index.tsx`)
- `bun run dev` — run with `--watch` for live reload
- `bun run typecheck` — `tsc --noEmit` strict type check (no runtime build)
- `bun run build` — produce a standalone Windows exe at `dist/kairos-trade.exe` via `bun build --compile`
- `bun run link` — expose `kairos-trade` as a global bin

There is no test runner, linter, or formatter configured.

### Running the CLI

Requires a Deriv Personal Access Token with scopes: Read, Trade, Trading Information, Payments. Pass via `--token` or `KAIROS_TRADE_TOKEN` env var (also accepts `DERIV_TOKEN`). An `.env.example` documents every env var; CLI flags override env. The token is not required at launch — the REPL opens without one — but `/start` will refuse until it's set.

Launch flags set *session defaults*; they do not auto-start the bot. Develop against `--dry-run` (or toggle with `/dryrun on`) — it simulates fills off the live tick stream without sending `buy` calls.

### REPL

Slash commands (see `src/commands/registry.ts`):

- `/start`, `/stop` — lifecycle. `/start` on an already-running bot is an error; stop first.
- `/pause`, `/resume` — halt/resume trade placement while ticks keep streaming.
- `/status` — print config, account, session stats.
- `/symbol <sym>` — hot-swaps the tick subscription if bot is running (`forgetAll(['ticks'])` → engine/scorer reset → re-seed history → resubscribe).
- `/stake`, `/duration`, `/sensitivity`, `/minstrength`, `/maxconcurrent`, `/dryrun` — mutate `TraderConfig` live; `Trader.updateConfig()` reads the new values on the next tick. Several (`/sensitivity`, `/minstrength`, `/dryrun`) open an arrow-key selection menu when invoked without arguments.
- `/rotate [on|off|status]` — multi-symbol rotation. When on, each trade cycles to the next symbol in a Fisher-Yates-shuffled permutation of the pool (`RotationScheduler` in `src/engine/rotation.ts`); when the cycle empties, a fresh permutation is drawn so every pool member trades once per cycle in random order. The first symbol of a new permutation is swapped if it repeats the last-emitted one (pool ≥2).
- `/pool [list|add <sym>|remove <sym>|clear|reset|refresh]` — manage the rotation pool. `refresh` calls `fetchActiveSymbolsPublic(['CALL','PUT'])` (unauth WS at `wss://api.derivws.com/trading/v1/options/ws/public`) and keeps `market==='synthetic_index' && exchange_is_open && !is_trading_suspended`. No args opens a toggle menu.
- `/fuzzduration [on|off|<min> <max>]` — per-trade random tick duration sampled uniformly from `[min..max]` (inclusive). When on, fuzz wins over both `/adaptive` and `/duration` (precedence: fuzz > adaptive > fixed `/duration`).
- `/clear`, `/help [cmd]`, `/quit`.

Input: `/` triggers an autocomplete menu (filtered by prefix, up/down to navigate, Tab to complete, Enter to submit). Command history (↑/↓ when menu isn't visible) is in-memory only. `Ctrl+C` initiates a graceful shutdown.

Nested menus: some commands (`/rotate`, `/pool`, `/fuzzduration`, `/sensitivity`, `/minstrength`, `/dryrun` with no args) push a `MenuDefinition` onto `useStore.menuStack`. `MenuStack` in `src/ui/components/SelectMenu.tsx` renders the stack and the topmost entry captures keyboard input (↑↓ nav, Enter select, 1-9 hotkeys, Esc/← back). Items receive a `MenuController` with `close`/`closeAll`/`replace`/`push`/`log` to either resolve or push child menus. `Prompt` is hidden while `menuStack.length > 0`.

## Architecture

Data flows in one direction: **Deriv WS → Trader → statistical engine → Zustand store → Ink UI**. The UI never talks to the WS; it only subscribes to store state. Slash-command handlers are the only inbound write path from UI → runtime, and they all go through `BotController` (`src/trading/controller.ts`), which owns the Trader instance.

### Key pieces

- **`src/services/derivRest.ts`** — thin fetch helpers for Deriv's **v1 Trading Options** REST endpoints: `listAccounts(appId, token)` hits `GET https://api.derivws.com/trading/v1/options/accounts`, `getOtpUrl(appId, token, accountId)` hits `POST /accounts/{id}/otp` and returns the single-use OTP-embedded WS URL. Both take the app_id in the `Deriv-App-ID` header and the PAT as `Authorization: Bearer`. `pickDefaultAccount` prefers active DEMO over REAL.

- **`src/services/derivWS.ts`** — the only WS client. Wraps Deriv's v1 Trading Options WebSocket. `connect()` performs the full auth dance: list accounts → select (by configured `accountId` or default-DEMO) → fetch OTP → open `wss://api.derivws.com/trading/v1/options/ws/{demo|real}?otp=...`. **No `authorize` message is sent** — the OTP in the URL is the auth. `disconnect()` is terminal (OTP is single-use; there is no auto-reconnect — if the socket drops, the Trader stops and the user must `/start` again to mint a fresh OTP). Per-request `req_id` correlation, 30s ping, typed helpers (`subscribeTicks`, `getTicksHistory`, `subscribeBalance`, `getProposal`, `buyContract`, `forgetAll`). Emits `tick`/`balance`/`contract`/`status`/`error` events. **`buyContract` follows the official v1 two-step flow**: send `proposal` (with `underlying_symbol`) to get a quote, then `buy: <proposal.id>, price: <ask_price>, subscribe: 1` — the `subscribe:1` streams `proposal_open_contract` updates so no separate POC subscription is needed.

- **`src/engine/adaptiveThreshold.ts`** — the statistical core. For each tick it computes `delta = |quote - prevQuote|` and maintains **three** adaptive estimators in parallel:
  - Welford rolling variance over `ROLLING_WINDOW=100` deltas (robust mean/stddev)
  - EWMA with `span=20` (`α = 2/(span+1)`) for fast response
  - Two-sided CUSUM (`sHigh`/`sLow`) with allowance `0.5σ` and decision threshold `4σ` to detect regime shifts
  
  The firing threshold is `min(welfordThresh, ewmaThresh)` where each = `mean + sensitivityMultiplier * stddev`. It also tracks bandwidth (Bollinger-style) over a 50-tick window and sets `squeezeActive` when current bandwidth < 1.2× the window minimum. `WARMUP_TICKS=20` gates any firing. `seedHistory()` preloads 500 historical ticks before the live subscription.

- **`src/engine/signalScorer.ts`** — turns `ThresholdResult` into a `Signal` with strength 1–3. Composite score = `0.5·magnitude + 0.2·velocity + 0.15·consistency + squeezeBonus(0.15) + cusumBonus(0.1)`. Spikes (`delta > mean + 5σ`) force strength 3. An active squeeze bumps strength by 1.

- **`src/trading/trader.ts`** — orchestrator. `start()` calls `ws.connect()` (which does REST listAccounts → REST OTP → open WS) and reads account info from the returned `DerivAccount` (no `authorize` message). Maintains a **per-symbol `EngineState` map** (`engines: Map<string, { engine, scorer, prevQuote }>`) with an `activeState` pointer for the symbol currently subscribed. When rotation is enabled, `start()` **pre-warms every pool symbol in parallel** (`warmPool()` → `Promise.allSettled(getTicksHistory × N)`) so later rotations are zero-latency state swaps rather than fresh network fetches; the first symbol of the cycle becomes the starting symbol. Symbols that fail to warm are dropped from the rotation via `rotation.setPool(ok)` and logged as warnings. With rotation off, only `config.symbol` is warmed. Feeds the active `AdaptiveThresholdEngine` with the sensitivity multiplier from `SENSITIVITY_LEVELS` (low 1.0, medium 1.5, high 2.0, elite 3.0), calls `SignalScorer`, then places a trade when **all** of: not paused, signal strength ≥ `minStrength`, open contracts < `maxConcurrent`. Trade duration follows precedence fuzz > adaptive > fixed: `pickFuzzDuration(min,max)` when `fuzzDuration.enabled`, else `signal.suggestedDuration` when `adaptiveDuration`, else `config.duration`. Dry-run path uses a negative fake `contractId` and resolves via `setTimeout(duration·1000ms)` by comparing the current store tick to the entry spot. Live path buys with `duration_unit: 't'` (ticks) and closes via `proposal_open_contract` stream when `is_sold === 1`. After a trade is placed (dry or live), `scheduleRotation()` queues a microtask that rotates `currentSymbol` via `changeSymbol(rotation.next())` — the pre-warmed engine takes over immediately while prior contracts keep resolving on the old symbol. `onTick` ignores ticks whose `symbol` doesn't match `currentSymbol`, so any late ticks from a still-draining subscription can't poison the wrong engine. `updateConfig()` hot-swaps `this.config`, rebuilds the `RotationScheduler` if `rotation.pool` changed (background-warming newly added pool members so the next rotation doesn't stall), and resets the scheduler when rotation is turned off. `changeSymbol()` does `forgetAll(['ticks'])` → switch `activeState` to the target symbol's pre-warmed entry (falls back to on-demand warm if missing) → resubscribe. Martingale state (`mgStep`, `mgConsecLosses`) is **global** across all symbols — a loss on A arms the next trade on B. The trader emits to the transcript (signal detections, trade-open, trade-close, rotation status, warm-up metrics, errors).

- **`src/trading/controller.ts`** — `BotController` is a thin wrapper the UI/commands own. It holds the single `Trader | null` reference, exposes `isRunning()`, `start()`, `stop()`, `updateConfig(patch)`. `start()` rejects if already running; `updateConfig` routes `symbol` changes to `trader.changeSymbol` while forwarding the full config to `trader.updateConfig` on every call. Config is stored in Zustand (`state.config`) so the Header re-renders on mutation.

- **`src/engine/rotation.ts`** — `RotationScheduler` holds the shuffled queue for the current cycle plus the last-emitted symbol. `next()` pops the head, refilling with a fresh Fisher-Yates permutation when empty and swapping out a leading duplicate when pool ≥2. `pickFuzzDuration(min,max)` → uniform integer in `[min..max]`.

- **`src/state/store.ts`** — single Zustand store holding **config** (source of truth, mutated by `BotController`), connection status, account, last tick/threshold, open trades, `SessionStats`, a capped `transcript` (`MAX_TRANSCRIPT=400`, visible tail `TRANSCRIPT_VISIBLE=30`), and a `menuStack: MenuDefinition[]` for nested selection menus. Session stats are updated in `closeTrade`; balance is adjusted by `trade.profit` locally (balance stream from WS also updates it authoritatively). `resetRuntime()` wipes non-config state before a fresh `/start`. **The Trader writes to the store via `useStore.getState()` from outside React** — don't try to use store hooks inside trader/engine code.

- **`src/commands/registry.ts`** — the command table (`name`, `aliases`, `usage`, `description`, `handler(args, ctx)`) + `dispatchCommand(input, ctx)` + `findCommand(name)`. `CommandContext` exposes `controller`, `append`, `clearTranscript`, `exit`. Add new commands here; `CommandMenu` picks them up automatically for autocomplete.

- **`src/ui/`** — `App.tsx` owns the `BotController` in a ref and the command dispatch. Layout: `Header` (banner + reactive status strip) / `Transcript` (tail of the store transcript, kind-tagged + timestamped) / either `MenuStack` (when `menuStack.length > 0`) or `Prompt` (text input with inline `CommandMenu`). No auto-start — bot boots only when the user runs `/start`.

- **`src/ui/components/SelectMenu.tsx`** — renders one menu from the stack at a time; only the top instance captures input (via `useInput({ isActive: isTop })`). Items support a `checked` state (renders `[x]`/`[ ]`) for toggle/multi-select workflows. `MenuController` (in `src/ui/menu.ts`) exposes `close`/`closeAll`/`replace`/`push`/`log` so item handlers can either resolve, reopen with new state, or push a child menu.

- **`src/cli/args.ts`** — hand-rolled `--flag value` / `--flag=value` parser. Every flag has an env-var fallback. Throws `ArgParseError` with a message shown above `helpText()` on invalid input. Flags set *session defaults* only; the REPL opens regardless of whether `--token` was provided.

