import React from 'react';
import { Box, Text } from 'ink';
import { theme } from '../../theme';

export function Card({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={accent}
      paddingX={1}
      flexGrow={1}
      flexBasis={0}
    >
      <Box>
        <Text color={accent} bold>
          {icon} {title}
        </Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {children}
      </Box>
    </Box>
  );
}

export function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box>
      <Box width={12}>
        <Text color={theme.dim}>{label}</Text>
      </Box>
      <Text>{children}</Text>
    </Box>
  );
}

export function Gauge({ filled, total, color }: { filled: number; total: number; color: string }) {
  const f = Math.max(0, Math.min(total, filled));
  return (
    <Text>
      <Text color={color}>{'▰'.repeat(f)}</Text>
      <Text color={theme.muted}>{'▱'.repeat(total - f)}</Text>
    </Text>
  );
}

export function StrengthGauge({ threshold }: { threshold: number }) {
  const total = 3;
  const t = Math.max(0, Math.min(total, threshold));
  return (
    <Text>
      {Array.from({ length: total }).map((_, i) => {
        const on = i < t;
        return (
          <Text key={i} color={on ? theme.warn : theme.muted}>
            {on ? '▰' : '▱'}
          </Text>
        );
      })}
    </Text>
  );
}

export function WinRateBar({ pct, hasTrades }: { pct: number; hasTrades: boolean }) {
  const width = 8;
  if (!hasTrades) {
    return <Text color={theme.muted}>{'░'.repeat(width)}</Text>;
  }
  const filled = Math.round(pct * width);
  const color = pct >= 0.55 ? theme.up : pct >= 0.45 ? theme.warn : theme.down;
  return (
    <Text>
      <Text color={color}>{'█'.repeat(filled)}</Text>
      <Text color={theme.muted}>{'░'.repeat(width - filled)}</Text>
    </Text>
  );
}
