// Command gateway is the Computable Beauty Golang Gateway entry point.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"github.com/computable-beauty/gateway/internal/conf"
)

// workerShutdownTimeout bounds how long graceful shutdown waits for the
// worker's current job — a best-effort wait, not a hard block, since the job
// itself runs on context.Background() and ignores the shutdown signal.
const workerShutdownTimeout = 10 * time.Second

func main() {
	cfg, err := conf.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	// SIGINT/SIGTERM cancels ctx, triggering graceful shutdown below.
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	a, err := newApp(ctx, cfg)
	if err != nil {
		log.Fatalf("failed to start gateway: %v", err)
	}
	defer a.cleanup()

	go a.worker.Run(ctx)

	go func() {
		log.Printf("starting gateway on %s", cfg.ListenAddr)
		if err := a.httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("gateway server failed: %v", err)
		}
	}()

	<-ctx.Done()
	log.Printf("stopping gateway")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := a.httpServer.Shutdown(shutdownCtx); err != nil {
		log.Printf("gateway shutdown error: %v", err)
	}

	select {
	case <-a.worker.Done():
		log.Printf("worker stopped")
	case <-time.After(workerShutdownTimeout):
		log.Printf("worker did not stop within %s, exiting anyway", workerShutdownTimeout)
	}

	log.Printf("gateway stopped")
}
