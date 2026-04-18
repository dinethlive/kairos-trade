import { isSensitivityLevel } from '../../constants/sensitivity';
import { openSensitivityMenu } from '../menus/sensitivity';
import { openMinStrengthMenu } from '../menus/minStrength';
import type { Command } from '../types';

export const sensitivityCommand: Command = {
  name: 'sensitivity',
  aliases: ['sens'],
  usage: '/sensitivity [low|medium|high|elite]',
  description: 'Set signal sensitivity (no arg opens menu)',
  async handler(args, ctx) {
    const raw = (args[0] ?? '').toLowerCase();
    if (!raw) {
      openSensitivityMenu(ctx);
      return;
    }
    if (!isSensitivityLevel(raw)) {
      ctx.append('error', 'usage: /sensitivity <low|medium|high|elite>');
      return;
    }
    await ctx.controller.updateConfig({ sensitivity: raw });
    ctx.append('info', `sensitivity = ${raw}`);
  },
};

export const minStrengthCommand: Command = {
  name: 'minstrength',
  aliases: ['min-strength', 'minstr'],
  usage: '/minstrength [1|2|3]',
  description: 'Minimum signal strength (no arg opens menu)',
  async handler(args, ctx) {
    if (args.length === 0) {
      openMinStrengthMenu(ctx);
      return;
    }
    const n = Number(args[0]);
    if (n !== 1 && n !== 2 && n !== 3) {
      ctx.append('error', 'usage: /minstrength <1|2|3>');
      return;
    }
    await ctx.controller.updateConfig({ minStrength: n as 1 | 2 | 3 });
    ctx.append('info', `min-strength = ${n}`);
  },
};
