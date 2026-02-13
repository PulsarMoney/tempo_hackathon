import { round2 } from "@/lib/game/constants";
import { rowBand } from "@/lib/game/odds";
import type { Bet, GameConfig, PricePoint, ResolvedBet } from "@/lib/game/types";

function isPriceInBand(price: number, low: number, high: number): boolean {
  return price >= low && price <= high;
}

export function resolveColumnBets(args: {
  bets: Bet[];
  priceWindow: PricePoint[];
  config: GameConfig;
  resolvedAtTick: number;
}): ResolvedBet[] {
  const { bets, priceWindow, config, resolvedAtTick } = args;

  return bets.map((bet) => {
    const band = rowBand(bet.row, config);
    const won = priceWindow.some((point) => isPriceInBand(point.price, band.low, band.high));
    const payout = won ? round2(bet.stake * bet.multiplier) : 0;

    return {
      ...bet,
      status: won ? "won" : "lost",
      payout,
      resolvedAtTick,
    };
  });
}
