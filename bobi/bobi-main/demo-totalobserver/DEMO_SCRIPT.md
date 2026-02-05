# TotalObserver Demo Script

## Pre-Demo Checklist

- [ ] Start demo: `./start-demo.sh`
- [ ] Open UI: http://localhost:8080
- [ ] Verify "Connected" status
- [ ] Have phone ready to call LiveKit room
- [ ] Pre-populate calendar with 2-3 meetings

## Demo Flow (10 minutes)

### Introduction (1 min)

"Dobro jutro! Danas ću vam pokazati AI glasovni asistent integrisan sa TotalObserver sistemom."

*Show UI on screen - point out:*
- Live transcript
- Tool call visualization
- MCP integrations available

### Scenario 1: Create Work Order (3 min)

**Call agent and say:**
```
"Dobar dan. Zakupac u Plaza Mall-u prijavljuje problem sa eskalatorom.
Pravi čudan zvuk i ne radi glatko."
```

**Expected:**
- Agent asks for priority → Say "Visok prioritet"
- Agent creates work order
- UI shows `create_work_order` tool call
- Agent confirms WO number

**Point out:**
- Real-time transcript
- MCP tool call to TotalObserver
- Work order created in system

### Scenario 2: Assign Technician (2 min)

**Continue conversation:**
```
"Koji tehničar je dostupan za eskalator?"
```

**Expected:**
- Agent calls `get_technician_availability`
- Shows available technicians
- Suggests Marko (general skills)

**Say:**
```
"U redu, dodeli Marku."
```

**Point out:**
- Multiple MCP calls chained
- Context maintained across conversation
- Natural language → structured API calls

### Scenario 3: Schedule Demo (2 min)

**Say:**
```
"Zakazi mi demo poziv sa TotalObserver timom za petak u 15 sati."
```

**Expected:**
- Agent calls `create_event` (real Google Calendar!)
- Creates calendar event
- Confirms created

**Point out:**
- Real Google Calendar integration
- OAuth authentication
- Actual event created (show calendar on screen)

### Scenario 4: CRM Lookup (2 min)

**Say:**
```
"Ko je Dragan iz TotalObserver-a? Treba mi info pre sastanka."
```

**Expected:**
- Agent calls `search_contacts`
- Returns full contact details
- Mentions deal stage, notes

**Point out:**
- CRM integration
- Context-aware responses
- Sales intelligence at voice command

## Key Talking Points

1. **Multi-System Integration**
   - One voice interface → Multiple systems
   - Work orders, calendar, CRM, email

2. **Real vs Mock**
   - Google Calendar/Gmail: Real APIs
   - TotalObserver/CRM: Mock (your system would plug in here)

3. **Serbian Language**
   - Fully supports Serbian (Gemini Realtime)
   - Natural conversation flow

4. **Privacy/Security**
   - Self-hosted option (LiveKit open source)
   - Data stays on your infrastructure
   - OAuth for Google (secure)

5. **Extensibility**
   - MCP protocol - add any integration
   - Easy to add new tools/systems

## Q&A Preparation

**Q: How hard is it to integrate our system?**
A: MCP interface is simple - implement tool functions, register with bridge. Similar to REST API.

**Q: Serbian language quality?**
A: Gemini Realtime handles Serbian well. Better than Deepgram/ElevenLabs (which we tested).

**Q: Can it run on-premise?**
A: Yes! LiveKit is open source, can self-host. Gemini calls go to Google but can use local LLM alternative.

**Q: Cost?**
A: Per-minute pricing from Google. Much cheaper than human agent. ROI quickly if handling routine queries.

**Q: What if it doesn't understand?**
A: Fallback to human agent (warm transfer). Agent says "Trenutak, povezujem vas sa kolegom..."

## Backup Plan

If live demo fails:
1. Have pre-recorded video ready
2. Show logs/transcripts from test runs
3. Walk through code architecture
