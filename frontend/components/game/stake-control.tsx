"use client";

import { Lock, Minus, Plus } from "lucide-react";

import { STAKE_PRESETS } from "@/lib/game/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type StakeControlProps = {
  stake: number;
  minStake: number;
  maxStake: number;
  setStake: (v: number) => void;
};

export function StakeControl({ stake, minStake, maxStake, setStake }: StakeControlProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-300">Stake</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setStake(stake - 1)} disabled={stake <= minStake}>
            <Minus className="h-4 w-4" />
          </Button>
          <div className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-center font-semibold text-emerald-300">
            ${stake.toFixed(0)}
          </div>
          <Button variant="outline" size="icon" onClick={() => setStake(stake + 1)} disabled={stake >= maxStake}>
            <Plus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-zinc-500" aria-label="lock visual">
            <Lock className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          {STAKE_PRESETS.map((preset) => (
            <Button
              key={preset}
              variant={preset === stake ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setStake(preset)}
            >
              ${preset}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
