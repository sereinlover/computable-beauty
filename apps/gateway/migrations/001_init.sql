-- Mirrors doc/architecture.md's "PostgreSQL" section — keep both in sync by hand.
--
-- This file is embedded into the gateway binary (migrations/migrations.go)
-- and re-run on every startup (data.PostgresStore.Migrate) — every statement
-- must stay idempotent (IF NOT EXISTS). CREATE TABLE IF NOT EXISTS only
-- covers "table doesn't exist yet"; it's a no-op on a table that already
-- exists, so it will NOT add a new column to an existing table. When adding
-- a column, add it to the CREATE TABLE definition below (for fresh
-- databases) AND add a matching `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`
-- statement (for databases that already have the table), e.g.:
--
--   ALTER TABLE jobs ADD COLUMN IF NOT EXISTS foo TEXT NOT NULL DEFAULT '';
--
-- This only covers adding columns. Renaming/dropping/retyping a column, or
-- migrating existing data, needs hand-written SQL beyond this pattern.

-- Audio analysis results, content-addressed, one row per audio_id. Doesn't
-- store title/artist — each job shows its own upload's title/artist (see the
-- jobs table below), independent of this content-dedup table.
--
-- The audio_id column actually stores "<content SHA-256>_<language>" (see
-- biz/pipeline.go's analysisKey), not a bare content hash — Chinese and
-- English are treated as "different content" and get their own row each, so
-- L4 (LLM-generated text) can be generated per language without a separate
-- table or splitting this row. The cost: switching language for the same
-- audio recomputes L1-L3 too (language-independent, deterministic) — an
-- accepted simplification; revisit splitting this out if that recompute
-- cost becomes a real problem.
CREATE TABLE IF NOT EXISTS analyses (
    audio_id              TEXT         PRIMARY KEY, -- "<content SHA-256>_<zh|en>"
    result                JSONB        NOT NULL,    -- full AnalysisResult (result.audio_id is the real content hash, no language suffix)
    analyzed_at           TIMESTAMPTZ  NOT NULL     -- when this analysis was first completed
);

-- One row per upload request
CREATE TABLE IF NOT EXISTS jobs (
    id                    UUID         PRIMARY KEY,
    audio_id              CHAR(64)     NOT NULL,    -- links to analyses, no FK (a failed job has no matching analyses row)
    audio_path            TEXT         NOT NULL,    -- absolute path of the file on disk; the worker reads this once it picks up this pending job
    title                 TEXT         NOT NULL,    -- read from ID3/filename at upload time; each job stores its own copy
    artist                TEXT         NOT NULL DEFAULT '', -- same as above; empty string when there's no ID3 artist tag
    language              TEXT         NOT NULL DEFAULT 'en', -- which language this analysis's explanation should be generated in ("zh" | "en")
    status                TEXT         NOT NULL,    -- pending | processing | done | failed
    error                 TEXT,                     -- error message, set when status=failed
    created_at            TIMESTAMPTZ  NOT NULL,
    analysis_duration_sec FLOAT                     -- this pipeline run's duration (seconds)
);

CREATE INDEX IF NOT EXISTS idx_jobs_audio_id ON jobs (audio_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at DESC);
