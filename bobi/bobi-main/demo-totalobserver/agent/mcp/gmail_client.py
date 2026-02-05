"""
Gmail MCP Client - Real Gmail API integration
Handles email operations: search, read, draft, send
"""
import os
import base64
from datetime import datetime
from typing import Dict, List, Optional
from pathlib import Path
from email.mime.text import MIMEText

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Scopes for Gmail
SCOPES = ['https://www.googleapis.com/auth/gmail.modify']

class GmailClient:
    """Real Gmail API client"""

    def __init__(self, credentials_path: Optional[str] = None):
        self.credentials_path = credentials_path or str(
            Path(__file__).parent / "credentials.json"
        )
        self.token_path = str(Path(__file__).parent / "gmail_token.json")
        self.service = None
        self._authenticate()

    def _authenticate(self):
        """Authenticate with Gmail API"""
        creds = None

        if os.path.exists(self.token_path):
            creds = Credentials.from_authorized_user_file(self.token_path, SCOPES)

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_path):
                    print(f"[GMAIL] ⚠ credentials.json not found")
                    self.service = None
                    return

                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, SCOPES
                )
                creds = flow.run_local_server(port=0)

            with open(self.token_path, 'w') as token:
                token.write(creds.to_json())

        try:
            self.service = build('gmail', 'v1', credentials=creds)
            print("[GMAIL] ✓ Authenticated with Gmail")
        except Exception as e:
            print(f"[GMAIL] ⚠ Failed to build service: {e}")
            self.service = None

    def search_emails(
        self,
        query: str,
        max_results: int = 10
    ) -> Dict:
        """Search emails"""
        if not self.service:
            return {"error": "Gmail service not available (credentials missing)"}

        try:
            results = self.service.users().messages().list(
                userId='me',
                q=query,
                maxResults=max_results
            ).execute()

            messages = results.get('messages', [])

            # Get snippet for each message
            email_summaries = []
            for msg in messages:
                msg_data = self.service.users().messages().get(
                    userId='me',
                    id=msg['id'],
                    format='metadata',
                    metadataHeaders=['From', 'Subject', 'Date']
                ).execute()

                headers = {h['name']: h['value'] for h in msg_data.get('payload', {}).get('headers', [])}
                email_summaries.append({
                    "id": msg['id'],
                    "thread_id": msg['threadId'],
                    "from": headers.get('From', ''),
                    "subject": headers.get('Subject', ''),
                    "date": headers.get('Date', ''),
                    "snippet": msg_data.get('snippet', '')
                })

            print(f"[GMAIL] ✓ Found {len(email_summaries)} emails")
            return {
                "success": True,
                "emails": email_summaries,
                "count": len(email_summaries)
            }

        except HttpError as e:
            print(f"[GMAIL] ⚠ Search failed: {e}")
            return {"error": str(e)}

    def get_email_thread(self, thread_id: str) -> Dict:
        """Get full email thread"""
        if not self.service:
            return {"error": "Gmail service not available"}

        try:
            thread = self.service.users().threads().get(
                userId='me',
                id=thread_id
            ).execute()

            messages = []
            for msg in thread['messages']:
                msg_data = self.service.users().messages().get(
                    userId='me',
                    id=msg['id'],
                    format='full'
                ).execute()

                headers = {h['name']: h['value'] for h in msg_data.get('payload', {}).get('headers', [])}

                # Extract body
                body = ""
                if 'parts' in msg_data['payload']:
                    for part in msg_data['payload']['parts']:
                        if part['mimeType'] == 'text/plain':
                            body = base64.urlsafe_b64decode(part['body']['data']).decode()
                            break
                else:
                    if 'body' in msg_data['payload'] and 'data' in msg_data['payload']['body']:
                        body = base64.urlsafe_b64decode(msg_data['payload']['body']['data']).decode()

                messages.append({
                    "id": msg['id'],
                    "from": headers.get('From', ''),
                    "to": headers.get('To', ''),
                    "subject": headers.get('Subject', ''),
                    "date": headers.get('Date', ''),
                    "body": body
                })

            print(f"[GMAIL] ✓ Retrieved thread with {len(messages)} messages")
            return {
                "success": True,
                "thread_id": thread_id,
                "messages": messages,
                "count": len(messages)
            }

        except HttpError as e:
            print(f"[GMAIL] ⚠ Failed to get thread: {e}")
            return {"error": str(e)}

    def draft_email(self, to: str, subject: str, body: str) -> Dict:
        """Create email draft"""
        if not self.service:
            return {"error": "Gmail service not available"}

        try:
            message = MIMEText(body)
            message['to'] = to
            message['subject'] = subject

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
            draft = {'message': {'raw': raw}}

            draft_result = self.service.users().drafts().create(
                userId='me',
                body=draft
            ).execute()

            print(f"[GMAIL] ✓ Created draft to {to}")
            return {
                "success": True,
                "draft": draft_result,
                "message": f"Draft email kreiran za {to}"
            }

        except HttpError as e:
            print(f"[GMAIL] ⚠ Failed to create draft: {e}")
            return {"error": str(e)}

    def send_email(self, to: str, subject: str, body: str) -> Dict:
        """Send email"""
        if not self.service:
            return {"error": "Gmail service not available"}

        try:
            message = MIMEText(body)
            message['to'] = to
            message['subject'] = subject

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode()

            sent_message = self.service.users().messages().send(
                userId='me',
                body={'raw': raw}
            ).execute()

            print(f"[GMAIL] ✓ Sent email to {to}")
            return {
                "success": True,
                "message": sent_message,
                "confirmation": f"Email poslat na {to}"
            }

        except HttpError as e:
            print(f"[GMAIL] ⚠ Failed to send: {e}")
            return {"error": str(e)}

    def get_recent_emails(
        self,
        from_address: Optional[str] = None,
        max_results: int = 5
    ) -> Dict:
        """Get recent emails, optionally filtered by sender"""
        query = f"from:{from_address}" if from_address else "in:inbox"
        return self.search_emails(query, max_results)
