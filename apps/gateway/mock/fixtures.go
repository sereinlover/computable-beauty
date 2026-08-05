// Stage 0 mock data for Gateway skeleton.
// Import path for contracts TBD when module structure is finalized.
// Data mirrors apps/engine/mock/fixtures.py — keep in sync.

package mock

// MockJob is a fully-populated done job returned by GET /api/jobs/{id}.
// Handlers return this when the engine is not yet wired up.
var MockJob = map[string]any{
	"id":                    "mock-job-001",
	"status":                "done",
	"result":                MockAnalysisResult,
	"analysis_duration_sec": 1.2,
	"created_at":            "2026-07-01T14:23:00Z",
	"title":                 "Forever Love",
	"artist":                "X Japan",
}

// MockAnalysisResult is the wire-safe AnalysisResult returned by POST /internal/explain.
var MockAnalysisResult = map[string]any{
	"audio_id":      "mock-yoshiki-001",
	"verified":      true,
	"tool_call_count": 4,
	"tool_call_log": []map[string]any{
		{
			"tool_name":   "explain_dimension",
			"input":       map[string]any{"dimension": "physical_precision", "score": 84, "evidence": map[string]any{"tempo_stability": 0.03, "dynamic_range_db": 28.5, "spectral_entropy": 4.2, "frequency_balance": 0.76}},
			"output":      map[string]any{"explanation": "物理精确性得分 84：节拍稳定性 0.03（鼓机精密编程），动态范围 28.5 dB 远超流行歌曲均值，频谱平衡度 0.76。"},
			"duration_ms": 1430,
		},
		{
			"tool_name":   "explain_dimension",
			"input":       map[string]any{"dimension": "structural_logic", "score": 78, "evidence": map[string]any{"tsd_coverage": 0.71, "segment_balance": 0.83, "key_stability": 0.88}},
			"output":      map[string]any{"explanation": "结构逻辑得分 78：T-S-D 和声覆盖率 71%，Dm→Bb→F→C 进行体现多利亚调式，七段式结构段落均衡度 0.83。"},
			"duration_ms": 1580,
		},
		{
			"tool_name":   "explain_dimension",
			"input":       map[string]any{"dimension": "emotional_depth", "score": 88, "evidence": map[string]any{"valence_delta": 1.13, "polarity_switches": 5, "arousal_std": 0.24, "high_arousal_ratio": 0.42}},
			"output":      map[string]any{"explanation": "情感深度得分 88：情感弧线极差 1.13，极性翻转 5 次，唤醒度标准差 0.24，从安静引子（0.35）到高潮（0.98）完整叙事。"},
			"duration_ms": 1620,
		},
		{
			"tool_name":   "explain_dimension",
			"input":       map[string]any{"dimension": "vital_tension", "score": 91, "evidence": map[string]any{"dynamic_contrast": 0.81, "burst_density": 11.4, "silence_burst_ratio": 0.08, "dissonance_ratio": 0.29}},
			"output":      map[string]any{"explanation": "生命张力得分 91：动态对比度 0.81，每分钟 11.4 次能量爆发，不协和音程占比 29%，静音与爆发交替比 0.08。"},
			"duration_ms": 1850,
		},
	},
	"feature_summary":  MockFeatureSummary,
	"understanding":    MockUnderstandingBundle,
	"aesthetic":        MockAestheticBundle,
	"summary":          "这首曲子在生命张力（91）与情感深度（88）两个维度上表现出色，大幅超出同类作品均值。物理精确性（84）印证了编程鼓与弦乐的精密配合；结构逻辑（78）略低，主要原因是 T-S-D 功能和声覆盖率未达最高水平。综合美学指数 86，属于高度可计算的美学强度区间。",
	"explanation":      "**物理精确性（84）**\n节拍稳定性极高（0.03），源于鼓机精密编程，动态范围 28.5 dB 远超流行歌曲均值。频谱平衡度 0.76 说明低中高频分布合理，管弦乐编制功不可没。\n\n**结构逻辑（78）**\nT-S-D 和声覆盖率 71%，Dm→Bb→F→C→Dm 进行体现了多利亚调式特征。段落时长分布均衡（0.83），七段式结构完整。\n\n**情感深度（88）**\n情感弧线从安静引子（arousal 0.35）到高潮（arousal 0.98）极差 1.13，极性翻转 5 次，呈现死亡与生命并存的叙事张力。\n\n**生命张力（91）**\n动态对比度 0.81 是最显著特征：最强与最弱瞬间的能量落差接近临界值。每分钟 11.4 次爆发密度保持持续紧张感而不疲劳。",
	"conversation_context_id": "ctx-mock-001",
}

var MockFeatureSummary = map[string]any{
	"bpm":              142.0,
	"tempo_stability":  0.03,
	"key":              "D minor",
	"dynamic_range_db": 28.5,
	"spectral_entropy": 4.2,
	"silence_ratio":    0.06,
	"duration_sec":     332.0,
}

