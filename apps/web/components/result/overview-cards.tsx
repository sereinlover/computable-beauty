import type { FeatureSummary, UnderstandingBundle } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TAG_GROUP_COLOR } from "@/lib/dimension-colors";

function ScalarCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <Card>
      <CardContent>
        <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
        <p className="text-sm text-foreground">
          {value}
          {unit && <span className="ml-1 text-muted-foreground">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

function TagCard({ label, items, group }: { label: string; items: string[]; group: keyof typeof TAG_GROUP_COLOR }) {
  return (
    <Card className="h-full">
      <CardContent>
        <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <Badge key={item} variant="outline" className={TAG_GROUP_COLOR[group]}>
              {item}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// 2 rows of 3: key/time signature/BPM (the order these appear in a score,
// left to right), then instruments/genre/emotion — artist/duration are shown
// by TitleRow instead (see title-row.tsx), so keeping them here too would be
// pure duplication. Two separate grids (not one shared 6-col grid) so each
// row's card height fits its own content — sharing one grid stretched every
// cell to the row's tallest cell, making the plain scalar cards (key/time
// signature/BPM) awkwardly tall to match the tag cards.
export async function OverviewCards({
  featureSummary,
  understanding,
}: {
  featureSummary: FeatureSummary;
  understanding: UnderstandingBundle;
}) {
  const t = await getTranslations("Result");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <ScalarCard label={t("key")} value={featureSummary.key} />
        <ScalarCard label={t("beat")} value={understanding.time_signature} />
        <ScalarCard label="BPM" value={Math.round(featureSummary.bpm).toString()} unit="bpm" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <TagCard
          label={t("instruments")}
          items={understanding.instruments.map((instrument) => instrument.name)}
          group="instrument"
        />
        <TagCard label={t("genre")} items={understanding.genre_top3.map((genre) => genre.label)} group="genre" />
        <TagCard label={t("mood")} items={understanding.emotion_labels} group="emotion" />
      </div>
    </div>
  );
}
