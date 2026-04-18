import { SENSITIVITY_LEVELS, SENSITIVITY_ORDER } from '../../constants/sensitivity';
import type { MenuController } from '../../ui/menu';
import type { CommandContext } from '../types';

export function openSensitivityMenu(ctx: CommandContext): void {
  const current = ctx.controller.config.sensitivity;
  ctx.openMenu({
    id: 'sensitivity',
    title: 'Signal sensitivity',
    subtitle: 'Higher multiplier → fewer, higher-confidence signals.',
    items: [
      ...SENSITIVITY_ORDER.map((lvl) => ({
        label: `${lvl}  (×${SENSITIVITY_LEVELS[lvl].multiplier.toFixed(1)})`,
        hint: lvl === current ? '(current)' : undefined,
        checked: lvl === current,
        onSelect: async (c: MenuController) => {
          await ctx.controller.updateConfig({ sensitivity: lvl });
          ctx.append('info', `sensitivity = ${lvl}`);
          c.close();
        },
      })),
      { label: 'Cancel', onSelect: (c) => c.close() },
    ],
  });
}
