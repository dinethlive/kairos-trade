import { useStore } from '../../state/store';
import { winRate } from '../../trading/session';
import type { Command } from '../types';

export const statusCommand: Command = {
  name: 'status',
  usage: '/status',
  description: 'Show bot state, config, and session stats',
  handler(_args, ctx) {
    const s = useStore.getState();
    const c = ctx.controller.config;
    const running = ctx.controller.isRunning();
    ctx.append(
      'info',
      `state: ${running ? s.status : 'not started'}${s.paused ? ' · paused' : ''}`,
    );
    ctx.append(
      'info',
      `cfg: symbol=${c.symbol} stake=${c.stake} dur=${c.duration}t${c.adaptiveDuration ? ' (adaptive cap)' : ''} sens=${c.sensitivity} min-str=${c.minStrength} max-conc=${c.maxConcurrent} cooldown=${c.cooldownTicks}t dry=${c.dryRun ? 'on' : 'off'}`,
    );
    ctx.append(
      'info',
      `conn: app-id=${c.appId} account=${c.accountId ?? 'auto (default DEMO)'}`,
    );
    if (s.account) {
      ctx.append(
        'info',
        `account: ${s.account.isVirtual ? 'DEMO' : 'REAL'} ${s.account.loginId} · bal ${s.account.balance.toFixed(2)} ${s.account.currency}`,
      );
    }
    const wr = (winRate(s.session) * 100).toFixed(0);
    ctx.append(
      'info',
      `session: trades=${s.session.trades} wins=${s.session.wins} losses=${s.session.losses} pnl=${s.session.totalProfit.toFixed(2)} wr=${s.session.trades === 0 ? '—' : wr + '%'}`,
    );
    if (c.rotation.enabled || c.fuzzDuration.enabled) {
      const rotStr = c.rotation.enabled
        ? `rotation ON · pool ${c.rotation.pool.length}`
        : 'rotation off';
      const fuzzStr = c.fuzzDuration.enabled
        ? `fuzz ${c.fuzzDuration.minTicks}..${c.fuzzDuration.maxTicks}t`
        : 'fuzz off';
      ctx.append('info', `multi: ${rotStr} · ${fuzzStr}`);
    }
    if (c.martingale.mode !== 'off') {
      const rt = s.martingale;
      ctx.append(
        'info',
        `mg: ${c.martingale.mode} · ${rt.armed ? `armed step ${rt.step}/${c.martingale.maxSteps}` : `dormant ${rt.consecLosses}/${c.martingale.armAfterLosses}`} · next ${rt.nextStake.toFixed(2)} · mult=${c.martingale.multiplier} on-cap=${c.martingale.onCap}`,
      );
    }
    if (c.sniper.enabled) {
      const sn = s.sniper;
      ctx.append(
        'info',
        `sniper: on · threshold ${c.sniper.lossThreshold} · streak ${sn.consecLosses}/${c.sniper.lossThreshold}${sn.armed ? ' (armed — next real)' : ''} · mg ${c.sniper.martingaleEnabled ? 'on' : 'off'} · sim ${sn.simWins}W/${sn.simLosses}L · real ${sn.realTrades}`,
      );
    }
    if (s.openTrades.length > 0) {
      ctx.append('info', `open trades: ${s.openTrades.length}`);
    }
  },
};
