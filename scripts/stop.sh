#!/usr/bin/env bash
# Tears down what ../deploy-build.sh or ../deploy-pull.sh started: the
# compose stack and the background log-follow process writing
# logs/runtime-*.log. Works for either — `down` targets containers by
# project+service name, so which of -build.yml/-pull.yml we pass below
# doesn't matter; -build.yml is picked arbitrarily, docker-compose.base.yml alone
# doesn't parse (engine/gateway/web need `build` or `image` from one of them).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PID_FILE="$REPO_ROOT/logs/.runtime.pid"
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  kill "$PID" 2>/dev/null || true
  rm -f "$PID_FILE"
fi

echo "==> Stopping services (docker compose down)..."
docker compose -f docker-compose.base.yml -f docker-compose.build.yml down

echo "Stopped. Past deploy/runtime logs are kept in logs/."
