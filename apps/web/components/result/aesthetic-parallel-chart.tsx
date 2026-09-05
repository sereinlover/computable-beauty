"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AestheticBundle } from "@contracts/types";

import { AESTHETIC_DIMENSION_ORDER } from "@/lib/dimension-colors";

const WIDTH = 640;
const HEIGHT = 320;
const MARGIN = { top: 34, right: 24, bottom: 20, left: 24 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

// Same violet as AestheticRadarChart's own hue.
const LINE_COLOR = "#7c3aed";

function axisX(index: number): number {
  return MARGIN.left + (index / (AESTHETIC_DIMENSION_ORDER.length - 1)) * PLOT_WIDTH;
}

function valueY(value: number): number {
  return MARGIN.top + (1 - value / 100) * PLOT_HEIGHT;
}

// Between each pair of adjacent axes, a cubic Bezier with both control
// points at the horizontal midpoint gives an eased S-curve transition
// instead of a straight zig-zag line.
function pathFor(aesthetic: AestheticBundle): { d: string; points: { x: number; y: number }[] } {
  const points = AESTHETIC_DIMENSION_ORDER.map((key, i) => ({ x: axisX(i), y: valueY(aesthetic[key].score) }));
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const xMid = (prev.x + curr.x) / 2;
    d += ` C ${xMid},${prev.y} ${xMid},${curr.y} ${curr.x},${curr.y}`;
  }
  return { d, points };
}

export function AestheticParallelChart({ aesthetic }: { aesthetic: AestheticBundle }) {
  const t = useTranslations("Result");
  const tDimension = useTranslations("AestheticDimension");
  const [hovered, setHovered] = useState(false);

  const { d, points } = pathFor(aesthetic);

  return (
    <div className="relative">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{t("aestheticParallelTitle")}</p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        {AESTHETIC_DIMENSION_ORDER.map((key, i) => (
          <g key={key}>
            <line
              x1={axisX(i)}
              x2={axisX(i)}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_HEIGHT}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text x={axisX(i)} y={MARGIN.top - 20} textAnchor="middle" className="fill-muted-foreground text-[11px]">
              {tDimension(`${key}.fullLabel`)}
            </text>
            <text x={axisX(i)} y={MARGIN.top - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              100
            </text>
            <text
              x={axisX(i)}
              y={MARGIN.top + PLOT_HEIGHT / 2 + 4}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              50
            </text>
            <text
              x={axisX(i)}
              y={MARGIN.top + PLOT_HEIGHT + 14}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px]"
            >
              0
            </text>
          </g>
        ))}

        <g onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
          {/* A wider invisible stroke widens the hover hit target past the
              visible 2px line, per the dataviz skill's interaction rules. */}
          <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
          <path d={d} fill="none" stroke={LINE_COLOR} strokeWidth={hovered ? 3 : 2} strokeLinecap="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={hovered ? 4 : 3} fill={LINE_COLOR} />
          ))}
        </g>
      </svg>

      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-card px-2 py-1 text-xs whitespace-nowrap text-foreground shadow-md"
          style={{ left: `${(points[0].x / WIDTH) * 100}%`, top: `${(points[0].y / HEIGHT) * 100}%`, marginTop: -8 }}
        >
          {AESTHETIC_DIMENSION_ORDER.map((key) => (
            <div key={key} className="text-muted-foreground">
              {tDimension(`${key}.fullLabel`)} {Math.round(aesthetic[key].score)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
