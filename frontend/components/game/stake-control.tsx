"use client";

import { Lock, Minus, Plus } from "lucide-react";

import { STAKE_PRESETS } from "@/lib/game/constants";
import { Button } from "@/components/ui/button";

type StakeControlProps = {
  stake: number;
  minStake: number;
  maxStake: number;
  setStake: (v: number) => void;
};

export function StakeControl({ stake, minStake, maxStake, setStake }: StakeControlProps) {
  return (
    <div className="panel-section space-y-3">
      <p className="section-title">Stake</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setStake(stake - 1)} disabled={stake <= minStake}>
          <Minus className="h-4 w-4" />
        </Button>
        <div className="flex-1 rounded-md border border-border bg-black/20 px-3 py-2 text-center text-lg font-semibold text-primary">
          ${stake.toFixed(0)}
        </div>
        <Button variant="outline" size="icon" onClick={() => setStake(stake + 1)} disabled={stake >= maxStake}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="text-zinc-500" aria-label="lock visual">
          <Lock className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {STAKE_PRESETS.map((preset) => (
          <Button
            key={preset}
            variant={preset === stake ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => setStake(preset)}
          >
            ${preset}
          </Button>
        ))}
      </div>
    </div>
  );
}
