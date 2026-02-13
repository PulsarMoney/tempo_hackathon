import type { GameConfig } from "@/lib/game/types";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

type PriceBandConfig = Pick<GameConfig, "rows" | "minPrice" | "maxPrice">;

export function priceToRow(price: number, config: PriceBandConfig): number {
  const bounded = clamp(price, config.minPrice, config.maxPrice);
  const rowHeight = (config.maxPrice - config.minPrice) / config.rows;
  const raw = Math.floor((config.maxPrice - bounded) / rowHeight);
  return clamp(raw, 0, config.rows - 1);
}

export function rowBand(row: number, config: PriceBandConfig): { low: number; high: number } {
  const rowHeight = (config.maxPrice - config.minPrice) / config.rows;
  const safeRow = clamp(row, 0, config.rows - 1);
  const high = config.maxPrice - safeRow * rowHeight;
  const low = high - rowHeight;
  return { low, high };
}

export function getMultiplierForCell(args: {
  colDistance: number;
  row: number;
  currentRow: number;
  config: Pick<GameConfig, "rows">;
}): number {
  const { colDistance, row, currentRow } = args;
  const timeDistance = Math.max(1, colDistance);
  const priceDistance = Math.abs(row - currentRow);

  const riskScore = 0.19 * timeDistance + 0.33 * priceDistance;
  const rawMultiplier = 1 + riskScore;
  return Math.max(1.08, rawMultiplier);
}

export function normalizeColumnMultipliersWithHouseEdge(multipliers: number[], houseEdge: number): number[] {
  const implied = multipliers.map((m) => 1 / Math.max(m, 1.08));
  const sum = implied.reduce((acc, p) => acc + p, 0);
  if (sum <= 0) {
    return multipliers.map(() => 1.08);
  }

  const target = 1 + houseEdge;
  const scale = target / sum;

  return implied.map((p) => {
    const normalizedP = p * scale;
    return Math.max(1.08, 1 / normalizedP);
  });
}
