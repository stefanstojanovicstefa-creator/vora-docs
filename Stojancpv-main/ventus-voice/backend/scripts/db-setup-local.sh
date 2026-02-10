#!/usr/bin/env bash
# Database Setup Script for Local Development
# Orchestrates: create database -> generate Prisma client -> migrate -> seed
#
# Usage:
#   bash scripts/db-setup-local.sh
#   npm run db:setup-local

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "========================================="
echo " Vora Voice - Local Database Setup"
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

echo "Using DATABASE_URL from .env"

# Step 2: Extract database name from DATABASE_URL (part after last /)
# Handle query params: strip everything after ? first, then get the part after the last /
DB_URL_NO_PARAMS="${DATABASE_URL%%\?*}"
DB_NAME="${DB_URL_NO_PARAMS##*/}"

if [ -z "$DB_NAME" ]; then
  echo "ERROR: Could not extract database name from DATABASE_URL"
  echo "  Expected format: postgresql://user:pass@host:port/dbname"
  exit 1
fi

echo "Database name: $DB_NAME"
echo ""

# Step 3: Check if database exists, create if not
echo "Checking if database '$DB_NAME' exists..."
if psql -lqt 2>/dev/null | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
  echo "  Database '$DB_NAME' already exists, continuing..."
else
  echo "  Database '$DB_NAME' does not exist, creating..."
  if createdb "$DB_NAME" 2>/dev/null; then
    echo "  Database '$DB_NAME' created successfully"
  else
    echo "ERROR: Failed to create database '$DB_NAME'"
    echo "  Make sure PostgreSQL is running and your user has createdb permissions"
    echo "  Try: brew services start postgresql@16"
    exit 1
  fi
fi
echo ""

# Step 4: Generate Prisma client
echo "Generating Prisma client..."
cd "$BACKEND_DIR"
npx prisma generate
echo "  Prisma client generated"
echo ""

# Step 5: Apply migrations (deploy mode - no interactive prompts)
echo "Applying database migrations..."
npx prisma migrate deploy
echo "  Migrations applied"
echo ""

# Step 6: Seed local data
echo "Seeding local development data..."
npx tsx prisma/seed-local.ts
echo ""

echo "========================================="
echo " Database setup complete!"
echo "========================================="
echo ""
echo "  Database: $DB_NAME"
echo "  Migrations: applied"
echo "  Seed data: loaded"
echo ""
echo "  Run 'npm run db:studio' to browse the database"
