import type { CommandContext } from '../types';

export function openBooleanMenu(
  ctx: CommandContext,
  opts: {
    title: string;
    subtitle?: string;
    current: boolean;
    apply: (v: boolean) => void | Promise<void>;
  },
): void {
  ctx.openMenu({
    id: `bool-${opts.title}`,
    title: opts.title,
    subtitle: opts.subtitle,
    items: [
      {
        label: 'On',
        hint: opts.current ? '(current)' : undefined,
        checked: opts.current,
        onSelect: async (c) => {
          await opts.apply(true);
          c.close();
        },
      },
      {
        label: 'Off',
        hint: !opts.current ? '(current)' : undefined,
        checked: !opts.current,
        onSelect: async (c) => {
          await opts.apply(false);
          c.close();
        },
      },
      { label: 'Cancel', onSelect: (c) => c.close() },
    ],
  });
}
