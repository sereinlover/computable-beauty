import type { UnderstandingBundle } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Progress } from "@/components/ui/progress";
import { EMOTION_DIMENSION_ORDER, METRIC_BAR_COLOR } from "@/lib/dimension-colors";
import { toEmotionPercent } from "@/lib/format";

export async function EmotionDimensions({ understanding }: { understanding: UnderstandingBundle }) {
  const t = await getTranslations("Result");

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-foreground">{t("emotionDimensions")}</p>
      <div className="space-y-2.5">
        {EMOTION_DIMENSION_ORDER.map((key) => {
          const value = understanding[key];
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-sm text-muted-foreground">{key}</span>
              <Progress value={toEmotionPercent(key, value)} className={`h-2 ${METRIC_BAR_COLOR[key]}`} />
              <span className="w-10 shrink-0 text-right text-sm text-foreground tabular-nums">
                {value.toFixed(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
