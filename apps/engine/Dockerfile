# Build context is the repo root — contracts/ needs to sit next to
# apps/engine for the editable dependency in pyproject.toml. `uv sync` bakes
# the absolute build path into the venv, so runtime keeps this layout and
# mounts contracts/ read-only (docker-compose.base.yml) instead of copying it.

FROM python:3.12-slim AS build
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/
WORKDIR /app

# contracts/ first, then engine's manifest files, so `uv sync` layer-caches
# independently of application source changes.
COPY contracts/ ./contracts/
COPY apps/engine/pyproject.toml apps/engine/uv.lock ./apps/engine/
WORKDIR /app/apps/engine
ENV UV_HTTP_TIMEOUT=300
# In mainland China, pypi.org can be too slow — uncomment to
# switch uv to a China mirror instead.
# ENV UV_DEFAULT_INDEX="https://pypi.tuna.tsinghua.edu.cn/simple"
RUN uv sync --frozen --no-dev

WORKDIR /app
COPY apps/engine/ ./apps/engine/

FROM python:3.12-slim
# In mainland China, deb.debian.org can be unreachable/slow — uncomment to
# switch apt to a China mirror instead.
# RUN (sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/debian.sources 2>/dev/null || true) \
#     && (sed -i 's|deb.debian.org|mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list 2>/dev/null || true)
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
