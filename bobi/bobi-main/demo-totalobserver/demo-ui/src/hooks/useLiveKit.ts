// src/hooks/useLiveKit.ts
import { useEffect, useState, useCallback } from 'react';
import { Room, RoomEvent, createLocalAudioTrack, LocalAudioTrack, RemoteTrack, RemoteTrackPublication, RemoteParticipant, Track } from 'livekit-client';
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioTrack, setAudioTrack] = useState<LocalAudioTrack | null>(null);

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

  // Enable microphone
  const enableMicrophone = useCallback(async () => {
    if (!room) {
      console.error('[LiveKit] Cannot enable microphone: not connected to room');
      return;
    }

    try {
      console.log('[LiveKit] Enabling microphone...');

      // Create local audio track with echo cancellation and noise suppression
      const track = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      // Publish track to room
      await room.localParticipant.publishTrack(track);

      setAudioTrack(track);
      setIsSpeaking(true);

      console.log('[LiveKit] Microphone enabled and published');
    } catch (e: any) {
      console.error('[LiveKit] Failed to enable microphone:', e);
      setError(e.message || 'Failed to enable microphone');
    }
  }, [room]);

  // Disable microphone
  const disableMicrophone = useCallback(async () => {
    if (!audioTrack || !room) {
      console.log('[LiveKit] No audio track to disable');
      return;
    }

    try {
      console.log('[LiveKit] Disabling microphone...');

      // Unpublish track from room
      await room.localParticipant.unpublishTrack(audioTrack);

      // Stop track
      audioTrack.stop();

      setAudioTrack(null);
      setIsSpeaking(false);

      console.log('[LiveKit] Microphone disabled');
    } catch (e: any) {
      console.error('[LiveKit] Failed to disable microphone:', e);
    }
  }, [audioTrack, room]);

  // Disconnect from room
  const disconnect = useCallback(() => {
    if (room) {
      room.disconnect();
      setRoom(null);
      setConnected(false);
    }
  }, [room]);

  // Auto-connect on mount (only once)
  useEffect(() => {
    let mounted = true;
    let currentRoom: Room | null = null;

    const connectRoom = async () => {
      if (!mounted) return;

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

        // Handle agent audio tracks (auto-play)
        newRoom.on(RoomEvent.TrackSubscribed, (
          track: RemoteTrack,
          _publication: RemoteTrackPublication,
          _participant: RemoteParticipant
        ) => {
          if (track.kind === Track.Kind.Audio) {
            console.log('[LiveKit] Agent audio track subscribed, playing...');

            // Create audio element and attach track
            const audioElement = track.attach();
            audioElement.autoplay = true;

            // Append to body (hidden)
            audioElement.style.display = 'none';
            document.body.appendChild(audioElement);

            console.log('[LiveKit] Agent audio playing');
          }
        });

        // Clean up audio elements when tracks are unsubscribed
        newRoom.on(RoomEvent.TrackUnsubscribed, (
          track: RemoteTrack,
          _publication: RemoteTrackPublication,
          _participant: RemoteParticipant
        ) => {
          if (track.kind === Track.Kind.Audio) {
            console.log('[LiveKit] Agent audio track unsubscribed');
            track.detach().forEach(el => el.remove());
          }
        });

        // Connect to room
        await newRoom.connect(url, token);

        if (mounted) {
          currentRoom = newRoom;
          setRoom(newRoom);
        } else {
          // If unmounted during connection, disconnect
          newRoom.disconnect();
        }

      } catch (e: any) {
        console.error('[LiveKit] Connection failed:', e);
        if (mounted) {
          setError(e.message || 'Failed to connect');
        }
      }
    };

    connectRoom();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (currentRoom) {
        currentRoom.disconnect();
      }
    };
  }, [url, token]); // Only depend on url and token

  return {
    room,
    connected,
    transcripts,
    toolCalls,
    error,
    connect,
    disconnect,
    isSpeaking,
    enableMicrophone,
    disableMicrophone,
  };
}
