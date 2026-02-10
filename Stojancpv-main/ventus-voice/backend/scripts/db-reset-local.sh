#!/usr/bin/env bash
# Database Reset Script for Local Development
# Drops and recreates the database, then migrates and seeds.
# WARNING: This DESTROYS all data in the local database.
#
# Usage:
#   bash scripts/db-reset-local.sh
#   npm run db:reset-local

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "========================================="
echo " Vora Voice - Local Database RESET"
echo "========================================="
echo ""

# Step 1: Read DATABASE_URL from .env
ENV_FILE="$BACKEND_DIR/.env"
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env file not found at $ENV_FILE"
  echo "  Copy .env.example to .env and configure it:"
  echo "    cp .env.example .env"
  exit 1
fi

DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")

if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL not found or empty in .env"
  exit 1
fi

# Step 2: Extract database name
DB_URL_NO_PARAMS="${DATABASE_URL%%\?*}"
DB_NAME="${DB_URL_NO_PARAMS##*/}"

if [ -z "$DB_NAME" ]; then
  echo "ERROR: Could not extract database name from DATABASE_URL"
  exit 1
fi

echo "WARNING: This will DESTROY all data in database '$DB_NAME'"
echo ""
read -r -p "Are you sure? Type 'yes' to continue: " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  echo "Aborted."
  exit 0
fi

echo ""

# Step 3: Drop existing database
echo "Dropping database '$DB_NAME'..."
if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  if dropdb "$DB_NAME" 2>/dev/null; then
    echo "  Database '$DB_NAME' dropped"
  else
    echo "ERROR: Failed to drop database '$DB_NAME'"
    echo "  Make sure no other connections are active"
    echo "  Try: psql -c \"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();\""
    exit 1
  fi
else
  echo "  Database '$DB_NAME' does not exist, nothing to drop"
fi

# Step 4: Create fresh database
echo "Creating database '$DB_NAME'..."
if createdb "$DB_NAME" 2>/dev/null; then
  echo "  Database '$DB_NAME' created"
else
  echo "ERROR: Failed to create database '$DB_NAME'"
  exit 1
fi
echo ""

# Step 5: Generate Prisma client
echo "Generating Prisma client..."
cd "$BACKEND_DIR"
npx prisma generate
echo "  Prisma client generated"
echo ""

# Step 6: Apply migrations
echo "Applying database migrations..."
npx prisma migrate deploy
echo "  Migrations applied"
echo ""

# Step 7: Seed local data
echo "Seeding local development data..."
npx tsx prisma/seed-local.ts
echo ""

echo "========================================="
echo " Database reset complete!"
echo "========================================="
echo ""
echo "  Database: $DB_NAME (fresh)"
echo "  Migrations: applied"
echo "  Seed data: loaded"
