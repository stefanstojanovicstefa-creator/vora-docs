// src/hooks/useLiveKit.ts
import { useEffect, useState, useCallback } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import type { LiveKitMessage, TranscriptMessage, ToolCallMessage } from '../types';

interface UseLiveKitProps {
  url: string;
  token: string;
  roomName: string;
}

export function useLiveKit({ url, token }: UseLiveKitProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [connected, setConnected] = useState(false);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Connect to LiveKit room
  const connect = useCallback(async () => {
    try {
      const newRoom = new Room();

      // Handle connection state
      newRoom.on(RoomEvent.Connected, () => {
        console.log('[LiveKit] Connected to room');
        setConnected(true);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        console.log('[LiveKit] Disconnected from room');
        setConnected(false);
      });

      // Handle incoming data messages (transcripts + tool calls)
      newRoom.on(RoomEvent.DataReceived, (payload: Uint8Array) => {
        try {
          const decoder = new TextDecoder();
          const jsonStr = decoder.decode(payload);
          const message: LiveKitMessage = JSON.parse(jsonStr);

          console.log('[LiveKit] Data received:', message);

          if (message.type === 'transcript') {
            setTranscripts(prev => [...prev, message as TranscriptMessage]);
          } else if (message.type === 'tool_call') {
            setToolCalls(prev => [...prev, message as ToolCallMessage]);
          }
        } catch (e) {
          console.error('[LiveKit] Failed to parse data message:', e);
        }
      });

      // Connect to room
      await newRoom.connect(url, token);
      setRoom(newRoom);

    } catch (e: any) {
      console.error('[LiveKit] Connection failed:', e);
      setError(e.message || 'Failed to connect');
    }
  }, [url, token]);

  // Disconnect from room
  const disconnect = useCallback(() => {
    if (room) {
      room.disconnect();
      setRoom(null);
      setConnected(false);
    }
  }, [room]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    room,
    connected,
    transcripts,
    toolCalls,
    error,
    connect,
    disconnect,
  };
}
