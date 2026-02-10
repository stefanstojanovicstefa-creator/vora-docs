# Vora Voice Platform - Local Development Guide

## Quick Start

```bash
git clone <repo-url> && cd Stojancpv-main
cd ventus-voice
npm run install:all
cp backend/.env.example backend/.env   # then edit with your values
cp frontend/.env.example frontend/.env # then edit with your values
npm run setup
npm run local
```

Frontend: http://localhost:8080 | Backend: http://localhost:3001

---

## Prerequisites

| Tool       | Version  | Install                                      |
|------------|----------|----------------------------------------------|
| Node.js    | 20+      | https://nodejs.org/ or `nvm install 20`      |
| npm        | 10+      | Ships with Node.js 20+                       |
| PostgreSQL | 15+      | `brew install postgresql@16` or Docker        |
| Git        | 2.30+    | `brew install git`                           |
| Docker     | (optional) | https://www.docker.com/products/docker-desktop |

Verify your installation:

```bash
node -v   # v20.x.x or higher
npm -v    # 10.x.x or higher
psql --version  # 15+ or 16+
git --version
```

---

## Environment Variables

### Backend (`backend/.env`)

Copy `backend/.env.example` to `backend/.env` and fill in values.

| Name                        | Required | Default                                          | Description                                      |
|-----------------------------|----------|--------------------------------------------------|--------------------------------------------------|
| DATABASE_URL                | Yes      | —                                                | PostgreSQL connection string                     |
| DIRECT_URL                  | No       | —                                                | Direct DB URL (bypasses connection pooler)        |
| NODE_ENV                    | No       | development                                      | Environment mode                                 |
| PORT                        | No       | 3001                                             | Backend server port                              |
| CLERK_SECRET_KEY            | Yes      | —                                                | Clerk authentication secret key                  |
| CLERK_PUBLISHABLE_KEY       | No       | —                                                | Clerk publishable key                            |
| JWT_SECRET                  | No       | —                                                | JWT signing secret                               |
| GOOGLE_GEMINI_API_KEY       | No       | —                                                | Gemini API key for agent compiler                |
| GOOGLE_API_KEY              | No       | —                                                | Google API key for brand analysis                |
| OPENAI_API_KEY              | No       | —                                                | OpenAI API key for GPT-based features            |
| XAI_API_KEY                 | No       | —                                                | xAI API key for Agent Forge (Grok)               |
| ANTHROPIC_API_KEY           | No       | —                                                | Anthropic API key for Claude-based features       |
| LIVEKIT_API_KEY             | No       | —                                                | LiveKit API key for voice sessions               |
| LIVEKIT_API_SECRET          | No       | —                                                | LiveKit API secret                               |
| LIVEKIT_WS_URL              | No       | —                                                | LiveKit WebSocket URL                            |
| ELEVENLABS_API_KEY          | No       | —                                                | ElevenLabs API key for TTS                       |
| SONIOX_API_KEY              | No       | —                                                | Soniox API key for STT                           |
| ENCRYPTION_MASTER_KEY       | No       | —                                                | 64-char hex key for provider credential storage  |
| REDIS_HOST                  | No       | localhost                                        | Redis host for caching                           |
| REDIS_PORT                  | No       | 6379                                             | Redis port                                       |
| REDIS_PASSWORD              | No       | —                                                | Redis password                                   |
| FLY_API_TOKEN               | No       | —                                                | Fly.io deploy token                              |
| FRONTEND_URL                | No       | http://localhost:8080                             | Frontend origin for CORS                         |
| DEMO_MODE                   | No       | false                                            | Enable demo mode (API-key auth bypass)           |
| DEMO_API_KEY                | No       | —                                                | Demo API key when DEMO_MODE=true                 |
| SENTRY_DSN                  | No       | —                                                | Sentry error tracking DSN                        |
| MAKE_WEBHOOK_URL            | No       | —                                                | Make.com CRM integration webhook                 |
| PADDLE_CREDIT_PACK_10_PRICE_ID | No   | —                                                | Paddle price ID for 10-credit pack               |
| PADDLE_CREDIT_PACK_50_PRICE_ID | No   | —                                                | Paddle price ID for 50-credit pack               |
| PADDLE_CREDIT_PACK_100_PRICE_ID| No   | —                                                | Paddle price ID for 100-credit pack              |

### Frontend (`frontend/.env`)

Copy `frontend/.env.example` to `frontend/.env` and fill in values.

