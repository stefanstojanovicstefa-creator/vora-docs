# TotalObserver Demo - Troubleshooting

## Agent Won't Start

### Symptom: `ModuleNotFoundError`

**Solution:**
```bash
cd agent
source ../../venv/bin/activate
pip install -r requirements.txt
```

### Symptom: `LIVEKIT_URL not set`

**Solution:**
```bash
# Check .env exists and is symlinked
ls -la agent/.env

# Should show: agent/.env -> ../../.env
# If not:
cd agent
ln -s ../../.env .env
```

### Symptom: `MCP Bridge failed to initialize`

**Solution:**
```bash
# Check mock data files exist
ls -la mock-data/*.json

# Should have:
# - buildings.json
# - technicians.json
# - work_orders.json
# - crm_contacts.json
```

## UI Won't Start

### Symptom: `npm: command not found`

**Solution:**
```bash
# Install Node.js 18+
brew install node

# Then:
cd demo-ui
npm install
```

### Symptom: UI shows "Disconnected"

**Solution:**
1. Check agent is running first
2. Check LiveKit URL in `.env`
3. Check room name matches

### Symptom: UI blank/white screen

**Solution:**
```bash
# Check browser console for errors
# Common issue: Vite port already in use

# Solution: Kill existing process
lsof -ti:8080 | xargs kill -9

# Restart UI
npm run dev
```

## Google OAuth Issues

### Symptom: `credentials.json not found`

**Solution:**
1. Go to https://console.cloud.google.com/
2. APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Desktop app)
4. Download as `credentials.json`
5. Place in `agent/mcp/credentials.json`

### Symptom: OAuth consent screen error

**Solution:**
1. In Google Cloud Console
2. APIs & Services → OAuth consent screen
3. Add test users (your email)
4. Save and retry

### Symptom: `invalid_grant` error

**Solution:**
```bash
# Delete token and re-authenticate
rm agent/mcp/token.json
rm agent/mcp/gmail_token.json

# Restart agent - will prompt for OAuth again
```

## Tool Calling Issues

### Symptom: Agent doesn't call tools

**Check agent logs:**
```
[MCP BRIDGE] ✓ Registered X tools  # Should see this
```

If not seeing this:
- Check `mcp_bridge` initialized in agent code
- Check `build_system_prompt_with_tools()` includes tool descriptions

### Symptom: Tool calls fail with error

**Check agent logs for:**
```
[MCP CALL] ⚠ Tool 'X' failed: ...
```

Common causes:
- Mock data file missing/malformed
- Google API credentials missing
- Tool parameters incorrect

## Demo Day Emergencies

### Agent crashes mid-demo

**Quick recovery:**
```bash
# Restart agent only (keeps UI running)
cd agent
python totalobserver_demo_agent.py dev
```

### LiveKit disconnects

**Causes:**
- Network issues
- Room timeout
- Server restart

**Solution:**
- Have backup video ready
- Explain "this is what it looks like when working"
- Continue with architecture explanation

### Google API rate limit

**Solution:**
- Switch to mock mode: `USE_REAL_GOOGLE=false`
- Explain "calendar integration same as you saw, just using mock data"

## Logs to Check

### Agent logs location
```
# Console output from agent terminal
# Look for:
[DEMO AGENT] ✓ Agent started
[MCP BRIDGE] ✓ Registered 22 tools
[CALENDAR] ✓ Authenticated with Google
```

### UI logs location
```
# Browser console (F12)
# Look for:
[LiveKit] Connected to room
[LiveKit] Data received: {"type":"transcript",...}
```

## Performance Issues

### Agent response slow

**Causes:**
- Gemini API latency
- Network issues

**Solution:**
- Check internet connection
- Try simpler prompts
- Restart agent

### UI laggy

**Causes:**
- Too many transcripts/tool calls
- Browser memory

**Solution:**
```bash
# Refresh browser
# Or restart UI:
cd demo-ui
npm run dev
```

## Contact

If all else fails:
- Check logs carefully
- Google error messages
- Ask for help in #support
