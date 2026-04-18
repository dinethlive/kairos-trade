import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { theme } from '../theme';
import type { MenuController, MenuDefinition, MenuItem } from '../menu';
import { useStore } from '../../state/store';

interface Props {
  menu: MenuDefinition;
  depth: number;
  isTop: boolean;
}

const VISIBLE = 10;

export function SelectMenu({ menu, depth, isTop }: Props) {
  const [idx, setIdx] = useState(0);
  const [busy, setBusy] = useState(false);

  const items = menu.items;
  const safeIdx = Math.max(0, Math.min(idx, items.length - 1));

  const controller: MenuController = {
    close: () => useStore.getState().popMenu(),
    closeAll: () => useStore.getState().clearMenus(),
    replace: (next) => useStore.getState().replaceTopMenu(next),
    push: (child) => useStore.getState().pushMenu(child),
    log: (text, kind = 'info') => useStore.getState().append(kind, text),
  };

  useInput(
    (input, key) => {
      if (!isTop || busy) return;

      if (key.escape || (key.leftArrow && depth > 0)) {
        if (menu.onCancel) menu.onCancel();
        useStore.getState().popMenu();
        return;
      }

      if (key.upArrow) {
        setIdx((i) => (i <= 0 ? items.length - 1 : i - 1));
        return;
      }
      if (key.downArrow) {
        setIdx((i) => (i >= items.length - 1 ? 0 : i + 1));
        return;
      }

      // Number hotkeys (1-9) for quick selection
      if (input && /^[1-9]$/.test(input)) {
        const n = Number(input) - 1;
        if (n < items.length) {
          setIdx(n);
          const item = items[n]!;
          if (!item.disabled) void invokeItem(item);
        }
        return;
      }

      if (key.return) {
        const item = items[safeIdx];
        if (!item || item.disabled) return;
        void invokeItem(item);
      }
    },
    { isActive: isTop },
  );

  const invokeItem = async (item: MenuItem): Promise<void> => {
    setBusy(true);
    try {
      await item.onSelect(controller);
    } catch (err) {
      useStore
        .getState()
        .append('error', err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  // Scroll window
  let windowStart = 0;
  if (items.length > VISIBLE) {
    if (safeIdx < VISIBLE - 1) windowStart = 0;
    else if (safeIdx >= items.length - 1) windowStart = items.length - VISIBLE;
    else {
      windowStart = safeIdx - Math.floor(VISIBLE / 2) + 1;
      windowStart = Math.max(0, Math.min(windowStart, items.length - VISIBLE));
    }
  }
  const windowEnd = Math.min(items.length, windowStart + VISIBLE);
  const visible = items.slice(windowStart, windowEnd);
  const hiddenAbove = windowStart;
  const hiddenBelow = items.length - windowEnd;

  const footer =
    menu.footer ??
    `↑↓ nav · Enter select · Esc back · 1-9 quick · ${safeIdx + 1}/${items.length}`;

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color={theme.accent} bold>
        {depth > 0 ? '‹ ' : ''}
        {menu.title}
      </Text>
      {menu.subtitle && <Text color={theme.dim}>{menu.subtitle}</Text>}
      {hiddenAbove > 0 && <Text color={theme.dim}>↑ {hiddenAbove} more…</Text>}
      {visible.map((item, i) => {
        const absIdx = windowStart + i;
        const selected = absIdx === safeIdx;
        const mark =
          item.checked === true ? '[x] ' : item.checked === false ? '[ ] ' : '';
        const labelColor = item.disabled
          ? theme.dim
          : selected
            ? theme.accent
            : theme.fg;
        return (
          <Box key={`${absIdx}-${item.label}`}>
            <Text color={selected ? theme.accent : theme.dim} bold={selected}>
              {selected ? '›' : ' '}
            </Text>
            <Text color={labelColor} bold={selected}>
              {` ${mark}${item.label}`}
            </Text>
            {item.hint && (
              <Text color={theme.dim}>{`  ${item.hint}`}</Text>
            )}
          </Box>
        );
      })}
      {hiddenBelow > 0 && <Text color={theme.dim}>↓ {hiddenBelow} more…</Text>}
      <Text color={theme.dim}>
        {busy ? 'working…' : footer}
      </Text>
    </Box>
  );
}

export function MenuStack() {
  const menuStack = useStore((s) => s.menuStack);
  if (menuStack.length === 0) return null;
  return (
    <Box flexDirection="column">
      {menuStack.map((m, i) => (
        <SelectMenu
          key={m.id + ':' + i}
          menu={m}
          depth={i}
          isTop={i === menuStack.length - 1}
        />
      ))}
    </Box>
  );
}
