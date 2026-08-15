package server

import (
	"encoding/json"
	"net/http"
)

// apiResponse is the {code, message, data} envelope every /api/* endpoint
// responds with — apps/web has one shape to parse for both success and
// failure, branching on code rather than on HTTP status or response shape.
type apiResponse struct {
	Code    Code   `json:"code"`
	Message string `json:"message"`
	Data    any    `json:"data,omitempty"`
}

// writeData writes a success response: code=CodeOK, empty message, data populated.
func writeData(w http.ResponseWriter, data any) {
	writeJSON(w, CodeOK.httpStatus(), apiResponse{Code: CodeOK, Data: data})
}

// writeErrCode writes the envelope for a failed request: the given error
// code, its registered message, and no data.
func writeErrCode(w http.ResponseWriter, code Code) {
	message, ok := errCodeMessages[code]
	if !ok {
		message = errCodeFallbackMessage
	}
	writeJSON(w, code.httpStatus(), apiResponse{Code: code, Message: message})
}

// writeJSON writes body as JSON with the given status code and a
// Content-Type: application/json header — the one place every handler in
// this package goes through to respond, instead of repeating those three
// lines at each call site.
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
