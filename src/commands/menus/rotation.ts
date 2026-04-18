import type { CommandContext } from '../types';
import { openPoolMenu } from './pool';
import { openFuzzMenu } from './fuzz';

export function openRotationMenu(ctx: CommandContext): void {
  const cur = ctx.controller.config.rotation;
  const fuzz = ctx.controller.config.fuzzDuration;
  ctx.openMenu({
    id: 'rotate',
    title: 'Symbol rotation',
    subtitle: `pool ${cur.pool.length} · rotation ${cur.enabled ? 'ON' : 'OFF'} · fuzz ${fuzz.enabled ? `${fuzz.minTicks}..${fuzz.maxTicks}t` : 'off'}`,
    items: [
      {
        label: cur.enabled ? 'Disable rotation' : 'Enable rotation',
        onSelect: async (c) => {
          if (!cur.enabled && cur.pool.length < 2) {
            ctx.append(
              'warn',
              'rotation pool has fewer than 2 symbols — add more via pool menu',
            );
          }
          await ctx.controller.updateConfig({
            rotation: { ...cur, enabled: !cur.enabled },
          });
          ctx.append('info', `rotation = ${!cur.enabled ? 'on' : 'off'}`);
          c.close();
        },
      },
      {
        label: 'Edit rotation pool…',
        hint: `${cur.pool.length} symbol${cur.pool.length === 1 ? '' : 's'}`,
        onSelect: async (c) => {
          await openPoolMenu(ctx, true);
        },
      },
      {
        label: 'Fuzzy duration…',
        hint: fuzz.enabled ? `${fuzz.minTicks}..${fuzz.maxTicks}t` : 'off',
        onSelect: (c) => {
          openFuzzMenu(ctx, true);
        },
      },
      { label: 'Cancel', onSelect: (c) => c.close() },
    ],
  });
}
