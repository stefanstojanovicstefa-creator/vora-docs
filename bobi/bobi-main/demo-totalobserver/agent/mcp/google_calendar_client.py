"""
Real Google Calendar API - MCP Tool Provider
Uses Google Calendar API v3 for actual calendar operations
"""
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# If modifying these scopes, delete the token.json file
SCOPES = ['https://www.googleapis.com/auth/calendar']

class GoogleCalendarClient:
    """Real Google Calendar API client"""

    def __init__(self, credentials_path: Optional[str] = None):
        self.credentials_path = credentials_path or str(
            Path(__file__).parent / "credentials.json"
        )
        self.token_path = str(Path(__file__).parent / "token.json")
        self.service = None
        self._authenticate()

    def _authenticate(self):
        """Authenticate with Google Calendar API"""
        creds = None

        # Token file stores user's access and refresh tokens
        if os.path.exists(self.token_path):
            creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)

        # If no valid credentials, let user log in
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_path):
                    print(f"[CALENDAR] ⚠ credentials.json not found at {self.credentials_path}")
                    print("[CALENDAR] ⚠ Using mock mode - no real calendar operations")
                    self.service = None
                    return

                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, SCOPES
                )
                creds = flow.run_local_server(port=0)

            # Save credentials for next run
            with open(self.token_path, 'w') as token:
                token.write(creds.to_json())

        try:
            self.service = build('calendar', 'v3', credentials=creds)
            print("[CALENDAR] ✓ Authenticated with Google Calendar")
        except Exception as e:
            print(f"[CALENDAR] ⚠ Failed to build service: {e}")
            self.service = None

    def get_calendar_events(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        max_results: int = 10
    ) -> Dict:
        """Get calendar events in date range"""
        if not self.service:
            return {"error": "Calendar service not available (credentials missing)"}

        try:
            # Default to today -> 7 days from now
            if not start_date:
                start = datetime.utcnow().isoformat() + 'Z'
            else:
                start = datetime.fromisoformat(start_date).isoformat() + 'Z'

            if not end_date:
                end = (datetime.utcnow() + timedelta(days=7)).isoformat() + 'Z'
            else:
                end = datetime.fromisoformat(end_date).isoformat() + 'Z'

            events_result = self.service.events().list(
                calendarId='primary',
                timeMin=start,
                timeMax=end,
                maxResults=max_results,
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])

            print(f"[CALENDAR] ✓ Found {len(events)} events")
            return {
                "success": True,
                "events": events,
                "count": len(events)
            }

        except HttpError as e:
            print(f"[CALENDAR] ⚠ API error: {e}")
            return {"error": str(e)}

    def create_event(
        self,
        title: str,
        start_time: str,
        end_time: str,
        attendees: Optional[List[str]] = None,
        description: Optional[str] = None
    ) -> Dict:
        """Create calendar event"""
        if not self.service:
            return {"error": "Calendar service not available (credentials missing)"}

        try:
            event = {
                'summary': title,
                'description': description or '',
                'start': {
                    'dateTime': start_time,
                    'timeZone': 'Europe/Belgrade',
                },
                'end': {
                    'dateTime': end_time,
                    'timeZone': 'Europe/Belgrade',
                },
            }

            if attendees:
                event['attendees'] = [{'email': email} for email in attendees]

            created_event = self.service.events().insert(
                calendarId='primary',
                body=event
            ).execute()

            print(f"[CALENDAR] ✓ Created event: {title}")
            return {
                "success": True,
                "event": created_event,
                "message": f"Event '{title}' kreiran za {start_time}"
            }

        except HttpError as e:
            print(f"[CALENDAR] ⚠ Failed to create event: {e}")
            return {"error": str(e)}

    def check_availability(self, date: str, duration_minutes: int = 30) -> Dict:
        """Check available time slots on date"""
        if not self.service:
            return {"error": "Calendar service not available (credentials missing)"}

        try:
            # Parse date and get events for that day
            target_date = datetime.fromisoformat(date)
            start = target_date.replace(hour=9, minute=0).isoformat() + 'Z'
            end = target_date.replace(hour=17, minute=0).isoformat() + 'Z'

            events_result = self.service.events().list(
                calendarId='primary',
                timeMin=start,
                timeMax=end,
                singleEvents=True,
                orderBy='startTime'
            ).execute()

            events = events_result.get('items', [])

            # Simple availability: find gaps between events
            # (This is simplified - real implementation would be more robust)
            available_slots = []
            current_time = target_date.replace(hour=9, minute=0)
            end_time = target_date.replace(hour=17, minute=0)

            for event in events:
                event_start = datetime.fromisoformat(
                    event['start'].get('dateTime', event['start'].get('date')).replace('Z', '+00:00')
                )
                if (event_start - current_time).seconds >= duration_minutes * 60:
                    available_slots.append({
                        "start": current_time.isoformat(),
                        "end": event_start.isoformat()
                    })
                event_end = datetime.fromisoformat(
                    event['end'].get('dateTime', event['end'].get('date')).replace('Z', '+00:00')
                )
                current_time = max(current_time, event_end)

            # Check if there's time after last event
            if (end_time - current_time).seconds >= duration_minutes * 60:
                available_slots.append({
                    "start": current_time.isoformat(),
                    "end": end_time.isoformat()
                })

            print(f"[CALENDAR] ✓ Found {len(available_slots)} available slots")
            return {
                "success": True,
                "available_slots": available_slots,
                "count": len(available_slots)
            }

        except Exception as e:
            print(f"[CALENDAR] ⚠ Failed to check availability: {e}")
            return {"error": str(e)}

    def reschedule_event(self, event_id: str, new_start_time: str) -> Dict:
        """Reschedule existing event"""
        if not self.service:
            return {"error": "Calendar service not available (credentials missing)"}

        try:
            # Get existing event
            event = self.service.events().get(
                calendarId='primary',
                eventId=event_id
            ).execute()

            # Calculate duration
            old_start = datetime.fromisoformat(
                event['start'].get('dateTime', event['start'].get('date')).replace('Z', '+00:00')
            )
            old_end = datetime.fromisoformat(
                event['end'].get('dateTime', event['end'].get('date')).replace('Z', '+00:00')
            )
            duration = old_end - old_start

            # Update times
            new_start = datetime.fromisoformat(new_start_time)
            new_end = new_start + duration

            event['start'] = {
                'dateTime': new_start.isoformat(),
                'timeZone': 'Europe/Belgrade'
            }
            event['end'] = {
                'dateTime': new_end.isoformat(),
                'timeZone': 'Europe/Belgrade'
            }

            updated_event = self.service.events().update(
                calendarId='primary',
                eventId=event_id,
                body=event
            ).execute()

            print(f"[CALENDAR] ✓ Rescheduled event {event_id}")
            return {
                "success": True,
                "event": updated_event,
                "message": f"Event je pomeren na {new_start_time}"
            }

        except HttpError as e:
            print(f"[CALENDAR] ⚠ Failed to reschedule: {e}")
            return {"error": str(e)}
