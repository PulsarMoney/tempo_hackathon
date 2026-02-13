"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";

import { GAME_CONFIG, INITIAL_BALANCE, getColumnTicks, round2 } from "@/lib/game/constants";
import { rowBand } from "@/lib/game/odds";
import { nextPricePoint, createInitialSeries } from "@/lib/game/price-engine";
import type {
  Bet,
  DemoModeState,
  GameConfig,
  GameSpeed,
  PricePoint,
  ResolvedBet,
  SettlementUiMessage,
} from "@/lib/game/types";

type GameState = {
  config: GameConfig;
  balance: number;
  stake: number;
  speed: GameSpeed;
  paused: boolean;

  currentTick: number;
  currentPrice: number;
  priceSeries: PricePoint[];

  betsOpen: Bet[];
  betsResolved: ResolvedBet[];
  history: ResolvedBet[];

  demoSeedEnabled: boolean;
  seed: number;
  rngState: number;

  ui: {
    message: SettlementUiMessage | null;
    hitEffectCellIds: string[];
    hitEffectTick: number;
  };

  tick: () => void;
  placeBet: (col: number, row: number, multiplier: number) => { ok: boolean; reason?: string };
  setStake: (value: number) => void;
  togglePause: () => void;
  setSpeed: (value: GameSpeed) => void;
  toggleDemoSeed: (enabled: boolean) => void;
  resetGame: () => void;
};

const INITIAL_ADVANCE_COLUMNS = GAME_CONFIG.colsFuture - 2;

const makeDemoMode = (enabled: boolean, seed: number): DemoModeState => ({
  enabled,
  seed,
  scriptedSpikeTick: GAME_CONFIG.demoSpikeTick,
});

function buildInitialSnapshot(config: GameConfig, seed: number, demoEnabled: boolean) {
  const initialTick = getColumnTicks(config) * INITIAL_ADVANCE_COLUMNS;
  let rngState = seed;
  let series = createInitialSeries(config);
  let prev = series[0];

  for (let tick = 1; tick <= initialTick; tick += 1) {
    const next = nextPricePoint(prev, tick, rngState, config, makeDemoMode(demoEnabled, seed));
    rngState = next.rngState;
    prev = next.point;
    series.push(next.point);
  }

  if (series.length > config.priceRetentionTicks) {
    series = series.slice(series.length - config.priceRetentionTicks);
  }

  return {
    initialTick,
    currentPrice: prev.price,
    priceSeries: series,
    rngState,
  };
}

const INITIAL_SNAPSHOT = buildInitialSnapshot(GAME_CONFIG, 1337, false);

function buildSettlementMessage(resolved: ResolvedBet[], tick: number): SettlementUiMessage | null {
  if (resolved.length === 0) {
    return null;
  }

  const wins = resolved.filter((bet) => bet.status === "won");
  const totalPayout = wins.reduce((acc, bet) => acc + bet.payout, 0);

  if (wins.length === 0) {
    return { text: `Column settled: ${resolved.length} losses`, kind: "loss", atTick: tick };
  }

  if (wins.length === resolved.length) {
    return { text: `Column settled: Won $${totalPayout.toFixed(2)}`, kind: "win", atTick: tick };
  }

  return { text: `Column settled: ${wins.length}/${resolved.length} wins (+$${totalPayout.toFixed(2)})`, kind: "mixed", atTick: tick };
}

