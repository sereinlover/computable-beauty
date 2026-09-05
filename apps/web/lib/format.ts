export function formatDuration(durationSec: number): string {
  const totalSeconds = Math.round(durationSec);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

// The four dimension scores are stored and displayed on a 0~100 scale.
export function formatScore(score0to100: number): string {
  return Math.round(score0to100).toString();
}

export function formatAnalysisDuration(durationSec: number | null): string {
  return durationSec === null ? "—" : durationSec.toFixed(2);
}

// Locale-agnostic on purpose — the actual "N minutes ago" text lives in
// messages/*.json's "RelativeTime" namespace, looked up by the caller (see
// history-item.tsx) via `unit`. Keeps this function pure and independently
// testable, with no i18n dependency of its own.
export type RelativeTimeUnit = "justNow" | "minutes" | "hours" | "yesterday" | "days";

export function relativeTimeParts(iso: string): { unit: RelativeTimeUnit; value: number } {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return { unit: "justNow", value: 0 };
  if (diffMin < 60) return { unit: "minutes", value: diffMin };
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return { unit: "hours", value: diffHour };
  const diffDay = Math.round(diffHour / 24);
  if (diffDay === 1) return { unit: "yesterday", value: 1 };
  return { unit: "days", value: diffDay };
}

// Precise, second-level timestamp shown alongside formatRelativeTime's fuzzy
// label (e.g. "18 hours ago (2026-08-03 21:14:07)") — relative time alone can't
// answer "was this actually today or yesterday".
export function formatExactTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// arousal/tension/release/energy are already 0~1; valence is -1~1, so it needs
// remapping to 0~100 for progress bar width. Text labels always show the raw
// value as-is, only the bar width goes through this.
export function toEmotionPercent(key: string, value: number): number {
  if (key === "valence") return ((value + 1) / 2) * 100;
  return value * 100;
}

// classifiers/chord.py's roots come from madmom's sharp-only vocabulary, but
// features/harmonic.py's key (Essentia) can come back flat-spelled ("Bb
// major"). Without normalizing, "Bb" would never string-match any chord
// event (all spelled "A#"), silently breaking the tonic highlight for
// every flat-keyed song.
const FLAT_TO_SHARP: Record<string, string> = { Db: "C#", Eb: "D#", Gb: "F#", Ab: "G#", Bb: "A#" };

// "D minor" → "Dm", "Bb major" → "A#" — used to highlight the tonic chord in
// the chord progression, since it's the harmonic "home" the piece keeps
// returning to (matches the emphasis seen in the product mockup).
export function getTonicChord(key: string): string {
  const match = key.match(/^([A-G][#b]?)\s*(major|minor)$/i);
  if (!match) return "";
  const [, rawRoot, quality] = match;
  const root = FLAT_TO_SHARP[rawRoot] ?? rawRoot;
  return quality.toLowerCase() === "minor" ? `${root}m` : root;
}
