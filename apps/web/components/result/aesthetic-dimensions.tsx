import type { AestheticBundle } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Progress } from "@/components/ui/progress";
import { formatScore } from "@/lib/format";
import { AESTHETIC_DIMENSION_BAR, AESTHETIC_DIMENSION_ORDER } from "@/lib/dimension-colors";

export async function AestheticDimensions({ aesthetic }: { aesthetic: AestheticBundle }) {
  const t = await getTranslations("Result");
  const tDimension = await getTranslations("AestheticDimension");

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{t("aestheticDimensions")}</p>
        <p className="text-sm text-muted-foreground">
          {t("aestheticIndex")} <span className="font-semibold text-primary">{formatScore(aesthetic.aesthetic_index)}</span>
        </p>
      </div>
      <div className="space-y-2.5">
        {AESTHETIC_DIMENSION_ORDER.map((key) => {
          const score = aesthetic[key].score;
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-10 shrink-0 text-sm text-muted-foreground">{tDimension(`${key}.label`)}</span>
              <Progress value={score} className={`h-2 ${AESTHETIC_DIMENSION_BAR[key]}`} />
              <span className="w-10 shrink-0 text-right text-sm text-foreground tabular-nums">
                {formatScore(score)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