export const useGameStore = create<GameState>()(
  immer((set, get) => ({
    config: GAME_CONFIG,
    balance: INITIAL_BALANCE,
    stake: GAME_CONFIG.defaultStake,
    speed: 1,
    paused: false,

    currentTick: INITIAL_SNAPSHOT.initialTick,
    currentPrice: INITIAL_SNAPSHOT.currentPrice,
    priceSeries: INITIAL_SNAPSHOT.priceSeries,

    betsOpen: [],
    betsResolved: [],
    history: [],

    demoSeedEnabled: false,
    seed: 1337,
    rngState: INITIAL_SNAPSHOT.rngState,

    ui: {
      message: null,
      hitEffectCellIds: [],
      hitEffectTick: -9999,
    },

    tick: () => {
      const state = get();
      if (state.paused) {
        return;
      }

      const columnTicks = getColumnTicks(state.config);
      const nextTick = state.currentTick + 1;
      const currentColumnAfter = Math.floor(nextTick / columnTicks);

      const prevPoint = state.priceSeries[state.priceSeries.length - 1];
      const priceResult = nextPricePoint(
        prevPoint,
        nextTick,
        state.rngState,
        state.config,
        makeDemoMode(state.demoSeedEnabled, state.seed)
      );

      set((draft) => {
        draft.currentTick = nextTick;
        draft.currentPrice = priceResult.point.price;
        draft.rngState = priceResult.rngState;
        if (nextTick - draft.ui.hitEffectTick > 8) {
          draft.ui.hitEffectCellIds = [];
        }
        draft.priceSeries.push(priceResult.point);
        if (draft.priceSeries.length > draft.config.priceRetentionTicks) {
          draft.priceSeries.splice(0, draft.priceSeries.length - draft.config.priceRetentionTicks);
        }

        const activeColumn = currentColumnAfter;
        const resolvedNow: ResolvedBet[] = [];
        const stillOpen: Bet[] = [];

        for (const bet of draft.betsOpen) {
          if (bet.col < activeColumn) {
            resolvedNow.push({
              ...bet,
              status: "lost",
              payout: 0,
              resolvedAtTick: nextTick,
            });
            continue;
          }

          if (bet.col === activeColumn) {
            const band = rowBand(bet.row, draft.config);
            const isHit = priceResult.point.price >= band.low && priceResult.point.price <= band.high;
            if (isHit) {
              resolvedNow.push({
                ...bet,
                status: "won",
                payout: round2(bet.stake * bet.multiplier),
                resolvedAtTick: nextTick,
              });
              continue;
            }
          }

          stillOpen.push(bet);
        }

        draft.betsOpen = stillOpen;

        if (resolvedNow.length > 0) {
          const payoutTotal = resolvedNow.reduce((acc, bet) => acc + bet.payout, 0);
          const wonCellIds = resolvedNow.filter((bet) => bet.status === "won").map((bet) => bet.cellId);
          draft.balance += payoutTotal;
          draft.betsResolved = [...resolvedNow, ...draft.betsResolved];
          draft.history = [...resolvedNow, ...draft.history].slice(0, draft.config.historyLimit);
          draft.ui.message = buildSettlementMessage(resolvedNow, nextTick);
          if (wonCellIds.length > 0) {
            draft.ui.hitEffectCellIds = wonCellIds;
            draft.ui.hitEffectTick = nextTick;
          }
        }
      });
    },

    placeBet: (col, row, multiplier) => {
      const state = get();
      const columnTicks = getColumnTicks(state.config);
      const currentColumn = Math.floor(state.currentTick / columnTicks);

      if (col <= currentColumn + 1) {
        return { ok: false, reason: "This column is too close and locked." };
      }

      if (state.balance < state.stake) {
        return { ok: false, reason: "Insufficient balance." };
      }

      const cellId = `${col}-${row}` as `${number}-${number}`;
      const exists = state.betsOpen.some((bet) => bet.cellId === cellId);
      if (exists) {
        return { ok: false, reason: "Bet already exists for this cell." };
      }

      const bet: Bet = {
        id: `${cellId}-${state.currentTick}`,
        cellId,
        col,
        row,
        stake: state.stake,
        multiplier,
        placedAtTick: state.currentTick,
        status: "open",
      };

      set((draft) => {
        draft.betsOpen.push(bet);
        draft.balance -= draft.stake;
      });

      return { ok: true };
    },

    setStake: (value) => {
      set((draft) => {
        const bounded = Math.max(draft.config.minStake, Math.min(draft.config.maxStake, value));
        draft.stake = bounded;
      });
    },

    togglePause: () => {
      set((draft) => {
        draft.paused = !draft.paused;
      });
    },

    setSpeed: (value) => {
      set((draft) => {
        draft.speed = value;
      });
    },

    toggleDemoSeed: (enabled) => {
      set((draft) => {
        draft.demoSeedEnabled = enabled;
        draft.rngState = enabled ? draft.seed : (Date.now() % 100000) + 1;
      });
    },

    resetGame: () => {
      set((draft) => {
        const snap = buildInitialSnapshot(draft.config, draft.seed, draft.demoSeedEnabled);
        draft.balance = INITIAL_BALANCE;
        draft.stake = draft.config.defaultStake;
        draft.speed = 1;
        draft.paused = false;

        draft.currentTick = snap.initialTick;
        draft.currentPrice = snap.currentPrice;
        draft.priceSeries = snap.priceSeries;

        draft.betsOpen = [];
        draft.betsResolved = [];
        draft.history = [];

        draft.rngState = snap.rngState;
        draft.ui.message = null;
        draft.ui.hitEffectCellIds = [];
        draft.ui.hitEffectTick = -9999;
      });
    },
  }))
);

export type { GameState };
