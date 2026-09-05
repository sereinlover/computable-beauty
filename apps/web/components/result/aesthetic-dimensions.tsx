import type { AestheticBundle } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Progress } from "@/components/ui/progress";
import { formatScore } from "@/lib/format";
import {
  AESTHETIC_DIMENSION_BAR,
  AESTHETIC_DIMENSION_FILL,
  AESTHETIC_DIMENSION_ORDER,
  AESTHETIC_DIMENSION_TEXT,
} from "@/lib/dimension-colors";

const RADAR_SIZE = 140;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_RADIUS = 44;

// AESTHETIC_DIMENSION_ORDER's order (physical_precision, structural_logic,
// emotional_depth, vital_tension) lands exactly on top/right/bottom/left —
// same convention as the "Four-Dimension Radar" tab chart, just without value
// labels here (the bars on the right already show exact numbers; this mini
// radar's job is the overall "shape," not precision).
function radarPoint(index: number, fraction: number) {
  const angle = ((-90 + index * 90) * Math.PI) / 180;
  const r = RADAR_RADIUS * fraction;
  return { x: RADAR_CENTER + r * Math.cos(angle), y: RADAR_CENTER + r * Math.sin(angle) };
}

function radarLabelPoint(index: number) {
  const angle = ((-90 + index * 90) * Math.PI) / 180;
  const r = RADAR_RADIUS + 16;
  return { x: RADAR_CENTER + r * Math.cos(angle), y: RADAR_CENTER + r * Math.sin(angle) };
}

export async function AestheticDimensions({ aesthetic }: { aesthetic: AestheticBundle }) {
  const t = await getTranslations("Result");
  const tDimension = await getTranslations("AestheticDimension");

  const vertices = AESTHETIC_DIMENSION_ORDER.map((key, i) => ({
    key,
    ...radarPoint(i, aesthetic[key].score / 100),
  }));
  const polygon = vertices.map((v) => `${v.x},${v.y}`).join(" ");

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-foreground">{t("aestheticDimensions")}</p>
      <div className="grid grid-cols-2 items-center gap-3">
        <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="w-full">
          {[0.5, 1].map((fraction) => (
            <polygon
              key={fraction}
              points={AESTHETIC_DIMENSION_ORDER.map((_, i) => {
                const p = radarPoint(i, fraction);
                return `${p.x},${p.y}`;
              }).join(" ")}
              fill="none"
              stroke="var(--border)"
              strokeWidth={1}
            />
          ))}
          <polygon points={polygon} fill="#7c3aed" fillOpacity={0.15} stroke="#7c3aed" strokeWidth={2} />
          {vertices.map((v) => (
            <circle key={v.key} cx={v.x} cy={v.y} r={4} className={AESTHETIC_DIMENSION_FILL[v.key]} stroke="var(--background)" strokeWidth={1.5} />
          ))}
          {AESTHETIC_DIMENSION_ORDER.map((key, i) => {
            const p = radarLabelPoint(i);
            return (
              <text key={key} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[11px]">
                {tDimension(`${key}.label`)}
              </text>
            );
          })}
        </svg>

        <div className="space-y-2.5">
          {AESTHETIC_DIMENSION_ORDER.map((key) => {
            const score = aesthetic[key].score;
            return (
              <div key={key}>
                <div className="mb-1 flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">{tDimension(`${key}.label`)}</span>
                  <span className={`text-sm font-semibold tabular-nums ${AESTHETIC_DIMENSION_TEXT[key]}`}>
                    {formatScore(score)}
                    {t("scoreUnit")}
                  </span>
                </div>
                <Progress value={score} className={`h-2 ${AESTHETIC_DIMENSION_BAR[key]}`} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
