package data

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/redis/go-redis/v9"

	"github.com/computable-beauty/contracts"
	"github.com/computable-beauty/gateway/internal/biz"
)

// jobStatusTTL is the TTL for the Redis job:{id}:status key.
const jobStatusTTL = 24 * time.Hour

// pgInvalidTextRepresentation is Postgres error code 22P02
// (invalid_text_representation) — returned when a query parameter can't be
// cast to its column's type, e.g. a non-UUID string for a UUID column.
const pgInvalidTextRepresentation = "22P02"

// JobPostgresStore implements biz.JobStore, sharing PostgresStore's
// connection pool (jobs and analyses live on the same Postgres instance, so
// there's no need for a separate pool).
type JobPostgresStore struct {
	*PostgresStore
}

// NewJobPostgresStore wraps an existing PostgresStore as a JobPostgresStore.
func NewJobPostgresStore(store *PostgresStore) *JobPostgresStore {
	return &JobPostgresStore{PostgresStore: store}
}

// CreateJob inserts a new job row. title/artist are contracts.Job's own
// fields — each job stores its own copy rather than depending on analyses.
func (r *JobPostgresStore) CreateJob(ctx context.Context, job biz.JobRecord) error {
	_, err := r.pool.Exec(ctx, `
		INSERT INTO jobs (id, audio_id, audio_path, title, artist, language, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, now())
	`, job.Job.ID, job.AudioID, job.AudioPath, job.Job.Title, job.Job.Artist, job.Language, job.Job.Status)
	if err != nil {
		return fmt.Errorf("failed to create job: %w", err)
	}
	return nil
}

// NextJob returns the oldest pending job by created_at ASC, for the
// worker to poll; found=false when the queue is empty (not an error).
func (r *JobPostgresStore) NextJob(ctx context.Context) (biz.JobRecord, bool, error) {
	job := biz.JobRecord{Job: &contracts.Job{}}
	err := r.pool.QueryRow(ctx, `
		SELECT id, audio_id, audio_path, title, artist, language
		FROM jobs
		WHERE status = $1
		ORDER BY created_at ASC
		LIMIT 1
	`, contracts.JobStatusPending).Scan(
		&job.Job.ID, &job.AudioID, &job.AudioPath, &job.Job.Title, &job.Job.Artist, &job.Language,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return biz.JobRecord{}, false, nil
	}
	if err != nil {
		return biz.JobRecord{}, false, fmt.Errorf("failed to get next pending job: %w", err)
	}
	return job, true, nil
}

// UpdateJob updates a job's status; durationSec only matters for
// status=done, errMsg only for status=failed.
func (r *JobPostgresStore) UpdateJob(ctx context.Context, jobID string, status contracts.JobStatus, errMsg string, durationSec *float64) error {
	var errArg any
	if errMsg != "" {
		errArg = errMsg
	}
	_, err := r.pool.Exec(ctx, `
		UPDATE jobs SET status = $1, error = $2, analysis_duration_sec = $3 WHERE id = $4
	`, status, errArg, durationSec, jobID)
	if err != nil {
		return fmt.Errorf("failed to update job status: %w", err)
	}
	return nil
}

// GetJob looks up a full Job by id (result comes from LEFT JOIN analyses).
// Returns biz.ErrJobNotFound if it doesn't exist — including when jobID isn't
// valid UUID syntax: Postgres rejects that as error code 22P02 rather than a
// no-rows result, but callers shouldn't see two different failure shapes for
// "malformed id" vs. "well-formed id, no match".
func (r *JobPostgresStore) GetJob(ctx context.Context, jobID string) (*contracts.Job, error) {
	// analyses.audio_id is a "<content-hash>_<language>" composite (see
	// biz/pipeline.go's analysisKey) — rebuild that key from jobs.audio_id/
	// language, a bare audio_id=audio_id join would never match.
	row := r.pool.QueryRow(ctx, `
		SELECT j.id, j.status, j.error, j.analysis_duration_sec, j.created_at, j.title, j.artist, a.result
		FROM jobs j
		LEFT JOIN analyses a ON a.audio_id = j.audio_id || '_' || j.language
		WHERE j.id = $1
	`, jobID)

	job, err := scanJobRow(row)
	var pgErr *pgconn.PgError
	if errors.Is(err, pgx.ErrNoRows) || (errors.As(err, &pgErr) && pgErr.Code == pgInvalidTextRepresentation) {
		return nil, biz.ErrJobNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get job: %w", err)
	}
	return job, nil
}

