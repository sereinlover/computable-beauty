// Package service is the application layer: it composes internal/biz's
// interfaces into complete use cases for internal/server to call.
package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"

	"github.com/computable-beauty/contracts"
	"github.com/computable-beauty/gateway/internal/biz"
)

// ErrJobNotAnalyzed is returned by Chat when the job has no result yet
// (still pending/processing, or failed) — nothing to answer against.
var ErrJobNotAnalyzed = errors.New("job has no analysis result yet")

// JobService composes biz-layer interfaces for job-related business logic.
// Chat lives here too since it's always reached through a job's URL and
// needs that job's stored result.
type JobService struct {
	jobStore biz.JobStore
	jobCache biz.JobCache
	engine   biz.EngineClient
}

// NewJobService wires JobService's biz-layer dependencies.
func NewJobService(jobStore biz.JobStore, jobCache biz.JobCache, engine biz.EngineClient) *JobService {
	return &JobService{jobStore: jobStore, jobCache: jobCache, engine: engine}
}

// SubmitJobRequest is handleSubmitJob's parsed upload, passed to
// JobService.SubmitJob.
type SubmitJobRequest struct {
	AudioID   string
	AudioPath string
	Title     string
	Artist    string
	Language  string
}

// SubmitJob creates a status=pending job — Worker.processJob decides later
// whether it's already analyzed. Title/Artist are this job's own upload
// metadata (ID3 tags/filename), independent of the analyses table, so a
// re-analyzed audio_id under a different filename still shows this job's
// own title.
func (s *JobService) SubmitJob(ctx context.Context, req SubmitJobRequest) (*contracts.Job, error) {
	job := &contracts.Job{
		ID:     uuid.New().String(),
		Title:  req.Title,
		Artist: req.Artist,
		Status: contracts.JobStatusPending,
	}

	record := biz.JobRecord{Job: job, AudioID: req.AudioID, AudioPath: req.AudioPath, Language: req.Language}
	if err := s.jobStore.CreateJob(ctx, record); err != nil {
		return nil, fmt.Errorf("failed to create job: %w", err)
	}

	return job, nil
}

// GetJobStatus reads a job's cached status, for handleJobStream to poll.
func (s *JobService) GetJobStatus(ctx context.Context, jobID string) (contracts.JobStatus, error) {
	return s.jobCache.GetJobStatus(ctx, jobID)
}

// GetJob looks up a single job by id. Returns biz.ErrJobNotFound unwrapped if
// it doesn't exist — translating that into an HTTP response is server's job.
func (s *JobService) GetJob(ctx context.Context, jobID string) (*contracts.Job, error) {
	return s.jobStore.GetJob(ctx, jobID)
}

// ListJob returns a page of jobs ordered by created_at DESC, for GET /api/jobs.
// An empty status matches every job regardless of status.
func (s *JobService) ListJob(ctx context.Context, status contracts.JobStatus, limit, offset int) (*contracts.ListJobResponse, error) {
	jobs, total, err := s.jobStore.ListJob(ctx, status, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("failed to list jobs: %w", err)
	}
	return &contracts.ListJobResponse{Items: jobs, Total: total}, nil
}

// Chat forwards a follow-up question to Engine along with jobID's own
// already-computed analysis (Engine is stateless — see biz.EngineClient.Chat).
// Returns ErrJobNotAnalyzed if there's no result yet, biz.ErrJobNotFound if
// the job doesn't exist at all.
func (s *JobService) Chat(ctx context.Context, jobID, question, language string) (answer string, err error) {
	job, err := s.jobStore.GetJob(ctx, jobID)
	if err != nil {
		return "", err
	}
	if job.Result == nil {
		return "", ErrJobNotAnalyzed
	}
	result := job.Result
	return s.engine.Chat(ctx, biz.EngineChatRequest{
		AudioID:        result.AudioID,
		Question:       question,
		Language:       language,
		FeatureSummary: &result.FeatureSummary,
		Understanding:  &result.Understanding,
		Aesthetic:      &result.Aesthetic,
		Summary:        result.Summary,
		Explanation:    result.Explanation,
	})
}
