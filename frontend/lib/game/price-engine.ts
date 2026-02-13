import type { DemoModeState, GameConfig, PricePoint } from "@/lib/game/types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nextRng(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return { value, state: t };
}

function nextNormal(state: number): { value: number; state: number } {
  const a = nextRng(state);
  const b = nextRng(a.state);
  const u1 = Math.max(a.value, 1e-8);
  const u2 = b.value;
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return { value: z0, state: b.state };
}

export function createInitialSeries(config: GameConfig): PricePoint[] {
  return [{ tick: 0, timeMs: 0, price: config.startPrice }];
}

export function nextPricePoint(
  prev: PricePoint,
  tick: number,
  rngState: number,
  config: GameConfig,
  mode: DemoModeState
): { point: PricePoint; rngState: number } {
  const range = config.maxPrice - config.minPrice;

  const norm = nextNormal(rngState);
  rngState = norm.state;

  const pulseRoll = nextRng(rngState);
  rngState = pulseRoll.state;

  const pulseDirRoll = nextRng(rngState);
  rngState = pulseDirRoll.state;

  const drift = Math.sin(tick / 75) * (range * 0.0007);
  const vol = range * (0.0016 + 0.0012 * (0.5 + 0.5 * Math.sin(tick / 43)));

  let pulse = 0;
  if (pulseRoll.value < 0.03) {
    pulse = (pulseDirRoll.value > 0.5 ? 1 : -1) * range * 0.012;
  }

  if (mode.enabled && tick === mode.scriptedSpikeTick) {
    pulse += range * 0.22;
  }

  const nextPrice = clamp(prev.price + drift + vol * norm.value + pulse, config.minPrice, config.maxPrice);

  return {
    point: {
      tick,
      timeMs: tick * config.tickMs,
      price: nextPrice,
    },
    rngState,
  };
}
