package biz

import "errors"

// ErrJobNotFound is the sentinel JobStore.GetJob returns when a job doesn't
// exist, for callers to check with errors.Is.
var ErrJobNotFound = errors.New("job not found")
