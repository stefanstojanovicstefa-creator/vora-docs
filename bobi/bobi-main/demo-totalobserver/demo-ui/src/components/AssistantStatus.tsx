// src/components/AssistantStatus.tsx
interface AssistantStatusProps {
  isActive: boolean;
  connected: boolean;
}

export function AssistantStatus({ isActive, connected }: AssistantStatusProps) {
  if (!connected) {
    return (
      <div className="flex items-center gap-3 text-gray-500">
        <div className="w-4 h-4 rounded-full bg-gray-400" />
        <span className="text-lg font-medium">🎤 Ready</span>
      </div>
    );
  }

  if (isActive) {
    return (
      <div className="flex items-center gap-3 text-green-600">
        <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse" />
        <span className="text-lg font-medium">👂 Listening...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-blue-600">
      <div className="w-4 h-4 rounded-full bg-blue-500" />
      <span className="text-lg font-medium">🎤 Ready</span>
    </div>
  );
}
