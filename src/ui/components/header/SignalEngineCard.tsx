import React from 'react';
import { Text } from 'ink';
import { theme } from '../../theme';
import { Card, Metric, Gauge, StrengthGauge } from './primitives';
import { SENSITIVITY_LEVELS, SENSITIVITY_ORDER, type SensitivityLevel } from '../../../constants/sensitivity';

export function SignalEngineCard({
  sensitivity,
  minStrength,
  openCount,
  maxConcurrent,
}: {
  sensitivity: SensitivityLevel;
  minStrength: number;
  openCount: number;
  maxConcurrent: number;
}) {
  const sens = SENSITIVITY_LEVELS[sensitivity];
  const sensIndex = SENSITIVITY_ORDER.indexOf(sensitivity);
  return (
    <Card title="SIGNAL ENGINE" icon="◆" accent={theme.accent2}>
      <Metric label="Sensitivity">
        <Text color={theme.accent2} bold>
          {sens.label}
        </Text>
      </Metric>
      <Metric label="Threshold">
        <Gauge filled={sensIndex + 1} total={4} color={theme.accent2} />
        <Text color={theme.dim}> ×{sens.multiplier}</Text>
      </Metric>
      <Metric label="Strength">
        <StrengthGauge threshold={minStrength} />
        <Text color={theme.dim}> ≥ {minStrength}/3</Text>
      </Metric>
      <Metric label="Slots">
        <Gauge
          filled={openCount}
          total={maxConcurrent}
          color={openCount > 0 ? theme.accent : theme.muted}
        />
        <Text color={theme.dim}> {openCount}/{maxConcurrent}</Text>
      </Metric>
    </Card>
  );
}
