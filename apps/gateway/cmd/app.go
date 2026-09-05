package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/computable-beauty/gateway/internal/biz"
	"github.com/computable-beauty/gateway/internal/conf"
	"github.com/computable-beauty/gateway/internal/data"
	"github.com/computable-beauty/gateway/internal/server"
	"github.com/computable-beauty/gateway/internal/service"
)

// app bundles a not-yet-started HTTP server, a not-yet-started background
// worker, and a cleanup to release underlying connections on shutdown.
type app struct {
	httpServer *http.Server
	worker     *biz.Worker
	cleanup    func()
}

// newApp wires the gateway's full dependency graph: connect to Postgres/Redis,
// build the biz-interface implementations on top of them, and assemble the
// service layer, worker, and HTTP server around them.
func newApp(ctx context.Context, cfg *conf.Config) (*app, error) {
	pgStore, err := data.NewPostgresStore(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres: %w", err)
	}
	if err := pgStore.Migrate(ctx); err != nil {
		pgStore.Close()
		return nil, err
	}
	log.Printf("database schema migrated")

	redisCache, err := data.NewRedisCache(cfg.RedisURL)
	if err != nil {
		pgStore.Close()
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	// Built once and shared: JobService and Worker both depend on all four.
	jobPGStore := data.NewJobPostgresStore(pgStore)
	jobRedisCache := data.NewJobRedisCache(redisCache)
	analysisPGStore := data.NewAnalysisPostgresStore(pgStore)
	analysisRedisCache := data.NewAnalysisRedisCache(redisCache)
	engineClient := data.NewHTTPEngineClient(cfg.EngineURL, cfg.InternalToken)

	// Requeues any job orphaned at status=processing by a previous crash/
	// restart before it can sort to the front of apps/web's queue view —
	// see biz.JobStore.RequeueStuckJobs.
	if titles, err := jobPGStore.RequeueStuckJobs(ctx); err != nil {
		pgStore.Close()
		return nil, fmt.Errorf("failed to requeue stuck jobs: %w", err)
	} else if len(titles) > 0 {
		log.Printf("requeued %d job(s) stuck at status=processing from a previous run: %v", len(titles), titles)
	}

	jobSvc := service.NewJobService(jobPGStore, jobRedisCache, engineClient)
	srv := server.New(server.Server{
		PG:        pgStore,
		Redis:     redisCache,
		JobSvc:    jobSvc,
		UploadDir: cfg.UploadDir,
	})

	worker := biz.NewWorker(biz.Worker{
		JobStore:      jobPGStore,
		JobCache:      jobRedisCache,
		AnalysisStore: analysisPGStore,
		AnalysisCache: analysisRedisCache,
		Engine:        engineClient,
		HasOpenAIKey:  cfg.HasOpenAIKey,
	})

	return &app{
		httpServer: &http.Server{
			Addr:    cfg.ListenAddr,
			Handler: srv.Router(),
		},
		worker: worker,
		cleanup: func() {
			pgStore.Close()
			_ = redisCache.Close()
		},
	}, nil
}
