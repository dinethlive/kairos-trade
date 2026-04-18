export type SensitivityLevel = 'low' | 'medium' | 'high' | 'elite';

export const SENSITIVITY_LEVELS: Record<SensitivityLevel, { label: string; multiplier: number }> = {
  low:    { label: 'Low',    multiplier: 1.0 },
  medium: { label: 'Medium', multiplier: 1.5 },
  high:   { label: 'High',   multiplier: 2.0 },
  elite:  { label: 'Elite',  multiplier: 3.0 },
} as const;

export const SENSITIVITY_ORDER: SensitivityLevel[] = ['low', 'medium', 'high', 'elite'];

export function isSensitivityLevel(v: string): v is SensitivityLevel {
  return v === 'low' || v === 'medium' || v === 'high' || v === 'elite';
}
