import { handleMartingale } from '../handlers/martingale';
import type { Command } from '../types';

export const martingaleCommand: Command = {
  name: 'martingale',
  aliases: ['mg'],
  usage: '/martingale <sub> [args]',
  description: 'Martingale loss-recovery stake scaling (use /mg help for subs)',
  async handler(args, ctx) {
    await handleMartingale(args, ctx);
  },
};
