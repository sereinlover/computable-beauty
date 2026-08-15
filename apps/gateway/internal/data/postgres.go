// Package data implements the internal/biz interfaces (the adapter layer).
package data

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/computable-beauty/gateway/migrations"
)

// PostgresStore holds the connection pool shared by JobPostgresStore and
// AnalysisPostgresStore.
type PostgresStore struct {
	pool *pgxpool.Pool
}

// NewPostgresStore opens a connection pool to Postgres.
func NewPostgresStore(ctx context.Context, databaseURL string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres: %w", err)
	}
	return &PostgresStore{pool: pool}, nil
}

// Close closes the underlying connection pool.
func (r *PostgresStore) Close() {
	r.pool.Close()
}

// Ping backs the /health endpoint's connectivity check.
func (r *PostgresStore) Ping(ctx context.Context) error {
	return r.pool.Ping(ctx)
}

// Migrate applies the embedded schema — every statement is CREATE
// TABLE/INDEX IF NOT EXISTS, safe to call on every startup.
func (r *PostgresStore) Migrate(ctx context.Context) error {
	if _, err := r.pool.Exec(ctx, migrations.InitSQL); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}
	return nil
}

// scanRow is the minimal interface shared by pgx.Row (QueryRow) and pgx.Rows
// (each row while iterating a Query), letting job.go's scanJobRow reuse one
// Scan implementation for both.
type scanRow interface {
	Scan(dest ...any) error
}
