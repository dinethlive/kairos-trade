import type { MenuController } from '../../ui/menu';
import type { CommandContext } from '../types';

export function openMinStrengthMenu(ctx: CommandContext): void {
  const current = ctx.controller.config.minStrength;
  const mk = (n: 1 | 2 | 3, hint: string) => ({
    label: `${n} — ${hint}`,
    checked: n === current,
    onSelect: async (c: MenuController) => {
      await ctx.controller.updateConfig({ minStrength: n });
      ctx.append('info', `min-strength = ${n}`);
      c.close();
    },
  });
  ctx.openMenu({
    id: 'min-strength',
    title: 'Minimum signal strength to trade',
    items: [
      mk(1, 'most signals pass'),
      mk(2, 'balanced (default)'),
      mk(3, 'only spikes / very strong'),
      { label: 'Cancel', onSelect: (c) => c.close() },
    ],
  });
}
