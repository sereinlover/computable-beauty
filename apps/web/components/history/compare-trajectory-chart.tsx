"use client";

import { useTranslations } from "next-intl";

import { AESTHETIC_DIMENSION_ORDER } from "@/lib/dimension-colors";
import type { CompareSong } from "@/components/history/compare-types";

const WIDTH = 720;
const HEIGHT = 360;
const MARGIN = { top: 34, right: 24, bottom: 20, left: 24 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

function axisX(index: number): number {
  return MARGIN.left + (index / (AESTHETIC_DIMENSION_ORDER.length - 1)) * PLOT_WIDTH;
}

function valueY(value: number): number {
  return MARGIN.top + (1 - value / 100) * PLOT_HEIGHT;
}

// Between each pair of adjacent axes, a cubic Bezier with both control
// points at the horizontal midpoint gives an eased S-curve transition
// instead of a straight zig-zag line.
function pathFor(song: CompareSong): { d: string; points: { x: number; y: number }[] } {
  const points = AESTHETIC_DIMENSION_ORDER.map((key, i) => ({ x: axisX(i), y: valueY(song.aesthetic[key].score) }));
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const xMid = (prev.x + curr.x) / 2;
    d += ` C ${xMid},${prev.y} ${xMid},${curr.y} ${curr.x},${curr.y}`;
  }
  return { d, points };
}

// hoveredId/onHoverChange are lifted to AestheticCompareModal so hovering a
// legend chip highlights the same song's line here — with up to 20 songs,
// several can plot near-identical scores and fully overlap (colors repeat
// past 10 too — see compare-context.tsx), and hovering the chip is the only
// reliable way to confirm each one is actually there.
export function CompareTrajectoryChart({
  songs,
  hoveredId,
  onHoverChange,
}: {
  songs: CompareSong[];
  hoveredId: string | null;
  onHoverChange: (id: string | null) => void;
}) {
  const tDimension = useTranslations("AestheticDimension");

  const hoveredSong = hoveredId ? songs.find((s) => s.id === hoveredId) : null;
  const hoveredFirstPoint = hoveredSong ? pathFor(hoveredSong).points[0] : null;

  return (
    <div className="relative">
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

        {songs.map((song) => {
          const isHovered = hoveredId === song.id;
          const isDimmed = hoveredId !== null && !isHovered;
          const { d, points } = pathFor(song);
          return (
            <g
              key={song.id}
              opacity={isDimmed ? 0.2 : 1}
              onMouseEnter={() => onHoverChange(song.id)}
              onMouseLeave={() => onHoverChange(null)}
            >
              {/* A wider invisible stroke widens the hover hit target past the
                  thin visible line, per the dataviz skill's interaction rules. */}
              <path d={d} fill="none" stroke="transparent" strokeWidth={16} />
              <path d={d} fill="none" stroke={song.color} strokeWidth={1.25} strokeLinecap="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={isHovered ? 2.5 : 1.75} fill={song.color} />
              ))}
            </g>
          );
        })}
      </svg>

      {hoveredSong && hoveredFirstPoint && (
        // Centered on the chart's own horizontal midpoint, not the hovered
        // line's x position — anchoring at the leftmost axis clipped the
        // card off the left edge for any song hovered there.
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-border bg-card px-2 py-1 text-xs whitespace-nowrap text-foreground shadow-md"
          style={{
            left: "50%",
            top: `${(hoveredFirstPoint.y / HEIGHT) * 100}%`,
            marginTop: -8,
          }}
        >
          <div className="mb-0.5 font-medium" style={{ color: hoveredSong.color }}>
            {hoveredSong.title}
          </div>
          {AESTHETIC_DIMENSION_ORDER.map((key) => (
            <div key={key} className="text-muted-foreground">
              {tDimension(`${key}.fullLabel`)} {Math.round(hoveredSong.aesthetic[key].score)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
