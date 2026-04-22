import { useStore } from '../../state/store';
import type { MenuController, MenuDefinition } from '../../ui/menu';
import type { CommandContext } from '../types';

export function openSniperMenu(ctx: CommandContext, replace = false): void {
  const cur = ctx.controller.config.sniper;
  const rt = useStore.getState().sniper;

  const apply = async (patch: Partial<typeof cur>) => {
    await ctx.controller.updateConfig({ sniper: { ...cur, ...patch } });
  };

  const thresholdPresets = [3, 5, 7, 10];

  const menu: MenuDefinition = {
    id: 'sniper',
    title: 'Sniper mode',
    subtitle: cur.enabled
      ? `on · threshold ${cur.lossThreshold} · mg ${cur.martingaleEnabled ? 'on' : 'off'} · streak ${rt.consecLosses}/${cur.lossThreshold}`
      : 'off · simulate N sim losses, then place one real trade',
    items: [
      {
        label: cur.enabled ? 'Disable sniper' : 'Enable sniper',
        checked: cur.enabled,
        onSelect: async (c: MenuController) => {
          await apply({ enabled: !cur.enabled });
          ctx.append('info', `sniper = ${!cur.enabled ? 'on' : 'off'}`);
          c.close();
        },
      },
      ...thresholdPresets.map((n) => ({
        label: `Threshold: ${n} consecutive sim losses`,
        checked: cur.lossThreshold === n,
        onSelect: async (c: MenuController) => {
          await apply({ lossThreshold: n });
          ctx.append('info', `sniper threshold = ${n}`);
          c.close();
        },
      })),
      {
        label: `Martingale: ${cur.martingaleEnabled ? 'on' : 'off'}`,
        hint: 'scale stake on the promoted real trade',
        checked: cur.martingaleEnabled,
        onSelect: async (c: MenuController) => {
          await apply({ martingaleEnabled: !cur.martingaleEnabled });
          ctx.append('info', `sniper mg = ${!cur.martingaleEnabled ? 'on' : 'off'}`);
          c.close();
        },
      },
      {
        label: 'Reset streak',
        hint: `current: ${rt.consecLosses}/${cur.lossThreshold}`,
        onSelect: (c) => {
          ctx.controller.resetSniper();
          ctx.append('info', 'sniper streak cleared');
          c.close();
        },
      },
      { label: 'Cancel', onSelect: (c) => c.close() },
    ],
  };

  if (replace) useStore.getState().replaceTopMenu(menu);
  else ctx.openMenu(menu);
}
