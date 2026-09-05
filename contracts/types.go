// Wire types for Golang gateway.
// These are the JSON-serializable cross-service types.
// numpy arrays from the Python engine are never included here —
// only scalars and structured lists cross service boundaries.

package contracts

// ─── Feature summary ──────────────────────────────────────────────────────────

// FeatureSummary carries the display-safe L1 scalars from engine to gateway.
type FeatureSummary struct {
	BPM             float64 `json:"bpm"`
	TempoStability  float64 `json:"tempo_stability"`
	Key             string  `json:"key"`
	DynamicRangeDB  float64 `json:"dynamic_range_db"`
	SpectralEntropy float64 `json:"spectral_entropy"`
	SilenceRatio    float64 `json:"silence_ratio"`
	DurationSec     float64 `json:"duration_sec"`
}

// ─── Understanding ────────────────────────────────────────────────────────────

type EmotionPoint struct {
	TimestampSec float64 `json:"timestamp_sec"`
	Valence      float64 `json:"valence"`
	Arousal      float64 `json:"arousal"`
}

type Segment struct {
	StartSec float64 `json:"start_sec"`
	EndSec   float64 `json:"end_sec"`
	Label    string  `json:"label"`
}

type ChordEvent struct {
	StartSec float64 `json:"start_sec"`
	EndSec   float64 `json:"end_sec"`
	Chord    string  `json:"chord"`
}

type InstrumentEntry struct {
	Name       string  `json:"name"`
	Confidence float64 `json:"confidence"`
}

type GenreEntry struct {
	Label      string  `json:"label"`
	Confidence float64 `json:"confidence"`
}

type UnderstandingBundle struct {
	AudioID         string            `json:"audio_id"`
	Genre           string            `json:"genre"`
	GenreConfidence float64           `json:"genre_confidence"`
	GenreTop3       []GenreEntry      `json:"genre_top3"`
	EmotionLabels   []string          `json:"emotion_labels"`
	Valence         float64           `json:"valence"`
	Arousal         float64           `json:"arousal"`
	Tension         float64           `json:"tension"`
	Release         float64           `json:"release"`
	Energy          float64           `json:"energy"`
	EmotionArc      []EmotionPoint    `json:"emotion_arc"`
	Signature       string            `json:"signature"`
	Instruments     []InstrumentEntry `json:"instruments"`
	Structure       []Segment         `json:"structure"`
	Chords          []ChordEvent      `json:"chords"`
}

// ─── Aesthetic ────────────────────────────────────────────────────────────────

type DimensionScore struct {
	Score    float64            `json:"score"`
	Evidence map[string]float64 `json:"evidence"`
}

// AestheticBundle holds four independent dimensions, deliberately with no
// combined score — beauty isn't a single scalar, collapsing it into one
// number hides more than it reveals.
type AestheticBundle struct {
	AudioID           string         `json:"audio_id"`
	PhysicalPrecision DimensionScore `json:"physical_precision"`
	StructuralLogic   DimensionScore `json:"structural_logic"`
	EmotionalDepth    DimensionScore `json:"emotional_depth"`
	VitalTension      DimensionScore `json:"vital_tension"`
}

// ─── Analysis result ──────────────────────────────────────────────────────────

type ToolCallRecord struct {
	ToolName   string                 `json:"tool_name"`
	Input      map[string]interface{} `json:"input"`
	Output     map[string]interface{} `json:"output"`
	DurationMS int                    `json:"duration_ms"`
}

type AnalysisResult struct {
	AudioID            string              `json:"audio_id"`
	Verified           bool                `json:"verified"`
	ToolCallCount      int                 `json:"tool_call_count"`
	ToolCallLog        []ToolCallRecord    `json:"tool_call_log"`
	Aesthetic          AestheticBundle     `json:"aesthetic"`
	Understanding      UnderstandingBundle `json:"understanding"`
	FeatureSummary     FeatureSummary      `json:"feature_summary"`
	Summary            string              `json:"summary"`
	Explanation        string              `json:"explanation"`
	ExplanationSkipped bool                `json:"explanation_skipped"` // true if no OPENAI_API_KEY was configured — Summary/Explanation are ""
}

// ─── Job ──────────────────────────────────────────────────────────────────────

// JobStatus covers both jobs.status's coarse lifecycle (pending/processing/
// done/failed) and SSE's finer-grained pipeline steps (extracting/
// classifying/scoring/explaining/explain_skipped) — one vocabulary instead
// of two, since "done"/"failed" mean the same thing in both.
type JobStatus string

const (
	JobStatusPending        JobStatus = "pending"
	JobStatusProcessing     JobStatus = "processing"
	JobStatusExtracting     JobStatus = "extracting"
	JobStatusClassifying    JobStatus = "classifying"
	JobStatusScoring        JobStatus = "scoring"
	JobStatusExplaining     JobStatus = "explaining"
	JobStatusExplainSkipped JobStatus = "explain_skipped" // no OPENAI_API_KEY configured — pipeline.go skips calling Engine's /internal/explain
	JobStatusDone           JobStatus = "done"
	JobStatusFailed         JobStatus = "failed"
)

// Job's fields are always present in JSON (no omitempty) so apps/web has one
// shape to read regardless of status — fields not yet meaningful (e.g.
// Result before status=done) serialize as the zero value (null/"") rather
// than being absent.
type Job struct {
	ID                  string          `json:"id"`
	Status              JobStatus       `json:"status"`
	Result              *AnalysisResult `json:"result"`
	Error               string          `json:"error"`
	AnalysisDurationSec *float64        `json:"analysis_duration_sec"`
	CreatedAt           string          `json:"created_at"` // ISO 8601
	Title               string          `json:"title"`      // from ID3 tag or filename
	Artist              string          `json:"artist"`     // from ID3 tag
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

// ChatRequest carries the question and which language to answer in — the
// analysis context to answer against is looked up server-side from the job
// (identified by {id} in the URL path) that produced it, not supplied by the
// client. Language is "zh" | "en", matching apps/web's LanguageToggle.
type ChatRequest struct {
	Question string `json:"question"`
	Language string `json:"language"`
}

type ChatResponse struct {
	Answer string `json:"answer"`
}

// ─── Job list ─────────────────────────────────────────────────────────────────

type ListJobResponse struct {
	Items []Job `json:"items"`
	Total int   `json:"total"`
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

type SSEEvent struct {
	Step          JobStatus `json:"step"`
	Message       string    `json:"message,omitempty"`
	Progress      float64   `json:"progress,omitempty"`        // 0.0 ~ 1.0
	RetryAfterSec int       `json:"retry_after_sec,omitempty"` // step=timeout only: reconnect after this many seconds
}

// ─── Demo tracks ──────────────────────────────────────────────────────────────

type DemoTrack struct {
	ID          string  `json:"id"`
	Title       string  `json:"title"`
	Artist      string  `json:"artist"`
	DurationSec float64 `json:"duration_sec"`
	AudioURL    string  `json:"audio_url"`
}

type DemoTracksResponse struct {
	Tracks []DemoTrack `json:"tracks"`
}
