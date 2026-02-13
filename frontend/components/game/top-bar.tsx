"use client";

import { Activity, CircleDot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BalancePill } from "@/components/game/balance-pill";

type TopBarProps = {
  currentPrice: number;
  balance: number;
};

export function TopBar({ currentPrice, balance }: TopBarProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="border-emerald-600/50 bg-emerald-500/15 text-emerald-200">
          CHART / USD
        </Badge>
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Activity className="h-4 w-4 text-emerald-400" />
          Price <span className="font-semibold text-white">${currentPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-emerald-300">
          <CircleDot className="h-3 w-3 animate-pulse text-emerald-400" />
          Sim feed live
        </div>
      </div>
      <BalancePill balance={balance} />
    </div>
  );
}
