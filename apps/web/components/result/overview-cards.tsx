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

// One row per entry (rank badge · name · confidence) instead of TagCard's
// wrapped chips — a "1. name · 0.87" chip is too wide to wrap cleanly here,
// so a plain list makes the one-entry-per-line layout intentional.
//
// Confidence shows the raw 0~1 score, not a percentage — these are
// independent sigmoid outputs or non-summing softmax shares, not a
// distribution that adds to 1, so "%" would misleadingly imply otherwise.
function RankedTagCard({
  label,
  entries,
  group,
}: {
  label: string;
  entries: { name: string; confidence: number }[];
  group: keyof typeof TAG_GROUP_COLOR;
}) {
  return (
    <Card className="h-full">
      <CardContent>
        <p className="mb-2 text-sm font-medium text-foreground">{label}</p>
        <ul className="space-y-1.5">
          {entries.map((entry, i) => (
            <li key={entry.name} className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className={`${TAG_GROUP_COLOR[group]} shrink-0`}>
                {i + 1}
              </Badge>
              <span className="truncate text-foreground">{entry.name}</span>
              <span className="ml-auto shrink-0 text-muted-foreground">{entry.confidence.toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// 2 rows of 3: key/time/BPM (score order, left to right), then
// instruments/genre/emotion — artist/duration live in TitleRow instead, so
// repeating them here would be pure duplication.
//
// Two separate grids, not one shared 6-col grid, so each row's card height
// fits its own content — a shared grid stretched every cell to the row's
// tallest, making the scalar cards awkwardly tall to match the tag cards.
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
        <ScalarCard label={t("beat")} value={understanding.signature} />
        <ScalarCard label="BPM" value={Math.round(featureSummary.bpm).toString()} unit="bpm" />
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <RankedTagCard
          label={t("instruments")}
          entries={understanding.instruments.map((instrument) => ({
            name: instrument.name,
            confidence: instrument.confidence,
          }))}
          group="instrument"
        />
        <RankedTagCard
          label={t("genre")}
          entries={understanding.genre_top3.map((genre) => ({ name: genre.label, confidence: genre.confidence }))}
          group="genre"
        />
        <TagCard label={t("mood")} items={understanding.emotion_labels} group="emotion" />
      </div>
    </div>
  );
}
