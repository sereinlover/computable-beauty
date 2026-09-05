"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { EmotionPoint } from "@contracts/types";

const WIDTH = 640;
const HEIGHT = 440;
const MARGIN = { top: 20, right: 20, bottom: 52, left: 56 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

const X_TICKS = [-1, -0.5, 0, 0.5, 1];
const Y_TICKS = [0, 0.25, 0.5, 0.75, 1];

// Bin resolution — 10x8 keeps individual cells legible at this chart size
// without the grid reading as noise; valence's wider domain (-1~1 vs 0~1)
// gets proportionally more columns so cells stay roughly square.
const GRID_COLS = 10;
const GRID_ROWS = 8;
const BIN_WIDTH = 2 / GRID_COLS;
const BIN_HEIGHT = 1 / GRID_ROWS;

// Sequential = one hue, light→dark by opacity, not discrete steps — same
// technique as EmotionArcChart's area fill. Violet matches emotional_depth's
// color elsewhere (lib/dimension-colors.ts). RGB triplet for template use.
const HEATMAP_COLOR = "124, 58, 237";

function xScale(valence: number): number {
  return MARGIN.left + ((valence + 1) / 2) * PLOT_WIDTH;
}

function yScale(arousal: number): number {
  return MARGIN.top + (1 - arousal) * PLOT_HEIGHT;
}

function clampIndex(i: number, max: number): number {
  return Math.min(Math.max(i, 0), max - 1);
}

export function EmotionHeatmapChart({ data }: { data: EmotionPoint[] }) {
  const t = useTranslations("Result");
  const tQuadrant = useTranslations("EmotionQuadrant");
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);

  const { counts, maxCount } = useMemo(() => {
    const grid: number[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(0));
    for (const p of data) {
      const col = clampIndex(Math.floor((p.valence + 1) / BIN_WIDTH), GRID_COLS);
      const row = clampIndex(Math.floor(p.arousal / BIN_HEIGHT), GRID_ROWS);
      grid[row][col] += 1;
    }
    const max = Math.max(1, ...grid.flat());
    return { counts: grid, maxCount: max };
  }, [data]);

  const hovered = hoverCell ? counts[hoverCell.row][hoverCell.col] : null;

  // emotion_arc's ~1.5s sample spacing isn't a constant exposed to the
  // frontend, so it's derived from the data itself — a cell's point count
  // only means "dwell time" once converted through this.
  const avgIntervalSec = data.length > 1 ? (data[data.length - 1].timestamp_sec - data[0].timestamp_sec) / (data.length - 1) : 0;

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">{t("emotionHeatmapTitle")}</p>

      <div className="relative">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
          {/* Quadrant labels — background context, never the loudest thing on the chart. */}
          <text
            x={MARGIN.left + PLOT_WIDTH * 0.25}
            y={MARGIN.top + PLOT_HEIGHT * 0.15}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {tQuadrant("negativeHighArousal")}
          </text>
          <text
            x={MARGIN.left + PLOT_WIDTH * 0.75}
            y={MARGIN.top + PLOT_HEIGHT * 0.15}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {tQuadrant("positiveHighArousal")}
          </text>
          <text
            x={MARGIN.left + PLOT_WIDTH * 0.25}
            y={MARGIN.top + PLOT_HEIGHT * 0.92}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {tQuadrant("negativeLowArousal")}
          </text>
          <text
            x={MARGIN.left + PLOT_WIDTH * 0.75}
            y={MARGIN.top + PLOT_HEIGHT * 0.92}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            {tQuadrant("positiveLowArousal")}
          </text>

          {/* Dwell-time cells — a floor of ~0.08 keeps a single-point cell
              faintly visible instead of indistinguishable from empty. */}
          {counts.map((rowCounts, row) =>
            rowCounts.map((count, col) => {
              if (count === 0) return null;
              const opacity = 0.08 + (count / maxCount) * 0.82;
              const vMin = -1 + col * BIN_WIDTH;
              const aMax = (row + 1) * BIN_HEIGHT;
              const isHovered = hoverCell?.row === row && hoverCell?.col === col;
              return (
                <rect
                  key={`${row}-${col}`}
                  x={xScale(vMin)}
                  y={yScale(aMax)}
                  width={xScale(vMin + BIN_WIDTH) - xScale(vMin)}
                  height={yScale(aMax - BIN_HEIGHT) - yScale(aMax)}
                  fill={`rgba(${HEATMAP_COLOR}, ${opacity})`}
                  stroke={isHovered ? "var(--foreground)" : "none"}
                  strokeWidth={isHovered ? 1.5 : 0}
                  onMouseEnter={() => setHoverCell({ row, col })}
                  onMouseLeave={() => setHoverCell(null)}
                />
              );
            }),
          )}

          {/* Gridlines — hairline, solid (never dashed, that's reserved for
              the valence=0 boundary below, which carries real meaning). */}
          {X_TICKS.map((v) => (
            <line
              key={v}
              x1={xScale(v)}
              x2={xScale(v)}
              y1={MARGIN.top}
              y2={MARGIN.top + PLOT_HEIGHT}
              stroke="var(--border)"
              strokeWidth={1}
            />
          ))}
          {Y_TICKS.map((a) => (
            <line
              key={a}
              x1={MARGIN.left}
              x2={MARGIN.left + PLOT_WIDTH}
              y1={yScale(a)}
              y2={yScale(a)}
              stroke="var(--border)"
              strokeWidth={1}
            />
          ))}

          {/* valence = 0, the boundary between negative/positive quadrants — a
              meaningful reference line, not a routine gridline, so it's the
              one line allowed to be dashed. */}
          <line
            x1={xScale(0)}
            x2={xScale(0)}
            y1={MARGIN.top}
            y2={MARGIN.top + PLOT_HEIGHT}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          {/* Axis tick labels. */}
          {X_TICKS.map((v) => (
            <text
              key={v}
              x={xScale(v)}
              y={MARGIN.top + PLOT_HEIGHT + 16}
              textAnchor="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {v.toFixed(1)}
            </text>
          ))}
          {Y_TICKS.map((a) => (
            <text
              key={a}
              x={MARGIN.left - 8}
              y={yScale(a) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px]"
            >
              {a.toFixed(2)}
            </text>
          ))}
          <text
            x={MARGIN.left + PLOT_WIDTH / 2}
            y={MARGIN.top + PLOT_HEIGHT + 32}
            textAnchor="middle"
            className="fill-muted-foreground text-[11px]"
          >
            valence
          </text>
          <text
            x={14}
            y={MARGIN.top + PLOT_HEIGHT / 2}
            textAnchor="middle"
            transform={`rotate(-90, 14, ${MARGIN.top + PLOT_HEIGHT / 2})`}
            className="fill-muted-foreground text-[11px]"
          >
            arousal
          </text>

          {/* Legend — a horizontal gradient swatch, not a discrete-step key,
              since the encoding itself is continuous. */}
          <defs>
            <linearGradient id="heatmap-legend-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={`rgba(${HEATMAP_COLOR}, 0.08)`} />
              <stop offset="100%" stopColor={`rgba(${HEATMAP_COLOR}, 0.9)`} />
            </linearGradient>
          </defs>
          <rect x={WIDTH - MARGIN.right - 70} y={4} width={70} height={6} fill="url(#heatmap-legend-gradient)" rx={2} />
          <text x={WIDTH - MARGIN.right - 70} y={18} textAnchor="start" className="fill-muted-foreground text-[10px]">
            {t("heatmapLegendLess")}
          </text>
          <text x={WIDTH - MARGIN.right} y={18} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {t("heatmapLegendMore")}
          </text>
        </svg>

        {hoverCell && hovered !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-card px-2 py-1 text-xs whitespace-nowrap text-foreground shadow-md"
            style={{
              left: `${((xScale(-1 + hoverCell.col * BIN_WIDTH + BIN_WIDTH / 2)) / WIDTH) * 100}%`,
              top: `${((yScale(hoverCell.row * BIN_HEIGHT + BIN_HEIGHT / 2)) / HEIGHT) * 100}%`,
              marginTop: -8,
            }}
          >
            <div className="text-muted-foreground">
              {((hovered / data.length) * 100).toFixed(2)}% · {t("heatmapLegendApprox")}
              {Math.round(hovered * avgIntervalSec)}
              {t("heatmapLegendSeconds")}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
