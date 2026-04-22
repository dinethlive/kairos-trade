import type { Command, CommandContext } from './types';
import { startCommand, stopCommand, pauseCommand, resumeCommand, clearCommand, quitCommand } from './commands/lifecycle';
import { statusCommand } from './commands/status';
import { accountsCommand, accountCommand } from './commands/account';
import { symbolCommand } from './commands/symbol';
import { stakeCommand, durationCommand, maxConcurrentCommand, adaptiveCommand, cooldownCommand } from './commands/tuning';
import { sensitivityCommand, minStrengthCommand } from './commands/sensitivity';
import { dryRunCommand } from './commands/dryrun';
import { martingaleCommand } from './commands/martingale';
import { rotateCommand, poolCommand } from './commands/rotate';
import { fuzzDurationCommand } from './commands/fuzz';
import { sniperCommand } from './commands/sniper';

export type { Command, CommandContext } from './types';

const helpCommand: Command = {
  name: 'help',
  aliases: ['?', 'h'],
  usage: '/help [cmd]',
  description: 'List commands or show detail for one',
  handler(args, ctx) {
    if (args[0]) {
      const c = findCommand(args[0].replace(/^\//, ''));
      if (!c) {
        ctx.append('error', `no such command: /${args[0]}`);
        return;
      }
      const al = c.aliases && c.aliases.length ? ` (aliases: ${c.aliases.map((a) => '/' + a).join(', ')})` : '';
      ctx.append('info', `/${c.name}${al}`);
      ctx.append('info', `  ${c.usage}`);
      ctx.append('info', `  ${c.description}`);
      return;
    }
    ctx.append('info', 'commands:');
    for (const c of COMMANDS) {
      ctx.append('info', `  ${c.usage.padEnd(36)} ${c.description}`);
    }
  },
};

export const COMMANDS: Command[] = [
  startCommand,
  stopCommand,
  pauseCommand,
  resumeCommand,
  statusCommand,
  accountsCommand,
  accountCommand,
  symbolCommand,
  stakeCommand,
  durationCommand,
  sensitivityCommand,
  minStrengthCommand,
  maxConcurrentCommand,
  adaptiveCommand,
  cooldownCommand,
  dryRunCommand,
  martingaleCommand,
  rotateCommand,
  poolCommand,
  fuzzDurationCommand,
  sniperCommand,
  clearCommand,
  helpCommand,
  quitCommand,
];

export function findCommand(name: string): Command | undefined {
  const n = name.toLowerCase();
  return COMMANDS.find((c) => c.name === n || c.aliases?.includes(n));
}

export async function dispatchCommand(input: string, ctx: CommandContext): Promise<void> {
  const line = input.trim();
  if (!line) return;
  if (!line.startsWith('/')) {
    ctx.append('error', 'commands must start with /  (type /help)');
    return;
  }
  const parts = line.slice(1).split(/\s+/).filter((p) => p.length > 0);
  const name = parts[0] ?? '';
  const args = parts.slice(1);
  if (!name) return;
  const cmd = findCommand(name);
  if (!cmd) {
    ctx.append('error', `unknown command: /${name}  (type /help)`);
    return;
  }
  try {
    await cmd.handler(args, ctx);
  } catch (err) {
    ctx.append('error', err instanceof Error ? err.message : String(err));
  }
}
