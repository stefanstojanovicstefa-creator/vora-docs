# Ventus Voice Backend API

Node.js + Express backend API za Ventus Voice platformu.

## 🚀 Šta je ovo?

Backend servis koji pruža:
- **Agent Compiler** - Transformiše tekstualne prompte u voice agent konfiguracije pomoću Google Gemini API
- **Agent Management** - CRUD operacije za voice agente
- **LiveKit Token Generation** - Generiše pristupne tokene za voice sesije
- **Fly.io Deployment** - Automatski deployuje Python agent workers na Fly.io

## 📋 Preduslov

- **Node.js** 20+
- **PostgreSQL** 15+ (ili Docker)
- **Google Gemini API** key ([dobij ovde](https://ai.google.dev/))
- **LiveKit Cloud** account ([registruj se](https://livekit.io/))
- **Fly.io** account i CLI ([instalacija](https://fly.io/docs/hands-on/install-flyctl/))

## 🛠 Instalacija

### 1. Instaliraj dependencies

```bash
cd backend
npm install
```

### 2. Podesi environment variables

Kopiraj `.env.example` u `.env`:

```bash
cp .env.example .env
```

Popuni potrebne vrednosti u `.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ventus_voice"

# Google Gemini API (već postavljen)
GOOGLE_GEMINI_API_KEY=AIza...

# LiveKit (dobij sa livekit.io dashboard)
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
LIVEKIT_WS_URL=wss://your-project.livekit.cloud

# Fly.io (dobij sa: fly auth token)
FLY_API_TOKEN=your-fly-token
```

### 3. Podesi PostgreSQL

**Opcija A: Lokalni PostgreSQL**

```bash
# Kreiraj databazu
createdb ventus_voice
```

**Opcija B: Docker PostgreSQL**

```bash
docker run --name ventus-postgres \
  -e POSTGRES_DB=ventus_voice \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15
```

### 4. Pokreni migracije

```bash
# Generiši Prisma client
npm run db:generate

# Pokreni migracije
npm run db:migrate
```

## 🏃 Pokretanje

### Development

```bash
npm run dev
```

Server će se pokrenuti na `http://localhost:3001`

### Production

```bash
# Build
npm run build

# Start
npm start
```

## 📡 API Endpoints

### Health Check
```bash
GET /health
```

### Agents

**Kreiraj agenta**
```bash
POST /api/agents/create
{
  "prompt": "Napravi mi voice asistenta koji...",
  "userId": "user_123"
}
```

**Lista agenata**
```bash
GET /api/agents?userId=user_123
```

**Detalji agenta**
```bash
GET /api/agents/:agentId?userId=user_123
```

**Update agenta**
```bash
PATCH /api/agents/:agentId
{
  "userId": "user_123",
  "updates": {
    "name": "Novi naziv",
    "config": { ... }
  }
}
```

**Obriši agenta**
```bash
DELETE /api/agents/:agentId?userId=user_123
```

**Regeneriši agenta**
```bash
POST /api/agents/:agentId/regenerate
{
  "userId": "user_123",
  "prompt": "Novi prompt..."
}
```

### LiveKit Tokens

**Generiši token za usera**
```bash
POST /api/tokens/generate
{
  "agentId": "agt_123",
  "participantName": "User 123"
}
```

### Deployment

**Deployuj agenta**
```bash
POST /api/deploy/:agentId
{
  "userId": "user_123"
}
```

**Proveri status**
```bash
GET /api/deploy/:agentId/status
```

**Uništi deployment**
```bash
DELETE /api/deploy/:agentId?userId=user_123
```

## 🧪 Testiranje

Testiraj Agent Compiler direktno:

```bash
curl -X POST http://localhost:3001/api/agents/create \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Treba mi support agent za hotel koji govori arapski",
    "userId": "test_user"
  }'
```

## 🗄 Database Management

```bash
# Prisma Studio (GUI za database)
npm run db:studio

# Reset database
npm run db:push

# Generate Prisma client
npm run db:generate
```

## 📁 Struktura

```
backend/
├── src/
│   ├── config/          # Database config
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   │   ├── agent-compiler.service.ts     # ⭐ KLJUČNI - Agent Compiler
│   │   ├── agent-manager.service.ts      # CRUD logic
│   │   ├── agent-deployer.service.ts     # Fly.io deployment
│   │   └── livekit-token.service.ts      # Token generation
│   ├── schemas/         # Zod validation schemas
│   ├── templates/       # Prompt templates
│   │   └── agent-compiler-prompt.ts      # ⭐ KLJUČNI - Gemini prompt
│   ├── utils/           # Helpers
│   └── index.ts         # Entry point
├── prisma/
│   └── schema.prisma    # Database schema
└── package.json
```

## 🔑 Ključne Komponente

### Agent Compiler (`agent-compiler.service.ts`)
Najvažniji deo platforme. Koristi Google Gemini API da transformiše user prompt u kompletnu agent konfiguraciju.

### Agent Compiler Prompt (`agent-compiler-prompt.ts`)
Definiše kako Gemini razume i transformiše user prompte. Ovo je "mozak" platforme.

### Agent Deployer (`agent-deployer.service.ts`)
Automatski deployuje Python voice agente na Fly.io. Generiše sve potrebne fajlove i konfiguriše deployment.

## 🐛 Troubleshooting

**Prisma connection error**
```bash
# Proveri DATABASE_URL u .env
# Proveri da li PostgreSQL radi
pg_isready
```

**Gemini API error**
```bash
# Proveri API key
curl https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_API_KEY
```

**Fly.io deployment fails**
```bash
# Login
fly auth login

# Dobij token
fly auth token

# Dodaj u .env
FLY_API_TOKEN=...
```

## Local Development

For the full local development guide including environment setup, Docker instructions, architecture overview, troubleshooting, and more, see [LOCAL_DEVELOPMENT.md](../LOCAL_DEVELOPMENT.md).

### Quick Start (Backend Only)

```bash
cd ventus-voice/backend
npm install
cp .env.example .env   # then fill in required values
npm run db:setup-local
npm run dev
```

The backend will start on `http://localhost:3001`.

### Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:setup-local` | Create local PostgreSQL database, run migrations, generate Prisma client, and seed data |
| `npm run db:reset-local` | Drop and recreate the local database, re-run migrations and seed |
| `npm run db:seed-local` | Run the local seed script to populate test data (org, user, agents, sessions, pricing) |
| `npm run db:generate` | Regenerate the Prisma client after schema changes |
| `npm run db:migrate` | Create and apply a new Prisma migration during development |
| `npm run db:studio` | Open Prisma Studio, a GUI for browsing and editing database records |

## Notes

- Agent Compiler koristi `gemini-2.0-flash-exp` model
- Svi agenti se deployuju kao zasebne Fly.io aplikacije
- Database automatski čuva config JSON za svaki agent
- LiveKit tokeni se generišu on-demand za svaku sesiju
