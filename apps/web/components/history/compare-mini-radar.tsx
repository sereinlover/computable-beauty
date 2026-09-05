"use client";

import { memo } from "react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslations } from "next-intl";

import { AESTHETIC_DIMENSION_ORDER } from "@/lib/dimension-colors";
import type { CompareSong } from "@/components/history/compare-types";

// One small radar per song (small-multiples) instead of overlaying all
// songs on one radar — a shared radar with >2 overlapping fills is
// unreadable past a couple of songs; small multiples scale to 20.
//
// Memoized: AestheticCompareModal's legend-chip hover re-renders the whole
// modal, and Recharts' ResponsiveContainer visibly flickers on every
// re-render even with unchanged data — `song` stays referentially stable
// across a hover change, so memo skips the pointless re-render.
export const CompareMiniRadar = memo(function CompareMiniRadar({ song }: { song: CompareSong }) {
  const tDimension = useTranslations("AestheticDimension");

  const data = AESTHETIC_DIMENSION_ORDER.map((key) => ({
    dimension: tDimension(`${key}.label`),
    value: song.aesthetic[key].score,
  }));

  return (
    <div className="flex flex-col items-center gap-1">
      <ResponsiveContainer width="100%" height={160}>
        <RadarChart data={data} outerRadius="65%">
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="value"
            stroke={song.color}
            strokeWidth={2}
            fill={song.color}
            fillOpacity={0.15}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: song.color, stroke: "var(--background)", strokeWidth: 2 }}
          />
          <Tooltip
            content={({ active, payload }) =>
              active && payload && payload.length > 0 ? (
                <div className="rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-foreground shadow-md">
                  {Math.round(Number(payload[0].value))}
                </div>
              ) : null
            }
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="max-w-full truncate text-sm font-medium" style={{ color: song.color }} title={song.title}>
        {song.title}
      </p>
    </div>
  );
});