var MockUnderstandingBundle = map[string]any{
	"audio_id":         "mock-yoshiki-001",
	"genre":            "Orchestral Rock",
	"genre_confidence": 0.87,
	"genre_top3": []map[string]any{
		{"label": "Orchestral Rock", "confidence": 0.87},
		{"label": "Symphonic Metal", "confidence": 0.09},
		{"label": "Classical",       "confidence": 0.04},
	},
	"emotion_labels": []string{"dramatic", "intense", "melancholic"},
	"valence":        -0.28,
	"arousal":        0.74,
	"tension":        0.71,
	"release":        0.44,
	"energy":         0.58,
	"emotion_arc": []map[string]any{
		{"timestamp_sec": 0,   "valence": -0.10, "arousal": 0.35},
		{"timestamp_sec": 15,  "valence": -0.20, "arousal": 0.45},
		{"timestamp_sec": 30,  "valence": -0.45, "arousal": 0.72},
		{"timestamp_sec": 50,  "valence": -0.60, "arousal": 0.90},
		{"timestamp_sec": 65,  "valence": -0.30, "arousal": 0.95},
		{"timestamp_sec": 88,  "valence": -0.55, "arousal": 0.65},
		{"timestamp_sec": 105, "valence": -0.40, "arousal": 0.80},
		{"timestamp_sec": 130, "valence": -0.15, "arousal": 0.98},
		{"timestamp_sec": 160, "valence": -0.50, "arousal": 0.40},
	},
	"time_signature": "4/4",
	"instruments": []map[string]any{
		{"name": "piano",             "confidence": 0.92},
		{"name": "orchestral strings","confidence": 0.88},
		{"name": "electric guitar",   "confidence": 0.81},
		{"name": "drums",             "confidence": 0.95},
		{"name": "brass",             "confidence": 0.73},
	},
	"structure": []map[string]any{
		{"start_sec": 0,   "end_sec": 28,  "label": "intro"},
		{"start_sec": 28,  "end_sec": 62,  "label": "verse"},
		{"start_sec": 62,  "end_sec": 96,  "label": "chorus"},
		{"start_sec": 96,  "end_sec": 124, "label": "verse"},
		{"start_sec": 124, "end_sec": 158, "label": "chorus"},
		{"start_sec": 158, "end_sec": 185, "label": "bridge"},
		{"start_sec": 185, "end_sec": 210, "label": "outro"},
	},
	"chords": []map[string]any{
		{"start_sec": 0,  "end_sec": 4,  "chord": "Dm"},
		{"start_sec": 4,  "end_sec": 8,  "chord": "Bb"},
		{"start_sec": 8,  "end_sec": 12, "chord": "F"},
		{"start_sec": 12, "end_sec": 16, "chord": "C"},
		{"start_sec": 16, "end_sec": 20, "chord": "Dm"},
		{"start_sec": 20, "end_sec": 24, "chord": "Gm"},
		{"start_sec": 24, "end_sec": 28, "chord": "A"},
	},
}

var MockAestheticBundle = map[string]any{
	"audio_id":        "mock-yoshiki-001",
	"aesthetic_index": 86.1,
	"physical_precision": map[string]any{
		"score": 84.0,
		"evidence": map[string]any{
			"tempo_stability":   0.03,
			"dynamic_range_db":  28.5,
			"spectral_entropy":  4.2,
			"frequency_balance": 0.76,
		},
	},
	"structural_logic": map[string]any{
		"score": 78.0,
		"evidence": map[string]any{
			"tsd_coverage":    0.71,
			"segment_balance": 0.83,
			"key_stability":   0.88,
		},
	},
	"emotional_depth": map[string]any{
		"score": 88.0,
		"evidence": map[string]any{
			"valence_delta":      1.13,
			"polarity_switches":  5.0,
			"arousal_std":        0.24,
			"high_arousal_ratio": 0.42,
		},
	},
	"vital_tension": map[string]any{
		"score": 91.0,
		"evidence": map[string]any{
			"dynamic_contrast":    0.81,
			"burst_density":       11.4,
			"silence_burst_ratio": 0.08,
			"dissonance_ratio":    0.29,
		},
	},
	"weights": map[string]any{
		"physical_precision": 0.20,
		"structural_logic":   0.20,
		"emotional_depth":    0.30,
		"vital_tension":      0.30,
	},
}

// MockDemoTracks is returned by GET /api/demo-tracks.
var MockDemoTracks = map[string]any{
	"tracks": []map[string]any{
		{
			"id":           "yoshiki-forever-love",
			"title":        "Forever Love",
			"artist":       "X Japan",
			"duration_sec": 332,
			"audio_url":    "/demo/yoshiki-forever-love.mp3",
		},
	},
}
