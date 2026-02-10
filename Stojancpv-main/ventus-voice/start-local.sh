#!/usr/bin/env bash
# Unified Local Development Startup Script
# Starts the entire Vora Voice development environment from ventus-voice/.
#
# Usage:
#   ./start-local.sh
#   npm run local
#
# Run from the ventus-voice/ directory.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

BACKEND_PID=""

# --- Color Support ---
# Disable colors if stdout is not a terminal (e.g., piped output)
if [ -t 1 ]; then
  RED='\033[0;31m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BLUE='\033[0;34m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  RED=''
  GREEN=''
  YELLOW=''
  BLUE=''
  BOLD=''
  RESET=''
fi

# --- Helper Functions ---
info() {
  echo -e "  ${BLUE}$1${RESET}"
}

success() {
  echo -e "  ${GREEN}✓ $1${RESET}"
}

warn() {
  echo -e "  ${YELLOW}⚠ $1${RESET}"
}

error() {
  echo -e "  ${RED}✗ $1${RESET}"
}

spinner() {
  local MSG="$1"
  local DELAY=0.5
  local DOTS=""
  while true; do
    DOTS="${DOTS}."
    if [ ${#DOTS} -gt 3 ]; then
      DOTS="."
    fi
    printf "\r  %s%s   " "$MSG" "$DOTS"
    sleep "$DELAY"
  done
}

# --- Cleanup ---
cleanup() {
  echo ""
  warn "Shutting down..."
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
    info "Backend stopped"
  fi
  echo -e "  ${BOLD}Goodbye!${RESET}"
  exit 0
}

trap cleanup SIGINT SIGTERM

# --- Banner ---
echo ""
echo -e "${BOLD}${BLUE}╔═══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${BLUE}║       Vora Voice Platform                 ║${RESET}"
echo -e "${BOLD}${BLUE}║       Local Development Environment       ║${RESET}"
echo -e "${BOLD}${BLUE}╚═══════════════════════════════════════════╝${RESET}"
echo ""

# Step 1: Run preflight check
info "Step 1: Running preflight check..."
if ! bash "$BACKEND_DIR/scripts/preflight-check.sh"; then
  echo ""
  error "Preflight check failed. Fix the issues above and try again."
  exit 1
fi
success "Preflight check passed"
echo ""

# Step 2: Check backend node_modules
info "Step 2: Checking backend dependencies..."
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  warn "Backend node_modules missing, installing..."
  (cd "$BACKEND_DIR" && npm install)
  success "Backend dependencies installed"
else
  success "Backend dependencies OK"
fi
echo ""

# Step 3: Check frontend node_modules
info "Step 3: Checking frontend dependencies..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  warn "Frontend node_modules missing, installing..."
  (cd "$FRONTEND_DIR" && npm install)
  success "Frontend dependencies installed"
else
  success "Frontend dependencies OK"
fi
echo ""

# Step 4: Check Prisma client
info "Step 4: Checking Prisma client..."
if [ ! -d "$BACKEND_DIR/node_modules/.prisma/client" ]; then
  warn "Prisma client not generated, generating..."
  (cd "$BACKEND_DIR" && npx prisma generate)
  success "Prisma client generated"
else
  success "Prisma client OK"
fi
echo ""

# Step 5: Check database has tables
info "Step 5: Checking database..."
ENV_FILE="$BACKEND_DIR/.env"
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")
DB_URL_NO_PARAMS="${DATABASE_URL%%\?*}"
DB_NAME="${DB_URL_NO_PARAMS##*/}"

if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  TABLE_COUNT=$(psql -d "$DB_NAME" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
  if [ "$TABLE_COUNT" -gt 0 ]; then
    success "Database '$DB_NAME' has $TABLE_COUNT tables"
  else
    warn "Database '$DB_NAME' has no tables, running setup..."
    (cd "$BACKEND_DIR" && npm run db:setup-local)
    success "Database setup complete"
  fi
else
  warn "Database '$DB_NAME' not found, running setup..."
  (cd "$BACKEND_DIR" && npm run db:setup-local)
  success "Database created and seeded"
fi
echo ""

# Step 6: Check ports
info "Step 6: Checking ports..."

check_port() {
  local PORT=$1
  local LABEL=$2
  local PORT_PID
  PORT_PID=$(lsof -ti:"$PORT" 2>/dev/null | head -1 || true)
  if [ -n "$PORT_PID" ]; then
    local PROC_NAME
    PROC_NAME=$(ps -p "$PORT_PID" -o comm= 2>/dev/null || echo "unknown")
    warn "Port $PORT ($LABEL) is in use by $PROC_NAME (PID: $PORT_PID)"
    printf "  Kill it? (y/N) "
    read -r REPLY
    if [ "$REPLY" = "y" ] || [ "$REPLY" = "Y" ]; then
      kill "$PORT_PID" 2>/dev/null || true
      sleep 1
      if lsof -ti:"$PORT" >/dev/null 2>&1; then
        error "Failed to kill process on port $PORT. Try: kill -9 $PORT_PID"
        exit 1
      fi
      success "Killed $PROC_NAME (PID: $PORT_PID)"
    else
      echo ""
      error "Port $PORT is still in use. Free it manually and try again:"
      info "  kill $PORT_PID"
      exit 1
    fi
  fi
}

check_port 3001 "backend"
check_port 8080 "frontend"

BACKEND_PORT_PID=$(lsof -ti:3001 2>/dev/null || true)
FRONTEND_PORT_PID=$(lsof -ti:8080 2>/dev/null || true)
if [ -z "$BACKEND_PORT_PID" ] && [ -z "$FRONTEND_PORT_PID" ]; then
  success "Ports 3001 and 8080 are free"
fi
echo ""

# Step 7: Start backend in background
info "Step 7: Starting backend..."
(cd "$BACKEND_DIR" && npm run dev) &
BACKEND_PID=$!
info "Backend starting (PID: $BACKEND_PID)"

# Step 8: Wait for backend health check with spinner
RETRIES=0
MAX_RETRIES=30
spinner "Waiting for backend" &
SPINNER_PID=$!

while [ $RETRIES -lt $MAX_RETRIES ]; do
  if curl -sf http://localhost:3001/health/live >/dev/null 2>&1; then
    kill "$SPINNER_PID" 2>/dev/null || true
    wait "$SPINNER_PID" 2>/dev/null || true
    printf "\r                                        \r"
    success "Backend is ready!"
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep 1
done

if [ $RETRIES -ge $MAX_RETRIES ]; then
  kill "$SPINNER_PID" 2>/dev/null || true
  wait "$SPINNER_PID" 2>/dev/null || true
  printf "\r                                        \r"
  warn "Backend did not respond within 30 seconds"
  info "Check the logs above for errors"
fi
echo ""

# --- Final Summary ---
echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║       Vora Voice is running!              ║${RESET}"
echo -e "${BOLD}${GREEN}╠═══════════════════════════════════════════╣${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}                                           ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  ${BOLD}Frontend:${RESET}  http://localhost:8080        ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  ${BOLD}Backend:${RESET}   http://localhost:3001        ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  ${BOLD}DB Studio:${RESET} npm run db:studio (backend/) ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}                                           ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}  Press ${BOLD}Ctrl+C${RESET} to stop all services       ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}║${RESET}                                           ${BOLD}${GREEN}║${RESET}"
echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════╝${RESET}"
echo ""

# Step 9: Start frontend in foreground
(cd "$FRONTEND_DIR" && npm run dev)
