package biz

import "github.com/computable-beauty/contracts"

// AnalysisRecord is one row of the analyses table. Keyed by a
// "<content-hash>_<language>" composite (see biz/pipeline.go's analysisKey),
// not a bare content hash — Result.AudioID inside still holds the real
// content hash, unmodified.
type AnalysisRecord struct {
	Result *contracts.AnalysisResult
}

// JobRecord combines contracts.Job with the internal-only
// AudioID/AudioPath/Language fields.
type JobRecord struct {
	Job       *contracts.Job
	AudioID   string
	AudioPath string
	Language  string
}

// EngineExplainRequest is EngineClient.Explain's input.
type EngineExplainRequest struct {
	AudioID        string
	JobID          string
	AudioPath      string
	Language       string
	FeatureSummary *contracts.FeatureSummary
	Understanding  *contracts.UnderstandingBundle
	Aesthetic      *contracts.AestheticBundle
}

// EngineChatRequest is EngineClient.Chat's input.
type EngineChatRequest struct {
	AudioID        string
	Question       string
	Language       string
	FeatureSummary *contracts.FeatureSummary
	Understanding  *contracts.UnderstandingBundle
	Aesthetic      *contracts.AestheticBundle
	Summary        string
	Explanation    string
}
