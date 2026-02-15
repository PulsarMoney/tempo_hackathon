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
        <linearGradient id="priceLineStroke" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8EAFFF" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#336CFF" stopOpacity="1" />
        </linearGradient>
        <filter id="lineGlow">
          <feGaussianBlur stdDeviation="0.8" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <polyline
        points={polyline}
        fill="none"
        stroke="#9DB8FF"
        strokeWidth="0.9"
        strokeOpacity="0.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={polyline}
        fill="none"
        stroke="url(#priceLineStroke)"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#lineGlow)"
      />
      <circle cx={currentX} cy={currentY} r="3.8" fill="#336CFF" className="animate-pulse" filter="url(#lineGlow)" />
    </svg>
  );
}
