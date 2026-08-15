// Package server is the pure transport layer: chi routing plus HTTP
// param parsing/response encoding, no business logic. Business logic lives in
// internal/service; server just calls it and writes the result as HTTP.
package server

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/computable-beauty/gateway/internal/data"
	"github.com/computable-beauty/gateway/internal/service"
)

// Server holds the chi router and its dependencies. Construct with
// Server{...} named fields and pass to New, mirroring the stdlib http.Server
// pattern.
type Server struct {
	// PG/Redis back only the /health endpoint's connectivity check — Ping is a
	// connection-level check, not a business method, so it bypasses service.
	PG    *data.PostgresStore
	Redis *data.RedisCache

	JobSvc *service.JobService

	// UploadDir is where uploaded audio files are stored.
	UploadDir string

	router *chi.Mux
}

// New assembles the chi router from the given dependencies and mounts
// middleware and routes.
func New(s Server) *Server {
	s.router = chi.NewRouter()

	s.router.Use(middleware.Logger)
	s.router.Use(middleware.Recoverer)

	s.router.Get("/health", s.handleHealth)
	s.router.Post("/api/jobs", s.handleSubmitJob)
	s.router.Get("/api/jobs", s.handleListJob)
	s.router.Get("/api/jobs/{id}", s.handleGetJob)
	s.router.Get("/api/jobs/{id}/stream", s.handleJobStream)
	s.router.Post("/api/jobs/{id}/chat", s.handleChat)
	s.router.Get("/api/demo-tracks", s.handleDemoTracks)

	return &s
}

// Router returns a handler ready to pass to http.ListenAndServe.
func (s *Server) Router() http.Handler {
	return s.router
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	status := http.StatusOK
	body := map[string]string{"status": "ok"}

	if err := s.PG.Ping(ctx); err != nil {
		status = http.StatusServiceUnavailable
		body = map[string]string{"status": "error", "error": "postgres: " + err.Error()}
	} else if err := s.Redis.Ping(ctx); err != nil {
		status = http.StatusServiceUnavailable
		body = map[string]string{"status": "error", "error": "redis: " + err.Error()}
	}

	writeJSON(w, status, body)
}
