package data

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"

	"github.com/computable-beauty/contracts"
	"github.com/computable-beauty/gateway/internal/biz"
)

// analysisCacheTTL is the TTL for the Redis analysis:{audio_id} key.
const analysisCacheTTL = 7 * 24 * time.Hour

// AnalysisPostgresStore implements biz.AnalysisStore, sharing PostgresStore's
// connection pool.
type AnalysisPostgresStore struct {
	*PostgresStore
}

// NewAnalysisPostgresStore wraps an existing PostgresStore as an
// AnalysisPostgresStore.
func NewAnalysisPostgresStore(store *PostgresStore) *AnalysisPostgresStore {
	return &AnalysisPostgresStore{PostgresStore: store}
}

// FindAnalysis looks up analyses by audio_id; returns (nil, nil) on a miss.
func (r *AnalysisPostgresStore) FindAnalysis(ctx context.Context, audioID string) (*biz.AnalysisRecord, error) {
	var resultJSON []byte
	err := r.pool.QueryRow(ctx, `
		SELECT result FROM analyses WHERE audio_id = $1
	`, audioID).Scan(&resultJSON)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to find analysis: %w", err)
	}

	var result contracts.AnalysisResult
	if err := json.Unmarshal(resultJSON, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal analysis result: %w", err)
	}
	return &biz.AnalysisRecord{Result: &result}, nil
}

// SaveAnalysis inserts a result with ON CONFLICT DO NOTHING — the first write
// for a given audio_id wins.
func (r *AnalysisPostgresStore) SaveAnalysis(ctx context.Context, audioID string, record *biz.AnalysisRecord) error {
	resultJSON, err := json.Marshal(record.Result)
	if err != nil {
		return fmt.Errorf("failed to marshal analysis result: %w", err)
	}
	_, err = r.pool.Exec(ctx, `
		INSERT INTO analyses (audio_id, result, analyzed_at)
		VALUES ($1, $2, now())
		ON CONFLICT (audio_id) DO NOTHING
	`, audioID, resultJSON)
	if err != nil {
		return fmt.Errorf("failed to save analysis: %w", err)
	}
	return nil
}

// UpdateAnalysis overwrites an existing row's result (see biz.AnalysisStore
// for when this, not SaveAnalysis, is the right call). A no-match UPDATE
// isn't an error — callers only reach this after FindAnalysis confirmed the
// row exists.
func (r *AnalysisPostgresStore) UpdateAnalysis(ctx context.Context, audioID string, record *biz.AnalysisRecord) error {
	resultJSON, err := json.Marshal(record.Result)
	if err != nil {
		return fmt.Errorf("failed to marshal analysis result: %w", err)
	}
	_, err = r.pool.Exec(ctx, `
		UPDATE analyses SET result = $2, analyzed_at = now() WHERE audio_id = $1
	`, audioID, resultJSON)
	if err != nil {
		return fmt.Errorf("failed to update analysis: %w", err)
	}
	return nil
}

// AnalysisRedisCache implements biz.AnalysisCache, sharing RedisCache's client.
type AnalysisRedisCache struct {
	*RedisCache
}

// NewAnalysisRedisCache wraps an existing RedisCache as an AnalysisRedisCache.
func NewAnalysisRedisCache(cache *RedisCache) *AnalysisRedisCache {
	return &AnalysisRedisCache{RedisCache: cache}
}

// GetAnalysis reads the analysis:{audio_id} cache; returns (nil, nil) on a miss.
func (c *AnalysisRedisCache) GetAnalysis(ctx context.Context, audioID string) (*contracts.AnalysisResult, error) {
	raw, err := c.client.Get(ctx, analysisCacheKey(audioID)).Bytes()
	if errors.Is(err, redis.Nil) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get analysis cache: %w", err)
	}

	var result contracts.AnalysisResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal analysis cache: %w", err)
	}
	return &result, nil
}

// SetAnalysis writes the analysis:{audio_id} cache with a 7-day TTL.
func (c *AnalysisRedisCache) SetAnalysis(ctx context.Context, audioID string, result *contracts.AnalysisResult) error {
	raw, err := json.Marshal(result)
	if err != nil {
		return fmt.Errorf("failed to marshal analysis result: %w", err)
	}
	if err := c.client.Set(ctx, analysisCacheKey(audioID), raw, analysisCacheTTL).Err(); err != nil {
		return fmt.Errorf("failed to set analysis cache: %w", err)
	}
	return nil
}

func analysisCacheKey(audioID string) string {
	return "analysis:" + audioID
}
