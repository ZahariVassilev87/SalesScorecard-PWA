#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# start-dev.sh  —  Sales Scorecard local dev environment
#
# Starts: PostgreSQL (Docker) + production backend (Docker) + React frontend
# Prod is NOT touched. Everything runs locally.
#
# Usage:
#   ./start-dev.sh            # normal start
#   ./start-dev.sh --seed     # also seed the DB after startup (first run)
#   ./start-dev.sh --reset    # tear down containers & volumes, then restart
#   ./start-dev.sh --stop     # stop all dev containers
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

COMPOSE_FILE="docker-compose.dev.yml"
SEED_FLAG=false
RESET_FLAG=false
STOP_FLAG=false

for arg in "$@"; do
  case $arg in
    --seed)  SEED_FLAG=true ;;
    --reset) RESET_FLAG=true ;;
    --stop)  STOP_FLAG=true ;;
  esac
done

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

header() { echo -e "\n${BOLD}${CYAN}$1${NC}"; }
ok()     { echo -e "  ${GREEN}✓${NC}  $1"; }
warn()   { echo -e "  ${YELLOW}⚠${NC}   $1"; }
err()    { echo -e "  ${RED}✗${NC}  $1"; }

echo -e "\n${BOLD}🚀  Sales Scorecard — Local Dev Environment${NC}"
echo    "════════════════════════════════════════════"

# ── Preflight checks ──────────────────────────────────────────────────────────
header "Checking prerequisites..."

command -v docker   >/dev/null 2>&1 || { err "Docker not installed. Install from https://docs.docker.com/get-docker/"; exit 1; }
command -v node     >/dev/null 2>&1 || { err "Node.js not installed."; exit 1; }
command -v npm      >/dev/null 2>&1 || { err "npm not installed."; exit 1; }
docker info         >/dev/null 2>&1 || { err "Docker daemon is not running. Please start Docker Desktop."; exit 1; }

ok "Docker is running"
ok "Node $(node -v) / npm $(npm -v)"

# ── Stop mode ────────────────────────────────────────────────────────────────
if [ "$STOP_FLAG" = true ]; then
  header "Stopping dev environment..."
  docker compose -f "$COMPOSE_FILE" down
  ok "All dev containers stopped"
  echo ""
  exit 0
fi

# ── Reset mode ───────────────────────────────────────────────────────────────
if [ "$RESET_FLAG" = true ]; then
  header "Resetting dev environment (removing containers & volumes)..."
  warn "This will DELETE all local dev data!"
  read -rp "  Are you sure? [y/N] " confirm
  [[ "$confirm" =~ ^[Yy]$ ]] || { echo "  Aborted."; exit 0; }
  docker compose -f "$COMPOSE_FILE" down -v --remove-orphans
  ok "Containers and volumes removed"
  SEED_FLAG=true   # auto-seed after reset
fi

# ── Start backend services ────────────────────────────────────────────────────
header "Starting PostgreSQL + Backend (Docker)..."
docker compose -f "$COMPOSE_FILE" up -d --build

# ── Wait for backend health ───────────────────────────────────────────────────
header "Waiting for backend to be healthy..."
MAX_WAIT=60
ELAPSED=0

while true; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' scorecard-backend-dev 2>/dev/null || echo "missing")
  if [ "$STATUS" = "healthy" ]; then
    ok "Backend is healthy at http://localhost:3001"
    break
  fi
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    err "Backend didn't become healthy after ${MAX_WAIT}s."
    echo "    Check logs with: docker logs scorecard-backend-dev"
    exit 1
  fi
  echo -n "  Waiting (${STATUS})... "
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo "${ELAPSED}s"
done

# ── Optional seeding ─────────────────────────────────────────────────────────
if [ "$SEED_FLAG" = true ]; then
  header "Seeding dev database..."
  if [ ! -f "package.json" ]; then
    warn "package.json not found — skipping npm install check"
  else
    # Install pg if not present (needed for seed script)
    if [ ! -d "node_modules/pg" ]; then
      npm install pg dotenv --no-save --quiet
    fi
  fi
  node seed-dev-data.js
fi

# ── Install frontend deps if needed ──────────────────────────────────────────
if [ ! -d "node_modules" ]; then
  header "Installing frontend dependencies..."
  npm install
  ok "Dependencies installed"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}════════════════════════════════════════════${NC}"
echo -e "${BOLD}✅  Dev environment is ready!${NC}"
echo ""
echo -e "  ${CYAN}Frontend${NC}   →  starting on  http://localhost:3000"
echo -e "  ${CYAN}Backend${NC}    →  running at   http://localhost:3001"
echo -e "  ${CYAN}Database${NC}   →  postgres      localhost:5432 / salesscorecard_dev"
echo ""
echo -e "  🔑 Test credentials (password for all: ${BOLD}password${NC})"
echo "     admin@dev.local        ADMIN"
echo "     director@dev.local     SALES_DIRECTOR"
echo "     manager@dev.local      REGIONAL_SALES_MANAGER"
echo "     lead@dev.local         SALES_LEAD"
echo "     salesperson@dev.local  SALESPERSON"
echo ""
echo "  💡 Stop everything with: ./start-dev.sh --stop"
echo -e "${BOLD}════════════════════════════════════════════${NC}"
echo ""

# ── Start React frontend ──────────────────────────────────────────────────────
header "Starting React frontend..."

# Cleanup handler: stop docker services when Ctrl+C is pressed
cleanup() {
  echo ""
  header "Shutting down dev environment..."
  docker compose -f "$COMPOSE_FILE" down
  ok "All services stopped"
  exit 0
}
trap cleanup SIGINT SIGTERM

npm start
