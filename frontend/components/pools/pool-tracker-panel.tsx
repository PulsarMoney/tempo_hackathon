"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PoolSummary } from "@/lib/pools/api";
import type { ResolvedBet } from "@/lib/game/types";

type PoolTrackerPanelProps = {
  activePool: PoolSummary | null;
  playMode: "demo" | "pool";
  activePoolId: string | null;
  history: ResolvedBet[];
  currentUserAddress?: string;
};

export function PoolTrackerPanel({ activePool, playMode, activePoolId, history, currentUserAddress }: PoolTrackerPanelProps) {
  const poolHistory = history.filter((bet) => bet.poolId && bet.poolId === activePoolId);
  const poolWins = poolHistory.filter((bet) => bet.status === "won").length;
  const poolPnl = poolHistory.reduce((acc, bet) => acc + (bet.payout - bet.stake), 0);

  const payoutByParticipant = new Map((activePool?.payouts ?? []).map((payout) => [payout.participantId, payout]));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-300">Pool Tracker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-zinc-400">Current play mode</span>
            <Badge variant={playMode === "pool" ? "default" : "secondary"}>{playMode === "pool" ? "Pool Play" : "Demo Play"}</Badge>
          </div>
          <p className="text-zinc-500">
            {playMode === "pool"
              ? "Your next trades are tagged to this pool and appear in pool results."
              : "You are testing in demo mode. Demo trades do not count for pool payouts."}
          </p>
        </div>

        {!activePool && <p className="text-xs text-zinc-500">Load or create a pool to track pool-specific results.</p>}

        {activePool && (
          <div className="space-y-2 rounded-md border border-zinc-800 bg-zinc-900/60 p-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-zinc-300">{activePool.title}</span>
              <span className="text-zinc-500">{activePool.status}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded bg-zinc-950/70 p-1">
                <p className="text-zinc-500">Trades</p>
                <p className="text-zinc-100">{poolHistory.length}</p>
              </div>
              <div className="rounded bg-zinc-950/70 p-1">
                <p className="text-zinc-500">Wins</p>
                <p className="text-zinc-100">{poolWins}</p>
              </div>
              <div className="rounded bg-zinc-950/70 p-1">
                <p className="text-zinc-500">PnL</p>
                <p className={poolPnl >= 0 ? "text-success" : "text-[#EF4444]"}>{poolPnl >= 0 ? "+" : ""}${poolPnl.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {activePool && (
          <div className="space-y-1 rounded-md border border-zinc-800 bg-zinc-900/60 p-2 text-xs">
            <p className="mb-1 text-zinc-400">Participants</p>
            {(activePool.participants ?? []).length === 0 && <p className="text-zinc-500">No participants yet.</p>}
            {(activePool.participants ?? []).map((participant) => {
              const payout = payoutByParticipant.get(participant.id);
              const mine =
                currentUserAddress &&
                participant.walletAddress &&
                participant.walletAddress.toLowerCase() === currentUserAddress.toLowerCase();

              return (
                <div key={participant.id} className="flex items-center justify-between rounded border border-zinc-800 px-2 py-1">
                  <span className={mine ? "text-blue-300" : "text-zinc-300"}>
                    {participant.walletAddress
                      ? `${participant.walletAddress.slice(0, 6)}...${participant.walletAddress.slice(-4)}`
                      : participant.id.slice(0, 8)}
                    {mine ? " (you)" : ""}
                  </span>
                  <span className="text-zinc-500">
                    {participant.joinStatus}
                    {payout ? ` · ${payout.status}` : ""}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
