// Package utils holds small business-agnostic helpers (hashing, ID3 tag parsing).
package utils

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

// HashAndSaveFile streams src to a temp file under destDir while hashing it
// with SHA-256, then atomically renames it to {sha256 hex}{ext} — avoids
// leaving a half-written file at the target path if the process crashes
// mid-write. The returned audioID is that hex SHA-256.
func HashAndSaveFile(src io.Reader, destDir, ext string) (audioID, path string, err error) {
	if err := os.MkdirAll(destDir, 0o755); err != nil {
		return "", "", fmt.Errorf("failed to create upload directory: %w", err)
	}

	tmp, err := os.CreateTemp(destDir, "upload-*.tmp")
	if err != nil {
		return "", "", fmt.Errorf("failed to create temp file: %w", err)
	}
	tmpPath := tmp.Name()
	defer func() {
		_ = tmp.Close()
		_ = os.Remove(tmpPath) // already gone after a successful rename; failing silently here is expected
	}()

	hasher := sha256.New()
	if _, err := io.Copy(io.MultiWriter(tmp, hasher), src); err != nil {
		return "", "", fmt.Errorf("failed to write upload to disk: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return "", "", fmt.Errorf("failed to close temp file: %w", err)
	}

	audioID = hex.EncodeToString(hasher.Sum(nil))
	finalPath := filepath.Join(destDir, audioID+ext)
	if err := os.Rename(tmpPath, finalPath); err != nil {
		return "", "", fmt.Errorf("failed to save upload file: %w", err)
	}

	return audioID, finalPath, nil
}
