.PHONY: run test lint lint-ci dataset models check-comments

run:
	uv run python main.py

test:
	uv run pytest

# Builds data/dataset.csv from one or more datasets (each downloaded separately).
dataset:
	uv run python -m dataset.build --pmemo-static ../../data/PMEmo2019 --out ../../data/dataset.csv

# Downloads the pretrained genre/instrument/emotion models (Essentia, ~26MB) —
# required by classifiers/genre.py, classifiers/instrument.py, and
# classifiers/emotion.py, not committed to the repo. Genre and instrument
# share the same embedding backbone (discogs-effnet-bs64-1.pb); emotion uses
# a separate one (msd-musicnn-1.pb) trained for a different task.
models:
	mkdir -p classifiers/models
	curl -sL -o classifiers/models/discogs-effnet-bs64-1.pb https://essentia.upf.edu/models/feature-extractors/discogs-effnet/discogs-effnet-bs64-1.pb
	curl -sL -o classifiers/models/genre_discogs400-discogs-effnet-1.pb https://essentia.upf.edu/models/classification-heads/genre_discogs400/genre_discogs400-discogs-effnet-1.pb
	curl -sL -o classifiers/models/genre_discogs400-discogs-effnet-1.json https://essentia.upf.edu/models/classification-heads/genre_discogs400/genre_discogs400-discogs-effnet-1.json
	curl -sL -o classifiers/models/mtg_jamendo_instrument-discogs-effnet-1.pb https://essentia.upf.edu/models/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.pb
	curl -sL -o classifiers/models/mtg_jamendo_instrument-discogs-effnet-1.json https://essentia.upf.edu/models/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.json
	curl -sL -o classifiers/models/msd-musicnn-1.pb https://essentia.upf.edu/models/feature-extractors/musicnn/msd-musicnn-1.pb
	curl -sL -o classifiers/models/deam-msd-musicnn-2.pb https://essentia.upf.edu/models/classification-heads/deam/deam-msd-musicnn-2.pb

lint: check-comments
	uv run ruff format .
	uv run ruff check .

# Same as lint, but never rewrites files — a formatting fix that only shows up
# here means someone skipped `make lint` before pushing.
lint-ci: check-comments
	uv run ruff format --check .
	uv run ruff check .

# CLAUDE.md bans "Stage N" numbering and "currently mocked"-style comments —
# they describe transient state that goes stale once the stage/mock is gone
# and nobody comes back to update it. Enforced here instead of relying on
# remembering the rule while writing each comment.
check-comments:
	@matches=$$(grep -rnE "Stage [0-9]|currently mocked" --include="*.py" --exclude-dir=.venv --exclude-dir=__pycache__ --exclude-dir=models . 2>/dev/null); \
	if [ -n "$$matches" ]; then \
		echo "$$matches"; \
		echo "Found stale-state comments (Stage N / currently mocked) — see CLAUDE.md's code-comment rules"; \
		exit 1; \
	fi
