import { describe, expect, test } from "vitest";

import { GAME_CONFIG } from "@/lib/game/constants";
import { rowBand } from "@/lib/game/odds";
import { resolveColumnBets } from "@/lib/game/settlement";
import type { Bet, PricePoint } from "@/lib/game/types";

describe("settlement", () => {
  const baseBet: Bet = {
    id: "b1",
    cellId: "3-4",
    col: 3,
    row: 4,
    stake: 5,
    multiplier: 2,
    placedAtTick: 0,
    status: "open",
  };

  test("resolves win when price enters row band", () => {
    const band = rowBand(4, GAME_CONFIG);
    const points: PricePoint[] = [
      { tick: 1, timeMs: 100, price: band.low - 0.2 },
      { tick: 2, timeMs: 200, price: (band.low + band.high) / 2 },
    ];

    const [resolved] = resolveColumnBets({ bets: [baseBet], priceWindow: points, config: GAME_CONFIG, resolvedAtTick: 10 });

    expect(resolved.status).toBe("won");
    expect(resolved.payout).toBe(10);
  });

  test("resolves loss when price never enters row band", () => {
    const points: PricePoint[] = [
      { tick: 1, timeMs: 100, price: 120 },
      { tick: 2, timeMs: 200, price: 119.5 },
    ];

    const [resolved] = resolveColumnBets({ bets: [baseBet], priceWindow: points, config: GAME_CONFIG, resolvedAtTick: 10 });

    expect(resolved.status).toBe("lost");
    expect(resolved.payout).toBe(0);
  });

  test("resolves multiple bets independently", () => {
    const bet2: Bet = { ...baseBet, id: "b2", cellId: "3-8", row: 8, multiplier: 3 };
    const points: PricePoint[] = [
      { tick: 1, timeMs: 100, price: (rowBand(4, GAME_CONFIG).low + rowBand(4, GAME_CONFIG).high) / 2 },
      { tick: 2, timeMs: 200, price: GAME_CONFIG.maxPrice },
    ];

    const resolved = resolveColumnBets({ bets: [baseBet, bet2], priceWindow: points, config: GAME_CONFIG, resolvedAtTick: 10 });

    expect(resolved[0].status).toBe("won");
    expect(resolved[1].status).toBe("lost");
  });

  test("payout rounds to 2 decimals", () => {
    const preciseBet: Bet = { ...baseBet, stake: 5, multiplier: 2.3333 };
    const mid = (rowBand(4, GAME_CONFIG).low + rowBand(4, GAME_CONFIG).high) / 2;
    const points: PricePoint[] = [{ tick: 1, timeMs: 100, price: mid }];

    const [resolved] = resolveColumnBets({ bets: [preciseBet], priceWindow: points, config: GAME_CONFIG, resolvedAtTick: 2 });
    expect(resolved.payout).toBe(11.67);
  });
});