| Name                        | Required | Default                    | Description                                  |
|-----------------------------|----------|----------------------------|----------------------------------------------|
| VITE_API_BASE_URL           | Yes      | http://localhost:3001       | Backend API URL                              |
| VITE_CLERK_PUBLISHABLE_KEY  | Yes      | —                          | Clerk publishable key for auth               |
| VITE_CLERK_JS_URL           | No       | —                          | Override Clerk JS CDN URL                    |
| VITE_CLERK_DOMAIN           | No       | —                          | Custom Clerk domain                          |
| VITE_LIVEKIT_URL            | No       | —                          | LiveKit server WebSocket URL                 |
| VITE_LOGGER_API_URL         | No       | http://localhost:3001/api   | Session logger API URL                       |
| VITE_LOGGER_ENABLED         | No       | true                       | Enable session logging                       |
| VITE_ENABLE_SESSION_LOGGING | No       | true                       | Feature flag for session logging             |
| VITE_ENABLE_ANALYTICS       | No       | true                       | Feature flag for analytics                   |
| VITE_POSTHOG_KEY            | No       | —                          | PostHog project API key                      |
| VITE_POSTHOG_HOST           | No       | https://us.i.posthog.com   | PostHog host URL                             |
| VITE_SENTRY_DSN             | No       | —                          | Sentry DSN for frontend error tracking       |
| VITE_PADDLE_CLIENT_TOKEN    | No       | —                          | Paddle client token for payments             |
| VITE_PADDLE_ENVIRONMENT     | No       | sandbox                    | Paddle environment (sandbox/production)      |
| VITE_E2E_AUTH_BYPASS        | No       | —                          | Bypass Clerk auth for E2E testing            |
| VITE_E2E_API_KEY            | No       | —                          | API key for E2E bypass auth                  |

---

## Bare Metal Setup (Manual)

### 1. Install dependencies

```bash
cd ventus-voice
npm run install:all
# This runs: cd backend && npm install && cd ../frontend && npm install
```

### 2. Create the database

**Option A: Local PostgreSQL**

```bash
# Make sure PostgreSQL is running
brew services start postgresql@16   # macOS
# or: sudo systemctl start postgresql  # Linux

# Create the database
createdb vora_local
```

**Option B: Docker PostgreSQL**

```bash
docker run --name vora-postgres \
  -e POSTGRES_DB=vora_local \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  -d postgres:15-alpine
```

### 3. Configure environment files

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Edit `backend/.env` and set at minimum:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vora_local"
CLERK_SECRET_KEY=sk_test_your_clerk_key
```

Edit `frontend/.env` and set at minimum:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key
```

### 4. Run database migrations and seed

```bash
cd backend
npx prisma generate        # Generate Prisma client
npx prisma migrate deploy  # Apply all migrations
npx tsx prisma/seed-local.ts  # Seed demo data
cd ..
```

Or use the setup script:

```bash
npm run setup
# This runs: cd backend && npm run db:setup-local
# Which does: create DB -> generate -> migrate -> seed
```

### 5. Start the backend

```bash
cd backend
npm run dev
# Server starts on http://localhost:3001
```

### 6. Start the frontend (separate terminal)

```bash
cd frontend
npm run dev
# App opens on http://localhost:8080
```

Or use the unified startup script:

```bash
cd ventus-voice
npm run local
# Starts both backend and frontend with preflight checks
```

---

## Docker Setup

A Docker Compose file provides PostgreSQL, Redis, pgAdmin, and Redis Commander
for local development. It lives at the project root (one level above `ventus-voice/`).

### Start infrastructure services

```bash
# From the project root (Stojancpv-main/)
docker compose -f docker-compose.local.yml up -d
```

This starts:

| Service          | URL / Port                    | Credentials                      |
|------------------|-------------------------------|----------------------------------|
| PostgreSQL       | localhost:5432                | postgres / postgres / vora_local |
| Redis            | localhost:6379                | (no password)                    |
| pgAdmin          | http://localhost:5050         | admin@vora.local / admin         |
| Redis Commander  | http://localhost:8081         | (none)                           |

### Stop infrastructure

```bash
docker compose -f docker-compose.local.yml down
# Add -v to also remove data volumes:
docker compose -f docker-compose.local.yml down -v
```

You still run the backend and frontend outside Docker using `npm run local`.

---

## Architecture Overview

