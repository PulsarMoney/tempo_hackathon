"use client";

import { Wallet } from "lucide-react";

import { Badge } from "@/components/ui/badge";

type BalancePillProps = {
  balance: number;
};

export function BalancePill({ balance }: BalancePillProps) {
  return (
    <Badge className="gap-1.5 border-primary/45 bg-primary/15 px-3 py-1 text-sm text-blue-100 shadow-pulse">
      <Wallet className="h-3.5 w-3.5" />
      ${balance.toFixed(2)}
    </Badge>
  );
}
