package server

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/computable-beauty/contracts"
)

const (
	// ssePollInterval is how often handleJobStream re-checks the cache — kept
	// separate from biz.WorkerPollInterval since the two loops poll different
	// things.
	ssePollInterval = 5 * time.Second

	// sseMaxDuration bounds how long one connection stays open, so a job
	// stuck behind a long queue doesn't hold it indefinitely.
	sseMaxDuration = 5 * time.Minute

	// sseRetryAfterSec is how long the client waits before reconnecting after
	// a timeout event.
	sseRetryAfterSec = 60

	// sseProgressDone is the Progress value sent with the done event — not in
	// sseStepInfo since done is its own switch case, not a processing step.
	sseProgressDone = 1.0
)

const (
	// ssePendingMessage is sent once when the stream opens if the worker
	// hasn't picked up the job yet, so the connection doesn't look stuck.
	ssePendingMessage = "Waiting in queue..."

	// sseFailedMessage is generic — the cached status only holds "failed",
	// not the error detail (that's jobs.error in the store).
	sseFailedMessage = "Analysis failed, please try again."

	// sseTimeoutMessage tells the client to reconnect after sseRetryAfterSec.
	sseTimeoutMessage = "Still waiting — please reconnect shortly."
)

// SSE event names (the `event:` line's value) — this transport's own
// protocol constants, distinct from contracts.JobStatus. sseEventProcessing
// covers all four progress sub-steps (see sseStepInfo); the client
// subscribes to each event name separately via EventSource.addEventListener.
const (
	sseEventPending    = "pending"
	sseEventProcessing = "processing"
	sseEventDone       = "done"
	sseEventFailed     = "failed"
	sseEventTimeout    = "timeout"
)

// sseStepInfo maps a contracts.JobStatus to the message/progress shown for
// that step; the status value itself doubles as the SSE event's "step" field
// — no separate translation table needed.
var sseStepInfo = map[contracts.JobStatus]struct {
	Message  string
	Progress float64
}{
	contracts.JobStatusExtracting:     {"Extracting audio features...", 0.2},
	contracts.JobStatusClassifying:    {"Classifying genre and emotion...", 0.5},
	contracts.JobStatusScoring:        {"Scoring aesthetics...", 0.8},
	contracts.JobStatusExplaining:     {"Generating explanation...", 0.9},
	contracts.JobStatusExplainSkipped: {"Skipping AI explanation (no API key configured)...", 0.9},
}

// handleJobStream handles GET /api/jobs/{id}/stream: polls the cached job
// status and pushes an SSE event each time it changes, until the job reaches
// done or failed. Runs entirely in the request's own goroutine (no extra
// goroutine spawned) — returning from the handler is enough to release
// everything, and the loop itself exits as soon as the client disconnects
// (ctx.Done()) or a terminal status is reached.
func (s *Server) handleJobStream(w http.ResponseWriter, r *http.Request) {
	jobID := chi.URLParam(r, "id")
	ctx := r.Context()

	flusher, ok := w.(http.Flusher)
	if !ok {
		writeErrCode(w, ErrCodeStreamingUnsupported)
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.WriteHeader(http.StatusOK)
	flusher.Flush()

	ticker := time.NewTicker(ssePollInterval)
	defer ticker.Stop()

	timeout := time.NewTimer(sseMaxDuration)
	defer timeout.Stop()

	var lastStatus contracts.JobStatus
	sentPending := false

	// checkAndEmit reads the current cached status and, if it's new, writes
	// the matching SSE event. Returns true once a terminal event (done/failed)
	// has been sent, telling the caller to stop.
	checkAndEmit := func() (terminal bool) {
		status, err := s.JobSvc.GetJobStatus(ctx, jobID)
		if err != nil {
			log.Printf("job %s: sse failed to read status cache: %v", jobID, err)
			return false
		}
		if status == "" {
			// Not in the cache yet: the worker hasn't picked this job up off
			// the pending queue. Tell the client once so the connection
			// doesn't look stuck, then keep waiting silently.
			if !sentPending {
				sentPending = true
				writeSSEEvent(w, flusher, sseEventPending, contracts.SSEEvent{
					Step:    contracts.JobStatusPending,
					Message: ssePendingMessage,
				})
			}
			return false
		}
		if status == lastStatus {
			return false
		}
		lastStatus = status

		switch status {
		case contracts.JobStatusDone:
			writeSSEEvent(w, flusher, sseEventDone, contracts.SSEEvent{Step: status, Progress: sseProgressDone})
			return true
		case contracts.JobStatusFailed:
			writeSSEEvent(w, flusher, sseEventFailed, contracts.SSEEvent{Step: status, Message: sseFailedMessage})
			return true
		default:
			info, ok := sseStepInfo[status]
			if !ok {
				log.Printf("job %s: sse got unrecognized status %q, skipping", jobID, status)
				return false
			}
			writeSSEEvent(w, flusher, sseEventProcessing, contracts.SSEEvent{Step: status, Message: info.Message, Progress: info.Progress})
			return false
		}
	}

	// Checked once immediately, before the first tick — a client that opens
	// this connection well after the job started (e.g. apps/web restoring an
	// in-flight job on page refresh) would otherwise see the job sitting at
	// its default "queued" state for up to ssePollInterval even though it's
	// already past that step.
	if checkAndEmit() {
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		case <-timeout.C:
			writeSSEEvent(w, flusher, sseEventTimeout, contracts.SSEEvent{
				Message:       sseTimeoutMessage,
				RetryAfterSec: sseRetryAfterSec,
			})
			return
		case <-ticker.C:
		}

		if checkAndEmit() {
			return
		}
	}
}

// writeSSEEvent writes one `text/event-stream` event: an `event:` line
// followed by `data: <json>`, then flushes so the browser sees it immediately
// instead of sitting in a buffer.
func writeSSEEvent(w http.ResponseWriter, flusher http.Flusher, eventType string, event contracts.SSEEvent) {
	payload, err := json.Marshal(event)
	if err != nil {
		log.Printf("failed to marshal sse event: %v", err)
		return
	}
	_, _ = w.Write([]byte("event: " + eventType + "\n"))
	_, _ = w.Write([]byte("data: "))
	_, _ = w.Write(payload)
	_, _ = w.Write([]byte("\n\n"))
	flusher.Flush()
}
