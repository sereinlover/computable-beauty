import type { AestheticBundle } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Progress } from "@/components/ui/progress";
import { formatScore } from "@/lib/format";
import { AESTHETIC_DIMENSION_BAR, AESTHETIC_DIMENSION_ORDER, EVIDENCE_FIELD_ORDER } from "@/lib/dimension-colors";

export async function AestheticDetail({ aesthetic }: { aesthetic: AestheticBundle }) {
  const t = await getTranslations("Result");
  const tDimension = await getTranslations("AestheticDimension");
  const tEvidence = await getTranslations("EvidenceLabel");
  const tUnit = await getTranslations("EvidenceUnit");

  return (
    <div className="space-y-8">
      {AESTHETIC_DIMENSION_ORDER.map((key) => {
        const dimension = aesthetic[key];

        return (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-base font-medium text-foreground">{tDimension(`${key}.fullLabel`)}</p>
              <p className="text-lg font-bold text-foreground">
                {formatScore(dimension.score)}
                {t("scoreUnit")}
              </p>
            </div>
            <p className="mb-2 text-sm text-muted-foreground">{tDimension(`${key}.description`)}</p>
            <div className="mb-3 space-y-1 font-mono text-[11px] text-muted-foreground">
              <p>{tDimension(`${key}.formula`)}</p>
              {tDimension(`${key}.breakdown`)
                .split("\n")
                .map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
            </div>
            <Progress value={dimension.score} className={`h-2 ${AESTHETIC_DIMENSION_BAR[key]}`} />
            <table className="mt-3 w-full text-sm">
              <tbody className="divide-y divide-border">
                {Object.entries(dimension.evidence)
                  .sort(([a], [b]) => EVIDENCE_FIELD_ORDER[key].indexOf(a) - EVIDENCE_FIELD_ORDER[key].indexOf(b))
                  .map(([field, value]) => (
                    <tr key={field}>
                      <td className="py-1.5 pr-4 text-muted-foreground">{tEvidence.has(field) ? tEvidence(field) : field}</td>
                      <td className="py-1.5 text-right font-medium text-foreground tabular-nums">
                        {value}
                        {tUnit.has(field) ? ` (${tUnit(field)})` : ""}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
