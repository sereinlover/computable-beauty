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

// Same violet as EmotionHeatmapChart's wash, deliberately not the
// arousal/valence orange/blue pair from EmotionArcChart — those colors mean
// "which series" over there; reusing them for "start vs end" here would
// silently change what blue/orange mean between two adjacent charts.
const TRAJECTORY_COLOR = "124, 58, 237";

// emotion_arc lands on an uneven ~1.5s grid (msd-musicnn's patch hop — see
// classifiers/emotion.py). Bucket-averaging into clean 1s windows both
// normalizes the sample rate and smooths frame-to-frame model jitter.
const WINDOW_SEC = 1;

function downsample(data: EmotionPoint[], windowSec: number): EmotionPoint[] {
  const buckets = new Map<number, { valence: number; arousal: number; timestamp_sec: number; count: number }>();
  for (const p of data) {
    const key = Math.floor(p.timestamp_sec / windowSec);
    const bucket = buckets.get(key) ?? { valence: 0, arousal: 0, timestamp_sec: 0, count: 0 };
    bucket.valence += p.valence;
    bucket.arousal += p.arousal;
    bucket.timestamp_sec += p.timestamp_sec;
    bucket.count += 1;
    buckets.set(key, bucket);
  }
  return Array.from(buckets.keys())
    .sort((a, b) => a - b)
    .map((key) => {
      const b = buckets.get(key)!;
      return { valence: b.valence / b.count, arousal: b.arousal / b.count, timestamp_sec: b.timestamp_sec / b.count };
    });
}

function xScale(valence: number): number {
  return MARGIN.left + ((valence + 1) / 2) * PLOT_WIDTH;
}

function yScale(arousal: number): number {
  return MARGIN.top + (1 - arousal) * PLOT_HEIGHT;
}

// One hue, light→dark by opacity (same technique as the heatmap's wash),
// applied along time instead of dwell count — light = early, dark = late.
function opacityForProgress(t: number): number {
  return 0.15 + t * 0.8;
}

function formatTimestamp(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.round(sec % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function EmotionTrajectoryChart({ data }: { data: EmotionPoint[] }) {
  const t = useTranslations("Result");
  const tQuadrant = useTranslations("EmotionQuadrant");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const smoothed = useMemo(() => downsample(data, WINDOW_SEC), [data]);
  const points = useMemo(
    () => smoothed.map((p) => ({ ...p, x: xScale(p.valence), y: yScale(p.arousal) })),
    [smoothed],
  );

  if (points.length === 0) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const hovered = hoverIndex === null ? null : points[hoverIndex];

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const py = ((e.clientY - rect.top) / rect.height) * HEIGHT;

    // Nearest-point hover instead of one hit target per point — the path
    // winds back over itself, so screen-space distance to every point is
    // simpler and more robust than trying to hit a 2px line.
    let nearest = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = (p.x - px) ** 2 + (p.y - py) ** 2;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    });
    setHoverIndex(nearest);
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">{t("emotionTrajectoryTitle")}</p>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
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

          {/* Start/end legend — top-right, right-aligned to the plot's right
              edge (matches EmotionHeatmapChart's legend placement). */}
          <circle cx={WIDTH - MARGIN.right - 76} cy={12} r={4} fill={`rgba(${TRAJECTORY_COLOR}, 0.15)`} />
          <text x={WIDTH - MARGIN.right - 46} y={15} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {t("trajectoryStart")}
          </text>
          <circle cx={WIDTH - MARGIN.right - 30} cy={12} r={4} fill={`rgba(${TRAJECTORY_COLOR}, 0.95)`} />
          <text x={WIDTH - MARGIN.right} y={15} textAnchor="end" className="fill-muted-foreground text-[10px]">
            {t("trajectoryEnd")}
          </text>

          {/* The trajectory itself — one 2px segment per consecutive pair,
              each stroked with its own interpolated color, so the gradient
              follows the actual winding path instead of a straight-line
              approximation across the bounding box. */}
          {points.slice(1).map((p, i) => {
            const prev = points[i];
            const progress = points.length > 1 ? i / (points.length - 1) : 0;
            return (
              <line
                key={i}
                x1={prev.x}
                y1={prev.y}
                x2={p.x}
                y2={p.y}
                stroke={`rgba(${TRAJECTORY_COLOR}, ${opacityForProgress(progress)})`}
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          })}

          {/* Start/end markers — >=8px, filled with the series color, with a
              surface-color ring so they stay legible where the path crosses
              itself. */}
          <circle cx={first.x} cy={first.y} r={6} fill={`rgba(${TRAJECTORY_COLOR}, 0.15)`} stroke="var(--background)" strokeWidth={2} />
          <circle cx={last.x} cy={last.y} r={6} fill={`rgba(${TRAJECTORY_COLOR}, 0.95)`} stroke="var(--background)" strokeWidth={2} />

          {hovered && (
            <circle
              cx={hovered.x}
              cy={hovered.y}
              r={5}
              fill="var(--background)"
              stroke="var(--foreground)"
              strokeWidth={2}
            />
          )}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-card px-2 py-1 text-xs whitespace-nowrap text-foreground shadow-md"
            style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: `${(hovered.y / HEIGHT) * 100}%`, marginTop: -8 }}
          >
            <div className="font-medium">{formatTimestamp(hovered.timestamp_sec)}</div>
            <div className="text-muted-foreground">
              valence {hovered.valence.toFixed(2)} · arousal {hovered.arousal.toFixed(2)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
