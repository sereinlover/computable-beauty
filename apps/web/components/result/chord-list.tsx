import type { ChordEvent } from "@contracts/types";
import { getTranslations } from "next-intl/server";

import { formatDuration } from "@/lib/format";

export async function ChordList({ chords, tonicChord }: { chords: ChordEvent[]; tonicChord?: string }) {
  const t = await getTranslations("Result");

  return (
    <div>
      <p className="mb-2 text-sm font-medium text-foreground">{t("chordProgression")}</p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {chords.map((chord, i) => {
          const isTonic = chord.chord === tonicChord;
          return (
            <li
              key={`${chord.start_sec}-${i}`}
              className={`flex items-center justify-between px-3 py-2 text-sm ${isTonic ? "bg-primary/5" : ""}`}
            >
              <span className={isTonic ? "font-semibold text-primary" : "font-medium text-foreground"}>
                {chord.chord}
              </span>
              <span className="text-muted-foreground">
                {formatDuration(chord.start_sec)} – {formatDuration(chord.end_sec)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
