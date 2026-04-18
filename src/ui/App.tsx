import React, { useEffect, useRef, useState } from 'react';
import { Box, useApp, useInput } from 'ink';
import { Header } from './components/Header';
import { Transcript } from './components/Transcript';
import { Prompt } from './components/Prompt';
import { MenuStack } from './components/SelectMenu';
import { BotController } from '../trading/controller';
import { useStore } from '../state/store';
import { dispatchCommand, type CommandContext } from '../commands/registry';

export function App() {
  const { exit } = useApp();
  const controllerRef = useRef<BotController | null>(null);
  if (controllerRef.current === null) controllerRef.current = new BotController();
  const controller = controllerRef.current;

  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const s = useStore.getState();
    s.append('system', 'kairos-trade — type /help for commands, /start to connect');
    if (!s.config.token) {
      s.append('warn', 'no Deriv token — set KAIROS_TRADE_TOKEN or pass --token before /start');
    }
    return () => {
      if (controller.isRunning()) void controller.stop();
    };
  }, [controller]);

  const doExit = () => {
    if (exiting) return;
    setExiting(true);
    const finish = () => exit();
    useStore.getState().append('info', 'exiting…');
    if (controller.isRunning()) {
      void controller.stop().finally(finish);
    } else {
      finish();
    }
  };

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      doExit();
    }
  });

  const ctx: CommandContext = {
    controller,
    append: (kind, text) => useStore.getState().append(kind, text),
    clearTranscript: () => useStore.getState().clearTranscript(),
    openMenu: (menu) => useStore.getState().pushMenu(menu),
    exit: doExit,
  };

  const onSubmit = (input: string) => {
    useStore.getState().append('cmd', input);
    void dispatchCommand(input, ctx);
  };

  const menuOpen = useStore((s) => s.menuStack.length > 0);

  return (
    <Box flexDirection="column">
      <Header />
      <Transcript />
      {menuOpen ? (
        <MenuStack />
      ) : (
        <Prompt onSubmit={onSubmit} disabled={exiting} />
      )}
    </Box>
  );
}
