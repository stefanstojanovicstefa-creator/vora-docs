
const AVAILABLE_TOOLS = [
  { category: 'TotalObserver', tools: ['create_work_order', 'list_work_orders', 'assign_technician'] },
  { category: 'Calendar', tools: ['get_events', 'create_event', 'check_availability'] },
  { category: 'CRM', tools: ['search_contacts', 'log_interaction', 'get_deals'] },
  { category: 'Email', tools: ['draft_email', 'send_email', 'search_emails'] },
];

export function MCPToolsPanel() {
  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h3 className="text-sm font-bold mb-3 text-totalobserver-dark">
        🔌 Available MCP Tools
      </h3>
      <div className="space-y-2">
        {AVAILABLE_TOOLS.map(({ category, tools }) => (
          <div key={category} className="text-xs">
            <p className="font-semibold text-gray-700 mb-1">{category}</p>
            <div className="flex flex-wrap gap-1">
              {tools.map(tool => (
                <span
                  key={tool}
                  className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {tool}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
