import type { ChordEvent, Segment } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";
import { SEGMENT_COLOR, SEGMENT_NAME } from "@/lib/dimension-colors";

const MAIN_CHORDS_SHOWN = 8;

// Ranked by how often each chord actually occurs, not first appearance —
// "main chords" means the harmonic center of gravity, and a chord that
// shows up once early shouldn't outrank one that recurs throughout the
// song. Ties keep insertion (first-occurrence) order, since Array.sort is
// stable and the counts were built in chord-event order.
function topChords(chords: ChordEvent[], limit: number): { chord: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of chords) counts.set(c.chord, (counts.get(c.chord) ?? 0) + 1);
  return Array.from(counts, ([chord, count]) => ({ chord, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// First-occurrence order, deduped — the legend names each segment type
// present once, not once per repeat (a song with 3 verses shows "Verse"
// one time, not three).
function segmentTypesPresent(structure: Segment[]): string[] {
  return Array.from(new Set(structure.map((s) => s.label)));
}

// Overview's card is a summary, not the detail view: the full structure
// breakdown with per-segment names/times, plus the complete chord timeline,
// live in StructureAnalysis on the Structure tab. This just counts and ranks.
export async function StructureSection({
  structure,
  chords = [],
  tonicChord,
}: {
  structure: Segment[];
  chords?: ChordEvent[];
  tonicChord?: string;
}) {
  const t = await getTranslations("Result");
  const types = segmentTypesPresent(structure);
  const ranked = topChords(chords, MAIN_CHORDS_SHOWN);
  const distinctChordCount = new Set(chords.map((c) => c.chord)).size;

  return (
    <div>
      <p className="text-sm font-medium text-foreground">
        {t("structureSegments")} <span className="text-muted-foreground">{t("segmentCount", { count: structure.length })}</span>
      </p>

      <div className="mt-3 flex h-2 overflow-hidden rounded-full">
        {structure.map((seg) => (
          <div
            key={`${seg.start_sec}-${seg.label}`}
            title={`${seg.label} ${formatDuration(seg.start_sec)}–${formatDuration(seg.end_sec)}`}
            className={SEGMENT_COLOR[seg.label] ?? "bg-muted"}
            style={{ flexGrow: seg.end_sec - seg.start_sec, flexBasis: 0 }}
          />
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {types.map((label) => (
          <span key={label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={`size-2 shrink-0 rounded-full ${SEGMENT_COLOR[label] ?? "bg-muted"}`} />
            {SEGMENT_NAME[label] ?? label}
          </span>
        ))}
      </div>

      {ranked.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-medium text-foreground">
            {t("mainChords")}{" "}
            <span className="text-muted-foreground">
              {t("chordCount", { count: chords.length })} · {t("distinctChordCount", { count: distinctChordCount })}
            </span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ranked.map(({ chord }) => (
              <Badge
                key={chord}
                variant="outline"
                className={chord === tonicChord ? "border-primary font-semibold text-primary" : undefined}
              >
                {chord}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
