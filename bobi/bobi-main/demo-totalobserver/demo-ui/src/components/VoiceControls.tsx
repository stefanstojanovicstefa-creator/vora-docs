// src/components/VoiceControls.tsx
interface VoiceControlsProps {
  isSpeaking: boolean;
  connected: boolean;
  onToggleMic: () => void;
}

export function VoiceControls({ isSpeaking, connected, onToggleMic }: VoiceControlsProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8">
      <button
        onClick={onToggleMic}
        disabled={!connected}
        className={`
          w-32 h-32 rounded-full flex items-center justify-center
          transition-all duration-300 ease-in-out
          ${isSpeaking
            ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-2xl'
            : 'bg-blue-500 hover:bg-blue-600 shadow-lg'
          }
          ${!connected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          text-white text-5xl
        `}
        aria-label={isSpeaking ? 'Stop speaking' : 'Start speaking'}
      >
        {isSpeaking ? '🎤' : '🎙️'}
      </button>

      <p className={`mt-4 text-lg font-semibold ${
        isSpeaking ? 'text-red-600' : 'text-gray-700'
      }`}>
        {!connected && 'Not Connected'}
        {connected && !isSpeaking && 'Click to Speak'}
        {connected && isSpeaking && 'Speaking...'}
      </p>

      {!connected && (
        <p className="mt-2 text-sm text-gray-500">
          Connect to agent to enable voice
        </p>
      )}
    </div>
  );
}
