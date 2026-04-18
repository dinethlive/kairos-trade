import { listAccounts } from '../../services/derivRest';
import type { Command } from '../types';

export const accountsCommand: Command = {
  name: 'accounts',
  usage: '/accounts',
  description: 'List Deriv accounts visible to your token',
  async handler(_args, ctx) {
    const c = ctx.controller.config;
    if (!c.token) {
      ctx.append('error', 'no token configured');
      return;
    }
    try {
      const accounts = await listAccounts(c.appId, c.token);
      if (accounts.length === 0) {
        ctx.append('warn', 'no accounts returned');
        return;
      }
      ctx.append('info', `accounts (${accounts.length}):`);
      for (const a of accounts) {
        const selected = c.accountId === a.account_id ? ' *' : '';
        ctx.append(
          'info',
          `  ${a.account_id.padEnd(14)} ${a.account_type.padEnd(4)} ${a.status.padEnd(8)} bal ${a.balance.toFixed(2)} ${a.currency}${selected}`,
        );
      }
      if (!c.accountId) {
        ctx.append(
          'info',
          'no account selected — defaults to first active DEMO. Use /account <id> to pick one.',
        );
      }
    } catch (err) {
      ctx.append('error', err instanceof Error ? err.message : String(err));
    }
  },
};

export const accountCommand: Command = {
  name: 'account',
  usage: '/account <account_id|auto>',
  description: 'Select which account to trade on (applied on next /start)',
  async handler(args, ctx) {
    if (ctx.controller.isRunning()) {
      ctx.append('error', 'cannot change account while running — /stop first');
      return;
    }
    const v = args[0];
    if (!v) {
      ctx.append('error', 'usage: /account <account_id>   (or /account auto)');
      return;
    }
    if (v === 'auto' || v === 'default') {
      await ctx.controller.updateConfig({ accountId: null });
      ctx.append('info', 'account = auto (default: first active DEMO)');
      return;
    }
    await ctx.controller.updateConfig({ accountId: v });
    ctx.append('info', `account = ${v}`);
  },
};
