package server

// Code is the numeric code in the gateway's {code, message, data} response
// envelope to the web frontend — the stable contract the web frontend
// branches on by number. It's distinct from internal errors like
// biz.ErrJobNotFound: those are only ever checked with errors.Is inside Go
// code and never serialized to JSON. Handlers translate a biz-layer error
// into the matching Code before returning — that translation is server's
// job, not biz's.
//
// Numbering: prefixed with the matching HTTP status (200xx/400xx/404xx/
// 500xx/...), numbered sequentially within a status. The status is
// therefore just the leading 3 digits of the code — see httpStatus().
type Code int

const (
	CodeOK Code = 20000

	ErrCodeInvalidUpload          Code = 40001 // request body isn't valid multipart/form-data, or exceeds 1GB
	ErrCodeMissingAudioFile       Code = 40002 // missing the 'audio' field
	ErrCodeUnsupportedAudioFormat Code = 40003 // audio format outside mp3/wav/flac/ogg
	ErrCodeInvalidChatRequest     Code = 40004 // request body isn't valid JSON matching ChatRequest
	ErrCodeChatNoResult           Code = 40005 // job has no analysis result yet, nothing to chat about
	ErrCodeJobNotFound            Code = 40401 // no job with the given id
	ErrCodeUploadSaveFailed       Code = 50001 // failed to save the uploaded file
	ErrCodeSubmitJobFailed        Code = 50002 // failed to create the job record
	ErrCodeStreamingUnsupported   Code = 50003 // http.ResponseWriter doesn't support flushing, can't stream SSE
	ErrCodeGetJobFailed           Code = 50004 // failed to look up the job
	ErrCodeListJobFailed          Code = 50005 // failed to list jobs
	ErrCodeChatFailed             Code = 50006 // Engine's /internal/chat call failed
)

// httpStatus derives the HTTP status straight from the code value
// (40003 / 100 = 400) instead of maintaining a separate code -> status
// table that could drift out of sync.
func (c Code) httpStatus() int {
	return int(c) / 100
}

// errCodeFallbackMessage is used when code has no entry in errCodeMessages —
// shouldn't happen, since every error Code in use should be registered there.
const errCodeFallbackMessage = "Internal server error."

// errCodeMessages holds each error Code's default English message.
var errCodeMessages = map[Code]string{
	ErrCodeInvalidUpload:          "The request body is not valid multipart/form-data, or the file exceeds 1GB.",
	ErrCodeMissingAudioFile:       "Missing the 'audio' field.",
	ErrCodeUnsupportedAudioFormat: "Unsupported audio format — only mp3/wav/flac/ogg are accepted.",
	ErrCodeInvalidChatRequest:     "The request body must be JSON with a 'question' field.",
	ErrCodeChatNoResult:           "This job doesn't have an analysis result yet.",
	ErrCodeJobNotFound:            "No job found with this id.",
	ErrCodeUploadSaveFailed:       "Failed to save the uploaded file.",
	ErrCodeSubmitJobFailed:        "Failed to create the analysis job.",
	ErrCodeStreamingUnsupported:   "Server does not support streaming responses.",
	ErrCodeGetJobFailed:           "Failed to look up the job.",
	ErrCodeListJobFailed:          "Failed to list jobs.",
	ErrCodeChatFailed:             "Failed to get a response from the assistant.",
}
