"use client";

import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslations } from "next-intl";
import type { AestheticBundle } from "@contracts/types";

import { AESTHETIC_DIMENSION_ORDER } from "@/lib/dimension-colors";

// Own order, deliberately not AESTHETIC_DIMENSION_ORDER (which drives
// AestheticDetail/AestheticDimensions elsewhere) — this chart's clockwise
// layout is physical/emotional/structural/vital, alternating "precision"
// and "expressive" dimensions around the circle instead of grouping them.
const RADAR_ORDER: (typeof AESTHETIC_DIMENSION_ORDER)[number][] = [
  "physical_precision",
  "emotional_depth",
  "structural_logic",
  "vital_tension",
];

// Same violet as EmotionHeatmapChart's dwell-time wash — the "aesthetic"
// section's own hue, distinct from the arousal/valence and per-song
// categorical palettes used elsewhere on this page.
const RADAR_COLOR = "#7c3aed";

// RADAR_ORDER lands on Recharts' default clockwise layout (top/right/bottom/
// left), so offset direction is driven by index alone, no angle math. Offsets
// point *toward* center, not outward — outward collides with the axis's
// category label at the perimeter once a score pushes the vertex out far
// enough (verified with vital_tension=90).
const LABEL_OFFSET: Record<number, { dx: number; dy: number }> = {
  0: { dx: 0, dy: 16 },
  1: { dx: -22, dy: 4 },
  2: { dx: 0, dy: -10 },
  3: { dx: 22, dy: 4 },
};

type RadarDotProps = { cx?: number; cy?: number; value?: number; index?: number };

function RadarValueDot(props: RadarDotProps) {
  const { cx, cy, value, index } = props;
  if (cx === undefined || cy === undefined || value === undefined || index === undefined) return null;
  const offset = LABEL_OFFSET[index] ?? { dx: 0, dy: 0 };
  return (
    <g>
      <circle cx={cx} cy={cy} r={4} fill={RADAR_COLOR} stroke="var(--background)" strokeWidth={2} />
      <text x={cx + offset.dx} y={cy + offset.dy} textAnchor="middle" className="fill-foreground text-xs font-semibold">
        {Math.round(value)}
      </text>
    </g>
  );
}

export function AestheticRadarChart({ aesthetic }: { aesthetic: AestheticBundle }) {
  const t = useTranslations("Result");
  const tDimension = useTranslations("AestheticDimension");

  const data = RADAR_ORDER.map((key) => ({
    dimension: tDimension(`${key}.fullLabel`),
    value: aesthetic[key].score,
  }));

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">{t("aestheticRadarTitle")}</p>
      <ResponsiveContainer width="100%" height={300}>
        <RadarChart data={data} outerRadius="65%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <PolarRadiusAxis domain={[0, 100]} tickCount={3} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke={RADAR_COLOR}
            strokeWidth={2}
            fill={RADAR_COLOR}
            fillOpacity={0.15}
            dot={(props: RadarDotProps) => <RadarValueDot key={props.index} {...props} />}
            isAnimationActive={false}
          />
          <Tooltip formatter={(value) => (typeof value === "number" ? value.toFixed(0) : String(value))} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
