import { useStore } from '../../state/store';
import type { Command } from '../types';

export const startCommand: Command = {
  name: 'start',
  usage: '/start',
  description: 'Connect to Deriv and start auto-trading',
  async handler(_args, ctx) {
    if (ctx.controller.isRunning()) {
      ctx.append('error', 'bot is already running — use /stop first');
      return;
    }
    ctx.append('info', 'starting…');
    try {
      await ctx.controller.start();
    } catch (err) {
      ctx.append('error', err instanceof Error ? err.message : String(err));
    }
  },
};

export const stopCommand: Command = {
  name: 'stop',
  usage: '/stop',
  description: 'Disconnect and stop the bot (REPL stays open)',
  async handler(_args, ctx) {
    if (!ctx.controller.isRunning()) {
      ctx.append('warn', 'bot is not running');
      return;
    }
    try {
      await ctx.controller.stop();
    } catch (err) {
      ctx.append('error', err instanceof Error ? err.message : String(err));
    }
  },
};

export const pauseCommand: Command = {
  name: 'pause',
  usage: '/pause',
  description: 'Pause trade placement (ticks keep flowing)',
  handler(_args, ctx) {
    const s = useStore.getState();
    if (s.paused) {
      ctx.append('warn', 'already paused');
      return;
    }
    s.setPaused(true);
    ctx.append('info', 'paused — signals will be logged but no trades placed');
  },
};

export const resumeCommand: Command = {
  name: 'resume',
  aliases: ['unpause'],
  usage: '/resume',
  description: 'Resume trade placement',
  handler(_args, ctx) {
    const s = useStore.getState();
    if (!s.paused) {
      ctx.append('warn', 'not paused');
      return;
    }
    s.setPaused(false);
    ctx.append('info', 'resumed');
  },
};

export const clearCommand: Command = {
  name: 'clear',
  aliases: ['cls'],
  usage: '/clear',
  description: 'Clear the transcript',
  handler(_args, ctx) {
    ctx.clearTranscript();
  },
};

export const quitCommand: Command = {
  name: 'quit',
  aliases: ['exit', 'q'],
  usage: '/quit',
  description: 'Stop the bot and exit kairos-trade',
  async handler(_args, ctx) {
    ctx.exit();
  },
};
