"use client";

import type { PricePoint } from "@/lib/game/types";

type PriceLineOverlayProps = {
  points: PricePoint[];
  minPrice: number;
  maxPrice: number;
  windowStartTick: number;
  windowEndTick: number;
  currentTick: number;
};

export function PriceLineOverlay({
  points,
  minPrice,
  maxPrice,
  windowStartTick,
  windowEndTick,
  currentTick,
}: PriceLineOverlayProps) {
  const width = 1000;
  const height = 420;

  const visiblePoints = points.filter((point) => point.tick >= windowStartTick && point.tick <= windowEndTick);
  if (visiblePoints.length < 2) {
    return null;
  }

  const tickRange = Math.max(1, windowEndTick - windowStartTick);
  const priceRange = Math.max(1, maxPrice - minPrice);

  const mapped = visiblePoints.map((point) => {
    const x = ((point.tick - windowStartTick) / tickRange) * width;
    const y = ((maxPrice - point.price) / priceRange) * height;
    return { x, y };
  });

  const polyline = mapped.map((p) => `${p.x},${p.y}`).join(" ");
  const currentX = ((currentTick - windowStartTick) / tickRange) * width;
  const currentPoint = visiblePoints[visiblePoints.length - 1];
  const currentY = ((maxPrice - currentPoint.price) / priceRange) * height;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="pointer-events-none absolute inset-y-0 left-0 right-[62px] h-full w-full">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polyline points={polyline} fill="none" stroke="#34d399" strokeWidth="2.8" filter="url(#glow)" />
      <circle cx={currentX} cy={currentY} r="6.5" fill="#4ade80" className="animate-pulse" filter="url(#glow)" />
    </svg>
  );
}
