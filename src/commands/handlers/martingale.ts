import { useStore } from '../../state/store';
import type { MartingaleConfig } from '../../trading/trader';
import type { CommandContext } from '../types';

const MG_SUBS: Array<{ name: string; usage: string; description: string }> = [
  { name: '(no args)', usage: '/mg', description: 'Show current mode, step, next stake, caps' },
  { name: 'on', usage: '/mg on [classic]', description: 'Enable martingale (default mode: classic)' },
  { name: 'off', usage: '/mg off', description: 'Disable martingale' },
  { name: 'mult', usage: '/mg mult <x>', description: 'Stake multiplier (>1)' },
  { name: 'max-steps', usage: '/mg max-steps <n>', description: 'Cap on consecutive armed steps (≥1)' },
  { name: 'arm-after', usage: '/mg arm-after <n>', description: 'Arm after N consecutive losses (0=always)' },
  { name: 'max-stake', usage: '/mg max-stake <x|off>', description: 'Per-trade stake cap' },
  { name: 'stop-loss', usage: '/mg stop-loss <x|off>', description: 'Session cumulative loss cap (stops bot)' },
  { name: 'take-profit', usage: '/mg take-profit <x|off>', description: 'Session cumulative profit cap (stops bot)' },
  { name: 'on-cap', usage: '/mg on-cap <reset|pause|stop>', description: 'What to do when a cap is hit' },
  { name: 'reset', usage: '/mg reset', description: 'Clear step + loss-streak counters without changing config' },
  { name: 'help', usage: '/mg help', description: 'Show this list' },
];

export async function handleMartingale(args: string[], ctx: CommandContext): Promise<void> {
  const sub = (args[0] ?? '').toLowerCase();
  const s = useStore.getState();
  const mg = ctx.controller.config.martingale;

  const patch = (p: Partial<MartingaleConfig>) =>
    ctx.controller.updateConfig({ martingale: { ...mg, ...p } });

  const parseNumOrOff = (raw: string | undefined): number | null | 'err' => {
    if (raw === undefined) return 'err';
    if (raw === 'off' || raw === 'none' || raw === 'clear') return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 'err';
    return n;
  };

  if (!sub || sub === 'status') {
    const rt = s.martingale;
    const caps: string[] = [];
    if (mg.maxStake != null) caps.push(`max-stake ${mg.maxStake}`);
    if (mg.stopLoss != null) caps.push(`sl −${mg.stopLoss}`);
    if (mg.takeProfit != null) caps.push(`tp +${mg.takeProfit}`);
    ctx.append(
      'info',
      `mg: mode=${mg.mode} mult=${mg.multiplier} max-steps=${mg.maxSteps} arm-after=${mg.armAfterLosses} on-cap=${mg.onCap}`,
    );
    ctx.append(
      'info',
      `runtime: ${rt.armed ? `armed step ${rt.step}/${mg.maxSteps}` : `dormant ${rt.consecLosses}/${mg.armAfterLosses}`} · next ${rt.nextStake.toFixed(2)}${caps.length ? ' · ' + caps.join(' · ') : ''}`,
    );
    return;
  }

  if (sub === 'help') {
    ctx.append('info', '/martingale (alias /mg) subcommands:');
    for (const m of MG_SUBS) {
      ctx.append('info', `  ${m.usage.padEnd(32)} ${m.description}`);
    }
    return;
  }

  if (sub === 'on' || sub === 'enable') {
    const modeArg = (args[1] ?? 'classic').toLowerCase();
    if (modeArg !== 'classic') {
      ctx.append('error', 'usage: /mg on [classic]');
      return;
    }
    if (ctx.controller.config.maxConcurrent > 1) {
      ctx.append(
        'warn',
        'martingale is designed for max-concurrent=1; step updates lag when multiple trades are open',
      );
    }
    await patch({ mode: 'classic' });
    ctx.append('info', 'mg = classic');
    return;
  }

  if (sub === 'off' || sub === 'disable') {
    await patch({ mode: 'off' });
    ctx.controller.resetMartingale();
    ctx.append('info', 'mg = off');
    return;
  }

  if (sub === 'mult' || sub === 'multiplier') {
    const n = Number(args[1]);
    if (!Number.isFinite(n) || n <= 1) {
      ctx.append('error', 'usage: /mg mult <number > 1>');
      return;
    }
    await patch({ multiplier: n });
    ctx.append('info', `mg mult = ${n}`);
    return;
  }

  if (sub === 'max-steps' || sub === 'maxsteps') {
    const n = Number(args[1]);
    if (!Number.isInteger(n) || n < 1) {
      ctx.append('error', 'usage: /mg max-steps <integer ≥ 1>');
      return;
    }
    await patch({ maxSteps: n });
    ctx.append('info', `mg max-steps = ${n}`);
    return;
  }

  if (sub === 'arm-after' || sub === 'armafter') {
    const n = Number(args[1]);
    if (!Number.isInteger(n) || n < 0) {
      ctx.append('error', 'usage: /mg arm-after <integer ≥ 0>   (0 = always armed)');
      return;
    }
    await patch({ armAfterLosses: n });
    ctx.append('info', `mg arm-after = ${n}${n === 0 ? ' (always armed)' : ''}`);
    return;
  }

  if (sub === 'max-stake' || sub === 'maxstake') {
    const v = parseNumOrOff(args[1]);
    if (v === 'err') {
      ctx.append('error', 'usage: /mg max-stake <positive number | off>');
      return;
    }
    await patch({ maxStake: v });
    ctx.append('info', `mg max-stake = ${v ?? 'off'}`);
    return;
  }

  if (sub === 'stop-loss' || sub === 'stoploss' || sub === 'sl') {
    const v = parseNumOrOff(args[1]);
    if (v === 'err') {
      ctx.append('error', 'usage: /mg stop-loss <positive number | off>');
      return;
    }
    await patch({ stopLoss: v });
    ctx.append('info', `mg stop-loss = ${v == null ? 'off' : '−' + v}`);
    return;
  }

  if (sub === 'take-profit' || sub === 'takeprofit' || sub === 'tp') {
    const v = parseNumOrOff(args[1]);
    if (v === 'err') {
      ctx.append('error', 'usage: /mg take-profit <positive number | off>');
      return;
    }
    await patch({ takeProfit: v });
    ctx.append('info', `mg take-profit = ${v == null ? 'off' : '+' + v}`);
    return;
  }

  if (sub === 'on-cap' || sub === 'oncap') {
    const v = (args[1] ?? '').toLowerCase();
    if (v !== 'reset' && v !== 'pause' && v !== 'stop') {
      ctx.append('error', 'usage: /mg on-cap <reset|pause|stop>');
      return;
    }
    await patch({ onCap: v });
    ctx.append('info', `mg on-cap = ${v}`);
    return;
  }

  if (sub === 'reset') {
    ctx.controller.resetMartingale();
    ctx.append('info', 'mg runtime cleared (step=0, consec-losses=0)');
    return;
  }

  ctx.append('error', `unknown /mg subcommand: ${sub}  (try /mg help)`);
}
