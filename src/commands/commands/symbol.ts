import type { Command } from '../types';

export const symbolCommand: Command = {
  name: 'symbol',
  usage: '/symbol <symbol>',
  description: 'Change market symbol (hot-swap if running)',
  async handler(args, ctx) {
    const sym = args[0];
    if (!sym) {
      ctx.append('error', 'usage: /symbol <symbol>  (e.g. 1HZ100V, R_100)');
      return;
    }
    try {
      await ctx.controller.updateConfig({ symbol: sym });
      ctx.append('info', `symbol = ${sym}`);
    } catch (err) {
      ctx.append('error', err instanceof Error ? err.message : String(err));
    }
  },
};
