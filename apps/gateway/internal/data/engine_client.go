package data

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/computable-beauty/contracts"
	"github.com/computable-beauty/gateway/internal/biz"
)

// engineRequestTimeout bounds every /internal/* call — generous because
// /internal/explain runs a real LLM tool-use loop, much slower than the
// other three. Kept above harness/orchestrator.py's own OpenAI timeout (8
// minutes) so a slow LLM call fails on the Engine side first, not here.
const engineRequestTimeout = 10 * time.Minute

// HTTPEngineClient implements biz.EngineClient over HTTP against apps/engine's
// /internal/* endpoints.
type HTTPEngineClient struct {
	baseURL       string
	internalToken string
	httpClient    *http.Client
}

// NewHTTPEngineClient builds an Engine client pointed at baseURL (ENGINE_URL).
func NewHTTPEngineClient(baseURL, internalToken string) *HTTPEngineClient {
	return &HTTPEngineClient{
		baseURL:       baseURL,
		internalToken: internalToken,
		httpClient:    &http.Client{Timeout: engineRequestTimeout},
	}
}

func (c *HTTPEngineClient) ExtractFeatures(ctx context.Context, audioID, audioPath string) (*contracts.FeatureSummary, error) {
	reqBody := map[string]string{"audio_id": audioID, "audio_path": audioPath}
	var result contracts.FeatureSummary
	if err := c.post(ctx, "/internal/extract-features", reqBody, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *HTTPEngineClient) Classify(
	ctx context.Context, audioID, audioPath string, fs *contracts.FeatureSummary,
) (*contracts.UnderstandingBundle, error) {
	reqBody := map[string]any{"audio_id": audioID, "audio_path": audioPath, "feature_summary": fs}
	var result contracts.UnderstandingBundle
	if err := c.post(ctx, "/internal/classify", reqBody, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *HTTPEngineClient) ScoreAesthetics(
	ctx context.Context, audioID, audioPath string,
	fs *contracts.FeatureSummary, ub *contracts.UnderstandingBundle,
) (*contracts.AestheticBundle, error) {
	reqBody := map[string]any{
		"audio_id": audioID, "audio_path": audioPath,
		"feature_summary": fs, "understanding": ub,
	}
	var result contracts.AestheticBundle
	if err := c.post(ctx, "/internal/score-aesthetics", reqBody, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *HTTPEngineClient) Explain(ctx context.Context, req biz.EngineExplainRequest) (*contracts.AnalysisResult, error) {
	reqBody := map[string]any{
		"audio_id": req.AudioID, "audio_path": req.AudioPath, "job_id": req.JobID, "language": req.Language,
		"feature_summary": req.FeatureSummary, "understanding": req.Understanding, "aesthetic": req.Aesthetic,
	}
	var result contracts.AnalysisResult
	if err := c.post(ctx, "/internal/explain", reqBody, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func (c *HTTPEngineClient) Chat(ctx context.Context, req biz.EngineChatRequest) (string, error) {
	reqBody := map[string]any{
		"audio_id": req.AudioID, "question": req.Question, "language": req.Language,
		"feature_summary": req.FeatureSummary, "understanding": req.Understanding, "aesthetic": req.Aesthetic,
		"summary": req.Summary, "explanation": req.Explanation,
	}
	var result contracts.ChatResponse
	if err := c.post(ctx, "/internal/chat", reqBody, &result); err != nil {
		return "", err
	}
	return result.Answer, nil
}

// post is the shared request logic for all five /internal/* endpoints:
// marshal the body, attach X-Internal-Token, unmarshal the response; a
// non-2xx status gets its message parsed out of the standard error response
// shape and folded into the returned error.
func (c *HTTPEngineClient) post(ctx context.Context, path string, reqBody, respBody any) error {
	reqJSON, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("failed to marshal request body for %s: %w", path, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(reqJSON))
	if err != nil {
		return fmt.Errorf("failed to build request for %s: %w", path, err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Internal-Token", c.internalToken)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call %s: %w: %w", path, biz.ErrEngineUnreachable, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var apiErr struct {
			Error   string `json:"error"`
			Message string `json:"message"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&apiErr)
		return fmt.Errorf("%s returned %d: %s", path, resp.StatusCode, apiErr.Message)
	}

	if err := json.NewDecoder(resp.Body).Decode(respBody); err != nil {
		return fmt.Errorf("failed to decode response from %s: %w", path, err)
	}
	return nil
}
