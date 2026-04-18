import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme';
import { CommandMenu, matchCommands } from './CommandMenu';

interface Props {
  onSubmit: (cmd: string) => void;
  disabled?: boolean;
}

export function Prompt({ onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const [menuIdx, setMenuIdx] = useState(0);

  const submit = (line: string) => {
    const v = line.trim();
    if (v.length > 0) {
      onSubmit(v);
      setHistory((h) => (h[h.length - 1] === v ? h : [...h, v]));
    }
    setValue('');
    setHistIdx(null);
    setMenuIdx(0);
  };

  useInput((input, key) => {
    if (disabled) return;

    const matches = matchCommands(value);
    const menuOpen = matches.length > 0;

    if (key.return) {
      if (menuOpen) {
        const pick = matches[Math.min(menuIdx, matches.length - 1)];
        if (pick) {
          const needsArgs = pick.usage.includes('<');
          if (needsArgs) {
            setValue('/' + pick.name + ' ');
            setMenuIdx(0);
            return;
          }
          submit('/' + pick.name);
          return;
        }
      }
      submit(value);
      return;
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      setMenuIdx(0);
      return;
    }

    if (key.upArrow) {
      if (menuOpen) {
        setMenuIdx((i) => (i <= 0 ? matches.length - 1 : i - 1));
        return;
      }
      if (history.length === 0) return;
      const idx = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setValue(history[idx] ?? '');
      return;
    }

    if (key.downArrow) {
      if (menuOpen) {
        setMenuIdx((i) => (i >= matches.length - 1 ? 0 : i + 1));
        return;
      }
      if (histIdx === null) return;
      const idx = histIdx + 1;
      if (idx >= history.length) {
        setHistIdx(null);
        setValue('');
      } else {
        setHistIdx(idx);
        setValue(history[idx] ?? '');
      }
      return;
    }

    if (key.tab) {
      if (menuOpen) {
        const pick = matches[Math.min(menuIdx, matches.length - 1)];
        if (pick) {
          setValue('/' + pick.name + ' ');
          setMenuIdx(0);
        }
      }
      return;
    }

    if (key.escape) {
      if (menuOpen) {
        setValue('');
        setMenuIdx(0);
        return;
      }
      setValue('');
      setHistIdx(null);
      setMenuIdx(0);
      return;
    }

    if (key.ctrl || key.meta) return;

    if (input && input.length > 0) {
      setValue((v) => v + input);
      setMenuIdx(0);
    }
  });

  return (
    <Box flexDirection="column">
      <Box paddingX={1}>
        <Text color={theme.accent} bold>
          {'> '}
        </Text>
        <Text>{value}</Text>
        <Text color={theme.dim}>_</Text>
      </Box>
      <CommandMenu query={value} highlight={menuIdx} />
    </Box>
  );
}
