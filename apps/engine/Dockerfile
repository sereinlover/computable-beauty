# Build context is the repo root — contracts/ needs to sit next to
# apps/engine for the editable dependency in pyproject.toml. `uv sync` bakes
# the absolute build path into the venv, so runtime keeps this layout and
# mounts contracts/ read-only (docker-compose.base.yml) instead of copying it.

FROM python:3.12-slim AS base
# In mainland China, deb.debian.org can be unreachable/slow — deploy-build.sh's
# China-mirror prompt passes APT_MIRROR=mirrors.tuna.tsinghua.edu.cn as a
# build arg here. Both stages below start FROM this one, so this only needs
# setting once; empty (the default) is a no-op, matching a plain
# `docker build`/`docker compose build`.
ARG APT_MIRROR=""
RUN if [ -n "$APT_MIRROR" ]; then \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list.d/debian.sources 2>/dev/null || true; \
      sed -i "s|deb.debian.org|${APT_MIRROR}|g" /etc/apt/sources.list 2>/dev/null || true; \
    fi

FROM base AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# build-essential: madmom compiles from source (Cython extension). git:
# madmom/msaf are git dependencies (tool.uv.sources in pyproject.toml), and
# `uv sync` shells out to git to fetch them.
RUN apt-get update && apt-get install -y --no-install-recommends build-essential git \
    && rm -rf /var/lib/apt/lists/*

# In mainland China, GitHub's HTTP/2 connections can reset mid-clone —
# deploy-build.sh's China-mirror prompt passes GIT_HTTP1=true as a build arg
# to force HTTP/1.1 instead; the default below is a no-op.
ARG GIT_HTTP1="false"
RUN if [ "$GIT_HTTP1" = "true" ]; then git config --global http.version HTTP/1.1; fi

# contracts/ first, then engine's manifest files, so `uv sync` layer-caches
# independently of application source changes.
COPY contracts/ ./contracts/
COPY apps/engine/pyproject.toml apps/engine/uv.lock ./apps/engine/
WORKDIR /app/apps/engine
ENV UV_HTTP_TIMEOUT=300
# In mainland China, pypi.org can be too slow — deploy-build.sh's China-mirror
# prompt passes UV_INDEX=https://pypi.tuna.tsinghua.edu.cn/simple as a build
# arg here; the default below matches uv's own default index.
ARG UV_INDEX="https://pypi.org/simple"
ENV UV_DEFAULT_INDEX=${UV_INDEX}
RUN uv sync --frozen --no-dev

WORKDIR /app
COPY apps/engine/ ./apps/engine/

# Pretrained genre/instrument/emotion models (Essentia, ~26MB) — gitignored,
# not in the COPY above. See Makefile's `models` target for the dev-machine
# equivalent.
ADD https://essentia.upf.edu/models/feature-extractors/discogs-effnet/discogs-effnet-bs64-1.pb /app/apps/engine/classifiers/models/discogs-effnet-bs64-1.pb
ADD https://essentia.upf.edu/models/classification-heads/genre_discogs400/genre_discogs400-discogs-effnet-1.pb /app/apps/engine/classifiers/models/genre_discogs400-discogs-effnet-1.pb
ADD https://essentia.upf.edu/models/classification-heads/genre_discogs400/genre_discogs400-discogs-effnet-1.json /app/apps/engine/classifiers/models/genre_discogs400-discogs-effnet-1.json
ADD https://essentia.upf.edu/models/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.pb /app/apps/engine/classifiers/models/mtg_jamendo_instrument-discogs-effnet-1.pb
ADD https://essentia.upf.edu/models/classification-heads/mtg_jamendo_instrument/mtg_jamendo_instrument-discogs-effnet-1.json /app/apps/engine/classifiers/models/mtg_jamendo_instrument-discogs-effnet-1.json
ADD https://essentia.upf.edu/models/feature-extractors/musicnn/msd-musicnn-1.pb /app/apps/engine/classifiers/models/msd-musicnn-1.pb
ADD https://essentia.upf.edu/models/classification-heads/deam/deam-msd-musicnn-2.pb /app/apps/engine/classifiers/models/deam-msd-musicnn-2.pb

FROM base
# librosa/soundfile need libsndfile for decoding; ffmpeg backs mp3 support.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libsndfile1 ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system engine && useradd --system --no-create-home --gid engine engine

WORKDIR /app/apps/engine
COPY --from=build --chown=engine:engine /app/apps/engine ./
# Placeholder — real content comes from the runtime volume mount (see above).
RUN mkdir -p /app/contracts && chown engine:engine /app/contracts

USER engine
CMD [".venv/bin/python", "main.py"]
