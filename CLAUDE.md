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
- `/symbol <sym>` — hot-swaps the tick subscription if bot is running.
- `/stake`, `/duration`, `/sensitivity`, `/minstrength`, `/maxconcurrent`, `/dryrun` — mutate `TraderConfig` live.
- `/rotate [on|off|status]` — multi-symbol rotation.
- `/pool [list|add|remove|clear|reset|refresh]` — manage the rotation pool.
- `/fuzzduration [on|off|<min> <max>]` — per-trade random tick duration.
- `/clear`, `/help [cmd]`, `/quit`.

Input: `/` triggers an autocomplete menu (filtered by prefix, up/down to navigate, Tab to complete, Enter to submit). Command history (↑/↓ when menu isn't visible) is in-memory only. `Ctrl+C` initiates a graceful shutdown.
