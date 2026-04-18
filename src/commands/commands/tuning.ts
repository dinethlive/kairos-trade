import { parseOnOff } from '../util';
import type { Command } from '../types';

export const stakeCommand: Command = {
  name: 'stake',
  usage: '/stake <amount>',
  description: 'Set stake per trade',
  async handler(args, ctx) {
    const n = Number(args[0]);
    if (!Number.isFinite(n) || n <= 0) {
      ctx.append('error', 'usage: /stake <positive number>');
      return;
    }
    await ctx.controller.updateConfig({ stake: n });
    ctx.append('info', `stake = ${n}`);
  },
};

export const durationCommand: Command = {
  name: 'duration',
  aliases: ['ticks'],
  usage: '/duration <ticks>',
  description: 'Set contract duration in ticks (affects new trades)',
  async handler(args, ctx) {
    const n = Number(args[0]);
    if (!Number.isInteger(n) || n < 1) {
      ctx.append('error', 'usage: /duration <integer ≥ 1>');
      return;
    }
    await ctx.controller.updateConfig({ duration: n });
    ctx.append('info', `duration = ${n}t`);
  },
};

export const maxConcurrentCommand: Command = {
  name: 'maxconcurrent',
  aliases: ['max-concurrent', 'maxconc'],
  usage: '/maxconcurrent <n>',
  description: 'Max open trades at once',
  async handler(args, ctx) {
    const n = Number(args[0]);
    if (!Number.isInteger(n) || n < 1) {
      ctx.append('error', 'usage: /maxconcurrent <integer ≥ 1>');
      return;
    }
    await ctx.controller.updateConfig({ maxConcurrent: n });
    ctx.append('info', `max-concurrent = ${n}`);
  },
};

export const adaptiveCommand: Command = {
  name: 'adaptive',
  aliases: ['adapt'],
  usage: '/adaptive <on|off>',
  description: 'Per-signal duration from signal features (uses /duration as upper cap)',
  async handler(args, ctx) {
    const b = parseOnOff(args[0]);
    if (b === null) {
      ctx.append('error', 'usage: /adaptive <on|off>');
      return;
    }
    await ctx.controller.updateConfig({ adaptiveDuration: b });
    ctx.append(
      'info',
      b
        ? `adaptive = on · per-signal hold, capped at ${ctx.controller.config.duration}t`
        : `adaptive = off · fixed ${ctx.controller.config.duration}t holds`,
    );
  },
};

export const cooldownCommand: Command = {
  name: 'cooldown',
  aliases: ['cool', 'cd'],
  usage: '/cooldown <ticks>',
  description: 'Suppress signals for N ticks after one fires (0 = off)',
  async handler(args, ctx) {
    const n = Number(args[0]);
    if (!Number.isInteger(n) || n < 0) {
      ctx.append('error', 'usage: /cooldown <integer ≥ 0>');
      return;
    }
    await ctx.controller.updateConfig({ cooldownTicks: n });
    ctx.append('info', n === 0 ? 'cooldown = off' : `cooldown = ${n}t`);
  },
};
