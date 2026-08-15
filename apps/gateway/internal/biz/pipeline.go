package biz

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/computable-beauty/contracts"
)

// WorkerPollInterval is how long the worker waits before re-checking for a
// pending job when the queue is empty.
const WorkerPollInterval = 1 * time.Second

// Worker processes the jobs table's pending rows serially: one goroutine,
// oldest job first, next one only after the current reaches a terminal
// state. Re-uploading an audio_id already queued/running just finds the
// analysis already done and skips re-running Engine — no dedup lock needed.
//
// NewWorker takes a Worker literal so the exported fields below are
// self-documenting at the call site instead of six positional params.
type Worker struct {
	JobStore      JobStore
	JobCache      JobCache
	AnalysisStore AnalysisStore
	AnalysisCache AnalysisCache
	Engine        EngineClient
	HasOpenAIKey  bool // false skips calling Engine's /internal/explain entirely — see runPipeline

	pollInterval time.Duration
	doneC        chan struct{}
}

// NewWorker fills in Worker's internal-only fields; the poll interval is
// fixed to WorkerPollInterval.
func NewWorker(w Worker) *Worker {
	w.pollInterval = WorkerPollInterval
	w.doneC = make(chan struct{})
	return &w
}

// Done returns a channel closed once Run exits after ctx is canceled, for
// main to wait on during graceful shutdown.
func (w *Worker) Done() <-chan struct{} {
	return w.doneC
}

// Run loops forever: a pending job is processed immediately, next one
// fetched right after; pollInterval only kicks in once the queue is empty.
//
// A picked-up job is processed with context.Background(), not ctx —
// canceling ctx only stops fetching the *next* job, it never interrupts one
// already in flight, so every job reaches a terminal state (done/failed)
// no matter when shutdown happens.
func (w *Worker) Run(ctx context.Context) {
	log.Printf("worker started, polling every %s", w.pollInterval)
	defer close(w.doneC)
	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		job, found, err := w.JobStore.NextJob(ctx)
		if err != nil {
			log.Printf("failed to get next pending job: %v", err)
		}
		if err != nil || !found {
			select {
			case <-ctx.Done():
				return
			case <-time.After(w.pollInterval):
			}
			continue
		}

		w.processJob(context.Background(), job)
	}
}

// analysisKey is a "<content-hash>_<language>" composite, not the bare
// content hash — zh/en count as "different content" for caching, so L1-L3
// (language-independent) get recomputed alongside L4 the first time an
// audio_id shows up in a new language. An accepted simplification; worth
// splitting the two out if that recompute cost becomes a real problem.
func analysisKey(audioID, language string) string {
	return audioID + "_" + language
}

// findExistingAnalysis checks Redis first, falling back to the authoritative
// Postgres FindAnalysis on a miss or a read error — this absorbs repeated
// re-uploads of the same file without sending every one to Postgres.
func (w *Worker) findExistingAnalysis(ctx context.Context, jobID, key string) (*AnalysisRecord, error) {
	if cached, err := w.AnalysisCache.GetAnalysis(ctx, key); err != nil {
		log.Printf("job %s: failed to read analysis cache, falling back to store: %v", jobID, err)
	} else if cached != nil {
		return &AnalysisRecord{Result: cached}, nil
	}
	return w.AnalysisStore.FindAnalysis(ctx, key)
}

