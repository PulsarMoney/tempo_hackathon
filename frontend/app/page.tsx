import { ChartBoard } from "@/components/game/chart-board";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#030503] p-4 text-zinc-100 md:p-8">
      <div className="mx-auto mb-4 max-w-[1440px]">
        <h1 className="text-2xl font-bold text-emerald-300 md:text-3xl">Chart Hunter</h1>
        <p className="text-sm text-zinc-400">Place fixed-size bets on the future grid and watch columns settle live.</p>
      </div>
      <ChartBoard />
    </main>
  );
}
