# TotalObserver AI Voice Assistant Demo

Live demo showcasing AI voice assistant with MCP integrations for facility management.

## Features

- 🎙️ **Voice Interaction** - Gemini Realtime (Serbian language)
- 🔧 **TotalObserver Integration** - Work orders, buildings, technicians (mock)
- 📅 **Google Calendar** - Real integration (OAuth)
- 📧 **Gmail** - Real integration (OAuth)
- 👤 **CRM** - Contact management (mock HubSpot-style)
- 🎨 **Live Demo UI** - Real-time transcript & tool call visualization

## Quick Start

### 1. Setup

```bash
cd demo-totalobserver

# Install Python dependencies
cd agent
pip install -r requirements.txt
cd ..

# Install Node dependencies
cd demo-ui
npm install
cd ..
```

### 2. Configure Environment

Copy `.env` from parent directory (already done via symlink):

```bash
# agent/.env should be symlinked to ../../.env
ls -la agent/.env  # Should show -> ../../.env
```

Required env vars:
- `LIVEKIT_URL` - LiveKit server URL
- `LIVEKIT_API_KEY` - LiveKit API key
- `LIVEKIT_API_SECRET` - LiveKit API secret
- `GOOGLE_API_KEY` - For Gemini
- `USE_REAL_GOOGLE=true` - Enable real Calendar/Gmail (optional)

### 3. Google OAuth Setup (Optional - for real Calendar/Gmail)

If using real Google integrations:

1. Go to https://console.cloud.google.com/
2. Create OAuth 2.0 credentials (Desktop app)
3. Download `credentials.json`
4. Place in `agent/mcp/credentials.json`

On first run, browser will open for OAuth consent.

### 4. Launch Demo

```bash
./start-demo.sh
```

This starts:
- Agent on LiveKit
- UI on http://localhost:8080

### 5. Stop Demo

```bash
# Kill processes shown in start-demo.sh output
kill [AGENT_PID] [UI_PID]
```

## Manual Launch

### Start Agent

```bash
cd agent
source ../../venv/bin/activate
python totalobserver_demo_agent.py dev
```

### Start UI

```bash
cd demo-ui
npm run dev
```

## Project Structure

```
demo-totalobserver/
├── agent/                      # Voice agent
│   ├── totalobserver_demo_agent.py
│   ├── mcp/                    # MCP tool providers
│   │   ├── bridge.py           # Tool coordinator
│   │   ├── mock_totalobserver.py
│   │   ├── mock_crm.py
│   │   ├── google_calendar_client.py
│   │   └── gmail_client.py
│   └── prompts/                # Serbian prompts
├── demo-ui/                    # React visualization
│   ├── src/
│   │   ├── App.tsx
│   │   ├── components/
│   │   └── hooks/
├── mock-data/                  # Demo data
│   ├── buildings.json
│   ├── technicians.json
│   ├── work_orders.json
│   └── crm_contacts.json
└── docs/
    └── plans/
```

## Demo Scenarios

### 1. Create Work Order

**User says:** "Zakupac u Plaza Mall-u prijavljuje kvar na eskalatoru, pravi čudan zvuk"

**Agent:**
- Confirms understanding
- Calls `create_work_order()`
- Creates WO-2024-xxxx
- Asks if should assign technician

### 2. Schedule Demo

**User says:** "Zakazi mi demo sa TotalObserver za petak u 15h"

**Agent:**
- Calls `create_event()` (real Google Calendar)
- Confirms created
- Offers to send email confirmation

### 3. Check Technician Status

**User says:** "Šta ima kod Marka?"

**Agent:**
- Calls `list_open_work_orders(technician_id="tech-001")`
- Summarizes Marko's current assignments

### 4. CRM Lookup

**User says:** "Ko je Dragan iz TotalObserver-a?"

**Agent:**
- Calls `search_contacts(query="Dragan")`
- Returns full contact details
- Shows deal stage, notes, etc.

## Troubleshooting

### Agent fails to start

- Check `.env` has all required keys
- Check LiveKit credentials are valid
- Check Python venv is activated

### UI not connecting

- Check agent is running first
- Check LiveKit room name matches
- Check browser console for errors

### Google OAuth fails

- Check `credentials.json` is present
- Check OAuth consent screen is configured
- Delete `token.json` and re-authenticate

### Tools not working

- Check MCP bridge initialized (logs show "✓ Registered X tools")
- Check mock data files exist
- Check Gemini function calling is enabled

## Tech Stack

- **Agent:** Python 3.11, LiveKit Agents, Gemini Realtime
- **MCP:** Google Calendar API, Gmail API, Mock servers
- **UI:** React 18, TypeScript, Tailwind CSS, Vite
- **Language:** Serbian (srpski)

## Notes

- Mock data is in `mock-data/` directory
- Real Google integrations require OAuth setup
- Serbian language throughout (prompts + UI)
- Demo designed for Friday presentation
