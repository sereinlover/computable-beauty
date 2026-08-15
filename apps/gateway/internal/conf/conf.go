// Package conf reads the gateway's runtime configuration.
package conf

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

// Config is the gateway's runtime configuration, sourced from environment
// variables (repo-root .env.local, or whatever the process already has set).
type Config struct {
	ListenAddr    string // ":" + GATEWAY_PORT (binds all interfaces)
	DatabaseURL   string
	RedisURL      string
	EngineURL     string
	InternalToken string
	UploadDir     string // where uploaded audio is stored; overridden to /data/uploads in containers
	HasOpenAIKey  bool   // OPENAI_API_KEY set and non-empty — Engine owns the actual key, Gateway only needs to know whether to call /internal/explain at all (see biz.Worker.runPipeline)
}

// Load tries the repo-root .env.local first (local dev only — missing is not
// an error, since containers get their env from docker-compose.base.yml's
// env_file: .env instead), then assembles Config from environment variables.
func Load() (*Config, error) {
	_ = godotenv.Load(repoRootEnvPath())

	cfg := &Config{
		ListenAddr:    ":" + os.Getenv("GATEWAY_PORT"),
		DatabaseURL:   os.Getenv("DATABASE_URL"),
		RedisURL:      os.Getenv("REDIS_URL"),
		EngineURL:     os.Getenv("ENGINE_URL"),
		InternalToken: os.Getenv("INTERNAL_TOKEN"),
		UploadDir:     uploadDir(),
		HasOpenAIKey:  os.Getenv("OPENAI_API_KEY") != "",
	}

	if cfg.DatabaseURL == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set")
	}
	if cfg.RedisURL == "" {
		return nil, fmt.Errorf("REDIS_URL is not set")
	}
	if cfg.EngineURL == "" {
		return nil, fmt.Errorf("ENGINE_URL is not set")
	}
	if cfg.InternalToken == "" {
		return nil, fmt.Errorf("INTERNAL_TOKEN is not set")
	}

	return cfg, nil
}

// repoRootEnvPath locates the repo-root .env.local relative to this source
// file, independent of the process's working directory.
func repoRootEnvPath() string {
	return filepath.Join(repoRoot(), ".env.local")
}

// uploadDir prefers the UPLOAD_DIR env var (set to /data/uploads under Docker
// Compose, a shared volume mount); falls back to repo-root data/uploads/ for
// local dev, where Engine and Gateway both run on the host and can share a
// plain directory instead.
func uploadDir() string {
	if dir := os.Getenv("UPLOAD_DIR"); dir != "" {
		return dir
	}
	return filepath.Join(repoRoot(), "data", "uploads")
}

// repoRoot walks up from the working directory to find .env.example, the
// repo root's marker file — works regardless of where `go run` is launched
// from, and doesn't break if this package later moves to a different
// directory depth.
func repoRoot() string {
	dir, err := os.Getwd()
	if err != nil {
		return "."
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, ".env.example")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "." // reached filesystem root without finding it
		}
		dir = parent
	}
}