// ListJob returns a page of Jobs ordered by created_at DESC (jobs LEFT JOIN
// analyses), limit rows starting at offset — total is a separate unpaginated
// COUNT(*), for callers to tell whether there's a next page. An empty status
// matches every job; a non-empty one (e.g. contracts.JobStatusDone) restricts
// both the count and the page — apps/web's recent-analyses/history pages rely
// on this so a still-in-progress job (which renders nothing, having no result
// yet) doesn't quietly shrink a page below `limit`.
func (r *JobPostgresStore) ListJob(ctx context.Context, status contracts.JobStatus, limit, offset int) ([]contracts.Job, int, error) {
	var total int
	if err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM jobs WHERE ($1 = '' OR status = $1)
	`, status).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count history: %w", err)
	}

	// Composite-key join — see GetJob's comment above.
	rows, err := r.pool.Query(ctx, `
		SELECT j.id, j.status, j.error, j.analysis_duration_sec, j.created_at, j.title, j.artist, a.result
		FROM jobs j
		LEFT JOIN analyses a ON a.audio_id = j.audio_id || '_' || j.language
		WHERE ($1 = '' OR j.status = $1)
		ORDER BY j.created_at DESC
		LIMIT $2 OFFSET $3
	`, status, limit, offset)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list history: %w", err)
	}
	defer rows.Close()

	// Initialized, not `var jobs []contracts.Job`, so zero rows still
	// JSON-marshal as `[]` — apps/web calls `.map` on it unconditionally.
	jobs := []contracts.Job{}
	for rows.Next() {
		job, err := scanJobRow(rows)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan job row: %w", err)
		}
		jobs = append(jobs, *job)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed to list history: %w", err)
	}
	return jobs, total, nil
}

// JobRedisCache implements biz.JobCache, sharing RedisCache's client.
type JobRedisCache struct {
	*RedisCache
}

// NewJobRedisCache wraps an existing RedisCache as a JobRedisCache.
func NewJobRedisCache(cache *RedisCache) *JobRedisCache {
	return &JobRedisCache{RedisCache: cache}
}

// SetJobStatus writes job:{id}:status with a 1-day TTL.
func (c *JobRedisCache) SetJobStatus(ctx context.Context, jobID string, status contracts.JobStatus) error {
	if err := c.client.Set(ctx, jobStatusKey(jobID), string(status), jobStatusTTL).Err(); err != nil {
		return fmt.Errorf("failed to set job status cache: %w", err)
	}
	return nil
}

// GetJobStatus reads job:{id}:status, for the SSE handler to poll; a miss
// returns an empty string.
func (c *JobRedisCache) GetJobStatus(ctx context.Context, jobID string) (contracts.JobStatus, error) {
	status, err := c.client.Get(ctx, jobStatusKey(jobID)).Result()
	if errors.Is(err, redis.Nil) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("failed to get job status cache: %w", err)
	}
	return contracts.JobStatus(status), nil
}

func jobStatusKey(jobID string) string {
	return "job:" + jobID + ":status"
}

// scanJobRow scans the jobs LEFT JOIN analyses row shape shared by
// GetJob/ListJob into a contracts.Job. a.result is NULL (nil []byte) when
// there's no matching analyses row yet.
func scanJobRow(row scanRow) (*contracts.Job, error) {
	var (
		job        contracts.Job
		errMsg     *string
		duration   *float64
		createdAt  time.Time
		resultJSON []byte
	)
	if err := row.Scan(&job.ID, &job.Status, &errMsg, &duration, &createdAt, &job.Title, &job.Artist, &resultJSON); err != nil {
		return nil, err
	}

	if errMsg != nil {
		job.Error = *errMsg
	}
	job.AnalysisDurationSec = duration
	job.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	if resultJSON != nil {
		var result contracts.AnalysisResult
		if err := json.Unmarshal(resultJSON, &result); err != nil {
			return nil, fmt.Errorf("failed to unmarshal analysis result: %w", err)
		}
		job.Result = &result
	}
	return &job, nil
}
