#!/usr/bin/env bash
# One-command local deploy that pulls prebuilt images from ghcr.io instead of
# building locally — much faster and skips downloading every Python/Go/npm
# dependency on this machine. Trade-off: it always runs whatever image the
# latest CI run on `main` pushed, never your uncommitted local changes — use
# deploy-build.sh instead while iterating on code.
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-common.sh"

# docker-compose.pull.yml only adds `image` to the three custom services —
# docker-compose.base.yml still supplies everything else (ports/postgres/redis).
COMPOSE_ARGS=(-f docker-compose.base.yml -f docker-compose.pull.yml)

echo "==> Pulling images from ghcr.io..."
echo
docker compose "${COMPOSE_ARGS[@]}" pull

echo "==> Starting services (docker compose up -d)..."
echo
docker compose "${COMPOSE_ARGS[@]}" up -d

echo
echo "==> Waiting for web to be ready..."
READY=false
for _ in $(seq 1 60); do
  if port_in_use "$WEB_PORT"; then
    READY=true
    break
  fi
  sleep 1
done
if [ "$READY" = false ]; then
  echo "⚠️  Web wasn't ready within 60s — it may still be starting or something went wrong. Check: docker compose ${COMPOSE_ARGS[*]} logs -f web"
fi

nohup docker compose "${COMPOSE_ARGS[@]}" logs -f --no-color --timestamps >"$RUNTIME_LOG" 2>&1 &
echo $! > "$PID_FILE"

echo
echo "=================================================="
echo "✅ Deploy complete (pulled from ghcr.io)"
echo "   URL:         http://localhost:${WEB_PORT}"
echo "   Runtime log: ${RUNTIME_LOG} (still being written — tail -f to follow)"
echo "   Stop:        scripts/stop.sh"
echo "=================================================="
