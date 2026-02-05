// src/types.ts
export interface TranscriptMessage {
  type: 'transcript';
  speaker: 'User' | 'Agent';
  text: string;
  timestamp: string;
}

export interface ToolCallMessage {
  type: 'tool_call';
  tool_name: string;
  params: Record<string, any>;
  result: Record<string, any>;
  timestamp: string;
}

export type LiveKitMessage = TranscriptMessage | ToolCallMessage;
