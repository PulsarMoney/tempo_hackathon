"use client";

import { Separator } from "@/components/ui/separator";
import type { ResolvedBet } from "@/lib/game/types";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type HistoryPanelProps = {
  history: ResolvedBet[];
  openCount: number;
  activePoolId: string | null;
};

export function HistoryPanel({ history, openCount, activePoolId }: HistoryPanelProps) {
  const [filter, setFilter] = useState<"all" | "demo" | "pool">("all");

  const filteredHistory = useMemo(() => {
    if (filter === "all") {
      return history;
    }
    if (filter === "demo") {
      return history.filter((bet) => bet.playMode === "demo");
    }
    if (!activePoolId) {
      return [];
    }
    return history.filter((bet) => bet.playMode === "pool" && bet.poolId === activePoolId);
  }, [activePoolId, filter, history]);

  const pnl = filteredHistory.reduce((acc, bet) => acc + (bet.payout - bet.stake), 0);

  return (
    <div className="panel-section space-y-3">
      <div className="flex items-center justify-between">
        <p className="section-title">History</p>
        <div className="flex items-center gap-2 text-xs">
          <span className="muted-meta">Open</span>
          <span className="font-medium text-foreground">{openCount}</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="muted-meta">Filtered Net PnL</span>
        <span className={pnl >= 0 ? "value-positive" : "value-negative"}>{pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}</span>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
          All
        </Button>
        <Button size="sm" variant={filter === "demo" ? "default" : "outline"} onClick={() => setFilter("demo")}>
          Demo
        </Button>
        <Button size="sm" variant={filter === "pool" ? "default" : "outline"} onClick={() => setFilter("pool")}>
          Pool
        </Button>
      </div>
      <Separator />
      <div className="max-h-[300px] space-y-2 overflow-auto pr-1">
        {filteredHistory.length === 0 && <p className="muted-meta">No settled bets in this view yet.</p>}
        {filteredHistory.slice(0, 20).map((bet) => (
          <div key={bet.id} className="rounded-md border border-border/75 bg-black/20 px-2 py-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">
                c{bet.col} r{bet.row}
                {" · "}
                {bet.playMode === "pool" ? `POOL ${bet.poolId?.slice(0, 6)}` : "DEMO"}
              </span>
              <span className={bet.status === "won" ? "value-positive" : "value-negative"}>{bet.status.toUpperCase()}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-zinc-400">
              <span>${bet.stake.toFixed(2)} @ x{bet.multiplier.toFixed(2)}</span>
              <span className="text-zinc-200">${bet.payout.toFixed(2)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
