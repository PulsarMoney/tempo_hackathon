"use client";

import { useEffect, useMemo, useState } from "react";

import { getColumnTicks } from "@/lib/game/constants";
import { getCurrentColumnProgress, getFutureGrid } from "@/lib/game/selectors";
import { rowBand } from "@/lib/game/odds";
import { useGameStore } from "@/store/use-game-store";
import { Card, CardContent } from "@/components/ui/card";
import { TopBar } from "@/components/game/top-bar";
import { PriceLineOverlay } from "@/components/game/price-line-overlay";
import { BetGrid } from "@/components/game/bet-grid";
import { StakeControl } from "@/components/game/stake-control";
import { GameControls } from "@/components/game/game-controls";
import { HistoryPanel } from "@/components/game/history-panel";

export function ChartBoard() {
  const [localMessage, setLocalMessage] = useState<string | null>(null);

  const config = useGameStore((state) => state.config);
  const balance = useGameStore((state) => state.balance);
  const stake = useGameStore((state) => state.stake);
  const currentTick = useGameStore((state) => state.currentTick);
  const currentPrice = useGameStore((state) => state.currentPrice);
  const priceSeries = useGameStore((state) => state.priceSeries);
  const paused = useGameStore((state) => state.paused);
  const speed = useGameStore((state) => state.speed);
  const history = useGameStore((state) => state.history);
  const betsOpen = useGameStore((state) => state.betsOpen);
  const demoSeedEnabled = useGameStore((state) => state.demoSeedEnabled);
  const ui = useGameStore((state) => state.ui);
  const tick = useGameStore((state) => state.tick);
  const placeBet = useGameStore((state) => state.placeBet);
  const setStake = useGameStore((state) => state.setStake);
  const togglePause = useGameStore((state) => state.togglePause);
  const setSpeed = useGameStore((state) => state.setSpeed);
  const resetGame = useGameStore((state) => state.resetGame);
  const toggleDemoSeed = useGameStore((state) => state.toggleDemoSeed);

  const futureGrid = useMemo(
    () =>
      getFutureGrid({
        config,
        currentTick,
        currentPrice,
        betsOpen,
      }),
    [config, currentTick, currentPrice, betsOpen]
  );

  const progress = useMemo(
    () =>
      getCurrentColumnProgress({
        config,
        currentTick,
      }),
    [config, currentTick]
  );
  const columnTicks = useMemo(() => getColumnTicks(config), [config]);
  const currentColumn = Math.floor(currentTick / columnTicks);
  const pastColumnsVisible = config.colsFuture - 2;
  const futureColumnsVisible = config.colsFuture;
  const totalColumnsVisible = pastColumnsVisible + futureColumnsVisible;
  const windowStartTick = Math.max(0, currentTick - pastColumnsVisible * columnTicks);
  const windowEndTick = currentTick + futureColumnsVisible * columnTicks;
  const gridShiftPercent = (progress * 100) / totalColumnsVisible;

  useEffect(() => {
    if (paused) {
      return;
    }

    const stepMs = Math.max(20, config.tickMs / speed);
    const id = setInterval(() => {
      tick();
    }, stepMs);

    return () => clearInterval(id);
  }, [paused, speed, config.tickMs, tick]);

  useEffect(() => {
    if (!localMessage) {
      return;
    }
    const id = setTimeout(() => setLocalMessage(null), 1500);
    return () => clearTimeout(id);
  }, [localMessage]);

  const yAxisLabels = useMemo(() => {
    return Array.from({ length: config.rows }, (_, row) => rowBand(row, config).high.toFixed(2));
  }, [config]);

  const onPlaceBet = (col: number, row: number, multiplier: number) => {
    const result = placeBet(col, row, multiplier);
    if (!result.ok) {
      setLocalMessage(result.reason ?? "Unable to place bet");
    }
    return result;
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-4">
      <TopBar currentPrice={currentPrice} balance={balance} />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="overflow-hidden">
          <CardContent className="p-3">
            <div className="relative h-[420px] rounded-lg border border-zinc-800 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.15),transparent_55%),linear-gradient(180deg,#0b0f0c_0%,#050706_100%)]">
              <div
                className="absolute inset-y-0 left-0 right-[62px] grid"
                style={{
                  gridTemplateColumns: `repeat(${totalColumnsVisible}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${config.rows}, minmax(0, 1fr))`,
                  transform: `translateX(-${gridShiftPercent}%)`,
                }}
              >
                {Array.from({ length: totalColumnsVisible * config.rows }, (_, i) => (
                  <div key={i} className="border-[0.5px] border-zinc-900/80" />
                ))}
              </div>

              <div className="absolute inset-y-0 left-0 w-1/2 border-r border-zinc-800/80 bg-zinc-950/22" />
              <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px bg-emerald-400/55" />

              <PriceLineOverlay
                points={priceSeries}
                minPrice={config.minPrice}
                maxPrice={config.maxPrice}
                windowStartTick={windowStartTick}
                windowEndTick={windowEndTick}
                currentTick={currentTick}
              />
              <BetGrid
                columns={futureGrid}
                rows={config.rows}
                totalColumnsVisible={totalColumnsVisible}
                pastColumnsVisible={pastColumnsVisible}
                currentColumn={currentColumn}
                progress={progress}
                betsOpen={betsOpen}
                hitEffectCellIds={ui.hitEffectCellIds}
                hitEffectActive={currentTick - ui.hitEffectTick <= 8}
                onPlaceBet={onPlaceBet}
              />

              <div className="absolute inset-y-0 right-0 z-20 flex w-[62px] flex-col justify-between border-l border-zinc-800 bg-zinc-950/90 py-1">
                {yAxisLabels.map((label, index) => (
                  <span key={`${label}-${index}`} className="px-1 text-right text-[10px] text-zinc-500">
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-3 min-h-6 text-sm">
              {localMessage && <span className="text-amber-300">{localMessage}</span>}
              {!localMessage && ui.message && (
                <span className={ui.message.kind === "loss" ? "text-red-300" : "text-emerald-300"}>{ui.message.text}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <StakeControl stake={stake} minStake={config.minStake} maxStake={config.maxStake} setStake={setStake} />
          <GameControls
            paused={paused}
            speed={speed}
            demoSeedEnabled={demoSeedEnabled}
            togglePause={togglePause}
            setSpeed={setSpeed}
            resetGame={resetGame}
            toggleDemoSeed={toggleDemoSeed}
          />
          <HistoryPanel history={history} openCount={betsOpen.length} />
        </div>
      </div>
    </div>
  );
}
