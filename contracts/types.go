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
	TimeSignature   string            `json:"time_signature"`
	Instruments     []InstrumentEntry `json:"instruments"`
	Structure       []Segment         `json:"structure"`
	Chords          []ChordEvent      `json:"chords"`
}

// ─── Aesthetic ────────────────────────────────────────────────────────────────

type DimensionScore struct {
	Score    float64            `json:"score"`
	Evidence map[string]float64 `json:"evidence"`
}

type AestheticBundle struct {
	AudioID           string             `json:"audio_id"`
	PhysicalPrecision DimensionScore     `json:"physical_precision"`
	StructuralLogic   DimensionScore     `json:"structural_logic"`
	EmotionalDepth    DimensionScore     `json:"emotional_depth"`
	VitalTension      DimensionScore     `json:"vital_tension"`
	AestheticIndex    float64            `json:"aesthetic_index"`
	Weights           map[string]float64 `json:"weights"`
}

// ─── Analysis result ──────────────────────────────────────────────────────────

type ToolCallRecord struct {
	ToolName   string                 `json:"tool_name"`
	Input      map[string]interface{} `json:"input"`
	Output     map[string]interface{} `json:"output"`
	DurationMS int                    `json:"duration_ms"`
}

type AnalysisResult struct {
	AudioID               string              `json:"audio_id"`
	Verified              bool                `json:"verified"`
	ToolCallCount         int                 `json:"tool_call_count"`
	ToolCallLog           []ToolCallRecord    `json:"tool_call_log"`
	Aesthetic             AestheticBundle     `json:"aesthetic"`
	Understanding         UnderstandingBundle `json:"understanding"`
	FeatureSummary        FeatureSummary      `json:"feature_summary"`
	Summary               string              `json:"summary"`
	Explanation           string              `json:"explanation"`
	ConversationContextID string              `json:"conversation_context_id"`
}

// ─── Job ──────────────────────────────────────────────────────────────────────

type JobStatus string

const (
	JobStatusPending    JobStatus = "pending"
	JobStatusProcessing JobStatus = "processing"
	JobStatusDone       JobStatus = "done"
	JobStatusFailed     JobStatus = "failed"
)

type Job struct {
	ID                  string          `json:"id"`
	Status              JobStatus       `json:"status"`
	Result              *AnalysisResult `json:"result,omitempty"`
	Error               string          `json:"error,omitempty"`
	AnalysisDurationSec *float64        `json:"analysis_duration_sec,omitempty"`
	CreatedAt           string          `json:"created_at,omitempty"` // ISO 8601; omitempty allows partial Job in POST response
	Title               string          `json:"title,omitempty"`      // from ID3 tag or filename
	Artist              string          `json:"artist,omitempty"`     // from ID3 tag
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

type ChatRequest struct {
	Question              string `json:"question"`
	ConversationContextID string `json:"conversation_context_id"`
}

type ChatResponse struct {
	Answer                string `json:"answer"`
	ConversationContextID string `json:"conversation_context_id"`
}

// ─── History ──────────────────────────────────────────────────────────────────

type HistoryResponse struct {
	Items []Job `json:"items"`
	Total int   `json:"total"`
}

// ─── SSE ──────────────────────────────────────────────────────────────────────

type SSEEvent struct {
	Step     string  `json:"step"`
	Message  string  `json:"message,omitempty"`
	Progress float64 `json:"progress,omitempty"` // 0.0 ~ 1.0
}
