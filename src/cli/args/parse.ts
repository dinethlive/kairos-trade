import {
  DEFAULT_APP_ID,
  DEFAULT_DURATION_TICKS,
  DEFAULT_MIN_STRENGTH,
  DEFAULT_SENSITIVITY,
  DEFAULT_STAKE,
  DEFAULT_SYMBOL,
  DEFAULT_MG_MODE,
  DEFAULT_MG_MULTIPLIER,
  DEFAULT_MG_MAX_STEPS,
  DEFAULT_MG_ARM_AFTER,
  DEFAULT_MG_ON_CAP,
  DEFAULT_MG_STOP_LOSS,
  DEFAULT_ADAPTIVE_DURATION,
  DEFAULT_COOLDOWN_TICKS,
} from '../../constants/api';
import { isSensitivityLevel, type SensitivityLevel } from '../../constants/sensitivity';
import type { MartingaleMode, MartingaleOnCap } from '../../trading/trader';

export interface ParsedArgs {
  token: string;
  appId: string;
  accountId: string | null;
  symbol: string;
  stake: number;
  duration: number;
  sensitivity: SensitivityLevel;
  minStrength: 1 | 2 | 3;
  maxConcurrent: number;
  dryRun: boolean;
  adaptiveDuration: boolean;
  cooldownTicks: number;
  mgMode: MartingaleMode;
  mgMultiplier: number;
  mgMaxSteps: number;
  mgArmAfter: number;
  mgMaxStake: number | null;
  mgStopLoss: number | null;
  mgTakeProfit: number | null;
  mgOnCap: MartingaleOnCap;
  showHelp: boolean;
  showVersion: boolean;
}

export interface RawArgs {
  argv: string[];
  env: Record<string, string | undefined>;
}

export class ArgParseError extends Error {}

