// Wire types for Next.js (BFF Route Handlers + React UI).
// Mirrors contracts/types.go — field names must match JSON keys exactly.

// ─── Feature summary ──────────────────────────────────────────────────────────

export interface FeatureSummary {
  bpm: number;
  tempo_stability: number;
  key: string;
  dynamic_range_db: number;
  spectral_entropy: number;
  silence_ratio: number;
  duration_sec: number;
}

// ─── Understanding ────────────────────────────────────────────────────────────

export interface EmotionPoint {
  timestamp_sec: number;
  valence: number; // -1.0 ~ 1.0
  arousal: number; // 0.0 ~ 1.0
}

export interface Segment {
  start_sec: number;
  end_sec: number;
  label: "intro" | "verse" | "chorus" | "bridge" | "outro" | string;
}

export interface ChordEvent {
  start_sec: number;
  end_sec: number;
  chord: string;
}

export interface InstrumentEntry {
  name: string;
  confidence: number;
}

export interface GenreEntry {
  label: string;
  confidence: number;
}

export interface UnderstandingBundle {
  audio_id: string;
  genre: string;
  genre_confidence: number;
  genre_top3: GenreEntry[];
  emotion_labels: string[];
  valence: number;    // -1.0 ~ 1.0
  arousal: number;    // 0.0 ~ 1.0
  tension: number;    // 0.0 ~ 1.0
  release: number;    // 0.0 ~ 1.0
  energy: number;     // 0.0 ~ 1.0
  emotion_arc: EmotionPoint[];
  signature: string;  // e.g. "4/4"
  instruments: InstrumentEntry[];
  structure: Segment[];
  chords: ChordEvent[];
}

// ─── Aesthetic ────────────────────────────────────────────────────────────────

export interface DimensionScore {
  score: number; // 0 ~ 100
  evidence: Record<string, number>;
}

// Four independent dimensions, deliberately with no combined score — beauty
// isn't a single scalar, collapsing it into one number hides more than it reveals.
export interface AestheticBundle {
  audio_id: string;
  physical_precision: DimensionScore;
  structural_logic: DimensionScore;
  emotional_depth: DimensionScore;
  vital_tension: DimensionScore;
}

// ─── Analysis result ──────────────────────────────────────────────────────────

export interface ToolCallRecord {
  tool_name: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  duration_ms: number;
}

export interface AnalysisResult {
  audio_id: string;
  verified: boolean;
  tool_call_count: number;
  tool_call_log: ToolCallRecord[];
  aesthetic: AestheticBundle;
  understanding: UnderstandingBundle;
  feature_summary: FeatureSummary;
  summary: string;
  explanation: string;
  explanation_skipped: boolean; // true if no OPENAI_API_KEY was configured — summary/explanation are ""
}

// ─── Job ──────────────────────────────────────────────────────────────────────

// Covers both jobs.status's coarse lifecycle (pending/processing/done/failed)
// and SSE's finer-grained pipeline steps (extracting/classifying/scoring/
// explaining/explain_skipped) — one vocabulary instead of two, since
// "done"/"failed" mean the same thing in both.
export type JobStatus =
  | "pending"
  | "processing"
  | "extracting"
  | "classifying"
  | "scoring"
  | "explaining"
  | "explain_skipped" // no OPENAI_API_KEY configured — pipeline.go skips calling Engine's /internal/explain
  | "done"
  | "failed";

// Fields are always present (no optional `?:`) so apps/web has one shape to
// read regardless of status — fields not yet meaningful (e.g. result before
// status=done) are null/"" rather than absent.
export interface Job {
  id: string;
  status: JobStatus;
  result: AnalysisResult | null;
  error: string;
  analysis_duration_sec: number | null;
  created_at: string; // ISO 8601
  title: string;       // from ID3 tag or filename
  artist: string;      // from ID3 tag
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

// The analysis context to answer the question against is looked up
// server-side from the job (identified by {id} in the URL path) that
// produced it, not supplied by the client.
export interface ChatRequest {
  question: string;
  language: "zh" | "en";
}

export interface ChatResponse {
  answer: string;
}

// ─── Job list ─────────────────────────────────────────────────────────────────

export interface ListJobResponse {
  items: Job[];
  total: number;
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

export interface SSEEvent {
  step: JobStatus;
  message?: string;
  progress?: number;         // 0.0 ~ 1.0
  retry_after_sec?: number;  // step=timeout only: reconnect after this many seconds
}

// ─── Demo tracks ──────────────────────────────────────────────────────────────

export interface DemoTrack {
  id: string;
  title: string;
  artist: string;
  duration_sec: number;
  audio_url: string;
}

export interface DemoTracksResponse {
  tracks: DemoTrack[];
}
