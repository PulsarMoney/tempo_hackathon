"use client";

import { Button } from "@/components/ui/button";

type PoolDetail = {
  id: string;
  title: string;
  status: string;
  entryAmount: string;
  tokenAddress: string;
};

export function PoolDetailPanel({
  pool,
  onJoin,
  onResolve,
  onExecutePayout,
  onSelectPoolPlay,
  onSelectDemoPlay,
  isPlayingThisPool,
}: {
  pool: PoolDetail | null;
  onJoin: () => Promise<void>;
  onResolve: () => Promise<void>;
  onExecutePayout: () => Promise<void>;
  onSelectPoolPlay: () => void;
  onSelectDemoPlay: () => void;
  isPlayingThisPool: boolean;
}) {
  if (!pool) {
    return <p className="text-xs text-zinc-500">No active pool selected yet. Create one above or load by ID.</p>;
  }

  return (
    <div className="space-y-3 rounded-md border border-border bg-zinc-900/40 p-3">
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-zinc-100">{pool.title}</h4>
        <p className="text-xs text-zinc-400">Entry amount: {pool.entryAmount}</p>
        <p className="text-xs text-zinc-500">Status: {pool.status}</p>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button variant={isPlayingThisPool ? "default" : "outline"} onClick={onSelectPoolPlay}>
          Play This Pool
        </Button>
        <Button variant={!isPlayingThisPool ? "default" : "outline"} onClick={onSelectDemoPlay}>
          Switch To Demo
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button onClick={onJoin}>Join</Button>
        <Button variant="outline" onClick={onResolve}>
          Resolve
        </Button>
        <Button variant="outline" onClick={onExecutePayout}>
          Pay Winners
        </Button>
      </div>

      <details className="rounded border border-zinc-800 px-2 py-1 text-xs">
        <summary className="cursor-pointer text-zinc-400">Technical details</summary>
        <div className="mt-2 space-y-1 text-zinc-500">
          <p>Pool ID: {pool.id}</p>
          <p>Token: {pool.tokenAddress}</p>
        </div>
      </details>
    </div>
  );
}
