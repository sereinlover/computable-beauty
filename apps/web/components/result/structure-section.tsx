import type { ChordEvent, Segment } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";
import { SEGMENT_ABBR, SEGMENT_COLOR, SEGMENT_NAME } from "@/lib/dimension-colors";

// "verse"/"chorus" repeat across a song — number repeated labels (v1, v2 / Verse 1, Verse 2)
// so adjacent identical-colored blocks are still distinguishable.
function withOccurrenceLabel(structure: Segment[], nameFor: (label: string) => string, sep: string): string[] {
  const totalByLabel: Record<string, number> = {};
  for (const seg of structure) totalByLabel[seg.label] = (totalByLabel[seg.label] ?? 0) + 1;

  const seenByLabel: Record<string, number> = {};
  return structure.map((seg) => {
    const name = nameFor(seg.label);
    if ((totalByLabel[seg.label] ?? 0) <= 1) return name;
    seenByLabel[seg.label] = (seenByLabel[seg.label] ?? 0) + 1;
    return `${name}${sep}${seenByLabel[seg.label]}`;
  });
}

const segmentAbbrLabels = (structure: Segment[]) =>
  withOccurrenceLabel(structure, (label) => SEGMENT_ABBR[label] ?? label.slice(0, 2), "");

const segmentFullLabels = (structure: Segment[]) =>
  withOccurrenceLabel(structure, (label) => SEGMENT_NAME[label] ?? label, " ");

export async function StructureSection({
  structure,
  chords = [],
  durationSec,
  tonicChord,
  variant = "mini",
}: {
  structure: Segment[];
  // Only rendered in the "mini" variant's chord-progression footer below — the
  // "full" variant (structure tab) shows chords via the separate ChordList
  // component instead, so callers there don't need to pass this.
  chords?: ChordEvent[];
  durationSec: number;
  tonicChord?: string;
  variant?: "mini" | "full";
}) {
  const abbrLabels = segmentAbbrLabels(structure);
  const fullLabels = variant === "full" ? segmentFullLabels(structure) : [];
  const t = await getTranslations("Result");

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">
        {t("structureSegments")} <span className="text-muted-foreground">{t("segmentCount", { count: structure.length })}</span>
      </p>

      <div className="flex overflow-hidden rounded-md">
        {structure.map((seg, i) => (
          <div
            key={`${seg.start_sec}-${seg.label}`}
            title={`${seg.label} ${formatDuration(seg.start_sec)}–${formatDuration(seg.end_sec)}`}
            className={`flex h-7 items-center justify-center text-[10px] font-medium text-foreground/80 ${
              SEGMENT_COLOR[seg.label] ?? "bg-muted"
            }`}
            style={{ flexGrow: seg.end_sec - seg.start_sec, flexBasis: 0 }}
          >
            {abbrLabels[i]}
          </div>
        ))}
      </div>

      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        <span>0:00</span>
        <span>{formatDuration(durationSec)}</span>
      </div>

      {variant === "full" ? (
        <ul className="mt-4 divide-y divide-border">
          {structure.map((seg, i) => (
            <li key={`${seg.start_sec}-${seg.label}-full`} className="flex items-center justify-between py-2 text-sm">
              <span className="flex items-center gap-2 text-foreground">
                <span className={`size-2.5 shrink-0 rounded-full ${SEGMENT_COLOR[seg.label] ?? "bg-muted"}`} />
                {fullLabels[i]}
              </span>
              <span className="text-muted-foreground">
                {formatDuration(seg.start_sec)} – {formatDuration(seg.end_sec)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-6">
          <p className="mb-2 text-sm font-medium text-foreground">{t("chordProgression")}</p>
          <div className="flex flex-wrap gap-1.5">
            {chords.map((chord, i) => {
              const isTonic = chord.chord === tonicChord;
              return (
                <Badge
                  key={`${chord.start_sec}-${i}`}
                  variant="outline"
                  className={isTonic ? "border-primary font-semibold text-primary" : undefined}
                >
                  {chord.chord}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
