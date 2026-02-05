import React from 'react';
import type { ToolCallMessage } from '../types';

interface Props {
  toolCalls: ToolCallMessage[];
}

const TOOL_ICONS: Record<string, string> = {
  create_work_order: '🔧',
  get_calendar_events: '📅',
  search_contacts: '👤',
  send_email: '📧',
  default: '🔌',
};

export function ToolCallVisualization({ toolCalls }: Props) {
  const getIcon = (toolName: string) => {
    return TOOL_ICONS[toolName] || TOOL_ICONS.default;
  };

  const formatToolName = (name: string) => {
    return name.split('_').map(w =>
      w.charAt(0).toUpperCase() + w.slice(1)
    ).join(' ');
  };

  return (
    <div className="h-full bg-gradient-to-br from-totalobserver-dark to-gray-900 rounded-lg shadow-lg p-4 overflow-y-auto">
      <h2 className="text-lg font-bold mb-4 text-white">
        🔧 MCP Tool Calls
      </h2>
      <div className="space-y-3">
        {toolCalls.map((call, idx) => (
          <div
            key={idx}
            className="bg-gray-800 rounded-lg p-3 border border-totalobserver-blue animate-fadeIn"
          >
            {/* Tool header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getIcon(call.tool_name)}</span>
              <div className="flex-1">
                <p className="font-semibold text-white">
                  {formatToolName(call.tool_name)}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(call.timestamp).toLocaleTimeString('sr-RS')}
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-green-500 text-white rounded">
                ✓
              </span>
            </div>

            {/* Parameters */}
            {Object.keys(call.params).length > 0 && (
              <div className="mt-2 text-xs">
                <p className="text-gray-400 mb-1">Parameters:</p>
                <div className="bg-gray-900 rounded p-2 font-mono text-green-400">
                  {Object.entries(call.params).map(([key, value]) => (
                    <div key={key}>
                      <span className="text-blue-400">{key}:</span>{' '}
                      {JSON.stringify(value)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result preview */}
            {call.result && (
              <div className="mt-2 text-xs">
                <p className="text-gray-400 mb-1">Result:</p>
                <div className="bg-gray-900 rounded p-2 font-mono text-yellow-400 max-h-24 overflow-y-auto">
                  {call.result.message || call.result.success?.toString() || 'Success'}
                </div>
              </div>
            )}
          </div>
        ))}
        {toolCalls.length === 0 && (
          <p className="text-gray-400 text-center mt-8">
            Nema poziva alata...
          </p>
        )}
      </div>
    </div>
  );
}
