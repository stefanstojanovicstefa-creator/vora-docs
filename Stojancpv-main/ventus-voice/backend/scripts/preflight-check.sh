#!/usr/bin/env bash
# Environment Preflight Check for Local Development
# Validates all prerequisites before starting the Vora development environment.
#
# Usage:
#   bash scripts/preflight-check.sh
#
# Exit 0 if all checks pass, exit 1 if any fail.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FRONTEND_DIR="$(cd "$BACKEND_DIR/../frontend" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

ERRORS=0

pass() {
  echo -e "  ${GREEN}✓${NC} $1"
}

fail() {
  echo -e "  ${RED}✗${NC} $1"
  ERRORS=$((ERRORS + 1))
}

echo ""
echo "Vora Voice - Preflight Check"
echo "=============================="
echo ""

# 1. Check Node.js version >= 20
echo "Runtime:"
if command -v node &>/dev/null; then
  NODE_VERSION=$(node -v | sed 's/^v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 20 ]; then
    pass "Node.js v$NODE_VERSION (>= 20)"
  else
    fail "Node.js v$NODE_VERSION is too old (need >= 20)"
    echo "       Fix: nvm install 20 && nvm use 20"
  fi
else
  fail "Node.js not found"
  echo "       Fix: brew install node@20  OR  nvm install 20"
fi

# 2. Check npm
if command -v npm &>/dev/null; then
  NPM_VERSION=$(npm -v)
  pass "npm v$NPM_VERSION"
else
  fail "npm not found"
  echo "       Fix: Install Node.js (npm comes bundled)"
fi

# 3. Check PostgreSQL
echo ""
echo "Database:"
if pg_isready -q 2>/dev/null; then
  pass "PostgreSQL is running"
elif docker ps 2>/dev/null | grep -q postgres; then
  pass "PostgreSQL running via Docker"
else
  fail "PostgreSQL is not reachable"
  echo "       Fix: brew services start postgresql@16"
  echo "        OR: docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16"
fi

# 4. Check backend .env
echo ""
echo "Environment files:"
if [ -f "$BACKEND_DIR/.env" ]; then
  pass "Backend .env exists"
else
  fail "Backend .env not found"
  echo "       Fix: cp ventus-voice/backend/.env.example ventus-voice/backend/.env"
fi

# 5. Check frontend .env
if [ -f "$FRONTEND_DIR/.env" ]; then
  pass "Frontend .env exists"
else
  fail "Frontend .env not found"
  echo "       Fix: cp ventus-voice/frontend/.env.example ventus-voice/frontend/.env"
fi

# 6. Check required backend env vars
echo ""
echo "Backend env vars:"
if [ -f "$BACKEND_DIR/.env" ]; then
  check_env_var() {
    local var_name=$1
    local env_file=$2
    local value
    value=$(grep -E "^${var_name}=" "$env_file" 2>/dev/null | head -1 | sed "s/^${var_name}=//" | tr -d '"' | tr -d "'")
    if [ -n "$value" ]; then
      pass "$var_name is set"
    else
      fail "$var_name is missing or empty"
      echo "       Fix: Add $var_name=<value> to $env_file"
    fi
  }

  check_env_var "DATABASE_URL" "$BACKEND_DIR/.env"
  check_env_var "CLERK_SECRET_KEY" "$BACKEND_DIR/.env"
  check_env_var "CLERK_PUBLISHABLE_KEY" "$BACKEND_DIR/.env"
  check_env_var "JWT_SECRET" "$BACKEND_DIR/.env"
else
  fail "Skipped (backend .env missing)"
fi

# 7. Check required frontend env vars
echo ""
echo "Frontend env vars:"
if [ -f "$FRONTEND_DIR/.env" ]; then
  check_env_var "VITE_CLERK_PUBLISHABLE_KEY" "$FRONTEND_DIR/.env"
else
  fail "Skipped (frontend .env missing)"
fi

# 8. Check backend node_modules
echo ""
echo "Dependencies:"
if [ -d "$BACKEND_DIR/node_modules" ]; then
  pass "Backend node_modules installed"
else
  fail "Backend node_modules missing"
  echo "       Fix: cd ventus-voice/backend && npm install"
fi

# 9. Check frontend node_modules
if [ -d "$FRONTEND_DIR/node_modules" ]; then
  pass "Frontend node_modules installed"
else
  fail "Frontend node_modules missing"
  echo "       Fix: cd ventus-voice/frontend && npm install"
fi

# 10. Check Prisma client generated
if [ -d "$BACKEND_DIR/node_modules/.prisma/client" ]; then
  pass "Prisma client generated"
else
  fail "Prisma client not generated"
  echo "       Fix: cd ventus-voice/backend && npx prisma generate"
fi

# Summary
echo ""
echo "=============================="
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}All checks passed!${NC}"
  exit 0
else
  echo -e "${RED}$ERRORS check(s) failed${NC}"
  echo "Fix the issues above and run the preflight check again."
  exit 1
fi
