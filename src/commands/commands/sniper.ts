import { useStore } from '../../state/store';
import { openSniperMenu } from '../menus/sniper';
import { parseOnOff } from '../util';
import type { Command } from '../types';

export const sniperCommand: Command = {
  name: 'sniper',
  aliases: ['snipe'],
  usage: '/sniper [on|off|status|losses <n>|mg <on|off>|reset]',
  description:
    'Simulate trades locally, fire a real one only after N consecutive sim losses',
  async handler(args, ctx) {
    const sub = (args[0] ?? '').toLowerCase();
    const cur = ctx.controller.config.sniper;
    const rt = useStore.getState().sniper;

    if (!sub) {
      openSniperMenu(ctx);
      return;
    }

    if (sub === 'status') {
      const armed = rt.consecLosses >= cur.lossThreshold;
      ctx.append(
        'info',
        `sniper: ${cur.enabled ? 'on' : 'off'} · threshold ${cur.lossThreshold} · mg ${cur.martingaleEnabled ? 'on' : 'off'}`,
      );
      ctx.append(
        'info',
        `runtime: streak ${rt.consecLosses}/${cur.lossThreshold}${armed ? ' (armed — next trade real)' : ''} · sim ${rt.simWins}W/${rt.simLosses}L · real fired ${rt.realTrades}`,
      );
      return;
    }

    if (sub === 'reset') {
      ctx.controller.resetSniper();
      ctx.append('info', 'sniper streak cleared');
      return;
    }

    if (sub === 'losses' || sub === 'loss' || sub === 'threshold') {
      const n = Number(args[1]);
      if (!Number.isInteger(n) || n < 1) {
        ctx.append('error', 'usage: /sniper losses <integer ≥ 1>');
        return;
      }
      await ctx.controller.updateConfig({ sniper: { ...cur, lossThreshold: n } });
      ctx.append('info', `sniper threshold = ${n}`);
      return;
    }

    if (sub === 'mg' || sub === 'martingale') {
      const b = parseOnOff(args[1]);
      if (b === null) {
        ctx.append('error', 'usage: /sniper mg <on|off>');
        return;
      }
      await ctx.controller.updateConfig({
        sniper: { ...cur, martingaleEnabled: b },
      });
      ctx.append('info', `sniper mg = ${b ? 'on' : 'off'}`);
      return;
    }

    const b = parseOnOff(sub);
    if (b === null) {
      ctx.append(
        'error',
        'usage: /sniper <on|off|status|losses <n>|mg <on|off>|reset>',
      );
      return;
    }
    await ctx.controller.updateConfig({ sniper: { ...cur, enabled: b } });
    ctx.append(
      'info',
      b
        ? `sniper = on · threshold ${cur.lossThreshold} · mg ${cur.martingaleEnabled ? 'on' : 'off'}`
        : 'sniper = off',
    );
  },
};
