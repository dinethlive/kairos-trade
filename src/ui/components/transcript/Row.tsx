import React from 'react';
import { Box, Text } from 'ink';
import { theme, fmtTime } from '../../theme';
import type { TranscriptLine } from '../../../types';
import { TAG_WIDTH, BAR } from './constants';
import { labelFor } from './labels';
import { renderBody } from './body';

export const Row = React.memo(
  function Row({ line }: { line: TranscriptLine }) {
    const meta = labelFor(line.kind, line.text);
    const padded = meta.label.padEnd(TAG_WIDTH, ' ');
    return (
      <Box>
        <Text color={theme.dim}>{fmtTime(line.ts)}</Text>
        <Text color={meta.color}> {BAR} </Text>
        <Text color={meta.color} bold>
          {padded}
        </Text>
        <Text> </Text>
        {renderBody(line.kind, line.text)}
      </Box>
    );
  },
  (prev, next) => prev.line.id === next.line.id,
);
