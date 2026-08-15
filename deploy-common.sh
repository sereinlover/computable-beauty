# Shared setup for deploy-build.sh/deploy-pull.sh — sourced, not run
# directly. Only the final `docker compose up` step differs between the two
# callers (build vs. pull), so that part stays out of this file.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

if ! command -v docker &>/dev/null; then
  echo "docker not found — install it first: https://docs.docker.com/get-docker/"
  exit 1
fi
if ! docker compose version &>/dev/null; then
  echo "docker compose plugin not found — please upgrade Docker to a newer version."
  exit 1
fi
if ! docker info &>/dev/null; then
  echo "docker is installed but not running — start Docker Desktop / the Docker daemon first."
  exit 1
fi

ENV_FILE="$REPO_ROOT/.env"

# --- redeploying on top of a previous run: stop it first (or wipe it) ------
# .env's presence is what distinguishes "first run" from "redeploy" — a
# still-running previous stack would hold the ports resolve_port checks
# below, making them drift upward for no reason if not stopped first.
if [ -f "$ENV_FILE" ]; then
  RED=$'\033[0;31m'; BOLD=$'\033[1m'; NC=$'\033[0m'
  echo -e "${RED}${BOLD}⚠️  A previous deployment was found.${NC}"
  echo -e "${RED}Do you want to wipe everything (database, Redis, uploaded audio, .env) and start completely fresh?${NC}"
  read -rp "Type 'y' to wipe everything, or press Enter to keep your existing data: " CONFIRM_1
  CONFIRM_2=""
  if [ "$CONFIRM_1" = "y" ]; then
    echo -e "${RED}${BOLD}⚠️  This cannot be undone — all data will be permanently deleted.${NC}"
    read -rp "Type 'y' again to confirm: " CONFIRM_2
  fi

  if [ "$CONFIRM_1" = "y" ] && [ "$CONFIRM_2" = "y" ]; then
    echo "==> Wiping everything (scripts/reset.sh --force)..."
    "$REPO_ROOT/scripts/reset.sh" --force
  else
    echo "==> Stopping the previous deployment (scripts/stop.sh)..."
    "$REPO_ROOT/scripts/stop.sh"
  fi
  echo
fi

# --- .env: generated here, never hand-edited by the user -------------

random_secret() {
  # `head -c` closing early sends tr a SIGPIPE; under pipefail that would
  # otherwise abort the script via `set -e`, so swallow it with `|| true`.
  LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom 2>/dev/null | head -c 32 || true
}

set_env_var() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE" 2>/dev/null; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  else
    echo "${key}=${value}" >>"$ENV_FILE"
  fi
}

if [ ! -f "$ENV_FILE" ]; then
  echo "==> First run — generating .env (docker network config + random secrets)..."
  POSTGRES_PASSWORD="$(random_secret)"
  INTERNAL_TOKEN="$(random_secret)"
  GATEWAY_PORT=8080
  ENGINE_PORT=8000
  WEB_PORT=3000
  POSTGRES_PORT=5432
  REDIS_PORT=6379
  cat >"$ENV_FILE" <<EOF
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=

POSTGRES_USER=cb
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=computable_beauty
DATABASE_URL=postgresql://cb:${POSTGRES_PASSWORD}@postgres:5432/computable_beauty
REDIS_URL=redis://redis:6379

GATEWAY_PORT=${GATEWAY_PORT}
ENGINE_PORT=${ENGINE_PORT}
WEB_PORT=${WEB_PORT}
POSTGRES_PORT=${POSTGRES_PORT}
REDIS_PORT=${REDIS_PORT}

GATEWAY_URL=http://gateway:${GATEWAY_PORT}
ENGINE_URL=http://engine:${ENGINE_PORT}

INTERNAL_TOKEN=${INTERNAL_TOKEN}

UPLOAD_DIR=/data/uploads
EOF
fi

# shellcheck disable=SC1091
set -a; source "$ENV_FILE"; set +a

# Runs before stdout gets tee'd below — a `read -p` prompt can otherwise sit
# unflushed in the pipe. Plain (not -s/silent) so you can see what you
# typed; none of the three get logged since the tee starts after this block.
if [ -n "${OPENAI_API_KEY:-}" ]; then
  read -rp "OpenAI API Key (already set, ends in ...${OPENAI_API_KEY: -4} — press Enter to keep it, or type a new value to replace it): " INPUT_KEY
