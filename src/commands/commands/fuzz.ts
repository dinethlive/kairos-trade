import { openFuzzMenu } from '../menus/fuzz';
import { parseOnOff } from '../util';
import type { Command } from '../types';

export const fuzzDurationCommand: Command = {
  name: 'fuzzduration',
  aliases: ['fuzz', 'fuzz-duration'],
  usage: '/fuzzduration [on|off|<min> <max>]',
  description: 'Random tick-duration per trade in [min..max] (no arg opens menu)',
  async handler(args, ctx) {
    const cur = ctx.controller.config.fuzzDuration;
    if (args.length === 0) {
      openFuzzMenu(ctx);
      return;
    }
    const v = args[0]!.toLowerCase();
    if (v === 'status') {
      ctx.append(
        'info',
        `fuzz = ${cur.enabled ? 'on' : 'off'} · range ${cur.minTicks}..${cur.maxTicks}t`,
      );
      return;
    }
    const b = parseOnOff(v);
    if (b !== null) {
      await ctx.controller.updateConfig({ fuzzDuration: { ...cur, enabled: b } });
      ctx.append(
        'info',
        b ? `fuzz = on · range ${cur.minTicks}..${cur.maxTicks}t` : 'fuzz = off',
      );
      return;
    }
    const min = Number(args[0]);
    const max = Number(args[1]);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
      ctx.append('error', 'usage: /fuzzduration <minTicks> <maxTicks>   (integers, min≥1, max≥min)');
      return;
    }
    await ctx.controller.updateConfig({
      fuzzDuration: { enabled: true, minTicks: min, maxTicks: max },
    });
    ctx.append('info', `fuzz = on · range ${min}..${max}t`);
  },
};
