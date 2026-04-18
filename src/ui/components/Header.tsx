import React from 'react';
import { Box } from 'ink';
import { useStore } from '../../state/store';
import { Banner } from './header/Banner';
import { MarketCard } from './header/MarketCard';
import { SignalEngineCard } from './header/SignalEngineCard';
import { SessionCard } from './header/SessionCard';
import { MartingaleCard } from './header/MartingaleCard';

export function Header() {
  const config = useStore((s) => s.config);
  const status = useStore((s) => s.status);
  const paused = useStore((s) => s.paused);
  const account = useStore((s) => s.account);
  const session = useStore((s) => s.session);
  const openCount = useStore((s) => s.openTrades.length);
  const warming = useStore((s) => s.warming);
  const ticksSeen = useStore((s) => s.ticksSeen);
  const mg = useStore((s) => s.martingale);
  const activeSymbol = useStore((s) => s.activeSymbol);
  const displaySymbol = activeSymbol ?? config.symbol;
  const currency = account?.currency ?? '';

  return (
    <Box flexDirection="column" paddingX={1} paddingTop={1}>
      <Banner status={status} paused={paused} warming={warming} ticksSeen={ticksSeen} />

      <Box flexDirection="row" marginTop={1}>
        <MarketCard
          displaySymbol={displaySymbol}
          rotation={config.rotation}
          fuzz={config.fuzzDuration}
          dryRun={config.dryRun}
          duration={config.duration}
          stake={config.stake}
          currency={currency}
        />

        <Box width={2} />

        <SignalEngineCard
          sensitivity={config.sensitivity}
          minStrength={config.minStrength}
          openCount={openCount}
          maxConcurrent={config.maxConcurrent}
        />

        <Box width={2} />

        <SessionCard account={account} session={session} />
      </Box>

      {config.martingale.mode !== 'off' && (
        <Box marginTop={1}>
          <MartingaleCard
            mode={config.martingale.mode}
            multiplier={config.martingale.multiplier}
            maxSteps={config.martingale.maxSteps}
            armAfterLosses={config.martingale.armAfterLosses}
            maxStake={config.martingale.maxStake}
            stopLoss={config.martingale.stopLoss}
            takeProfit={config.martingale.takeProfit}
            armed={mg.armed}
            step={mg.step}
            consecLosses={mg.consecLosses}
            nextStake={mg.nextStake}
            currency={currency}
          />
        </Box>
      )}
    </Box>
  );
}
