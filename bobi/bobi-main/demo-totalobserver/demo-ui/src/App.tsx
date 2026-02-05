import { useState } from 'react';
import { useLiveKit } from './hooks/useLiveKit';
import { TranscriptDisplay } from './components/TranscriptDisplay';
import { ToolCallVisualization } from './components/ToolCallVisualization';
import { VoiceWaveform } from './components/VoiceWaveform';
import { MCPToolsPanel } from './components/MCPToolsPanel';
import { VoiceControls } from './components/VoiceControls';
import { DataPanels } from './components/DataPanels';
import { AssistantStatus } from './components/AssistantStatus';

// LiveKit connection details from env
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'ws://localhost:7880';
const LIVEKIT_TOKEN = import.meta.env.VITE_LIVEKIT_TOKEN || '';
const ROOM_NAME = import.meta.env.VITE_ROOM_NAME || 'totalobserver-demo';

function App() {
  const {
    connected,
    transcripts,
    toolCalls,
    error,
    isAssistantActive,
    enableMicrophone,
    disableMicrophone,
  } = useLiveKit({
    url: LIVEKIT_URL,
    token: LIVEKIT_TOKEN,
    roomName: ROOM_NAME,
  });

  const [showTools, setShowTools] = useState(false);

  // Handle assistant toggle
  const handleToggleAssistant = () => {
    if (isAssistantActive) {
      disableMicrophone();
    } else {
      enableMicrophone();
    }
  };

  // Error screen
  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h1>
          <p className="text-gray-700 mb-4">{error}</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm">
            <p className="font-semibold mb-2">Troubleshooting:</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Check agent is running</li>
              <li>Check VITE_LIVEKIT_URL in .env</li>
              <li>Check LiveKit token is valid</li>
            </ul>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 w-full px-4 py-2 bg-totalobserver-blue text-white rounded hover:bg-blue-600"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-totalobserver-dark text-white p-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-totalobserver-blue rounded-lg flex items-center justify-center text-xl">
              🏢
            </div>
            <div>
              <h1 className="text-2xl font-bold">TotalObserver AI Demo</h1>
              <p className="text-sm text-gray-300">Voice Assistant + MCP Integrations</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Connection status */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
              }`} />
              <span className="text-sm">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <button
              onClick={() => setShowTools(!showTools)}
              className="px-4 py-2 bg-totalobserver-blue hover:bg-blue-600 rounded-lg text-sm transition"
            >
              {showTools ? 'Hide Tools' : 'Show Tools'}
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto p-6">
        {!connected && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
            <p className="text-blue-800 font-medium">
              Čekam konekciju sa agentom...
            </p>
          </div>
        )}

        {/* Voice Controls - Prominent assistant button */}
        <div className="mb-6">
          <div className="bg-white rounded-lg shadow-lg">
            <VoiceControls
              isAssistantActive={isAssistantActive}
              connected={connected}
              onToggleAssistant={handleToggleAssistant}
            />
            {/* Assistant Status */}
            <div className="pb-6 flex justify-center">
              <AssistantStatus isActive={isAssistantActive} connected={connected} />
            </div>
          </div>
        </div>

        {/* Top row: VoiceWaveform + TranscriptDisplay */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-1">
            <VoiceWaveform active={connected} />
          </div>
          <div className="col-span-2">
            <TranscriptDisplay transcripts={transcripts} />
          </div>
        </div>

        {/* Bottom row: ToolCallVisualization + MCPToolsPanel */}
        <div className={`grid ${showTools ? 'grid-cols-3' : 'grid-cols-1'} gap-6 mb-6`}>
          <div className={showTools ? 'col-span-2' : 'col-span-1'}>
            <ToolCallVisualization toolCalls={toolCalls} />
          </div>
          {showTools && (
            <div className="col-span-1">
              <MCPToolsPanel />
            </div>
          )}
        </div>

        {/* Data Panels - Show live data created by tools */}
        <div className="mb-6">
          <DataPanels toolCalls={toolCalls} />
        </div>

        {/* Stats footer */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-2xl font-bold text-totalobserver-blue">
                {transcripts.length}
              </p>
              <p className="text-sm text-gray-600">Transkripti</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-totalobserver-blue">
                {toolCalls.length}
              </p>
              <p className="text-sm text-gray-600">MCP Tool Calls</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-totalobserver-blue">
                {connected ? 'LIVE' : 'OFF'}
              </p>
              <p className="text-sm text-gray-600">Status</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 py-4 text-center text-gray-600 text-sm">
        <p>TotalObserver AI Voice Assistant Demo | LiveKit + MCP + Gemini</p>
      </footer>
    </div>
  );
}

export default App;
