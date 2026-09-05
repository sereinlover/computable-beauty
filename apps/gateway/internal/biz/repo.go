// Package biz defines the abstract interfaces (ports) the gateway depends on;
// concrete implementations live in internal/data. Interfaces are named by
// role (JobStore, AnalysisCache, ...), not suffixed "Repo" — that suffix
// belongs to internal/data's "technology + role" struct names
// (JobPostgresStore, JobRedisCache, ...).
package biz

import (
	"context"
	"errors"

	"github.com/computable-beauty/contracts"
)

// ErrEngineUnreachable marks a transport-level EngineClient failure (the
// HTTP round trip never completed) rather than Engine rejecting the request
// for a real reason. Worker requeues these instead of failing the job.
var ErrEngineUnreachable = errors.New("engine unreachable")

// JobStore reads and writes the jobs table, implemented by JobPostgresStore
// (internal/data/job.go). GetJob/ListJob query jobs LEFT JOIN analyses, but
// the semantics are "look up a Job", so they live here, not on AnalysisStore.
type JobStore interface {
	// AudioPath isn't exposed on contracts.Job; it only lives in the jobs
	// table, for the worker to read once it picks up this pending job.
	CreateJob(ctx context.Context, job JobRecord) error
	// durationSec only matters for status=done, errMsg only for status=failed.
	UpdateJob(ctx context.Context, jobID string, status contracts.JobStatus, errMsg string, durationSec *float64) error
	GetJob(ctx context.Context, jobID string) (*contracts.Job, error)
	// total is the unpaginated row count, for ListJobResponse.Total. An empty
	// status matches every job; a non-empty one restricts both the count and
	// the page to that status.
	ListJob(ctx context.Context, status contracts.JobStatus, limit, offset int) (jobs []contracts.Job, total int, err error)
	// NextJob returns the oldest pending job (created_at ASC); found=false
	// when the queue is empty.
	NextJob(ctx context.Context) (job JobRecord, found bool, err error)
	// RequeueStuckJobs resets every status=processing row back to pending.
	// Only one Worker goroutine ever holds that status, so any row still
	// processing at startup is an orphan from a process that died or
	// restarted mid-job — NextJob only selects pending, so nothing else
	// would ever move it. Returns each reset row's title for logging.
	RequeueStuckJobs(ctx context.Context) (titles []string, err error)
}

// AnalysisStore reads and writes the analyses table, implemented by
// AnalysisPostgresStore (internal/data/analysis.go). audioID here is the
// "<content-hash>_<language>" composite from biz/pipeline.go's analysisKey,
// not a bare content hash — this interface doesn't need to know about
// language at all, it's baked into the key by the caller.
type AnalysisStore interface {
	// FindAnalysis returns (nil, nil) on a miss.
	FindAnalysis(ctx context.Context, audioID string) (*AnalysisRecord, error)
	// SaveAnalysis inserts with ON CONFLICT DO NOTHING — first write wins.
	SaveAnalysis(ctx context.Context, audioID string, record *AnalysisRecord) error
	// UpdateAnalysis overwrites an existing row, for the one case where a
	// *later* write should win: an ExplanationSkipped result gets its
	// explanation filled in once a key is configured (see
	// biz.Worker.processJob). No-ops if the row doesn't exist; callers only
	// call this after FindAnalysis confirmed it does.
	UpdateAnalysis(ctx context.Context, audioID string, record *AnalysisRecord) error
}

// JobCache caches a job's progress status keyed by job ID, implemented by
// JobRedisCache (internal/data/job.go).
type JobCache interface {
	// SetJobStatus caches with a 1-day TTL.
	SetJobStatus(ctx context.Context, jobID string, status contracts.JobStatus) error
	// GetJobStatus is polled by the SSE handler. Returns "" (not a
	// contracts.JobStatus constant) on a miss — the worker hasn't picked up
	// this job yet.
	GetJobStatus(ctx context.Context, jobID string) (contracts.JobStatus, error)
}

// AnalysisCache caches an analysis result keyed by the same composite
// audio_id AnalysisStore uses, implemented by AnalysisRedisCache
// (internal/data/analysis.go).
type AnalysisCache interface {
	// SetAnalysis caches an analysis result with a 7-day TTL.
	SetAnalysis(ctx context.Context, audioID string, result *contracts.AnalysisResult) error
	// GetAnalysis reads a cached analysis result; returns (nil, nil) on a miss.
	GetAnalysis(ctx context.Context, audioID string) (*contracts.AnalysisResult, error)
}

// EngineClient calls apps/engine's five /internal/* endpoints, implemented by
// HTTPEngineClient (internal/data/engine_client.go).
type EngineClient interface {
	ExtractFeatures(ctx context.Context, audioID, audioPath string) (*contracts.FeatureSummary, error)
	Classify(ctx context.Context, audioID, audioPath string, fs *contracts.FeatureSummary) (*contracts.UnderstandingBundle, error)
	ScoreAesthetics(
		ctx context.Context, audioID, audioPath string,
		fs *contracts.FeatureSummary, ub *contracts.UnderstandingBundle,
	) (*contracts.AestheticBundle, error)
	Explain(ctx context.Context, req EngineExplainRequest) (*contracts.AnalysisResult, error)
	Chat(ctx context.Context, req EngineChatRequest) (answer string, err error)
}
