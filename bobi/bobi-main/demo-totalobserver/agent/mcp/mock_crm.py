"""
Mock CRM (HubSpot-style) - MCP Tool Provider
Simulates CRM operations: contacts, deals, tasks, interactions
"""
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

class MockCRMClient:
    """Mock HubSpot-style CRM client for demo"""

    def __init__(self):
        self.data_path = Path(__file__).parent.parent.parent / "mock-data"
        self.contacts = self._load_json("crm_contacts.json")
        self.interactions = []  # In-memory interaction log

    def _load_json(self, filename: str) -> List[Dict]:
        """Load JSON data file"""
        try:
            with open(self.data_path / filename, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[MOCK CRM] ⚠ Failed to load {filename}: {e}")
            return []

    def search_contacts(self, query: str) -> Dict:
        """Search contacts by name or company"""
        query_lower = query.lower()
        results = [
            c for c in self.contacts
            if query_lower in c["name"].lower() or query_lower in c["company"].lower()
        ]

        return {
            "success": True,
            "contacts": results,
            "count": len(results)
        }

    def get_contact_details(self, contact_id: str) -> Dict:
        """Get full contact details"""
        contact = next((c for c in self.contacts if c["id"] == contact_id), None)
        if not contact:
            return {"error": f"Contact '{contact_id}' not found"}

        # Get interaction history for this contact
        contact_interactions = [
            i for i in self.interactions
            if i["contact_id"] == contact_id
        ]

        return {
            "success": True,
            "contact": contact,
            "interaction_history": contact_interactions
        }

    def get_deal_pipeline(self, stage: Optional[str] = None) -> Dict:
        """Get deals in pipeline"""
        deals = self.contacts  # Each contact has deal info

        if stage:
            deals = [c for c in deals if c.get("deal_stage") == stage]

        deal_list = [
            {
                "contact_id": c["id"],
                "company": c["company"],
                "contact_name": c["name"],
                "stage": c.get("deal_stage"),
                "value": c.get("deal_value"),
                "last_contact": c.get("last_contact")
            }
            for c in deals
            if "deal_stage" in c
        ]

        return {
            "success": True,
            "deals": deal_list,
            "count": len(deal_list)
        }

    def log_interaction(
        self,
        contact_id: str,
        interaction_type: str,
        notes: str
    ) -> Dict:
        """Log interaction with contact"""
        contact = next((c for c in self.contacts if c["id"] == contact_id), None)
        if not contact:
            return {"error": f"Contact '{contact_id}' not found"}

        interaction = {
            "id": f"int-{len(self.interactions) + 1}",
            "contact_id": contact_id,
            "type": interaction_type,
            "notes": notes,
            "timestamp": datetime.now().isoformat()
        }

        self.interactions.append(interaction)

        # Update last_contact on contact
        contact["last_contact"] = interaction["timestamp"]

        print(f"[MOCK CRM] ✓ Logged {interaction_type} for {contact['name']}")
        return {
            "success": True,
            "interaction": interaction,
            "message": f"Interakcija sa {contact['name']} je zabeležena"
        }

    def create_task(
        self,
        contact_id: str,
        title: str,
        due_date: str
    ) -> Dict:
        """Create task for contact"""
        contact = next((c for c in self.contacts if c["id"] == contact_id), None)
        if not contact:
            return {"error": f"Contact '{contact_id}' not found"}

        task = {
            "id": f"task-{datetime.now().timestamp()}",
            "contact_id": contact_id,
            "contact_name": contact["name"],
            "title": title,
            "due_date": due_date,
            "status": "pending",
            "created_at": datetime.now().isoformat()
        }

        print(f"[MOCK CRM] ✓ Created task '{title}' for {contact['name']}")
        return {
            "success": True,
            "task": task,
            "message": f"Zadatak '{title}' je kreiran za {contact['name']}"
        }

    def get_company_info(self, company_name: str) -> Dict:
        """Get company info and associated contacts"""
        company_contacts = [
            c for c in self.contacts
            if c["company"].lower() == company_name.lower()
        ]

        if not company_contacts:
            return {"error": f"Company '{company_name}' not found"}

        return {
            "success": True,
            "company": {
                "name": company_name,
                "contact_count": len(company_contacts),
                "contacts": company_contacts
            }
        }
