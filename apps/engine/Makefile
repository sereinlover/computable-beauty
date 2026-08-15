.PHONY: run test lint lint-ci

run:
	uv run python main.py

test:
	uv run pytest

lint:
	uv run ruff format .
	uv run ruff check .

# Same as lint, but never rewrites files — a formatting fix that only shows up
# here means someone skipped `make lint` before pushing.
lint-ci:
	uv run ruff format --check .
	uv run ruff check .
