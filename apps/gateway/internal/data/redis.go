package data

import (
	"context"
	"fmt"

	"github.com/redis/go-redis/v9"
)

// RedisCache holds the client shared by JobRedisCache and AnalysisRedisCache.
type RedisCache struct {
	client *redis.Client
}

// NewRedisCache builds a Redis client from REDIS_URL, wrapped as RedisCache.
func NewRedisCache(redisURL string) (*RedisCache, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse redis url: %w", err)
	}
	return &RedisCache{client: redis.NewClient(opt)}, nil
}

// Close closes the underlying Redis client.
func (c *RedisCache) Close() error {
	return c.client.Close()
}

// Ping backs the /health endpoint's connectivity check.
func (c *RedisCache) Ping(ctx context.Context) error {
	return c.client.Ping(ctx).Err()
}
