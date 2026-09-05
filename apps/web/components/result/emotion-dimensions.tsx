import type { UnderstandingBundle } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Progress } from "@/components/ui/progress";
import { EMOTION_DIMENSION_GRID_ORDER, METRIC_BAR_COLOR, METRIC_TEXT_COLOR } from "@/lib/dimension-colors";
import { toEmotionPercent } from "@/lib/format";

// valence is -1~1, the only dimension that crosses zero — a regular 0-100%
// bar would make -0.19 look like a small positive value instead of a small
// negative one. This renders it as a diverging bar instead: a fixed center
// tick at 0, filled leftward in blue for negative, rightward in green for
// positive, so the sign is visible in the shape, not just the number.
function ValenceBar({ value }: { value: number }) {
  const half = Math.min(Math.abs(value), 1) * 50;
  return (
    <div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
        {value < 0 ? (
          <div className="absolute inset-y-0 rounded-full bg-sky-500" style={{ right: "50%", width: `${half}%` }} />
        ) : (
          <div className="absolute inset-y-0 rounded-full bg-emerald-500" style={{ left: "50%", width: `${half}%` }} />
        )}
      </div>
      <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground">
        <span>−1</span>
        <span>0</span>
        <span>+1</span>
      </div>
    </div>
  );
}

export async function EmotionDimensions({ understanding }: { understanding: UnderstandingBundle }) {
  const t = await getTranslations("Result");

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-foreground">{t("emotionDimensions")}</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {EMOTION_DIMENSION_GRID_ORDER.map((key) => {
          const value = understanding[key];
          return (
            <div key={key} className={key === "energy" ? "col-span-2" : undefined}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">{key}</span>
                <span
                  className={`text-lg font-semibold tabular-nums ${
                    key === "valence" ? (value < 0 ? "text-sky-500" : "text-emerald-500") : METRIC_TEXT_COLOR[key]
                  }`}
                >
                  {value.toFixed(2)}
                </span>
              </div>
              {key === "valence" ? (
                <ValenceBar value={value} />
              ) : (
                <Progress value={toEmotionPercent(key, value)} className={`h-2 ${METRIC_BAR_COLOR[key]}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
