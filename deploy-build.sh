#!/usr/bin/env bash
# One-command local deploy that builds all three service images from source
# on this machine. See deploy-pull.sh for the ghcr.io-prebuilt-image
# alternative — faster and no local build/network cost, but it only ever
# runs whatever image the latest CI run on `main` pushed, never your
# uncommitted local changes.
set -euo pipefail

source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deploy-common.sh"

# docker-compose.build.yml only adds `build` to the three custom services —
# docker-compose.base.yml still supplies everything else (ports/postgres/redis).
COMPOSE_ARGS=(-f docker-compose.base.yml -f docker-compose.build.yml)

echo "==> Building and starting services (docker compose up -d --build)..."
echo
docker compose "${COMPOSE_ARGS[@]}" up -d --build

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

# Continuously append container logs (previously terminal-only under `up`,
# now the stack runs detached) to a timestamped file until scripts/stop.sh.
nohup docker compose "${COMPOSE_ARGS[@]}" logs -f --no-color --timestamps >"$RUNTIME_LOG" 2>&1 &
echo $! > "$PID_FILE"

echo
echo "=================================================="
echo "✅ Deploy complete (built from source)"
echo "   URL:         http://localhost:${WEB_PORT}"
echo "   Runtime log: ${RUNTIME_LOG} (still being written — tail -f to follow)"
echo "   Stop:        scripts/stop.sh"
echo "=================================================="
