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
}: {
  pool: PoolDetail | null;
  onJoin: () => Promise<void>;
  onResolve: () => Promise<void>;
  onExecutePayout: () => Promise<void>;
}) {
  if (!pool) {
    return <p className="text-xs text-zinc-500">No pool selected.</p>;
  }

  return (
    <div className="space-y-2 rounded-md border border-border bg-zinc-900/40 p-2">
      <h4 className="text-sm font-semibold text-zinc-200">{pool.title}</h4>
      <p className="text-xs text-zinc-400">{pool.id}</p>
      <p className="text-xs text-zinc-300">Entry: {pool.entryAmount}</p>
      <p className="text-xs text-zinc-500">Token: {pool.tokenAddress}</p>
      <p className="text-xs text-zinc-500">Status: {pool.status}</p>
      <div className="grid grid-cols-1 gap-2">
        <Button onClick={onJoin}>Join Pool</Button>
        <Button variant="outline" onClick={onResolve}>Resolve Pool (admin)</Button>
        <Button variant="outline" onClick={onExecutePayout}>Execute Payouts (operator)</Button>
      </div>
    </div>
  );
}