export function parseArgs({ argv, env }: RawArgs): ParsedArgs {
  const flags = new Map<string, string | boolean>();

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const [rawKey, inline] = a.slice(2).split('=', 2);
    const key = rawKey!;
    if (inline !== undefined) {
      flags.set(key, inline);
      continue;
    }
    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags.set(key, next);
      i++;
    } else {
      flags.set(key, true);
    }
  }

  const showHelp = flags.has('help') || flags.has('h');
  const showVersion = flags.has('version') || flags.has('v');

  const token =
    (flags.get('token') as string | undefined) ??
    env.KAIROS_TRADE_TOKEN ??
    env.KAIROS_TOKEN ??
    env.DERIV_TOKEN ??
    '';

  const appId =
    (flags.get('app-id') as string | undefined) ??
    env.KAIROS_TRADE_APP_ID ??
    env.KAIROS_APP_ID ??
    DEFAULT_APP_ID;

  const accountId =
    (flags.get('account-id') as string | undefined) ??
    env.KAIROS_TRADE_ACCOUNT_ID ??
    env.KAIROS_ACCOUNT_ID ??
    null;

  const symbol =
    (flags.get('symbol') as string | undefined) ??
    env.KAIROS_TRADE_SYMBOL ??
    env.KAIROS_SYMBOL ??
    DEFAULT_SYMBOL;

  const stakeRaw =
    (flags.get('stake') as string | undefined) ??
    env.KAIROS_TRADE_STAKE ??
    env.KAIROS_STAKE ??
    String(DEFAULT_STAKE);
  const stake = Number(stakeRaw);
  if (!Number.isFinite(stake) || stake <= 0) {
    throw new ArgParseError(`invalid --stake: ${stakeRaw}`);
  }

  const durationRaw =
    (flags.get('duration') as string | undefined) ??
    (flags.get('ticks') as string | undefined) ??
    env.KAIROS_TRADE_DURATION ??
    env.KAIROS_DURATION ??
    String(DEFAULT_DURATION_TICKS);
  const duration = Number(durationRaw);
  if (!Number.isFinite(duration) || duration < 1) {
    throw new ArgParseError(`invalid --duration (ticks): ${durationRaw}`);
  }

  const sensRaw = (
    (flags.get('sensitivity') as string | undefined) ??
    env.KAIROS_TRADE_SENSITIVITY ??
    env.KAIROS_SENSITIVITY ??
    DEFAULT_SENSITIVITY
  ).toLowerCase();
  if (!isSensitivityLevel(sensRaw)) {
    throw new ArgParseError(`invalid --sensitivity (low|medium|high|elite): ${sensRaw}`);
  }

  const minStrRaw =
    (flags.get('min-strength') as string | undefined) ??
    env.KAIROS_TRADE_MIN_STRENGTH ??
    env.KAIROS_MIN_STRENGTH ??
    String(DEFAULT_MIN_STRENGTH);
  const minStr = Number(minStrRaw);
  if (minStr !== 1 && minStr !== 2 && minStr !== 3) {
    throw new ArgParseError(`invalid --min-strength (1|2|3): ${minStrRaw}`);
  }

  const maxConcurrentRaw =
    (flags.get('max-concurrent') as string | undefined) ?? '1';
  const maxConcurrent = Number(maxConcurrentRaw);
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new ArgParseError(`invalid --max-concurrent: ${maxConcurrentRaw}`);
  }

  const dryRun = Boolean(flags.get('dry-run'));

  const adaptiveRaw =
    (flags.get('adaptive') as string | boolean | undefined) ??
    env.KAIROS_TRADE_ADAPTIVE ??
    env.KAIROS_ADAPTIVE;
  let adaptiveDuration: boolean;
  if (adaptiveRaw === undefined) {
    adaptiveDuration = DEFAULT_ADAPTIVE_DURATION;
  } else if (adaptiveRaw === true) {
    adaptiveDuration = true;
  } else {
    const v = String(adaptiveRaw).toLowerCase();
    if (v === 'on' || v === 'true' || v === '1') adaptiveDuration = true;
    else if (v === 'off' || v === 'false' || v === '0') adaptiveDuration = false;
    else throw new ArgParseError(`invalid --adaptive (on|off): ${adaptiveRaw}`);
  }

  const cooldownRaw =
    (flags.get('cooldown') as string | undefined) ??
    env.KAIROS_TRADE_COOLDOWN ??
    env.KAIROS_COOLDOWN ??
    String(DEFAULT_COOLDOWN_TICKS);
  const cooldownTicks = Number(cooldownRaw);
  if (!Number.isInteger(cooldownTicks) || cooldownTicks < 0) {
    throw new ArgParseError(`invalid --cooldown (integer ≥ 0): ${cooldownRaw}`);
  }

  const mgModeRaw = (
    (flags.get('mg') as string | undefined) ??
    env.KAIROS_TRADE_MG ??
    env.KAIROS_MG ??
    DEFAULT_MG_MODE
  ).toLowerCase();
  if (mgModeRaw !== 'off' && mgModeRaw !== 'classic') {
    throw new ArgParseError(`invalid --mg (off|classic): ${mgModeRaw}`);
  }
  const mgMode = mgModeRaw as MartingaleMode;

  const mgMultRaw =
    (flags.get('mg-mult') as string | undefined) ??
    env.KAIROS_TRADE_MG_MULT ??
    env.KAIROS_MG_MULT ??
    String(DEFAULT_MG_MULTIPLIER);
  const mgMultiplier = Number(mgMultRaw);
  if (!Number.isFinite(mgMultiplier) || mgMultiplier <= 1) {
    throw new ArgParseError(`invalid --mg-mult (>1): ${mgMultRaw}`);
  }

  const mgMaxStepsRaw =
    (flags.get('mg-max-steps') as string | undefined) ??
    env.KAIROS_TRADE_MG_MAX_STEPS ??
    env.KAIROS_MG_MAX_STEPS ??
    String(DEFAULT_MG_MAX_STEPS);
  const mgMaxSteps = Number(mgMaxStepsRaw);
  if (!Number.isInteger(mgMaxSteps) || mgMaxSteps < 1) {
    throw new ArgParseError(`invalid --mg-max-steps (integer ≥ 1): ${mgMaxStepsRaw}`);
  }

  const mgArmAfterRaw =
    (flags.get('mg-arm-after') as string | undefined) ??
    env.KAIROS_TRADE_MG_ARM_AFTER ??
    env.KAIROS_MG_ARM_AFTER ??
    String(DEFAULT_MG_ARM_AFTER);
  const mgArmAfter = Number(mgArmAfterRaw);
  if (!Number.isInteger(mgArmAfter) || mgArmAfter < 0) {
    throw new ArgParseError(`invalid --mg-arm-after (integer ≥ 0): ${mgArmAfterRaw}`);
  }

  const parseOptionalNum = (
    flag: string,
    envKey: string,
    fallback: number | null = null,
    legacyEnvKey?: string,
  ): number | null => {
    const raw =
      (flags.get(flag) as string | undefined) ??
      env[envKey] ??
      (legacyEnvKey ? env[legacyEnvKey] : undefined);
    if (raw === undefined) return fallback;
    if (raw === '' || raw === 'off') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      throw new ArgParseError(`invalid --${flag} (positive number or "off"): ${raw}`);
    }
    return n;
  };
  const mgMaxStake = parseOptionalNum('mg-max-stake', 'KAIROS_TRADE_MG_MAX_STAKE', null, 'KAIROS_MG_MAX_STAKE');
  const mgStopLoss = parseOptionalNum('mg-stop-loss', 'KAIROS_TRADE_MG_STOP_LOSS', DEFAULT_MG_STOP_LOSS, 'KAIROS_MG_STOP_LOSS');
  const mgTakeProfit = parseOptionalNum('mg-take-profit', 'KAIROS_TRADE_MG_TAKE_PROFIT', null, 'KAIROS_MG_TAKE_PROFIT');

  const mgOnCapRaw = (
    (flags.get('mg-on-cap') as string | undefined) ??
    env.KAIROS_TRADE_MG_ON_CAP ??
    env.KAIROS_MG_ON_CAP ??
    DEFAULT_MG_ON_CAP
  ).toLowerCase();
  if (mgOnCapRaw !== 'reset' && mgOnCapRaw !== 'pause' && mgOnCapRaw !== 'stop') {
    throw new ArgParseError(`invalid --mg-on-cap (reset|pause|stop): ${mgOnCapRaw}`);
  }
  const mgOnCap = mgOnCapRaw as MartingaleOnCap;

  return {
    token,
    appId,
    accountId,
    symbol,
    stake,
    duration: Math.floor(duration),
    sensitivity: sensRaw,
    minStrength: minStr as 1 | 2 | 3,
    maxConcurrent,
    dryRun,
    adaptiveDuration,
    cooldownTicks,
    mgMode,
    mgMultiplier,
    mgMaxSteps,
    mgArmAfter,
    mgMaxStake,
    mgStopLoss,
    mgTakeProfit,
    mgOnCap,
    showHelp,
    showVersion,
  };
}
