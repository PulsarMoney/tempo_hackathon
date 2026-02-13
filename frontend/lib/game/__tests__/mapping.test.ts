import { describe, expect, test } from "vitest";

import { GAME_CONFIG } from "@/lib/game/constants";
import { priceToRow, rowBand } from "@/lib/game/odds";

describe("price mapping", () => {
  test("top and bottom edge mapping", () => {
    expect(priceToRow(GAME_CONFIG.maxPrice, GAME_CONFIG)).toBe(0);
    expect(priceToRow(GAME_CONFIG.minPrice, GAME_CONFIG)).toBe(GAME_CONFIG.rows - 1);
  });

  test("out-of-range price is clamped", () => {
    expect(priceToRow(GAME_CONFIG.maxPrice + 200, GAME_CONFIG)).toBe(0);
    expect(priceToRow(GAME_CONFIG.minPrice - 200, GAME_CONFIG)).toBe(GAME_CONFIG.rows - 1);
  });

  test("row bands are contiguous and ordered", () => {
    const bands = Array.from({ length: GAME_CONFIG.rows }, (_, row) => rowBand(row, GAME_CONFIG));

    for (let i = 0; i < bands.length - 1; i += 1) {
      expect(bands[i].low).toBeCloseTo(bands[i + 1].high, 8);
      expect(bands[i].high).toBeGreaterThan(bands[i].low);
    }
  });
});
