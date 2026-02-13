"use client";

import { Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type BalancePillProps = {
  balance: number;
};

export function BalancePill({ balance }: BalancePillProps) {
  return (
    <Badge className="gap-1.5 border-emerald-400/60 bg-emerald-500/20 px-3 py-1 text-sm text-emerald-200 shadow-pulse">
      <Wallet className="h-3.5 w-3.5" />
      ${balance.toFixed(2)}
    </Badge>
  );
}
