import { useState } from 'react';
import type { ToolCallMessage } from '../types';
import { extractWorkOrders, extractContacts, extractEvents } from '../utils/extractToolData';

interface Props {
  toolCalls: ToolCallMessage[];
}

export function DataPanels({ toolCalls }: Props) {
  const [expandedWorkOrder, setExpandedWorkOrder] = useState<string | null>(null);
  const [expandedContact, setExpandedContact] = useState<string | null>(null);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const workOrders = extractWorkOrders(toolCalls);
  const contacts = extractContacts(toolCalls);
  const events = extractEvents(toolCalls);

  const toggleWorkOrder = (id: string) => {
    setExpandedWorkOrder(expandedWorkOrder === id ? null : id);
  };

  const toggleContact = (id: string) => {
    setExpandedContact(expandedContact === id ? null : id);
  };

  const toggleEvent = (id: string) => {
    setExpandedEvent(expandedEvent === id ? null : id);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-500 text-white';
      case 'in_progress':
        return 'bg-yellow-500 text-white';
      case 'pending':
        return 'bg-gray-400 text-white';
      default:
        return 'bg-blue-500 text-white';
    }
  };

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
        return 'bg-red-500 text-white';
      case 'medium':
        return 'bg-orange-500 text-white';
      case 'low':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-400 text-white';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('sr-RS');
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sr-RS', { style: 'currency', currency: 'EUR' }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Work Orders Panel */}
      {workOrders.length > 0 && (
        <div className="bg-gradient-to-br from-totalobserver-dark to-gray-900 rounded-lg shadow-lg p-4">
          <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
            <span>📋</span>
            Work Orders Created ({workOrders.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2 px-2">ID</th>
                  <th className="pb-2 px-2">Building</th>
                  <th className="pb-2 px-2">Issue</th>
                  <th className="pb-2 px-2">Priority</th>
                  <th className="pb-2 px-2">Status</th>
                  <th className="pb-2 px-2">Technician</th>
                  <th className="pb-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workOrders.map((wo) => (
                  <>
                    <tr key={wo.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                      <td className="py-3 px-2">
                        <div className="text-white font-mono text-xs">{wo.id}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-white">{wo.building_name}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-white">{wo.issue_type}</div>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityBadgeClass(wo.priority)}`}>
                          {wo.priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeClass(wo.status)}`}>
                          {wo.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-gray-300 text-xs">
                          {wo.assigned_to_name || 'Unassigned'}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => toggleWorkOrder(wo.id)}
                          className="px-3 py-1 bg-totalobserver-blue hover:bg-blue-600 text-white rounded text-xs transition"
                        >
                          {expandedWorkOrder === wo.id ? 'Hide Details ▲' : 'View Details ▼'}
                        </button>
                      </td>
                    </tr>
                    {expandedWorkOrder === wo.id && (
                      <tr key={`${wo.id}-details`} className="bg-gray-900">
                        <td colSpan={7} className="py-4 px-4">
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Description:</p>
                                <p className="text-white">{wo.description}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Reporter:</p>
                                <p className="text-white">{wo.reporter || 'N/A'}</p>
                              </div>
                            </div>
                            <div>
                              <p className="text-gray-400 text-xs mb-1">Created At:</p>
                              <p className="text-white">{formatDate(wo.created_at)}</p>
                            </div>
                            <div className="mt-3">
                              <p className="text-gray-400 text-xs mb-2">Full JSON:</p>
                              <pre className="bg-black rounded p-3 overflow-x-auto text-xs text-green-400">
                                {JSON.stringify(wo, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CRM Contacts Panel */}
      {contacts.length > 0 && (
        <div className="bg-gradient-to-br from-totalobserver-dark to-gray-900 rounded-lg shadow-lg p-4">
          <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
            <span>👥</span>
            CRM Contacts ({contacts.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2 px-2">Name</th>
                  <th className="pb-2 px-2">Company</th>
                  <th className="pb-2 px-2">Role</th>
                  <th className="pb-2 px-2">Deal Stage</th>
                  <th className="pb-2 px-2">Value</th>
                  <th className="pb-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <>
                    <tr key={contact.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                      <td className="py-3 px-2">
                        <div className="text-white font-semibold">{contact.name}</div>
                        {contact.email && (
                          <div className="text-gray-400 text-xs">{contact.email}</div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-white">{contact.company}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-gray-300 text-xs">{contact.role || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-2">
                        {contact.deal_stage && (
                          <span className="px-2 py-1 rounded text-xs font-semibold bg-purple-500 text-white">
                            {contact.deal_stage.replace('_', ' ').toUpperCase()}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-green-400 font-semibold">
                          {contact.deal_value ? formatCurrency(contact.deal_value) : 'N/A'}
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => toggleContact(contact.id)}
                          className="px-3 py-1 bg-totalobserver-blue hover:bg-blue-600 text-white rounded text-xs transition"
                        >
                          {expandedContact === contact.id ? 'Hide Details ▲' : 'View Details ▼'}
                        </button>
                      </td>
                    </tr>
                    {expandedContact === contact.id && (
                      <tr key={`${contact.id}-details`} className="bg-gray-900">
                        <td colSpan={6} className="py-4 px-4">
                          <div className="space-y-2 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Phone:</p>
                                <p className="text-white">{contact.phone || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Tags:</p>
                                <div className="flex gap-1 flex-wrap">
                                  {contact.tags && contact.tags.length > 0 ? (
                                    contact.tags.map((tag) => (
                                      <span key={tag} className="px-2 py-1 rounded text-xs bg-blue-600 text-white">
                                        {tag}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-white">N/A</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {contact.notes && (
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Notes:</p>
                                <p className="text-white">{contact.notes}</p>
                              </div>
                            )}
                            <div className="mt-3">
                              <p className="text-gray-400 text-xs mb-2">Full JSON:</p>
                              <pre className="bg-black rounded p-3 overflow-x-auto text-xs text-green-400">
                                {JSON.stringify(contact, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar Events Panel */}
      {events.length > 0 && (
        <div className="bg-gradient-to-br from-totalobserver-dark to-gray-900 rounded-lg shadow-lg p-4">
          <h2 className="text-lg font-bold mb-4 text-white flex items-center gap-2">
            <span>📅</span>
            Calendar Events ({events.length})
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2 px-2">Title</th>
                  <th className="pb-2 px-2">Date</th>
                  <th className="pb-2 px-2">Time</th>
                  <th className="pb-2 px-2">Location</th>
                  <th className="pb-2 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <>
                    <tr key={event.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                      <td className="py-3 px-2">
                        <div className="text-white font-semibold">{event.title}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-white">{event.date}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-white">{event.time}</div>
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-gray-300 text-xs">{event.location || 'N/A'}</div>
                      </td>
                      <td className="py-3 px-2">
                        <button
                          onClick={() => toggleEvent(event.id)}
                          className="px-3 py-1 bg-totalobserver-blue hover:bg-blue-600 text-white rounded text-xs transition"
                        >
                          {expandedEvent === event.id ? 'Hide Details ▲' : 'View Details ▼'}
                        </button>
                      </td>
                    </tr>
                    {expandedEvent === event.id && (
                      <tr key={`${event.id}-details`} className="bg-gray-900">
                        <td colSpan={5} className="py-4 px-4">
                          <div className="space-y-2 text-sm">
                            {event.attendees && (
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Attendees:</p>
                                <p className="text-white">{event.attendees.join(', ')}</p>
                              </div>
                            )}
                            {event.description && (
                              <div>
                                <p className="text-gray-400 text-xs mb-1">Description:</p>
                                <p className="text-white">{event.description}</p>
                              </div>
                            )}
                            <div className="mt-3">
                              <p className="text-gray-400 text-xs mb-2">Full JSON:</p>
                              <pre className="bg-black rounded p-3 overflow-x-auto text-xs text-green-400">
                                {JSON.stringify(event, null, 2)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {workOrders.length === 0 && contacts.length === 0 && events.length === 0 && (
        <div className="bg-gradient-to-br from-totalobserver-dark to-gray-900 rounded-lg shadow-lg p-8 text-center">
          <p className="text-gray-400 text-lg">
            No data created yet. Agent will populate this panel as it creates work orders, looks up contacts, or schedules events.
          </p>
        </div>
      )}
    </div>
  );
}
