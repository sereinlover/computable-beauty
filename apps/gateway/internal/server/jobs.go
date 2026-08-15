package server

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"path/filepath"
	"slices"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"github.com/computable-beauty/contracts"
	"github.com/computable-beauty/gateway/internal/biz"
	"github.com/computable-beauty/gateway/internal/service"
	"github.com/computable-beauty/gateway/internal/utils"
)

const (
	// maxUploadSize is POST /api/jobs's upload size limit (1GiB).
	maxUploadSize = 1 << 30

	audioFormField    = "audio"
	languageFormField = "language"

	// languageZH and languageEN are the only two values contracts.Job.Language
	// accepts; an unrecognized ?language= falls back to languageEN rather
	// than rejecting the request.
	languageZH = "zh"
	languageEN = "en"

	// defaultListJobLimit and maxListJobLimit are GET /api/jobs's ?limit=
	// default and clamp, so a caller can't pull the whole jobs table into
	// memory with e.g. limit=999999.
	defaultListJobLimit = 20
	maxListJobLimit     = 100
)

// allowedAudioExt is the set of audio formats POST /api/jobs accepts.
var allowedAudioExt = []string{".mp3", ".wav", ".flac", ".ogg"}

// handleSubmitJob handles POST /api/jobs: streams the multipart audio
// straight to disk while hashing it (see utils.HashAndSaveFile), then reads
// ID3 tags as title/artist candidates. Whether it's already analyzed and
// creating the job record are service.SubmitJob's job, not this handler's.
func (s *Server) handleSubmitJob(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	mr, err := r.MultipartReader()
	if err != nil {
		writeErrCode(w, ErrCodeInvalidUpload)
		return
	}

	var audioID, audioPath, filename, language string
	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			writeErrCode(w, ErrCodeInvalidUpload)
			return
		}

		switch part.FormName() {
		case audioFormField:
			filename = part.FileName()
			ext := strings.ToLower(filepath.Ext(filename))
			if !slices.Contains(allowedAudioExt, ext) {
				_ = part.Close()
				writeErrCode(w, ErrCodeUnsupportedAudioFormat)
				return
			}
			audioID, audioPath, err = utils.HashAndSaveFile(part, s.UploadDir, ext)
			_ = part.Close()
			if err != nil {
				log.Printf("failed to save uploaded audio: %v", err)
				writeErrCode(w, ErrCodeUploadSaveFailed)
				return
			}
		case languageFormField:
			buf, _ := io.ReadAll(part)
			language = string(buf)
			_ = part.Close()
		default:
			_ = part.Close()
		}
	}

	if audioPath == "" {
		writeErrCode(w, ErrCodeMissingAudioFile)
		return
	}

	fallbackTitle := strings.TrimSuffix(filename, filepath.Ext(filename))
	title, artist := utils.ReadTitleArtist(audioPath, fallbackTitle)

	if language != languageZH && language != languageEN {
		language = languageEN
	}

	job, err := s.JobSvc.SubmitJob(ctx, service.SubmitJobRequest{
		AudioID:   audioID,
		AudioPath: audioPath,
		Title:     title,
		Artist:    artist,
		Language:  language,
	})
	if err != nil {
		log.Printf("failed to submit job: %v", err)
		writeErrCode(w, ErrCodeSubmitJobFailed)
		return
	}

	writeData(w, job)
}

// handleGetJob handles GET /api/jobs/{id}: looks up a single job by id.
func (s *Server) handleGetJob(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	jobID := chi.URLParam(r, "id")

	job, err := s.JobSvc.GetJob(ctx, jobID)
	if errors.Is(err, biz.ErrJobNotFound) {
		writeErrCode(w, ErrCodeJobNotFound)
		return
	}
	if err != nil {
		log.Printf("failed to get job %s: %v", jobID, err)
		writeErrCode(w, ErrCodeGetJobFailed)
		return
	}

	writeData(w, job)
}

// handleListJob handles GET /api/jobs: a paginated list ordered by
// created_at DESC. Malformed ?limit=/?offset= fall back to the default
// instead of erroring. ?status= restricts the list; an unrecognized value
// just matches zero rows in Postgres, no whitelist needed here.
func (s *Server) handleListJob(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	limit := defaultListJobLimit
	if v, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && v > 0 {
		limit = v
	}
	if limit > maxListJobLimit {
		limit = maxListJobLimit
	}

	offset := 0
	if v, err := strconv.Atoi(r.URL.Query().Get("offset")); err == nil && v >= 0 {
		offset = v
	}

	status := contracts.JobStatus(r.URL.Query().Get("status"))

	result, err := s.JobSvc.ListJob(ctx, status, limit, offset)
	if err != nil {
		log.Printf("failed to list jobs: %v", err)
		writeErrCode(w, ErrCodeListJobFailed)
		return
	}

	writeData(w, result)
}

// handleChat handles POST /api/jobs/{id}/chat: a follow-up question answered
// against this job's own already-finished analysis.
func (s *Server) handleChat(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	jobID := chi.URLParam(r, "id")

	var req contracts.ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErrCode(w, ErrCodeInvalidChatRequest)
		return
	}

	log.Printf("job %s: chat question=%q language=%s", jobID, req.Question, req.Language)

	answer, err := s.JobSvc.Chat(ctx, jobID, req.Question, req.Language)
	if errors.Is(err, biz.ErrJobNotFound) {
		writeErrCode(w, ErrCodeJobNotFound)
		return
	}
	if errors.Is(err, service.ErrJobNotAnalyzed) {
		writeErrCode(w, ErrCodeChatNoResult)
		return
	}
	if err != nil {
		log.Printf("job %s: chat failed: %v", jobID, err)
		writeErrCode(w, ErrCodeChatFailed)
		return
	}

	writeData(w, contracts.ChatResponse{Answer: answer})
}
