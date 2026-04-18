import { openRotationMenu } from '../menus/rotation';
import { openPoolMenu, refreshPoolFromDeriv } from '../menus/pool';
import { parseOnOff } from '../util';
import type { Command } from '../types';

export const rotateCommand: Command = {
  name: 'rotate',
  aliases: ['rotation', 'rot'],
  usage: '/rotate [on|off|status]',
  description: 'Multi-symbol rotation — each trade cycles through the pool',
  async handler(args, ctx) {
    const v = (args[0] ?? '').toLowerCase();
    if (!v) {
      openRotationMenu(ctx);
      return;
    }
    if (v === 'status') {
      const c = ctx.controller.config.rotation;
      ctx.append(
        'info',
        `rotation = ${c.enabled ? 'on' : 'off'} · pool ${c.pool.length}: ${c.pool.join(', ') || '(empty)'}`,
      );
      return;
    }
    const b = parseOnOff(v);
    if (b === null) {
      ctx.append('error', 'usage: /rotate <on|off|status>');
      return;
    }
    const cur = ctx.controller.config.rotation;
    if (b && cur.pool.length < 2) {
      ctx.append(
        'warn',
        'rotation pool has fewer than 2 symbols — use /pool to add more',
      );
    }
    await ctx.controller.updateConfig({
      rotation: { ...cur, enabled: b },
    });
    ctx.append('info', `rotation = ${b ? 'on' : 'off'}`);
  },
};

export const poolCommand: Command = {
  name: 'pool',
  usage: '/pool [list|add <sym>|remove <sym>|clear|reset|refresh]',
  description: 'Manage the rotation symbol pool (no arg opens menu)',
  async handler(args, ctx) {
    const sub = (args[0] ?? '').toLowerCase();
    if (!sub) {
      await openPoolMenu(ctx);
      return;
    }
    const cur = ctx.controller.config.rotation;
    if (sub === 'list') {
      ctx.append('info', `pool (${cur.pool.length}): ${cur.pool.join(', ') || '(empty)'}`);
      return;
    }
    if (sub === 'add') {
      const sym = args[1];
      if (!sym) {
        ctx.append('error', 'usage: /pool add <symbol>');
        return;
      }
      if (cur.pool.includes(sym)) {
        ctx.append('warn', `${sym} already in pool`);
        return;
      }
      await ctx.controller.updateConfig({
        rotation: { ...cur, pool: [...cur.pool, sym] },
      });
      ctx.append('info', `pool += ${sym} (${cur.pool.length + 1})`);
      return;
    }
    if (sub === 'remove' || sub === 'rm' || sub === 'del') {
      const sym = args[1];
      if (!sym) {
        ctx.append('error', 'usage: /pool remove <symbol>');
        return;
      }
      const next = cur.pool.filter((s) => s !== sym);
      if (next.length === cur.pool.length) {
        ctx.append('warn', `${sym} not in pool`);
        return;
      }
      await ctx.controller.updateConfig({ rotation: { ...cur, pool: next } });
      ctx.append('info', `pool -= ${sym} (${next.length})`);
      return;
    }
    if (sub === 'clear') {
      await ctx.controller.updateConfig({ rotation: { ...cur, pool: [] } });
      ctx.append('info', 'pool cleared');
      return;
    }
    if (sub === 'reset') {
      const { DEFAULT_ROTATION_POOL } = await import('../../constants/api');
      await ctx.controller.updateConfig({
        rotation: { ...cur, pool: [...DEFAULT_ROTATION_POOL] },
      });
      ctx.append('info', `pool reset (${DEFAULT_ROTATION_POOL.length})`);
      return;
    }
    if (sub === 'refresh' || sub === 'fetch') {
      await refreshPoolFromDeriv(ctx);
      return;
    }
    ctx.append('error', `unknown /pool subcommand: ${sub}`);
  },
};
