#!/usr/bin/env bash
# Completely tears down everything: containers, networks, locally-built
# images, ALL volumes (postgres_data/redis_data/uploads), .env, and logs/.
# Deletes .env and the volumes together so a rerun can't drift out of sync
# the way a leftover .env vs. leftover volume could. `--rmi local` spares
# ghcr.io-pulled images so deploy-pull.sh doesn't re-download them.
#
# Usage: scripts/reset.sh [-f|--force]   (-f skips the confirmation prompt)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

FORCE=false
for arg in "$@"; do
  case "$arg" in
    -f|--force) FORCE=true ;;
  esac
done

if [ "$FORCE" != true ]; then
  echo "This will permanently delete:"
  echo "  - All containers and networks"
  echo "  - Locally-built images (engine/gateway/web)"
  echo "  - All volumes: postgres_data (database), redis_data, uploads (uploaded audio)"
  echo "  - .env (next deploy regenerates it — you'll need to re-enter the OpenAI API key)"
  echo "  - Everything in logs/"
  echo
  read -rp "Continue? Type y to proceed: " CONFIRM
  if [ "$CONFIRM" != "y" ]; then
    echo "Cancelled."
    exit 0
  fi
fi

PID_FILE="$REPO_ROOT/logs/.runtime.pid"
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  kill "$PID" 2>/dev/null || true
fi

echo "==> docker compose down -v --rmi local --remove-orphans ..."
# -build.yml/-pull.yml both work here (down doesn't care which); -build.yml
# is picked arbitrarily, docker-compose.base.yml alone doesn't parse (see stop.sh).
docker compose -f docker-compose.base.yml -f docker-compose.build.yml down -v --rmi local --remove-orphans

# .env may be a symlink (e.g. into a separate private notes repo for local
# dev) — rm unlinks it without touching whatever it points to.
rm -f "$REPO_ROOT/.env"
rm -rf "$REPO_ROOT/logs"

echo "Everything wiped. The next ./deploy-build.sh or ./deploy-pull.sh run will be a completely fresh install."