// processJob handles one job: mark processing → check whether it's already
// analyzed → run the pipeline if not → mark done. An error from the check
// step (FindAnalysis) requeues to pending for a retry; an error from the
// pipeline or the save step fails the job.
func (w *Worker) processJob(ctx context.Context, job JobRecord) {
	jobID := job.Job.ID
	start := time.Now()
	log.Printf("job %s: processing started (audio_id=%s, language=%s)", jobID, job.AudioID, job.Language)

	if err := w.JobStore.UpdateJob(ctx, jobID, contracts.JobStatusProcessing, "", nil); err != nil {
		log.Printf("job %s: failed to mark processing: %v", jobID, err)
		return
	}

	key := analysisKey(job.AudioID, job.Language)

	// A failure here doesn't mean this audio_id can't be analyzed, so requeue
	// to pending instead of failing outright — the worker retries it on the
	// next poll. Repeated failures (e.g. a permanent schema error) hold the
	// queue head and block everything behind it.
	existing, err := w.findExistingAnalysis(ctx, jobID, key)
	if err != nil {
		log.Printf("job %s: failed to check existing analysis, requeueing: %v", jobID, err)
		if requeueErr := w.JobStore.UpdateJob(ctx, jobID, contracts.JobStatusPending, "", nil); requeueErr != nil {
			// Requeue itself failed while still marked processing — NextJob
			// only picks up pending jobs, so leaving it as-is would strand it
			// forever. Fail instead, so the user has a state to retry from.
			w.fail(ctx, jobID, fmt.Errorf("failed to check existing analysis: %w; failed to requeue: %w", err, requeueErr))
			return
		}
		return
	}

	var freshResult *contracts.AnalysisResult
	if existing == nil {
		freshResult, err = w.runPipeline(ctx, job)
		if err != nil {
			w.fail(ctx, jobID, err)
			return
		}
		// Write order: the store (source of truth) before the cache.
		if err := w.AnalysisStore.SaveAnalysis(ctx, key, &AnalysisRecord{Result: freshResult}); err != nil {
			w.fail(ctx, jobID, fmt.Errorf("failed to save analysis: %w", err))
			return
		}
	} else if existing.Result.ExplanationSkipped && w.HasOpenAIKey {
		// Cached from before a key was configured — L1-L3 are still good,
		// only L4 needs retrying. A failure here just keeps the cached skip
		// result rather than failing the job — this retry is a bonus, not
		// something that should make things worse.
		retried, explainErr := w.runExplain(
			ctx, jobID, job.AudioID, job.AudioPath, job.Language,
			&existing.Result.FeatureSummary, &existing.Result.Understanding, &existing.Result.Aesthetic,
		)
		if explainErr != nil {
			log.Printf("job %s: retrying explain for a previously-skipped analysis failed, keeping the cached result: %v", jobID, explainErr)
		} else if err := w.AnalysisStore.UpdateAnalysis(ctx, key, &AnalysisRecord{Result: retried}); err != nil {
			w.fail(ctx, jobID, fmt.Errorf("failed to update analysis with retried explanation: %w", err))
			return
		} else {
			freshResult = retried
		}
	}
	// existing != nil and not retried above: an earlier job already has this
	// audio_id's analysis, so this one skips straight to marking done.

	// The analysis is already saved by now, so a failure marking this job
	// done is safe to requeue: next round, findExistingAnalysis hits the
	// saved analysis and retries straight to the done write.
	duration := time.Since(start).Seconds()
	if err := w.JobStore.UpdateJob(ctx, jobID, contracts.JobStatusDone, "", &duration); err != nil {
		log.Printf("job %s: failed to mark done, requeueing: %v", jobID, err)
		if requeueErr := w.JobStore.UpdateJob(ctx, jobID, contracts.JobStatusPending, "", nil); requeueErr != nil {
			w.fail(ctx, jobID, fmt.Errorf("failed to mark done: %w; failed to requeue: %w", err, requeueErr))
		}
		return
	}
	if freshResult != nil {
		if err := w.AnalysisCache.SetAnalysis(ctx, key, freshResult); err != nil {
			log.Printf("job %s: failed to warm analysis cache: %v", jobID, err)
		}
	}
	if err := w.JobCache.SetJobStatus(ctx, jobID, contracts.JobStatusDone); err != nil {
		log.Printf("job %s: failed to set done status cache: %v", jobID, err)
	}
	log.Printf("job %s: done in %.2fs", jobID, duration)
}

