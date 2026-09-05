import type { UnderstandingBundle } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Progress } from "@/components/ui/progress";
import { toEmotionPercent } from "@/lib/format";
import { EMOTION_DIMENSION_ORDER, METRIC_BAR_COLOR } from "@/lib/dimension-colors";

export async function EmotionDetail({ understanding }: { understanding: UnderstandingBundle }) {
  const t = await getTranslations("Result");
  const tDimension = await getTranslations("EmotionDimension");

  return (
    <div className="space-y-6">
      {EMOTION_DIMENSION_ORDER.map((key) => {
        const value = understanding[key];

        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-base font-medium text-foreground">{tDimension(`${key}.label`)}</p>
              <p className="text-lg font-bold text-foreground">{value.toFixed(2)}</p>
            </div>
            <p className="mb-2 text-sm text-muted-foreground">{tDimension(`${key}.description`)}</p>
            <Progress value={toEmotionPercent(key, value)} className={`h-2 ${METRIC_BAR_COLOR[key]}`} />
            <div className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
              <p>
                <span className="font-medium">{t("computationMethod")}</span>
                {tDimension(`${key}.computation`)}
              </p>
              {tDimension(`${key}.formula`)
                .split("\n")
                .map((line, i) => (
                  <p key={i}>
                    {line}
                    <span className="font-medium">{t("valueRange")}</span>
                    {tDimension(`${key}.range`)}
                  </p>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
