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
