export type GridCellId = `${number}-${number}`;

export type BetStatus = "open" | "won" | "lost";

export type GameSpeed = 1 | 2 | 4;

export type DemoModeState = {
  enabled: boolean;
  seed: number;
  scriptedSpikeTick: number;
};

export type GameConfig = {
  rows: number;
  colsFuture: number;
  columnDurationMs: number;
  tickMs: number;
  minPrice: number;
  maxPrice: number;
  startPrice: number;
  defaultStake: number;
  minStake: number;
  maxStake: number;
  houseEdge: number;
  historyLimit: number;
  priceRetentionTicks: number;
  demoSpikeTick: number;
};

export type PricePoint = {
  tick: number;
  timeMs: number;
  price: number;
};

export type Bet = {
  id: string;
  cellId: GridCellId;
  col: number;
  row: number;
  stake: number;
  multiplier: number;
  placedAtTick: number;
  status: BetStatus;
  payout?: number;
  playMode: "demo" | "pool";
  poolId?: string;
  poolTitle?: string;
};

export type ResolvedBet = Bet & {
  status: "won" | "lost";
  payout: number;
  resolvedAtTick: number;
};

export type ColumnWindow = {
  colIndex: number;
  startTick: number;
  endTick: number;
};

export type SettlementUiMessage = {
  text: string;
  kind: "win" | "loss" | "mixed";
  atTick: number;
};

export type FutureCell = {
  cellId: GridCellId;
  col: number;
  row: number;
  multiplier: number;
  locked: boolean;
  bet?: Bet;
};

export type FutureColumn = {
  col: number;
  cells: FutureCell[];
};
