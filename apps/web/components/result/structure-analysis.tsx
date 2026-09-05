"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ChordEvent, Segment } from "@contracts/types";

import { formatDuration } from "@/lib/format";
import { SEGMENT_COLOR, SEGMENT_NAME } from "@/lib/dimension-colors";

const MAIN_CHORDS_SHOWN = 8;

// "verse"/"chorus" repeat across a song — number repeated labels (Verse 1,
// Verse 2) so identically-colored rows/cards are still distinguishable.
function segmentFullLabels(structure: Segment[]): string[] {
  const totalByLabel: Record<string, number> = {};
  for (const seg of structure) totalByLabel[seg.label] = (totalByLabel[seg.label] ?? 0) + 1;

  const seenByLabel: Record<string, number> = {};
  return structure.map((seg) => {
    const name = SEGMENT_NAME[seg.label] ?? seg.label;
    if ((totalByLabel[seg.label] ?? 0) <= 1) return name;
    seenByLabel[seg.label] = (seenByLabel[seg.label] ?? 0) + 1;
    return `${name} ${seenByLabel[seg.label]}`;
  });
}

// Ranked by how often each chord occurs across the whole track — the
// harmonic center of gravity, not first appearance.
function chordFrequency(chords: ChordEvent[], limit: number): { chord: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of chords) counts.set(c.chord, (counts.get(c.chord) ?? 0) + 1);
  return Array.from(counts, ([chord, count]) => ({ chord, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

// A chord belongs to the segment its onset falls inside — start_sec is
// exact, no overlap resolution needed since segments partition the timeline.
function chordsInSegment(chords: ChordEvent[], seg: Segment): ChordEvent[] {
  return chords.filter((c) => c.start_sec >= seg.start_sec && c.start_sec < seg.end_sec);
}

export function StructureAnalysis({
  structure,
  chords,
  tonicChord,
}: {
  structure: Segment[];
  chords: ChordEvent[];
  tonicChord?: string;
}) {
  const t = useTranslations("Result");
  const [selected, setSelected] = useState<number | null>(null);

  const fullLabels = segmentFullLabels(structure);
  const topChords = chordFrequency(chords, MAIN_CHORDS_SHOWN);
  const maxCount = topChords.length > 0 ? topChords[0].count : 1;
  const distinctChordCount = new Set(chords.map((c) => c.chord)).size;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      <div>
        <p className="mb-3 text-sm font-medium text-foreground">
          {t("structureSegments")} <span className="text-muted-foreground">{t("segmentCount", { count: structure.length })}</span>
        </p>

        <div className="flex h-3 gap-px">
          {structure.map((seg, i) => (
            <button
              key={`${seg.start_sec}-${seg.label}`}
              type="button"
              title={`${fullLabels[i]} ${formatDuration(seg.start_sec)}–${formatDuration(seg.end_sec)}`}
              onClick={() => setSelected(selected === i ? null : i)}
              className={`${SEGMENT_COLOR[seg.label] ?? "bg-muted"} ${
                selected === i ? "ring-2 ring-inset ring-foreground" : ""
              }`}
              style={{ flexGrow: seg.end_sec - seg.start_sec, flexBasis: 0 }}
            />
          ))}
        </div>

        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {structure.map((seg, i) => (
            <li key={`${seg.start_sec}-${seg.label}-row`}>
              <button
                type="button"
                onClick={() => setSelected(selected === i ? null : i)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                  selected === i ? "bg-primary/10" : ""
                }`}
              >
                <span className="flex items-center gap-2 text-foreground">
                  <span className={`size-2.5 shrink-0 rounded-full ${SEGMENT_COLOR[seg.label] ?? "bg-muted"}`} />
                  {fullLabels[i]}
                </span>
                <span className="flex shrink-0 items-center gap-3 text-muted-foreground">
                  <span>
                    {formatDuration(seg.start_sec)} – {formatDuration(seg.end_sec)}
                  </span>
                  <span className="tabular-nums">{Math.round(seg.end_sec - seg.start_sec)}s</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-foreground">
          {t("chordProgression")}{" "}
          <span className="text-muted-foreground">
            {t("chordCount", { count: chords.length })} · {t("distinctChordCount", { count: distinctChordCount })}
          </span>
        </p>

        <div className="mb-4 rounded-md border border-border bg-muted/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">{t("mainChordsByFrequency")}</p>
            <span className="flex items-center gap-1.5 text-xs text-primary">
              <span className="size-2 shrink-0 rounded-full bg-primary" />
              {t("tonicChordLegend")}
            </span>
          </div>
          <div className="space-y-1.5">
            {topChords.map(({ chord, count }) => {
              const isTonic = chord === tonicChord;
              return (
                <div key={chord} className="flex items-center gap-2 text-xs">
                  <span className={`w-10 shrink-0 font-medium ${isTonic ? "text-primary" : "text-foreground"}`}>{chord}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                    <div
                      className={`h-full rounded-full ${isTonic ? "bg-primary" : "bg-primary/25"}`}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {structure.map((seg, i) => {
            const segChords = chordsInSegment(chords, seg);
            return (
              <button
                key={`${seg.start_sec}-${seg.label}-card`}
                type="button"
                onClick={() => setSelected(selected === i ? null : i)}
                className={`w-full rounded-md border p-3 text-left ${selected === i ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 font-medium text-foreground">
                    <span className={`size-2 shrink-0 rounded-full ${SEGMENT_COLOR[seg.label] ?? "bg-muted"}`} />
                    {fullLabels[i]}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDuration(seg.start_sec)}–{formatDuration(seg.end_sec)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {segChords.map((c, j) => {
                    const isTonic = c.chord === tonicChord;
                    return (
                      <span
                        key={`${c.start_sec}-${j}`}
                        className={`rounded-md border px-2 py-0.5 text-xs font-medium ${
                          isTonic ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground"
                        }`}
                      >
                        {c.chord}
                      </span>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