```
+------------------+       +-------------------------+       +-------------------+
|                  |       |                         |       |                   |
|  Browser         | ----> |  Frontend (Vite+React)  | ----> |  Backend API      |
|                  |       |  localhost:8080          |       |  localhost:3001    |
|                  |       |                         |       |                   |
+------------------+       +-------------------------+       +--------+----------+
                                                                      |
                                                                      v
                                                             +--------+----------+
                                                             |                   |
                                                             |  PostgreSQL       |
                                                             |  localhost:5432   |
                                                             |                   |
                                                             +-------------------+

External Services (require API keys):

  Clerk Auth          - Authentication and user management
  LiveKit Cloud       - WebRTC voice session infrastructure
  Google Gemini API   - Agent compiler (prompt -> config)
  OpenAI API          - GPT-based features
  ElevenLabs          - Text-to-speech for voice agents
  Deepgram / Soniox   - Speech-to-text transcription
  Fly.io              - Agent worker deployment
  Paddle              - Payment processing
  PostHog             - Product analytics
  Sentry              - Error tracking
```

---

## Available Scripts

All commands run from the `ventus-voice/` directory unless noted.

### Root (`ventus-voice/package.json`)

| Command              | Description                                           |
|----------------------|-------------------------------------------------------|
| `npm run local`      | Start entire dev environment (preflight + backend + frontend) |
| `npm run setup`      | Create database, run migrations, seed demo data       |
| `npm run db:reset`   | Drop and recreate database, re-migrate, re-seed       |
| `npm run db:seed`    | Run seed script only                                  |
| `npm run frontend`   | Start frontend dev server only                        |
| `npm run backend`    | Start backend dev server only                         |
| `npm run install:all`| Install dependencies for both backend and frontend    |

### Backend (`ventus-voice/backend/`)

| Command                    | Description                                    |
|----------------------------|------------------------------------------------|
| `npm run dev`              | Start backend in watch mode (tsx)              |
| `npm run build`            | Compile TypeScript to JavaScript               |
| `npm start`                | Run compiled production build                  |
| `npm run type-check`       | TypeScript type checking (no emit)             |
| `npm run lint`             | Run ESLint on src/                             |
| `npm run test`             | Run all Jest tests                             |
| `npm run test:unit`        | Run unit tests only                            |
| `npm run test:integration` | Run integration tests only                     |
| `npm run test:security`    | Run security tests only                        |
| `npm run test:e2e`         | Run Playwright E2E tests                       |
| `npm run db:generate`      | Generate Prisma client                         |
| `npm run db:migrate`       | Create and apply a new migration (interactive) |
| `npm run db:migrate:deploy`| Apply pending migrations (non-interactive)     |
| `npm run db:push`          | Push schema to DB without migration files      |
| `npm run db:studio`        | Open Prisma Studio (database GUI)              |
| `npm run db:setup-local`   | Full local DB setup (create + migrate + seed)  |
| `npm run db:reset-local`   | Drop and recreate local DB                     |
| `npm run db:seed-local`    | Seed local development data                    |
| `npm run db:rollback`      | Rollback last migration                        |

---

## Feature Availability Matrix

Not all features require all API keys. The dashboard and agent management work
with just a database and Clerk auth. Add API keys as needed:

| Feature                  | Required Keys                                    |
|--------------------------|--------------------------------------------------|
| Dashboard, agent CRUD    | DATABASE_URL, CLERK_SECRET_KEY                   |
| Voice calls (test call)  | LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_WS_URL |
| Agent compiler (AI gen)  | GOOGLE_GEMINI_API_KEY                            |
| Agent Forge (Grok)       | XAI_API_KEY                                      |
| Brand analysis           | GOOGLE_API_KEY                                   |
| GPT-based features       | OPENAI_API_KEY                                   |
| Claude-based features    | ANTHROPIC_API_KEY                                |
| Text-to-speech previews  | ELEVENLABS_API_KEY                               |
| Agent deployment         | FLY_API_TOKEN                                    |
| Payment / subscriptions  | VITE_PADDLE_CLIENT_TOKEN, Paddle price IDs       |
| Analytics                | VITE_POSTHOG_KEY                                 |
| Error tracking           | SENTRY_DSN, VITE_SENTRY_DSN                      |
| CRM integration          | MAKE_WEBHOOK_URL                                 |

---

## Seed Data

The local seed script (`npm run db:seed` or `npx tsx prisma/seed-local.ts`) creates:

| Entity          | Count | Details                                                    |
|-----------------|-------|------------------------------------------------------------|
| Organization    | 1     | "Vora Demo Workspace" (id: org_local_dev_demo)            |
| User            | 1     | "Demo User" demo@voicevora.com (id: user_local_dev_demo)  |
| Agents          | 3     | Customer Support (ACTIVE), Sales Outreach (ACTIVE), Interview Screener (DRAFT) |
| Sessions        | 5     | Spread across past 6 days with varying durations and error counts |
| Credit Packs    | 3     | 10 Credits ($10), 50 Credits ($50), 100 Credits ($100)    |
| Provider Pricing| 6     | GPT-4o, GPT-4o-mini, Claude 3.5 Sonnet, Gemini Flash, Deepgram Nova-2, ElevenLabs |

