.PHONY: run build test lint lint-ci

run:
	go run ./cmd

build:
	go build -o bin/gateway ./cmd

test:
	go test ./...

lint:
	find . -name "*.go" | xargs goimports -w
	golangci-lint --version
	golangci-lint run -v

# Same as lint, but never rewrites files — a formatting fix that only shows up
# here means someone skipped `make lint` before pushing.
lint-ci:
	@files="$$(find . -name '*.go' | xargs goimports -l)"; \
	if [ -n "$$files" ]; then \
		echo "not goimports-formatted:"; \
		echo "$$files"; \
		exit 1; \
	fi
	golangci-lint run -v
