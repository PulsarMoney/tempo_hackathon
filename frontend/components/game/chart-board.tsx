"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

import { getColumnTicks } from "@/lib/game/constants";
import { getCurrentColumnProgress, getFutureGrid } from "@/lib/game/selectors";
import { rowBand } from "@/lib/game/odds";
import { useGameStore } from "@/store/use-game-store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TopBar } from "@/components/game/top-bar";
import { PriceLineOverlay } from "@/components/game/price-line-overlay";
import { BetGrid } from "@/components/game/bet-grid";
import { StakeControl } from "@/components/game/stake-control";
import { GameControls } from "@/components/game/game-controls";
import { HistoryPanel } from "@/components/game/history-panel";
import { SocialPoolsPanel } from "@/components/pools/social-pools-panel";

export function ChartBoard() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; text: string; tone: "neutral" | "win" | "warn" }>>([]);
  const toastSeq = useRef(1);
  const lastHitTickSeen = useRef(-1);

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
  const currentColumn = Math.floor(currentTick / columnTicks) + 1;
  const pastColumnsVisible = config.colsFuture;
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

  const pushToast = (text: string, tone: "neutral" | "win" | "warn" = "neutral") => {
    const id = toastSeq.current;
    toastSeq.current += 1;
    setToasts((prev) => [...prev, { id, text, tone }].slice(-4));
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1800);
  };

  useEffect(() => {
    if (ui.hitEffectTick <= lastHitTickSeen.current) {
      return;
    }
    lastHitTickSeen.current = ui.hitEffectTick;
    const wonNow = history.filter((bet) => bet.status === "won" && bet.resolvedAtTick === ui.hitEffectTick);
    if (wonNow.length === 0) {
      return;
    }
    const total = wonNow.reduce((acc, bet) => acc + bet.payout, 0);
    pushToast(`Hit! +$${total.toFixed(2)}`, "win");
  }, [ui.hitEffectTick, history]);

  const yAxisLabels = useMemo(() => {
    return Array.from({ length: config.rows }, (_, row) => rowBand(row, config).high.toFixed(2));
  }, [config]);

  const onPlaceBet = (col: number, row: number, multiplier: number) => {
    const result = placeBet(col, row, multiplier);
    if (!result.ok) {
      pushToast(result.reason ?? "Unable to place bet", "warn");
    } else {
      pushToast(`Bet placed: $${stake.toFixed(0)} @ x${multiplier.toFixed(2)}`, "neutral");
    }
    return result;
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-[1600px] flex-col gap-3">
      <TopBar currentPrice={currentPrice} balance={balance} />

      <div className="relative min-h-0 flex-1">
        <Card className="h-full overflow-hidden">
          <CardContent className="h-full p-2 md:p-3">
            <div className="relative h-full min-h-[560px] rounded-lg border border-zinc-800 bg-[radial-gradient(circle_at_20%_20%,rgba(51,108,255,0.15),transparent_55%),linear-gradient(180deg,#111827_0%,#090e19_100%)]">
              <Button
                variant="outline"
                size="sm"
                className="absolute right-2 top-2 z-50 border-zinc-700 bg-zinc-900/90 text-zinc-200"
                onClick={() => setPanelOpen((v) => !v)}
              >
                {panelOpen ? <PanelRightClose className="mr-1 h-4 w-4" /> : <PanelRightOpen className="mr-1 h-4 w-4" />}
                {panelOpen ? "Hide Menu" : "Menu"}
              </Button>

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

              <div className="absolute inset-y-0 left-0 w-[calc((100%-62px)/2)] border-r border-zinc-800/80 bg-zinc-950/22" />
              <div className="pointer-events-none absolute inset-y-0 left-[calc((100%-62px)/2)] z-20 w-px bg-primary/55" />

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
                  <span key={`${label}-${index}`} className="px-1 text-right text-[11px] text-zinc-500">
                    {label}
                  </span>
                ))}
              </div>

              <div className="pointer-events-none absolute left-2 top-2 z-30 space-y-2">
                {toasts.map((toast) => (
                  <div
                    key={toast.id}
                    className={`rounded-md border bg-zinc-950/90 px-3 py-1.5 text-sm shadow-lg ${
                      toast.tone === "win"
                        ? "border-success/70 text-green-200"
                        : toast.tone === "warn"
                          ? "border-warning/60 text-amber-200"
                          : "border-zinc-700 text-zinc-200"
                    }`}
                  >
                    {toast.text}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div
          className={`absolute bottom-2 right-2 top-2 z-40 w-[330px] overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl transition-transform duration-300 ${
            panelOpen ? "pointer-events-auto translate-x-0" : "pointer-events-none translate-x-[120%]"
          }`}
        >
          <div className="grid gap-3">
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
            <SocialPoolsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
