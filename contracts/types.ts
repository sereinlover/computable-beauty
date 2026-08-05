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
  arousal: number; // -1.0 ~ 1.0
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
  time_signature: string;  // e.g. "4/4"
  instruments: InstrumentEntry[];
  structure: Segment[];
  chords: ChordEvent[];
}

// ─── Aesthetic ────────────────────────────────────────────────────────────────

export interface DimensionScore {
  score: number; // 0 ~ 100
  evidence: Record<string, number>;
}

export interface AestheticBundle {
  audio_id: string;
  physical_precision: DimensionScore;
  structural_logic: DimensionScore;
  emotional_depth: DimensionScore;
  vital_tension: DimensionScore;
  aesthetic_index: number; // 0 ~ 100
  weights: Record<string, number>;
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
  conversation_context_id: string;
}

// ─── Job ──────────────────────────────────────────────────────────────────────

export type JobStatus = "pending" | "processing" | "done" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  result?: AnalysisResult;
  error?: string;
  analysis_duration_sec?: number;
  created_at?: string;    // ISO 8601; optional allows partial Job in POST response
  title?: string;         // from ID3 tag or filename
  artist?: string;        // from ID3 tag
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  question: string;
  conversation_context_id: string;
}

export interface ChatResponse {
  answer: string;
  conversation_context_id: string;
}

// ─── History ──────────────────────────────────────────────────────────────────

export interface HistoryResponse {
  items: Job[];
  total: number;
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

export interface SSEEvent {
  step: string;
  message?: string;
  progress?: number; // 0.0 ~ 1.0
}
