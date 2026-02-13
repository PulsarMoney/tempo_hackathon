import type { GameConfig } from "@/lib/game/types";

export const GAME_CONFIG: GameConfig = {
  rows: 12,
  colsFuture: 10,
  columnDurationMs: 5000,
  tickMs: 50,
  minPrice: 80,
  maxPrice: 120,
  startPrice: 100,
  defaultStake: 5,
  minStake: 1,
  maxStake: 50,
  houseEdge: 0.06,
  historyLimit: 80,
  priceRetentionTicks: 1200,
  demoSpikeTick: 900,
};

export const INITIAL_BALANCE = 250;

export const STAKE_PRESETS = [1, 5, 10] as const;

export const SPEED_OPTIONS = [1, 2, 4] as const;

export function getColumnTicks(config: GameConfig): number {
  return Math.max(1, Math.floor(config.columnDurationMs / config.tickMs));
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
