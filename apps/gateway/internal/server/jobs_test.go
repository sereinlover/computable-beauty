package server

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http/httptest"
	"runtime"
	"testing"
	"time"

	"github.com/computable-beauty/contracts"
	"github.com/computable-beauty/gateway/internal/biz"
	"github.com/computable-beauty/gateway/internal/service"
)

type fakeJobStore struct {
	createdJob *biz.JobRecord
}

func (f *fakeJobStore) CreateJob(ctx context.Context, job biz.JobRecord) error {
	f.createdJob = &job
	return nil
}

func (f *fakeJobStore) UpdateJob(context.Context, string, contracts.JobStatus, string, *float64) error {
	return nil
}

func (f *fakeJobStore) GetJob(context.Context, string) (*contracts.Job, error) {
	return nil, nil
}

func (f *fakeJobStore) ListJob(context.Context, contracts.JobStatus, int, int) ([]contracts.Job, int, error) {
	return nil, 0, nil
}

func (f *fakeJobStore) NextJob(context.Context) (biz.JobRecord, bool, error) {
	return biz.JobRecord{}, false, nil
}

func (f *fakeJobStore) RequeueStuckJobs(context.Context) ([]string, error) {
	return nil, nil
}

// jobCache and engine are nil: handleSubmitJob never touches them.
func newTestServer(t *testing.T) (*Server, *fakeJobStore) {
	t.Helper()
	js := &fakeJobStore{}
	svc := service.NewJobService(js, nil, nil)
	return &Server{JobSvc: svc, UploadDir: t.TempDir()}, js
}

// submitJob POSTs body to handleSubmitJob directly and returns the recorded response.
func submitJob(t *testing.T, s *Server, body io.Reader, contentType string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("POST", "/api/jobs", body)
	req.Header.Set("Content-Type", contentType)
	rec := httptest.NewRecorder()
	s.handleSubmitJob(rec, req)
	return rec
}

func buildMultipartBody(t *testing.T, filename string, content []byte, language string) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	fw, err := w.CreateFormFile("audio", filename)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := fw.Write(content); err != nil {
		t.Fatal(err)
	}
	if language != "" {
		if err := w.WriteField("language", language); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return body, w.FormDataContentType()
}

func TestHandleSubmitJobStreamingUpload(t *testing.T) {
	s, js := newTestServer(t)
	content := bytes.Repeat([]byte("x"), 5*1024*1024) // big enough to exercise real streaming
	body, contentType := buildMultipartBody(t, "song.mp3", content, "zh")

	rec := submitJob(t, s, body, contentType)

	if rec.Code != 200 {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if js.createdJob == nil {
		t.Fatal("CreateJob was never called")
	}
	if js.createdJob.Language != "zh" {
		t.Errorf("Language = %q, want zh", js.createdJob.Language)
	}
	if js.createdJob.AudioPath == "" {
		t.Error("AudioPath is empty")
	}
}

func TestHandleSubmitJobMissingAudioField(t *testing.T) {
	s, _ := newTestServer(t)
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	_ = w.WriteField("language", "en")
	_ = w.Close()

	rec := submitJob(t, s, body, w.FormDataContentType())

	if rec.Code != 400 {
		t.Fatalf("status = %d, want 400, body = %s", rec.Code, rec.Body.String())
	}
}

func TestHandleSubmitJobUnsupportedFormat(t *testing.T) {
	s, _ := newTestServer(t)
	body, contentType := buildMultipartBody(t, "song.exe", []byte("not audio"), "en")

	rec := submitJob(t, s, body, contentType)

	if rec.Code != 400 {
		t.Fatalf("status = %d, want 400, body = %s", rec.Code, rec.Body.String())
	}
}

func TestHandleSubmitJobDefaultLanguage(t *testing.T) {
	s, js := newTestServer(t)
	body, contentType := buildMultipartBody(t, "song.mp3", []byte("fake mp3 content"), "")

	rec := submitJob(t, s, body, contentType)

	if rec.Code != 200 {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if js.createdJob.Language != languageEN {
		t.Errorf("Language = %q, want %q", js.createdJob.Language, languageEN)
	}
}

// zeroReader is an infinite stream of zero bytes, for generating a huge
// upload body on the fly instead of holding it in a real byte slice.
type zeroReader struct{}

func (zeroReader) Read(p []byte) (int, error) {
	clear(p)
	return len(p), nil
}

// bigMultipartBody streams size bytes through an io.Pipe rather than
// buffering them, so the request body never inflates the test's own memory.
func bigMultipartBody(t *testing.T, size int64, language string) (*io.PipeReader, string) {
	t.Helper()
	pr, pw := io.Pipe()
	mw := multipart.NewWriter(pw)

	go func() {
		fw, err := mw.CreateFormFile("audio", "big.mp3")
		if err == nil {
			_, err = io.CopyN(fw, zeroReader{}, size)
		}
		if err == nil && language != "" {
			err = mw.WriteField("language", language)
		}
		if err == nil {
			err = mw.Close()
		}
		_ = pw.CloseWithError(err)
	}()

	return pr, mw.FormDataContentType()
}

// peakHeap runs fn while sampling runtime.MemStats.HeapAlloc in the
// background, returning the highest value observed.
func peakHeap(fn func()) uint64 {
	stop, done := make(chan struct{}), make(chan struct{})
	var peak uint64
	go func() {
		defer close(done)
		ticker := time.NewTicker(5 * time.Millisecond)
		defer ticker.Stop()
		var m runtime.MemStats
		for {
			runtime.ReadMemStats(&m)
			if m.HeapAlloc > peak {
				peak = m.HeapAlloc
			}
			select {
			case <-stop:
				return
			case <-ticker.C:
			}
		}
	}()

	fn()
	close(stop)
	<-done // wait so peak is no longer written before we read it below
	return peak
}

func TestHandleSubmitJobLargeUploadStaysMemoryBounded(t *testing.T) {
	if testing.Short() {
		t.Skip("streams and hashes ~1GB to disk, skipped with -short")
	}

	const uploadSize = 900 << 20    // shy of maxUploadSize (1GiB) to leave room for multipart framing overhead
	const maxHeapGrowth = 100 << 20 // generous but far below uploadSize; catches "buffered the whole file again"

	s, js := newTestServer(t)
	body, contentType := bigMultipartBody(t, uploadSize, "zh")

	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)

	var rec *httptest.ResponseRecorder
	peak := peakHeap(func() { rec = submitJob(t, s, body, contentType) })

	if rec.Code != 200 {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if js.createdJob == nil || js.createdJob.AudioPath == "" {
		t.Fatal("upload was not saved")
	}

	growth := peak - before.HeapAlloc
	t.Logf("uploaded %.0fMB, peak heap growth %.1fMB", float64(uploadSize)/1e6, float64(growth)/1e6)
	if growth > maxHeapGrowth {
		t.Errorf("heap grew %.1fMB during a %.0fMB upload — expected streaming to keep this small",
			float64(growth)/1e6, float64(uploadSize)/1e6)
	}
}
