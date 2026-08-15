package utils

import (
	"os"

	"github.com/dhowden/tag"
)

// ReadTitleArtist reads title/artist from an audio file's ID3/metadata tags.
// If the tags are missing or unreadable, title falls back to the
// caller-supplied fallbackTitle (usually the original filename without its
// extension) and artist is left empty.
func ReadTitleArtist(path, fallbackTitle string) (title, artist string) {
	f, err := os.Open(path)
	if err != nil {
		return fallbackTitle, ""
	}
	defer func() { _ = f.Close() }()

	meta, err := tag.ReadFrom(f)
	if err != nil {
		return fallbackTitle, ""
	}

	title = meta.Title()
	if title == "" {
		title = fallbackTitle
	}
	return title, meta.Artist()
}
