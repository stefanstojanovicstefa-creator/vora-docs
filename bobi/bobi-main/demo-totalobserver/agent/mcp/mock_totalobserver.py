"""Mock TotalObserver API client for demo purposes"""

import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional


class MockTotalObserverClient:
    """Mock TotalObserver API client for demo"""

    def __init__(self, mock_data_path: str = "../mock-data"):
        self.data_path = Path(__file__).parent.parent.parent / "mock-data"
        self.buildings = self._load_json("buildings.json")
        self.technicians = self._load_json("technicians.json")
        self.work_orders = self._load_json("work_orders.json")
        self._next_wo_id = 1848  # Start from WO-2024-1848

    def _load_json(self, filename: str) -> List[Dict]:
        """Load JSON data file"""
        try:
            with open(self.data_path / filename, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[MOCK TO] ⚠ Failed to load {filename}: {e}")
            return []

    def create_work_order(
        self,
        building_id: str,
        issue_type: str,
        description: str,
        priority: str = "medium",
        reporter_name: Optional[str] = None
    ) -> Dict:
        """Create new work order"""
        # Find building
        building = next((b for b in self.buildings if b["id"] == building_id), None)
        if not building:
            return {"error": f"Building '{building_id}' not found"}

        # Create work order
        wo_id = f"WO-2024-{self._next_wo_id}"
        self._next_wo_id += 1

        work_order = {
            "id": wo_id,
            "building_id": building_id,
            "building_name": building["name"],
            "issue_type": issue_type,
            "description": description,
            "priority": priority,
            "status": "pending",
            "assigned_to": None,
            "assigned_to_name": None,
            "created_at": datetime.now().isoformat(),
            "reporter": reporter_name or "AI Assistant"
        }

        self.work_orders.append(work_order)

        print(f"[MOCK TO] ✓ Created work order {wo_id}")
        return {
            "success": True,
            "work_order": work_order,
            "message": f"Radni nalog {wo_id} je kreiran za {building['name']}"
        }

    def get_work_order_status(self, work_order_id: str) -> Dict:
        """Get work order status"""
        wo = next((w for w in self.work_orders if w["id"] == work_order_id), None)
        if not wo:
            return {"error": f"Work order '{work_order_id}' not found"}

        return {
            "success": True,
            "work_order": wo
        }

    def list_open_work_orders(
        self,
        building_id: Optional[str] = None,
        technician_id: Optional[str] = None
    ) -> Dict:
        """List open work orders"""
        filtered = [
            wo for wo in self.work_orders
            if wo["status"] in ["pending", "in_progress"]
        ]

        if building_id:
            filtered = [wo for wo in filtered if wo["building_id"] == building_id]

        if technician_id:
            filtered = [wo for wo in filtered if wo["assigned_to"] == technician_id]

        return {
            "success": True,
            "work_orders": filtered,
            "count": len(filtered)
        }

    def assign_technician(self, work_order_id: str, technician_id: str) -> Dict:
        """Assign technician to work order"""
        wo = next((w for w in self.work_orders if w["id"] == work_order_id), None)
        if not wo:
            return {"error": f"Work order '{work_order_id}' not found"}

        tech = next((t for t in self.technicians if t["id"] == technician_id), None)
        if not tech:
            return {"error": f"Technician '{technician_id}' not found"}

        wo["assigned_to"] = technician_id
        wo["assigned_to_name"] = tech["name"]
        wo["status"] = "in_progress"

        print(f"[MOCK TO] ✓ Assigned {tech['name']} to {work_order_id}")
        return {
            "success": True,
            "work_order": wo,
            "message": f"Tehničar {tech['name']} je dodeljen radnom nalogu {work_order_id}"
        }

    def get_building_info(self, building_id: str) -> Dict:
        """Get building information"""
        building = next((b for b in self.buildings if b["id"] == building_id), None)
        if not building:
            return {"error": f"Building '{building_id}' not found"}

        # Get work orders for this building
        building_wos = [
            wo for wo in self.work_orders
            if wo["building_id"] == building_id and wo["status"] in ["pending", "in_progress"]
        ]

        return {
            "success": True,
            "building": building,
            "open_work_orders": len(building_wos),
            "recent_issues": building_wos[:5]  # Last 5
        }

    def get_technician_availability(
        self,
        date: Optional[str] = None,
        skill_type: Optional[str] = None
    ) -> Dict:
        """Get available technicians"""
        filtered = [t for t in self.technicians if t["available"]]

        if skill_type:
            filtered = [t for t in filtered if skill_type in t["skills"]]

        return {
            "success": True,
            "available_technicians": filtered,
            "count": len(filtered)
        }

    def update_work_order(
        self,
        work_order_id: str,
        status: Optional[str] = None,
        notes: Optional[str] = None
    ) -> Dict:
        """Update work order status"""
        wo = next((w for w in self.work_orders if w["id"] == work_order_id), None)
        if not wo:
            return {"error": f"Work order '{work_order_id}' not found"}

        if status:
            wo["status"] = status
        if notes:
            wo["notes"] = notes

        print(f"[MOCK TO] ✓ Updated {work_order_id}")
        return {
            "success": True,
            "work_order": wo
        }

    def get_tenant_info(self, tenant_name: str) -> Dict:
        """Get tenant information (mock - just returns placeholder)"""
        return {
            "success": True,
            "tenant": {
                "name": tenant_name,
                "contact": "+381641234567",
                "building": "Plaza Mall",
                "unit": "Food Court - Unit 23",
                "lease_expires": "2025-12-31",
                "open_tickets": 1
            }
        }
