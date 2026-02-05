import type { ToolCallMessage } from '../types';

export interface WorkOrder {
  id: string;
  building_name: string;
  issue_type: string;
  description: string;
  priority: string;
  status: string;
  assigned_to_name?: string;
  created_at: string;
  reporter?: string;
}

export interface Contact {
  id: string;
  name: string;
  company: string;
  role?: string;
  email?: string;
  phone?: string;
  deal_stage?: string;
  deal_value?: number;
  notes?: string;
  tags?: string[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location?: string;
  attendees?: string[];
  description?: string;
}

export function extractWorkOrders(toolCalls: ToolCallMessage[]): WorkOrder[] {
  const workOrders: WorkOrder[] = [];

  for (const call of toolCalls) {
    if (call.tool_name === 'create_work_order' && call.result) {
      // Extract work order from result
      if (call.result.work_order) {
        workOrders.push(call.result.work_order);
      } else if (call.result.id) {
        // If result directly contains work order data
        workOrders.push({
          id: call.result.id,
          building_name: call.params.building_name || call.result.building_name || 'Unknown',
          issue_type: call.params.issue_type || call.result.issue_type || 'General',
          description: call.params.description || call.result.description || '',
          priority: call.params.priority || call.result.priority || 'medium',
          status: call.result.status || 'pending',
          assigned_to_name: call.result.assigned_to_name,
          created_at: call.timestamp,
          reporter: call.params.reporter || call.result.reporter,
        });
      }
    } else if (call.tool_name === 'get_work_orders' && call.result?.work_orders) {
      // Extract list of work orders from query result
      workOrders.push(...call.result.work_orders);
    }
  }

  return workOrders;
}

export function extractContacts(toolCalls: ToolCallMessage[]): Contact[] {
  const contacts: Contact[] = [];

  for (const call of toolCalls) {
    if ((call.tool_name === 'search_contacts' || call.tool_name === 'get_contact_details') && call.result) {
      // Extract contacts from result
      if (call.result.contacts && Array.isArray(call.result.contacts)) {
        contacts.push(...call.result.contacts);
      } else if (call.result.contact) {
        contacts.push(call.result.contact);
      } else if (call.result.id) {
        // If result directly contains contact data
        contacts.push({
          id: call.result.id,
          name: call.result.name || 'Unknown',
          company: call.result.company || '',
          role: call.result.role,
          email: call.result.email,
          phone: call.result.phone,
          deal_stage: call.result.deal_stage,
          deal_value: call.result.deal_value,
          notes: call.result.notes,
          tags: call.result.tags,
        });
      }
    }
  }

  return contacts;
}

export function extractEvents(toolCalls: ToolCallMessage[]): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  for (const call of toolCalls) {
    if (call.tool_name === 'create_event' && call.result) {
      // Extract event from result
      if (call.result.event) {
        events.push(call.result.event);
      } else if (call.result.id) {
        // If result directly contains event data
        events.push({
          id: call.result.id,
          title: call.params.title || call.result.title || 'Event',
          date: call.params.date || call.result.date || call.timestamp.split('T')[0],
          time: call.params.time || call.result.time || call.timestamp.split('T')[1],
          location: call.params.location || call.result.location,
          attendees: call.params.attendees || call.result.attendees,
          description: call.params.description || call.result.description,
        });
      }
    } else if (call.tool_name === 'get_calendar_events' && call.result?.events) {
      // Extract list of events from query result
      events.push(...call.result.events);
    }
  }

  return events;
}
