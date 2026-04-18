import React from 'react';
import { Box, Text } from 'ink';
import { useStore } from '../../state/store';
import { theme } from '../theme';
import { TRANSCRIPT_VISIBLE } from '../../constants/api';
import { Row } from './transcript/Row';

export function Transcript() {
  const lines = useStore((s) => s.transcript);
  const tail = lines.slice(-TRANSCRIPT_VISIBLE);
  return (
    <Box flexDirection="column" paddingX={1} marginY={1}>
      {tail.length === 0 ? (
        <Text color={theme.dim}>(transcript is empty — type /help to see commands)</Text>
      ) : (
        tail.map((l) => <Row key={l.id} line={l} />)
      )}
    </Box>
  );
}
