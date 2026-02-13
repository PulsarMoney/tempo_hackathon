import { describe, expect, test } from "vitest";

import { GAME_CONFIG } from "@/lib/game/constants";
import { getMultiplierForCell, normalizeColumnMultipliersWithHouseEdge, priceToRow } from "@/lib/game/odds";

describe("odds", () => {
  test("multiplier increases with time distance", () => {
    const currentRow = priceToRow(100, GAME_CONFIG);

    const near = getMultiplierForCell({ colDistance: 1, row: currentRow, currentRow, config: GAME_CONFIG });
    const far = getMultiplierForCell({ colDistance: 6, row: currentRow, currentRow, config: GAME_CONFIG });

    expect(far).toBeGreaterThan(near);
  });

  test("multiplier increases with price distance", () => {
    const currentRow = priceToRow(100, GAME_CONFIG);

    const near = getMultiplierForCell({ colDistance: 2, row: currentRow + 1, currentRow, config: GAME_CONFIG });
    const far = getMultiplierForCell({ colDistance: 2, row: currentRow + 5, currentRow, config: GAME_CONFIG });

    expect(far).toBeGreaterThan(near);
  });

  test("house edge normalization keeps implied sum close to target", () => {
    const currentRow = priceToRow(100, GAME_CONFIG);
    const raw = Array.from({ length: GAME_CONFIG.rows }, (_, row) =>
      getMultiplierForCell({ colDistance: 3, row, currentRow, config: GAME_CONFIG })
    );

    const normalized = normalizeColumnMultipliersWithHouseEdge(raw, GAME_CONFIG.houseEdge);
    const impliedSum = normalized.reduce((acc, m) => acc + 1 / m, 0);

    expect(impliedSum).toBeCloseTo(1 + GAME_CONFIG.houseEdge, 2);
  });

  test("multiplier floor is respected", () => {
    const floorCase = getMultiplierForCell({ colDistance: 0, row: 0, currentRow: 0, config: GAME_CONFIG });
    expect(floorCase).toBeGreaterThanOrEqual(1.08);
  });
});
