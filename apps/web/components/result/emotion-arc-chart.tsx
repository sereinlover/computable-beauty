"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useTranslations } from "next-intl";
import type { EmotionPoint } from "@contracts/types";

function formatTimestamp(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = Math.round(sec % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function EmotionArcChart({ data }: { data: EmotionPoint[] }) {
  const t = useTranslations("Result");
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-muted-foreground">{t("emotionArc")}</p>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="timestamp_sec"
            tickFormatter={formatTimestamp}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <YAxis domain={[0, 1]} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} />
          <Tooltip
            labelFormatter={(value) => formatTimestamp(Number(value))}
            formatter={(value) => (typeof value === "number" ? value.toFixed(2) : String(value))}
          />
          <Legend />
          {/* Fixed orange/blue instead of shadcn's generated --chart-1..5 — that
              palette is a same-family warm gradient, not suited to a two-line
              chart like arousal/valence that needs strong contrast. A deliberate
              deviation made in checkpoint 6. */}
          <Line type="monotone" dataKey="arousal" stroke="#f97316" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="valence" stroke="#3b82f6" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
