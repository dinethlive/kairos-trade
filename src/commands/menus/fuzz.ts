import { useStore } from '../../state/store';
import type { MenuController, MenuDefinition } from '../../ui/menu';
import type { CommandContext } from '../types';

export function openFuzzMenu(ctx: CommandContext, replace = false): void {
  const cur = ctx.controller.config.fuzzDuration;
  const set = async (enabled: boolean, min: number, max: number) => {
    await ctx.controller.updateConfig({
      fuzzDuration: { enabled, minTicks: min, maxTicks: max },
    });
    ctx.append(
      'info',
      enabled ? `fuzz = on · range ${min}..${max}t` : 'fuzz = off',
    );
  };

  const presets: Array<[number, number]> = [
    [5, 10],
    [3, 7],
    [5, 15],
    [10, 20],
  ];

  const menu: MenuDefinition = {
    id: 'fuzz',
    title: 'Fuzzy duration',
    subtitle: cur.enabled
      ? `current: ${cur.minTicks}..${cur.maxTicks}t`
      : 'current: off',
    items: [
      ...presets.map(([lo, hi]) => ({
        label: `${lo}..${hi} ticks`,
        checked: cur.enabled && cur.minTicks === lo && cur.maxTicks === hi,
        onSelect: async (c: MenuController) => {
          await set(true, lo, hi);
          c.close();
        },
      })),
      {
        label: 'Disable',
        checked: !cur.enabled,
        onSelect: async (c) => {
          await set(false, cur.minTicks, cur.maxTicks);
          c.close();
        },
      },
      {
        label: 'Custom range…',
        hint: 'use /fuzzduration <min> <max>',
        onSelect: (c) => {
          ctx.append('info', 'run /fuzzduration <min> <max> (e.g. /fuzzduration 4 9)');
          c.close();
        },
      },
      { label: 'Cancel', onSelect: (c) => c.close() },
    ],
  };
  if (replace) useStore.getState().replaceTopMenu(menu);
  else ctx.openMenu(menu);
}