else
  read -rp "OpenAI API Key (powers AI analysis — press Enter to skip, you can rerun this script later to add it): " INPUT_KEY
fi
NEW_KEY="${INPUT_KEY:-${OPENAI_API_KEY:-}}"
if [ "$NEW_KEY" != "${OPENAI_API_KEY:-}" ]; then
  set_env_var OPENAI_API_KEY "$NEW_KEY"
fi
OPENAI_API_KEY="$NEW_KEY"

if [ -n "${OPENAI_BASE_URL:-}" ]; then
  read -rp "OpenAI Base URL (already set to ${OPENAI_BASE_URL} — press Enter to keep it, or type a new value to replace it): " INPUT_BASE_URL
else
  read -rp "OpenAI Base URL (required for AI analysis, e.g. https://api.openai.com/v1 — press Enter to skip for now): " INPUT_BASE_URL
fi
NEW_BASE_URL="${INPUT_BASE_URL:-${OPENAI_BASE_URL:-}}"
if [ "$NEW_BASE_URL" != "${OPENAI_BASE_URL:-}" ]; then
  set_env_var OPENAI_BASE_URL "$NEW_BASE_URL"
fi
OPENAI_BASE_URL="$NEW_BASE_URL"

if [ -n "${OPENAI_MODEL:-}" ]; then
  read -rp "OpenAI Model (already set to ${OPENAI_MODEL} — press Enter to keep it, or type a new value to replace it): " INPUT_MODEL
else
  read -rp "OpenAI Model (required for AI analysis, e.g. gpt-4o-mini — press Enter to skip for now): " INPUT_MODEL
fi
NEW_MODEL="${INPUT_MODEL:-${OPENAI_MODEL:-}}"
if [ "$NEW_MODEL" != "${OPENAI_MODEL:-}" ]; then
  set_env_var OPENAI_MODEL "$NEW_MODEL"
fi
OPENAI_MODEL="$NEW_MODEL"

# --- from here on, mirror everything to a log file too ----------------
LOG_DIR="$REPO_ROOT/logs"
mkdir -p "$LOG_DIR"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
DEPLOY_LOG="$LOG_DIR/deploy-${TIMESTAMP}.log"
RUNTIME_LOG="$LOG_DIR/runtime-${TIMESTAMP}.log"
PID_FILE="$LOG_DIR/.runtime.pid"

exec > >(tee -a "$DEPLOY_LOG") 2>&1

echo "==> Computable Beauty · local deploy"
echo "Deploy log: $DEPLOY_LOG"
if [ -n "$OPENAI_API_KEY" ]; then
  echo "OpenAI API Key: set (ends in ...${OPENAI_API_KEY: -4})"
else
  echo "OpenAI API Key: not set — AI analysis will be unavailable, everything else works fine"
fi
echo "OpenAI Base URL: ${OPENAI_BASE_URL:-(not set)}"
echo "OpenAI Model: ${OPENAI_MODEL:-(not set)}"
echo

# --- port conflict resolution -----------------------------------------
port_in_use() {
  (echo > "/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

# Bumps $port_var until free and persists it to .env (so docker compose,
# which reads .env directly, and a future restart both see the same value).
# $url_var/$url_host: only engine/gateway need this — the app inside reads
# $port_var to bind, so ENGINE_URL/GATEWAY_URL must move in lockstep or
# other services would call a stale port.
resolve_port() {
  local port_var="$1" default="$2" url_var="${3:-}" url_host="${4:-}"
  local current="${!port_var:-$default}"
  local port="$current"
  while port_in_use "$port"; do
    port=$((port + 1))
  done
  if [ "$port" != "$current" ]; then
    echo "port conflict: ${port_var} ${current} is taken -> using ${port} instead" >&2
    set_env_var "$port_var" "$port"
    [ -n "$url_var" ] && set_env_var "$url_var" "http://${url_host}:${port}"
  else
    echo "${port_var}: ${port} (default)" >&2
  fi
  echo "$port"
}

echo "==> Checking for port conflicts..."
ENGINE_PORT="$(resolve_port ENGINE_PORT 8000 ENGINE_URL engine)"
GATEWAY_PORT="$(resolve_port GATEWAY_PORT 8080 GATEWAY_URL gateway)"
WEB_PORT="$(resolve_port WEB_PORT 3000)"
POSTGRES_PORT="$(resolve_port POSTGRES_PORT 5432)"
REDIS_PORT="$(resolve_port REDIS_PORT 6379)"
echo
