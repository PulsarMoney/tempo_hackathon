"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { ResolvedBet } from "@/lib/game/types";

type HistoryPanelProps = {
  history: ResolvedBet[];
  openCount: number;
};

export function HistoryPanel({ history, openCount }: HistoryPanelProps) {
  const pnl = history.reduce((acc, bet) => acc + (bet.payout - bet.stake), 0);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-300">History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Open bets</span>
          <span className="font-medium text-zinc-100">{openCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-zinc-400">Cumulative PnL</span>
          <span className={pnl >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-red-300"}>
            {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
          </span>
        </div>
        <Separator />
        <div className="max-h-[290px] space-y-2 overflow-auto pr-1">
          {history.length === 0 && <p className="text-xs text-zinc-500">No settled bets yet.</p>}
          {history.slice(0, 20).map((bet) => (
            <div key={bet.id} className="rounded-md border border-zinc-800 bg-zinc-900/70 px-2 py-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-300">c{bet.col} r{bet.row}</span>
                <span className={bet.status === "won" ? "text-emerald-300" : "text-red-300"}>{bet.status.toUpperCase()}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-zinc-400">
                <span>${bet.stake.toFixed(2)} @ x{bet.multiplier.toFixed(2)}</span>
                <span className="text-zinc-200">${bet.payout.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
