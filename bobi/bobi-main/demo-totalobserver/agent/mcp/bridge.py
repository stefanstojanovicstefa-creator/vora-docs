"""
MCP Bridge - Coordinates all MCP tool providers
Routes tool calls to appropriate clients (real or mock)
"""
from typing import Dict, Any, Callable
import traceback

from .mock_totalobserver import MockTotalObserverClient
from .mock_crm import MockCRMClient
from .google_calendar_client import GoogleCalendarClient
from .gmail_client import GmailClient

class MCPBridge:
    """
    MCP Tool Bridge - coordinates all MCP integrations
    Provides unified interface for agent to call tools
    """

    def __init__(self, use_real_google: bool = True):
        """
        Initialize MCP bridge with all clients

        Args:
            use_real_google: If True, use real Google APIs (requires OAuth)
                           If False, use mock responses
        """
        print("[MCP BRIDGE] 🌉 Initializing MCP Bridge...")

        # Mock clients (always available)
        self.totalobserver = MockTotalObserverClient()
        self.crm = MockCRMClient()

        # Real Google clients (optional)
        if use_real_google:
            try:
                self.calendar = GoogleCalendarClient()
                self.gmail = GmailClient()
                print("[MCP BRIDGE] ✓ Real Google integrations enabled")
            except Exception as e:
                print(f"[MCP BRIDGE] ⚠ Failed to init Google clients: {e}")
                self.calendar = None
                self.gmail = None
        else:
            self.calendar = None
            self.gmail = None
            print("[MCP BRIDGE] ⚠ Using mock mode for Google services")

        # Register all tools
        self.tools = self._register_tools()
        print(f"[MCP BRIDGE] ✓ Registered {len(self.tools)} tools")

    def _register_tools(self) -> Dict[str, Callable]:
        """Register all available tools"""
        return {
            # TotalObserver tools
            "create_work_order": self.totalobserver.create_work_order,
            "get_work_order_status": self.totalobserver.get_work_order_status,
            "list_open_work_orders": self.totalobserver.list_open_work_orders,
            "assign_technician": self.totalobserver.assign_technician,
            "get_building_info": self.totalobserver.get_building_info,
            "get_technician_availability": self.totalobserver.get_technician_availability,
            "update_work_order": self.totalobserver.update_work_order,
            "get_tenant_info": self.totalobserver.get_tenant_info,

            # CRM tools
            "search_contacts": self.crm.search_contacts,
            "get_contact_details": self.crm.get_contact_details,
            "get_deal_pipeline": self.crm.get_deal_pipeline,
            "log_interaction": self.crm.log_interaction,
            "create_task": self.crm.create_task,
            "get_company_info": self.crm.get_company_info,

            # Calendar tools (if available)
            **(self._calendar_tools() if self.calendar else {}),

            # Gmail tools (if available)
            **(self._gmail_tools() if self.gmail else {}),
        }

    def _calendar_tools(self) -> Dict[str, Callable]:
        """Calendar tools (only if service available)"""
        if not self.calendar:
            return {}
        return {
            "get_calendar_events": self.calendar.get_calendar_events,
            "create_event": self.calendar.create_event,
            "check_availability": self.calendar.check_availability,
            "reschedule_event": self.calendar.reschedule_event,
        }

    def _gmail_tools(self) -> Dict[str, Callable]:
        """Gmail tools (only if service available)"""
        if not self.gmail:
            return {}
        return {
            "search_emails": self.gmail.search_emails,
            "get_email_thread": self.gmail.get_email_thread,
            "draft_email": self.gmail.draft_email,
            "send_email": self.gmail.send_email,
            "get_recent_emails": self.gmail.get_recent_emails,
        }

    def call_tool(self, tool_name: str, **kwargs) -> Dict[str, Any]:
        """
        Call a tool by name with arguments

        Args:
            tool_name: Name of tool to call
            **kwargs: Tool arguments

        Returns:
            Tool result dict
        """
        if tool_name not in self.tools:
            return {
                "error": f"Tool '{tool_name}' not found. Available: {list(self.tools.keys())}"
            }

        try:
            print(f"[MCP BRIDGE] 🔧 Calling tool: {tool_name}")
            result = self.tools[tool_name](**kwargs)
            print(f"[MCP BRIDGE] ✓ Tool '{tool_name}' completed")
            return result

        except Exception as e:
            error_msg = f"Tool '{tool_name}' failed: {str(e)}"
            print(f"[MCP BRIDGE] ⚠ {error_msg}")
            traceback.print_exc()
            return {"error": error_msg}

    def get_available_tools(self) -> list:
        """Get list of available tool names"""
        return list(self.tools.keys())

    def get_tool_descriptions(self) -> Dict[str, str]:
        """Get descriptions of all tools for LLM prompt"""
        return {
            # TotalObserver
            "create_work_order": "Kreira novi radni nalog. Parametri: building_id, issue_type, description, priority, reporter_name?",
            "get_work_order_status": "Proverava status radnog naloga. Parametri: work_order_id",
            "list_open_work_orders": "Lista otvorenih radnih naloga. Parametri: building_id?, technician_id?",
            "assign_technician": "Dodeljuje tehničara radnom nalogu. Parametri: work_order_id, technician_id",
            "get_building_info": "Informacije o zgradi. Parametri: building_id",
            "get_technician_availability": "Provera dostupnosti tehničara. Parametri: date?, skill_type?",
            "update_work_order": "Ažurira radni nalog. Parametri: work_order_id, status?, notes?",
            "get_tenant_info": "Informacije o zakupcu. Parametri: tenant_name",

            # CRM
            "search_contacts": "Pretraga kontakata. Parametri: query",
            "get_contact_details": "Detalji kontakta. Parametri: contact_id",
            "get_deal_pipeline": "Lista dealova. Parametri: stage?",
            "log_interaction": "Beleži interakciju. Parametri: contact_id, interaction_type, notes",
            "create_task": "Kreira zadatak. Parametri: contact_id, title, due_date",
            "get_company_info": "Informacije o kompaniji. Parametri: company_name",

            # Calendar (if available)
            **({
                "get_calendar_events": "Lista kalendar događaja. Parametri: start_date?, end_date?, max_results?",
                "create_event": "Kreira novi event. Parametri: title, start_time, end_time, attendees?, description?",
                "check_availability": "Provera slobodnih termina. Parametri: date, duration_minutes?",
                "reschedule_event": "Pomera event. Parametri: event_id, new_start_time",
            } if self.calendar else {}),

            # Gmail (if available)
            **({
                "search_emails": "Pretraga emailova. Parametri: query, max_results?",
                "get_email_thread": "Ceo email thread. Parametri: thread_id",
                "draft_email": "Kreira draft. Parametri: to, subject, body",
                "send_email": "Šalje email. Parametri: to, subject, body",
                "get_recent_emails": "Nedavni emailovi. Parametri: from_address?, max_results?",
            } if self.gmail else {}),
        }
