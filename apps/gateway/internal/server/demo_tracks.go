package server

import (
	"net/http"

	"github.com/computable-beauty/contracts"
)

var demoTracks = []contracts.DemoTrack{
	{
		ID:          "aria",
		Title:       "Aria, BWV 988",
		Artist:      "Glenn Gould",
		DurationSec: 30, // real duration of apps/web/public/demo/aria.mp3, via ffprobe — a 30s preview clip, not the full track
		AudioURL:    "/demo/aria.mp3",
	},
	{
		ID:          "arioso",
		Title:       "Arioso, BWV 156",
		Artist:      "Julian Lloyd Webber",
		DurationSec: 30, // real duration of apps/web/public/demo/arioso.mp3, via ffprobe — a 30s preview clip, not the full track
		AudioURL:    "/demo/arioso.mp3",
	},
}

// handleDemoTracks handles GET /api/demo-tracks: a fixed list of tracks the
// UI offers as ready-to-analyze samples, no upload required.
func (s *Server) handleDemoTracks(w http.ResponseWriter, r *http.Request) {
	writeData(w, contracts.DemoTracksResponse{Tracks: demoTracks})
}
