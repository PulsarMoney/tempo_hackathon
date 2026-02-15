"use client";

import { Activity, CircleDot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { BalancePill } from "@/components/game/balance-pill";
import { PrivyAuthControls } from "@/components/auth/privy-auth-controls";

type TopBarProps = {
  currentPrice: number;
  balance: number;
};

export function TopBar({ currentPrice, balance }: TopBarProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-950/80 px-4 py-3">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="border-primary/40 bg-primary/15 text-blue-200">
          CHART / USD
        </Badge>
        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <Activity className="h-4 w-4 text-primary" />
          Price <span className="font-semibold text-white">${currentPrice.toFixed(2)}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-blue-300">
          <CircleDot className="h-3 w-3 animate-pulse text-primary" />
          Sim feed live
        </div>
      </div>
      <div className="flex items-center gap-2">
        <BalancePill balance={balance} />
        <PrivyAuthControls />
      </div>
    </div>
  );
}
