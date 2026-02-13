import { getColumnTicks } from "@/lib/game/constants";
import { getMultiplierForCell, normalizeColumnMultipliersWithHouseEdge, priceToRow } from "@/lib/game/odds";
import type { Bet, FutureColumn } from "@/lib/game/types";

type ProgressState = {
  config: { columnDurationMs: number; tickMs: number };
  currentTick: number;
};

type FutureGridState = {
  config: {
    rows: number;
    colsFuture: number;
    houseEdge: number;
    columnDurationMs: number;
    tickMs: number;
    minPrice: number;
    maxPrice: number;
  };
  currentTick: number;
  currentPrice: number;
  betsOpen: Bet[];
};

export function getCurrentColumnProgress(state: ProgressState): number {
  const columnTicks = getColumnTicks(state.config);
  return (state.currentTick % columnTicks) / columnTicks;
}

export function getOpenBetsForCell(state: FutureGridState, cellId: string) {
  return state.betsOpen.find((bet) => bet.cellId === cellId);
}

export function getFutureGrid(state: FutureGridState): FutureColumn[] {
  const columnTicks = getColumnTicks(state.config);
  const currentColumn = Math.floor(state.currentTick / columnTicks) + 1;
  const currentRow = priceToRow(state.currentPrice, state.config);

  const columns: FutureColumn[] = [];

  for (let offset = 1; offset <= state.config.colsFuture; offset += 1) {
    const col = currentColumn + offset;
    const raw = Array.from({ length: state.config.rows }, (_, row) =>
      getMultiplierForCell({
        colDistance: offset,
        row,
        currentRow,
        config: state.config,
      })
    );

    const normalized = normalizeColumnMultipliersWithHouseEdge(raw, state.config.houseEdge);

    columns.push({
      col,
      cells: normalized.map((multiplier, row) => {
        const cellId = `${col}-${row}` as `${number}-${number}`;
        return {
          cellId,
          col,
          row,
          multiplier,
          locked: false,
          bet: getOpenBetsForCell(state, cellId),
        };
      }),
    });
  }

  return columns;
}