// runPipeline calls the Engine's four endpoints in sequence, updating the
// cache's job status to the matching step name after each success, for the
// SSE handler to read and push to the browser.
func (w *Worker) runPipeline(ctx context.Context, job JobRecord) (*contracts.AnalysisResult, error) {
	jobID := job.Job.ID

	if err := w.JobCache.SetJobStatus(ctx, jobID, contracts.JobStatusExtracting); err != nil {
		log.Printf("job %s: failed to set extracting status cache: %v", jobID, err)
	}
	features, err := w.Engine.ExtractFeatures(ctx, job.AudioID, job.AudioPath)
	if err != nil {
		return nil, fmt.Errorf("failed to extract features: %w", err)
	}
	log.Printf("job %s: extract-features done: %+v", jobID, features)

	if err := w.JobCache.SetJobStatus(ctx, jobID, contracts.JobStatusClassifying); err != nil {
		log.Printf("job %s: failed to set classifying status cache: %v", jobID, err)
	}
	understanding, err := w.Engine.Classify(ctx, job.AudioID, job.AudioPath, features)
	if err != nil {
		return nil, fmt.Errorf("failed to classify: %w", err)
	}
	log.Printf("job %s: classify done: %+v", jobID, understanding)

	if err := w.JobCache.SetJobStatus(ctx, jobID, contracts.JobStatusScoring); err != nil {
		log.Printf("job %s: failed to set scoring status cache: %v", jobID, err)
	}
	aesthetic, err := w.Engine.ScoreAesthetics(ctx, job.AudioID, job.AudioPath, features, understanding)
	if err != nil {
		return nil, fmt.Errorf("failed to score aesthetics: %w", err)
	}
	log.Printf("job %s: score-aesthetics done: %+v", jobID, aesthetic)

	// No key configured: skip calling Engine (would just fail or hang on the
	// LLM request) and build the result with the AI fields left empty. Still
	// counts as success — only the L4 explanation is unavailable.
	if !w.HasOpenAIKey {
		if err := w.JobCache.SetJobStatus(ctx, jobID, contracts.JobStatusExplainSkipped); err != nil {
			log.Printf("job %s: failed to set explain_skipped status cache: %v", jobID, err)
		}
		log.Printf("job %s: no OPENAI_API_KEY configured, skipping explain", jobID)
		return explainSkippedResult(job.AudioID, features, understanding, aesthetic), nil
	}

	return w.runExplain(ctx, jobID, job.AudioID, job.AudioPath, job.Language, features, understanding, aesthetic)
}

// runExplain calls Engine's /internal/explain — split out from runPipeline
// because processJob's retry-a-skipped-analysis branch needs just this L4
// step too, without the L1-L3 steps around it.
func (w *Worker) runExplain(
	ctx context.Context, jobID, audioID, audioPath, language string,
	features *contracts.FeatureSummary, understanding *contracts.UnderstandingBundle, aesthetic *contracts.AestheticBundle,
) (*contracts.AnalysisResult, error) {
	if err := w.JobCache.SetJobStatus(ctx, jobID, contracts.JobStatusExplaining); err != nil {
		log.Printf("job %s: failed to set explaining status cache: %v", jobID, err)
	}
	result, err := w.Engine.Explain(ctx, EngineExplainRequest{
		AudioID:        audioID,
		JobID:          jobID,
		AudioPath:      audioPath,
		Language:       language,
		FeatureSummary: features,
		Understanding:  understanding,
		Aesthetic:      aesthetic,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to explain: %w", err)
	}
	log.Printf("job %s: explain done: %+v", jobID, result)

	return result, nil
}

// explainSkippedResult builds the AnalysisResult for a job that never called
// /internal/explain (no OPENAI_API_KEY). ToolCallLog is `[]` not nil so it
// serializes as `[]` not `null`; ExplanationSkipped lets apps/web tell
// "skipped" apart from "LLM returned nothing".
func explainSkippedResult(
	audioID string,
	features *contracts.FeatureSummary,
	understanding *contracts.UnderstandingBundle,
	aesthetic *contracts.AestheticBundle,
) *contracts.AnalysisResult {
	return &contracts.AnalysisResult{
		AudioID:            audioID,
		FeatureSummary:     *features,
		Understanding:      *understanding,
		Aesthetic:          *aesthetic,
		ToolCallLog:        []contracts.ToolCallRecord{},
		ExplanationSkipped: true,
	}
}

// fail marks the job failed in the store, then the cache.
func (w *Worker) fail(ctx context.Context, jobID string, cause error) {
	log.Printf("job %s: failed: %v", jobID, cause)
	if err := w.JobStore.UpdateJob(ctx, jobID, contracts.JobStatusFailed, cause.Error(), nil); err != nil {
		log.Printf("job %s: failed to mark failed: %v", jobID, err)
	}
	if err := w.JobCache.SetJobStatus(ctx, jobID, contracts.JobStatusFailed); err != nil {
		log.Printf("job %s: failed to set failed status cache: %v", jobID, err)
	}
}
