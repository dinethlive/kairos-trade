import { useStore } from '../../state/store';
import { fetchActiveSymbolsPublic, type ActiveSymbol } from '../../services/derivWS';
import type { MenuController, MenuDefinition } from '../../ui/menu';
import type { CommandContext } from '../types';

export async function openPoolMenu(ctx: CommandContext, replace = false): Promise<void> {
  const cur = ctx.controller.config.rotation;

  // Lazy-load the live active-symbols list when the token is configured and bot
  // is not already running. Otherwise fall back to a static curated list.
  const items: Array<{ symbol: string; label: string; checked: boolean }> = [];
  for (const sym of cur.pool) {
    items.push({ symbol: sym, label: sym, checked: true });
  }
  // Append known curated defaults not already in pool for easy toggling.
  const { DEFAULT_ROTATION_POOL } = await import('../../constants/api');
  for (const sym of DEFAULT_ROTATION_POOL) {
    if (!cur.pool.includes(sym)) {
      items.push({ symbol: sym, label: sym, checked: false });
    }
  }

  const togglePool = async (symbol: string, nowOn: boolean) => {
    const latest = ctx.controller.config.rotation;
    const nextPool = nowOn
      ? latest.pool.includes(symbol)
        ? latest.pool
        : [...latest.pool, symbol]
      : latest.pool.filter((s) => s !== symbol);
    await ctx.controller.updateConfig({
      rotation: { ...latest, pool: nextPool },
    });
  };

  const buildMenu = (): MenuDefinition => {
    const latest = ctx.controller.config.rotation;
    const itemList = items.map((it) => ({
      label: it.label,
      checked: latest.pool.includes(it.symbol),
      hint: latest.pool.includes(it.symbol) ? 'in pool' : undefined,
      onSelect: async (c: MenuController) => {
        const nowOn = !latest.pool.includes(it.symbol);
        await togglePool(it.symbol, nowOn);
        ctx.append('info', `${nowOn ? '+' : '-'} ${it.symbol}`);
        c.replace(buildMenu());
      },
    }));
    return {
      id: 'pool',
      title: 'Rotation pool',
      subtitle: `toggle symbols · ${latest.pool.length} selected`,
      items: [
        ...itemList,
        {
          label: 'Fetch live from Deriv…',
          hint: 'populate menu with all active rise/fall symbols',
          onSelect: async (c) => {
            await refreshPoolFromDeriv(ctx);
            c.close();
          },
        },
        {
          label: 'Clear pool',
          onSelect: async (c) => {
            await ctx.controller.updateConfig({
              rotation: { ...ctx.controller.config.rotation, pool: [] },
            });
            ctx.append('info', 'pool cleared');
            c.replace(buildMenu());
          },
        },
        { label: 'Done', onSelect: (c) => c.closeAll() },
      ],
    };
  };

  const menu = buildMenu();
  if (replace) useStore.getState().replaceTopMenu(menu);
  else ctx.openMenu(menu);
}

export async function refreshPoolFromDeriv(ctx: CommandContext): Promise<void> {
  ctx.append('info', 'fetching active symbols from Deriv…');
  try {
    const list = await fetchActiveSymbolsPublic(['CALL', 'PUT']);
    const synthetics = list
      .filter((s: ActiveSymbol) => s.market === 'synthetic_index' && s.exchangeIsOpen && !s.isSuspended)
      .map((s) => s.symbol)
      .sort();
    if (synthetics.length === 0) {
      ctx.append('warn', 'no synthetic rise/fall symbols returned');
      return;
    }
    await ctx.controller.updateConfig({
      rotation: { ...ctx.controller.config.rotation, pool: synthetics },
    });
    ctx.append(
      'info',
      `pool = ${synthetics.length} live symbols (${synthetics.slice(0, 8).join(', ')}${synthetics.length > 8 ? ', …' : ''})`,
    );
  } catch (err) {
    ctx.append('error', err instanceof Error ? err.message : String(err));
  }
}
