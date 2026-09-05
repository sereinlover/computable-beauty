.PHONY: run build test lint lint-ci check-comments

run:
	go run ./cmd

build:
	go build -o bin/gateway ./cmd

test:
	go test ./...

lint: check-comments
	find . -name "*.go" | xargs goimports -w
	golangci-lint --version
	golangci-lint run -v

# Same as lint, but never rewrites files — a formatting fix that only shows up
# here means someone skipped `make lint` before pushing.
lint-ci: check-comments
	@files="$$(find . -name '*.go' | xargs goimports -l)"; \
	if [ -n "$$files" ]; then \
		echo "not goimports-formatted:"; \
		echo "$$files"; \
		exit 1; \
	fi
	golangci-lint run -v

# CLAUDE.md bans "Stage N" numbering and "currently mocked"-style comments —
# they describe transient state that goes stale once the stage/mock is gone
# and nobody comes back to update it. Enforced here instead of relying on
# remembering the rule while writing each comment.
check-comments:
	@matches=$$(grep -rnE "Stage [0-9]|currently mocked" --include="*.go" . 2>/dev/null); \
	if [ -n "$$matches" ]; then \
		echo "$$matches"; \
		echo "Found stale-state comments (Stage N / currently mocked) — see CLAUDE.md's code-comment rules"; \
		exit 1; \
	fi
