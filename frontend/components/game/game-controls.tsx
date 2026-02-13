"use client";

import { Pause, Play, RotateCcw } from "lucide-react";

import type { GameSpeed } from "@/lib/game/types";
import { SPEED_OPTIONS } from "@/lib/game/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type GameControlsProps = {
  paused: boolean;
  speed: GameSpeed;
  demoSeedEnabled: boolean;
  togglePause: () => void;
  setSpeed: (speed: GameSpeed) => void;
  resetGame: () => void;
  toggleDemoSeed: (enabled: boolean) => void;
};

export function GameControls({
  paused,
  speed,
  demoSeedEnabled,
  togglePause,
  setSpeed,
  resetGame,
  toggleDemoSeed,
}: GameControlsProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-zinc-300">Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Button onClick={togglePause} className="flex-1 gap-2">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button variant="outline" onClick={resetGame} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {SPEED_OPTIONS.map((item) => (
            <Button
              key={item}
              variant={speed === item ? "default" : "outline"}
              size="sm"
              onClick={() => setSpeed(item as GameSpeed)}
            >
              {item}x
            </Button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm">
          <span className="text-zinc-200">Deterministic demo seed</span>
          <input
            type="checkbox"
            className="h-4 w-4 accent-primary"
            checked={demoSeedEnabled}
            onChange={(e) => toggleDemoSeed(e.target.checked)}
          />
        </label>
      </CardContent>
    </Card>
  );
}
