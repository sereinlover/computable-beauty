// One fixed color per tag group card (TagCard, in OverviewCards) — all badges
// within the same card share one color, since the card's title already tells
// you the category.
export const TAG_GROUP_COLOR: Record<"genre" | "emotion" | "instrument", string> = {
  genre: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300",
  emotion: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  instrument: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
};

// Targets the Progress indicator child (`data-slot="progress-indicator"`) so the
// shadcn ui/progress.tsx file itself stays untouched/regenerable.
export const METRIC_BAR_COLOR: Record<string, string> = {
  arousal: "[&>[data-slot=progress-indicator]]:bg-orange-500",
  valence: "[&>[data-slot=progress-indicator]]:bg-sky-500",
  tension: "[&>[data-slot=progress-indicator]]:bg-violet-500",
  release: "[&>[data-slot=progress-indicator]]:bg-emerald-500",
  energy: "[&>[data-slot=progress-indicator]]:bg-amber-500",
};

// Order + per-dimension progress-bar color for the four aesthetic dimensions.
// The label/fullLabel/description copy itself lives in messages/*.json under
// the "AestheticDimension" namespace (see i18n/request.ts) — shared by the
// landing page's dimension cards and the result page's AestheticDetail tab,
// looked up by the same key as this map.
export const AESTHETIC_DIMENSION_ORDER = [
  "physical_precision",
  "structural_logic",
  "emotional_depth",
  "vital_tension",
] as const;

export const AESTHETIC_DIMENSION_BAR: Record<string, string> = {
  physical_precision: "[&>[data-slot=progress-indicator]]:bg-orange-500",
  structural_logic: "[&>[data-slot=progress-indicator]]:bg-sky-500",
  emotional_depth: "[&>[data-slot=progress-indicator]]:bg-violet-500",
  vital_tension: "[&>[data-slot=progress-indicator]]:bg-emerald-500",
};

// Same four hues as AESTHETIC_DIMENSION_BAR above, as text/fill utilities —
// used by OverviewCards' mini radar (vertex dots) and its score numbers, so
// a dimension's color means the same thing whether it's a bar, a dot, or a number.
export const AESTHETIC_DIMENSION_TEXT: Record<string, string> = {
  physical_precision: "text-orange-500",
  structural_logic: "text-sky-500",
  emotional_depth: "text-violet-500",
  vital_tension: "text-emerald-500",
};

export const AESTHETIC_DIMENSION_FILL: Record<string, string> = {
  physical_precision: "fill-orange-500",
  structural_logic: "fill-sky-500",
  emotional_depth: "fill-violet-500",
  vital_tension: "fill-emerald-500",
};

// The order evidence rows render in per dimension, matching each Scorer's
// WEIGHTS dict order in apps/engine/scoring/*.py — not the order they
// arrive over the wire. AestheticBundle.evidence is a Go map[string]float64,
// and encoding/json.Marshal sorts map keys alphabetically, so Python's
// original field order is gone by the time it reaches the browser; this is
// the only place it survives.
export const EVIDENCE_FIELD_ORDER: Record<(typeof AESTHETIC_DIMENSION_ORDER)[number], string[]> = {
  physical_precision: ["tempo_stability", "dynamic_range_db", "frequency_balance_std_db"],
  structural_logic: ["tsd_coverage", "segment_balance_ratio", "n_distinct_chords"],
  emotional_depth: ["valence_delta", "arousal_std", "polarity_switches", "polarity_switch_rate"],
  vital_tension: ["dynamic_contrast", "burst_density"],
};

// Order for the five emotion dimensions. Label/description/computation copy
// lives in messages/*.json under the "EmotionDimension" namespace, looked up
// by the same key as METRIC_BAR_COLOR above.
export const EMOTION_DIMENSION_ORDER = ["arousal", "valence", "tension", "release", "energy"] as const;

// OverviewCards' 2-column mini grid pairs (arousal, tension) and (valence,
// release) — the direct model outputs in one column, the dissonance-derived
// pair in the other — with energy alone on its own full-width row. Same text
// color as METRIC_BAR_COLOR's bars; valence has no fixed color here since its
// diverging bar switches blue/green by sign (see EmotionDimensions).
export const EMOTION_DIMENSION_GRID_ORDER = ["arousal", "tension", "valence", "release", "energy"] as const;

export const METRIC_TEXT_COLOR: Record<string, string> = {
  arousal: "text-orange-500",
  tension: "text-violet-500",
  release: "text-emerald-500",
  energy: "text-amber-500",
};

export const SEGMENT_COLOR: Record<string, string> = {
  intro: "bg-slate-300 dark:bg-slate-600",
  verse: "bg-sky-300 dark:bg-sky-700",
  chorus: "bg-violet-300 dark:bg-violet-700",
  bridge: "bg-amber-300 dark:bg-amber-700",
  outro: "bg-rose-300 dark:bg-rose-700",
};

export const SEGMENT_NAME: Record<string, string> = {
  intro: "Intro",
  verse: "Verse",
  chorus: "Chorus",
  bridge: "Bridge",
  outro: "Outro",
};
