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
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="pointer-events-none absolute inset-y-0 left-0 right-[62px] h-full w-full"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <filter id="lineGlow">
          <feGaussianBlur stdDeviation="1.1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polyline
        points={polyline}
        fill="none"
        stroke="#7aa0ff"
        strokeWidth="1.2"
        strokeOpacity="0.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={polyline}
        fill="none"
        stroke="#336CFF"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#lineGlow)"
      />
      <circle cx={currentX} cy={currentY} r="4.4" fill="#336CFF" className="animate-pulse" filter="url(#lineGlow)" />
    </svg>
  );
}
