"use client";

import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import type { EmotionPoint } from "@contracts/types";

function formatTimestamp(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.round(sec % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const AROUSAL_COLOR = "#f97316";
const VALENCE_COLOR = "#3b82f6";

// Recharts' label position="insideLeft"/"insideRight" keywords don't
// reliably center a rotated label against a dual-axis chart's real plot
// height. Reading viewBox gives the true vertical center; the x offset
// pushes past the tick numbers into the margin (reserved via
// ComposedChart's margin prop), the conventional axis-title spot.
type YAxisLabelProps = { viewBox: { x: number; y: number; width: number; height: number } };

function arousalAxisLabel({ viewBox }: YAxisLabelProps) {
  const cy = viewBox.y + viewBox.height / 2;
  const x = viewBox.x - 2;
  return (
    <text x={x} y={cy} textAnchor="middle" fill={AROUSAL_COLOR} fontSize={12} transform={`rotate(-90, ${x}, ${cy})`}>
      arousal
    </text>
  );
}

function valenceAxisLabel({ viewBox }: YAxisLabelProps) {
  const cy = viewBox.y + viewBox.height / 2;
  const x = viewBox.x + viewBox.width + 2;
  return (
    <text x={x} y={cy} textAnchor="middle" fill={VALENCE_COLOR} fontSize={12} transform={`rotate(-90, ${x}, ${cy})`}>
      valence
    </text>
  );
}

export function EmotionArcChart({ data }: { data: EmotionPoint[] }) {
  const t = useTranslations("Result");
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">{t("emotionArc")}</p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 20, left: 20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="timestamp_sec"
            tickFormatter={formatTimestamp}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          {/* Two independent scales, not one shared axis — arousal (0~1) and
              valence (-1~1) have different semantic ranges, and forcing them
              onto one axis compresses arousal into the top half, muting its
              real variation. A dual axis is normally an anti-pattern (it
              invents alignment between unrelated metrics), but here the two
              series are a genuinely paired measurement at every timestamp —
              legitimate exactly because EmotionHeatmapChart right below
              plots them directly against each other instead of relying on
              this chart's axis alignment to imply a relationship. */}
          <YAxis
            yAxisId="arousal"
            domain={[0, 1]}
            tick={{ fontSize: 12, fill: AROUSAL_COLOR }}
            label={arousalAxisLabel}
          />
          <YAxis
            yAxisId="valence"
            orientation="right"
            domain={[-1, 1]}
            tick={{ fontSize: 12, fill: VALENCE_COLOR }}
            label={valenceAxisLabel}
          />
          <Tooltip
            labelFormatter={(value) => formatTimestamp(Number(value))}
            formatter={(value) => (typeof value === "number" ? value.toFixed(2) : String(value))}
          />
          <Legend />
          <Area
            yAxisId="arousal"
            type="monotone"
            dataKey="arousal"
            stroke={AROUSAL_COLOR}
            strokeWidth={2}
            fill={AROUSAL_COLOR}
            fillOpacity={0.1}
            dot={false}
          />
          <Line yAxisId="valence" type="monotone" dataKey="valence" stroke={VALENCE_COLOR} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
