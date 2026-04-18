import { openBooleanMenu } from '../menus/boolean';
import { parseOnOff } from '../util';
import type { Command } from '../types';

export const dryRunCommand: Command = {
  name: 'dryrun',
  aliases: ['dry-run', 'dry'],
  usage: '/dryrun [on|off]',
  description: 'Toggle paper trading (no arg opens menu)',
  async handler(args, ctx) {
    if (!args[0]) {
      openBooleanMenu(ctx, {
        title: 'Dry run',
        subtitle: 'Simulate fills off the live tick stream (no real buys).',
        current: ctx.controller.config.dryRun,
        apply: async (b) => {
          await ctx.controller.updateConfig({ dryRun: b });
          ctx.append('info', `dry-run = ${b ? 'on' : 'off'}`);
        },
      });
      return;
    }
    const b = parseOnOff(args[0]);
    if (b === null) {
      ctx.append('error', 'usage: /dryrun <on|off>');
      return;
    }
    await ctx.controller.updateConfig({ dryRun: b });
    ctx.append('info', `dry-run = ${b ? 'on' : 'off'}`);
  },
};
