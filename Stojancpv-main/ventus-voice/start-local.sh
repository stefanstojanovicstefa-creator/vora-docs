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

cleanup() {
  echo ""
  echo "Shutting down..."
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
    wait "$BACKEND_PID" 2>/dev/null || true
    echo "  Backend stopped"
  fi
  echo "Goodbye!"
  exit 0
}

trap cleanup SIGINT SIGTERM

echo ""
echo "========================================="
echo " Vora Voice Platform - Local Development"
echo "========================================="
echo ""

# Step 1: Run preflight check
echo "Step 1: Running preflight check..."
if ! bash "$BACKEND_DIR/scripts/preflight-check.sh"; then
  echo ""
  echo "Preflight check failed. Fix the issues above and try again."
  exit 1
fi
echo ""

# Step 2: Check backend node_modules
echo "Step 2: Checking backend dependencies..."
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo "  Backend node_modules missing, installing..."
  (cd "$BACKEND_DIR" && npm install)
else
  echo "  Backend dependencies OK"
fi
echo ""

# Step 3: Check frontend node_modules
echo "Step 3: Checking frontend dependencies..."
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo "  Frontend node_modules missing, installing..."
  (cd "$FRONTEND_DIR" && npm install)
else
  echo "  Frontend dependencies OK"
fi
echo ""

# Step 4: Check Prisma client
echo "Step 4: Checking Prisma client..."
if [ ! -d "$BACKEND_DIR/node_modules/.prisma/client" ]; then
  echo "  Prisma client not generated, generating..."
  (cd "$BACKEND_DIR" && npx prisma generate)
else
  echo "  Prisma client OK"
fi
echo ""

# Step 5: Check database has tables
echo "Step 5: Checking database..."
ENV_FILE="$BACKEND_DIR/.env"
DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")
DB_URL_NO_PARAMS="${DATABASE_URL%%\?*}"
DB_NAME="${DB_URL_NO_PARAMS##*/}"

if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  # Database exists, check if it has tables (migrations applied)
  TABLE_COUNT=$(psql -d "$DB_NAME" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
  if [ "$TABLE_COUNT" -gt 0 ]; then
    echo "  Database '$DB_NAME' has $TABLE_COUNT tables"
  else
    echo "  Database '$DB_NAME' has no tables, running setup..."
    (cd "$BACKEND_DIR" && npm run db:setup-local)
  fi
else
  echo "  Database '$DB_NAME' not found, running setup..."
  (cd "$BACKEND_DIR" && npm run db:setup-local)
fi
echo ""

# Step 6: Check port 3001
echo "Step 6: Checking ports..."
BACKEND_PORT_PID=$(lsof -ti:3001 2>/dev/null || true)
if [ -n "$BACKEND_PORT_PID" ]; then
  echo "  WARNING: Port 3001 is in use by PID $BACKEND_PORT_PID"
  echo "  Kill it with: kill $BACKEND_PORT_PID"
fi

# Step 7: Check port 8080
FRONTEND_PORT_PID=$(lsof -ti:8080 2>/dev/null || true)
if [ -n "$FRONTEND_PORT_PID" ]; then
  echo "  WARNING: Port 8080 is in use by PID $FRONTEND_PORT_PID"
  echo "  Kill it with: kill $FRONTEND_PORT_PID"
fi

if [ -z "$BACKEND_PORT_PID" ] && [ -z "$FRONTEND_PORT_PID" ]; then
  echo "  Ports 3001 and 8080 are free"
fi
echo ""

# Step 8: Start backend in background
echo "Step 8: Starting backend..."
(cd "$BACKEND_DIR" && npm run dev) &
BACKEND_PID=$!
echo "  Backend starting (PID: $BACKEND_PID)"

# Step 9: Wait for backend health check
echo "  Waiting for backend to be ready..."
RETRIES=0
MAX_RETRIES=30
while [ $RETRIES -lt $MAX_RETRIES ]; do
  if curl -sf http://localhost:3001/health/live >/dev/null 2>&1; then
    echo "  Backend is ready!"
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep 1
done

if [ $RETRIES -ge $MAX_RETRIES ]; then
  echo "  WARNING: Backend did not respond within 30 seconds"
  echo "  Check the logs above for errors"
fi
echo ""

# Print summary
echo "========================================="
echo " Vora Voice is running!"
echo "========================================="
echo ""
echo "  Frontend:  http://localhost:8080"
echo "  Backend:   http://localhost:3001"
echo "  DB Studio: npm run db:studio (in backend/)"
echo ""
echo "  Press Ctrl+C to stop all services"
echo ""

# Step 10: Start frontend in foreground
(cd "$FRONTEND_DIR" && npm run dev)
