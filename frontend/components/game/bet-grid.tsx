"use client";

import type { Bet, FutureColumn } from "@/lib/game/types";

type BetGridProps = {
  columns: FutureColumn[];
  rows: number;
  totalColumnsVisible: number;
  pastColumnsVisible: number;
  currentColumn: number;
  progress: number;
  betsOpen: Bet[];
  hitEffectCellIds: string[];
  hitEffectActive: boolean;
  onPlaceBet: (col: number, row: number, multiplier: number) => { ok: boolean; reason?: string };
};

export function BetGrid({
  columns,
  rows,
  totalColumnsVisible,
  pastColumnsVisible,
  currentColumn,
  progress,
  betsOpen,
  hitEffectCellIds,
  hitEffectActive,
  onPlaceBet,
}: BetGridProps) {
  const gridShiftPercent = (progress * 100) / totalColumnsVisible;
  const cellMap = new Map<string, { multiplier: number; bet?: Bet }>();

  for (const column of columns) {
    for (const cell of column.cells) {
      cellMap.set(cell.cellId, { multiplier: cell.multiplier, bet: cell.bet });
    }
  }

  for (const bet of betsOpen) {
    if (!cellMap.has(bet.cellId)) {
      cellMap.set(bet.cellId, { multiplier: bet.multiplier, bet });
    }
  }

  const cells: Array<{
    key: string;
    colOffset: number;
    col: number;
    row: number;
    bet?: Bet;
    multiplier?: number;
    selectable: boolean;
    showMultiplier: boolean;
  }> = [];

  for (let colIndex = 0; colIndex < totalColumnsVisible; colIndex += 1) {
    const col = currentColumn - pastColumnsVisible + colIndex;
    const isPast = col < currentColumn;
    const isCurrent = col === currentColumn;
    const isNear = col === currentColumn + 1;
    const isFutureSelectable = col > currentColumn + 1;

    for (let row = 0; row < rows; row += 1) {
      const cellId = `${col}-${row}`;
      const entry = cellMap.get(cellId);
      const hasBet = Boolean(entry?.bet);

      cells.push({
        key: cellId,
        colOffset: colIndex,
        col,
        row,
        bet: entry?.bet,
        multiplier: entry?.multiplier,
        selectable: isFutureSelectable && !hasBet && Boolean(entry?.multiplier),
        showMultiplier: isFutureSelectable && !hasBet,
      });

      if (isPast || isCurrent || isNear) {
        if (!hasBet) {
          cells[cells.length - 1].showMultiplier = false;
          cells[cells.length - 1].selectable = false;
        }
      }
    }
  }

  return (
    <div
      className="pointer-events-none absolute inset-y-0 left-0 right-[62px] z-20 grid gap-[1px] p-1"
      style={{
        gridTemplateColumns: `repeat(${totalColumnsVisible}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        transform: `translateX(-${gridShiftPercent}%)`,
      }}
    >
      {cells.map((cell) => {
        const base =
          "relative flex h-full w-full items-center justify-center rounded-sm border border-zinc-800/65 text-[12px] font-semibold md:text-[13px]";
        const isHitCell = hitEffectActive && hitEffectCellIds.includes(cell.key);

        if (cell.bet) {
          return (
            <div
              key={cell.key}
              className={`${base} pointer-events-none z-10 border-emerald-400/70 bg-emerald-500/25 text-emerald-100 shadow-pulse backdrop-blur-[1px]`}
              style={{ gridColumn: `${cell.colOffset + 1} / span 1`, gridRow: `${cell.row + 1} / span 1` }}
            >
              {isHitCell && <div className="hit-burst-ring absolute inset-[-4px] rounded-sm" />}
              <div className="flex flex-col items-center">
                <span className="text-[13px] font-bold md:text-[14px]">${cell.bet.stake.toFixed(0)}</span>
                <span className="text-[11px] md:text-[12px]">x{cell.bet.multiplier.toFixed(2)}</span>
              </div>
            </div>
          );
        }

        if (!cell.showMultiplier || !cell.multiplier) {
          return (
            <div
              key={cell.key}
              className={`${base} ${isHitCell ? "hit-cell-splash bg-emerald-500/12 text-emerald-100" : "bg-transparent"}`}
              style={{ gridColumn: `${cell.colOffset + 1} / span 1`, gridRow: `${cell.row + 1} / span 1` }}
            >
              {isHitCell && (
                <>
                  <div className="hit-burst-ring absolute inset-[-6px] rounded-sm" />
                  <span className="relative z-10 text-[11px] font-black tracking-wide">HIT</span>
                </>
              )}
            </div>
          );
        }

        return (
          <button
            key={cell.key}
            className={`${base} pointer-events-auto bg-zinc-950/35 text-zinc-300 transition-all hover:border-emerald-500/50 hover:bg-zinc-900/45`}
            style={{ gridColumn: `${cell.colOffset + 1} / span 1`, gridRow: `${cell.row + 1} / span 1` }}
            onClick={() => onPlaceBet(cell.col, cell.row, cell.multiplier as number)}
            aria-label={`Place bet on column ${cell.col} row ${cell.row}`}
            title={`c${cell.col} r${cell.row}`}
            disabled={!cell.selectable}
          >
            x{cell.multiplier.toFixed(2)}
          </button>
        );
      })}
    </div>
  );
}
