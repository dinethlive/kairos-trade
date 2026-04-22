import type { SensitivityLevel } from '../constants/sensitivity';

export type MartingaleMode = 'off' | 'classic';
export type MartingaleOnCap = 'reset' | 'pause' | 'stop';

export interface MartingaleConfig {
  mode: MartingaleMode;
  multiplier: number;
  maxSteps: number;
  armAfterLosses: number;
  maxStake: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  onCap: MartingaleOnCap;
}

export interface RotationConfig {
  enabled: boolean;
  pool: string[];
}

export interface FuzzDurationConfig {
  enabled: boolean;
  minTicks: number;
  maxTicks: number;
}

export interface SniperConfig {
  enabled: boolean;
  lossThreshold: number;
  martingaleEnabled: boolean;
}

export interface TraderConfig {
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
  martingale: MartingaleConfig;
  rotation: RotationConfig;
  fuzzDuration: FuzzDurationConfig;
  sniper: SniperConfig;
}