All seed operations use upsert, so running the seed script multiple times is safe
and produces no duplicates.

---

## Troubleshooting

### CORS errors in browser console

**Symptom**: `Access-Control-Allow-Origin` errors when frontend calls backend.

**Cause**: Backend CORS configuration does not include the frontend origin.

**Fix**: Set `FRONTEND_URL=http://localhost:8080` in `backend/.env` and restart
the backend.

### 401 Unauthorized on API calls

**Symptom**: Every API request returns 401.

**Cause**: Clerk authentication keys are missing or invalid.

**Fix**: Verify `CLERK_SECRET_KEY` in `backend/.env` and
`VITE_CLERK_PUBLISHABLE_KEY` in `frontend/.env` are valid Clerk test keys from
your Clerk dashboard. Restart both services after updating.

### Database connection failed

**Symptom**: `PrismaClientInitializationError: Can't reach database server`.

**Cause**: PostgreSQL is not running or `DATABASE_URL` is incorrect.

**Fix**:
```bash
# Check if PostgreSQL is running
pg_isready
# If not running:
brew services start postgresql@16   # macOS
# Or if using Docker:
docker compose -f docker-compose.local.yml up -d postgres
# Verify DATABASE_URL in backend/.env matches your setup
```

### Migration errors

**Symptom**: `prisma migrate deploy` fails with schema drift or missing tables.

**Cause**: Database schema is out of sync with migration files.

**Fix**:
```bash
cd backend
npx prisma migrate reset --force   # WARNING: drops all data
npx tsx prisma/seed-local.ts       # Re-seed demo data
```

### Port already in use

**Symptom**: `EADDRINUSE: address already in use :::3001` (or 8080).

**Cause**: Another process is using the port.

**Fix**:
```bash
# Find what is using the port
lsof -ti:3001
# Kill it
kill $(lsof -ti:3001)
# Or use a different port:
PORT=3002 npm run dev
```

### Blank page in browser

**Symptom**: http://localhost:8080 shows a white screen with no content.

**Cause**: Frontend build error or missing environment variables.

**Fix**:
1. Check the browser developer console for errors.
2. Verify `frontend/.env` has `VITE_API_BASE_URL=http://localhost:3001`.
3. Verify `VITE_CLERK_PUBLISHABLE_KEY` is set.
4. Restart the frontend: `cd frontend && npm run dev`.

### WebSocket connection failed

**Symptom**: LiveKit voice calls fail with WebSocket errors.

**Cause**: Missing or invalid LiveKit configuration.

**Fix**: Set `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, and `LIVEKIT_WS_URL` in
`backend/.env`, and `VITE_LIVEKIT_URL` in `frontend/.env`. You need a LiveKit
Cloud account at https://livekit.io/.

### Prisma client not generated

**Symptom**: `Cannot find module '.prisma/client'` or similar import errors.

**Cause**: Prisma client was not generated after installing dependencies.

**Fix**:
```bash
cd backend
npx prisma generate
```

### Missing environment variables

**Symptom**: Backend crashes on startup with `Missing required environment variable`.

**Cause**: Required variables are not set in `backend/.env`.

**Fix**:
```bash
# Compare your .env with the example
diff backend/.env backend/.env.example
# Or recreate from example and re-fill values:
cp backend/.env.example backend/.env
```

### Node version mismatch

**Symptom**: Syntax errors or unexpected token errors during build or dev.

**Cause**: Running Node.js < 20.

**Fix**:
```bash
node -v
# If below v20, upgrade:
nvm install 20
nvm use 20
```

### Redis connection refused

**Symptom**: Backend logs `ECONNREFUSED` for Redis on startup.

**Cause**: Redis is not running. Redis is optional for local development; the
backend falls back gracefully when Redis is unavailable.

**Fix**: If you need caching, start Redis:
```bash
docker compose -f docker-compose.local.yml up -d redis
# Or install locally:
brew install redis && brew services start redis
```

---

## Nuclear Reset

When everything is broken and you want to start over completely:

```bash
cd ventus-voice

# 1. Stop all running processes (Ctrl+C or kill)

# 2. Reset the database
cd backend
npx prisma migrate reset --force
cd ..

# 3. Remove all node_modules
rm -rf backend/node_modules frontend/node_modules

# 4. Clear npm cache (optional)
npm cache clean --force

# 5. Reinstall everything
npm run install:all

# 6. Regenerate Prisma client
cd backend && npx prisma generate && cd ..

# 7. Re-run full setup (migrate + seed)
npm run setup

# 8. Start fresh
npm run local
```
