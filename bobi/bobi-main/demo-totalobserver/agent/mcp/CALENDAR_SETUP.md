# Google Calendar Setup

## 1. Enable Google Calendar API

1. Go to https://console.cloud.google.com/
2. Create a new project (or use existing)
3. Enable Google Calendar API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Application type: "Desktop app"
6. Download credentials as `credentials.json`
7. Place in `demo-totalobserver/agent/mcp/credentials.json`

## 2. First Run Authentication

On first run, the client will:
1. Open browser for OAuth consent
2. You log in with your Google account
3. Grant calendar access
4. Token saved to `token.json` for future use

## 3. Testing

```python
from mcp.google_calendar_client import GoogleCalendarClient

client = GoogleCalendarClient()
result = client.get_calendar_events()
print(result)
```
