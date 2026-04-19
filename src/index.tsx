#!/usr/bin/env bun
import React from 'react';
import { render } from 'ink';
import { parseArgs, ArgParseError, helpText } from './cli/args';
import { App } from './ui/App';
import { useStore } from './state/store';
import type { TraderConfig } from './trading/trader';
import {
  DEFAULT_ROTATION_ENABLED,
  DEFAULT_ROTATION_POOL,
  DEFAULT_FUZZ_DURATION_ENABLED,
  DEFAULT_FUZZ_DURATION_MIN,
  DEFAULT_FUZZ_DURATION_MAX,
} from './constants/api';

const VERSION = '0.2.0';

async function main() {
  const argv = process.argv.slice(2);

  let parsed;
  try {
    parsed = parseArgs({ argv, env: process.env as Record<string, string | undefined> });
  } catch (err) {
    if (err instanceof ArgParseError) {
      process.stderr.write(`error: ${err.message}\n`);
      process.stderr.write(helpText());
      process.exit(2);
    }
    throw err;
  }

  if (parsed.showVersion) {
    process.stdout.write(`kairos-trade v${VERSION}\n`);
    return;
  }

  if (parsed.showHelp) {
    process.stdout.write(helpText());
    return;
  }

  const config: TraderConfig = {
    token: parsed.token,
    appId: parsed.appId,
    accountId: parsed.accountId,
    symbol: parsed.symbol,
    stake: parsed.stake,
    duration: parsed.duration,
    sensitivity: parsed.sensitivity,
    minStrength: parsed.minStrength,
    maxConcurrent: parsed.maxConcurrent,
    dryRun: parsed.dryRun,
    adaptiveDuration: parsed.adaptiveDuration,
    cooldownTicks: parsed.cooldownTicks,
    martingale: {
      mode: parsed.mgMode,
      multiplier: parsed.mgMultiplier,
      maxSteps: parsed.mgMaxSteps,
      armAfterLosses: parsed.mgArmAfter,
      maxStake: parsed.mgMaxStake,
      stopLoss: parsed.mgStopLoss,
      takeProfit: parsed.mgTakeProfit,
      onCap: parsed.mgOnCap,
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

  useStore.getState().setConfig(config);

  const { waitUntilExit } = render(<App />);
  await waitUntilExit();
}

main().catch((err) => {
  process.stderr.write(`\nfatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
