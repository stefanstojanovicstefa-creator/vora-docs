/**
 * TestPanel Component
 *
 * Main agent testing interface that combines voice call controls,
 * live transcript display, and integration function visibility.
 * Used in AgentDetailPage for real-time agent testing.
 *
 * Features:
 * - Voice call button with mute/unmute controls
 * - Real-time transcript with speaker labels (User/Agent)
 * - Call duration timer
 * - Integration function call tracking
 * - Mobile responsive design
 *
 * Usage:
 * ```tsx
 * <TestPanel agentId="agent_123" />
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Clock, Loader2, User, Bot, Volume2 } from 'lucide-react';
import { RoomEvent, DataPacket_Kind } from 'livekit-client';
import { cn } from '@/lib/utils';
import { useVoiceCall } from '@/hooks/useVoiceCall';
import { voiceCallService } from '@/services/voice-call.service';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { IntegrationBadge } from './IntegrationBadge';

interface TranscriptMessage {
  id: string;
  text: string;
  speaker: 'user' | 'agent';
  timestamp: Date;
  isFinal: boolean;
}

interface FunctionCall {
  id: string;
  name: string;
  timestamp: Date;
  status: 'pending' | 'success' | 'error';
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

interface TestPanelProps {
  /** Agent ID to test */
  agentId: string;
  /** Participant name for the call */
  participantName?: string;
  /** Auto-start call on mount (opens mic permission prompt) */
  autoStart?: boolean;
  /** Custom class name */
  className?: string;
}

export function TestPanel({
  agentId,
  participantName = 'Tester',
  autoStart = false,
  className,
}: TestPanelProps) {
  // State
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [functionCalls, setFunctionCalls] = useState<FunctionCall[]>([]);
  const [interimText, setInterimText] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Refs
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const autoStartAttemptedRef = useRef(false);

  // Voice call hook
  const {
    startCall,
    endCall,
    status,
    isConnecting,
    isConnected,
    isMuted,
    toggleMute,
    duration,
    audioLevel,
    agentIsSpeaking,
    room,
    canPlaybackAudio,
    enableAudioPlayback,
    sessionId,
  } = useVoiceCall({
    onAudioLevel: (level) => {
      setIsSpeaking(level.isSpeaking);
    },
    onError: (error) => {
      console.error('Voice call error:', error);
    },
  });

  const isActive = status === 'ACTIVE' || status === 'CONNECTED';

  // Auto-start call (used by InterviewBot post-creation flow)
  useEffect(() => {
    if (!autoStart) return;
    if (autoStartAttemptedRef.current) return;
    if (isConnected || isConnecting) return;

    autoStartAttemptedRef.current = true;
    startCall({ agentId, participantName }).catch((err) => {
      console.error('Failed to auto-start call:', err);
    });
  }, [autoStart, agentId, participantName, isConnected, isConnecting, startCall]);

  // Set up LiveKit data channel listener for transcript and function calls
  useEffect(() => {
    if (!room || !isConnected) return;

    const handleDataReceived = (
      payload: Uint8Array,
      participant?: any,
      _kind?: DataPacket_Kind
    ) => {
      try {
        const decoder = new TextDecoder();
        const message = JSON.parse(decoder.decode(payload));

        // Handle different message types from agent
        switch (message.type) {
          case 'transcript':
          case 'agent_response':
            handleTranscriptUpdate(message);
            break;
          case 'interim_transcript':
            handleInterimTranscript(message);
            break;
          case 'function_call':
            handleFunctionCall(message);
            break;
          case 'function_result':
            handleFunctionResult(message);
            break;
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (err) {
        console.error('Failed to parse data packet:', err);
      }
    };

    room.on(RoomEvent.DataReceived, handleDataReceived);

    return () => {
      room.off(RoomEvent.DataReceived, handleDataReceived);
    };
  }, [room, isConnected]);

  // Auto-scroll transcript to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  /**
   * Handle interim (non-final) transcript from STT
   */
  const handleInterimTranscript = useCallback((message: any) => {
    if (message.text) {
      setInterimText(message.text);
    }
  }, []);

  /**
   * Handle final transcript update
   */
  const handleTranscriptUpdate = useCallback((message: any) => {
    const newMessage: TranscriptMessage = {
      id: `${Date.now()}-${Math.random()}`,
      text: message.text || message.content,
      speaker: message.speaker === 'agent' ? 'agent' : 'user',
      timestamp: new Date(),
      isFinal: true,
    };

    setTranscript(prev => [...prev, newMessage]);

    // Clear interim text if this was a user message
    if (newMessage.speaker === 'user') {
      setInterimText('');
    }
  }, []);

  /**
   * Handle function call from agent
   */
  const handleFunctionCall = useCallback((message: any) => {
    const functionCall: FunctionCall = {
      id: message.id || `${Date.now()}-${Math.random()}`,
      name: message.name || message.function_name,
      timestamp: new Date(),
      status: 'pending',
      args: message.args || message.arguments,
    };

    setFunctionCalls(prev => [...prev, functionCall]);
  }, []);

  /**
   * Handle function call result
   */
  const handleFunctionResult = useCallback((message: any) => {
    setFunctionCalls(prev =>
      prev.map(call =>
        call.id === message.id
          ? {
              ...call,
              status: message.error ? 'error' : 'success',
              result: message.result,
              error: message.error,
            }
          : call
      )
    );
  }, []);

  /**
   * Start voice call
   */
  const handleStartCall = async () => {
    try {
      // Clear previous session data
      setTranscript([]);
      setFunctionCalls([]);
      setInterimText('');

      await startCall({
        agentId,
        participantName,
        metadata: {
          mode: 'testing',
          trackFunctions: true,
        },
      });
    } catch (err) {
      console.error('Failed to start call:', err);
    }
  };

  /**
   * End voice call — persist transcript to backend first so the
   * room_finished webhook can find it and run memory extraction.
   */
  const handleEndCall = async () => {
    try {
      if (transcript.length > 0 && sessionId) {
        try {
          await voiceCallService.submitTranscript(sessionId, transcript);
        } catch (err) {
          console.error('Failed to submit transcript:', err);
        }
      }
      await endCall({ reason: 'user_ended' });
      if (transcript.length > 0) {
        window.dispatchEvent(new CustomEvent('tutorial:validation', { detail: { key: 'agent_tested' } }));
      }
    } catch (err) {
      console.error('Failed to end call:', err);
    }
  };

  /**
   * Format duration as MM:SS
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card
      className={cn(
        'bg-[hsl(var(--surface))]/70 backdrop-blur-xl',
        'border border-[hsl(var(--border))]/50',
        'rounded-2xl p-6',
        className
      )}
    >
      {/* Header with call controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-[hsl(var(--text-high))]">
            Test Voice Agent
          </h3>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 text-sm text-[hsl(var(--text-muted))]"
            >
              <Clock className="h-4 w-4" />
              <span className="font-mono">{formatDuration(duration)}</span>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Enable Audio button - show when browser blocks audio playback */}
          <AnimatePresence>
            {isActive && !canPlaybackAudio && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    'rounded-full border-yellow-500/50',
                    'bg-[hsl(var(--surface))] backdrop-blur-xl',
                    'hover:bg-yellow-500/20 hover:border-yellow-400',
                    'transition-all duration-200 animate-pulse'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    enableAudioPlayback();
                  }}
                  title="Enable Audio (browser blocked autoplay)"
                >
                  <Volume2 className="h-4 w-4 text-yellow-400" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mute button - only show when active */}
          <AnimatePresence>
            {isActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: 10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: 10 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    'rounded-full border-[hsl(var(--border))]',
                    'bg-[hsl(var(--surface))] backdrop-blur-xl',
                    'hover:bg-[hsl(var(--surface))]/80',
                    'hover:border-[hsl(var(--primary))]',
                    'transition-all duration-200'
                  )}
                  onClick={toggleMute}
                >
                  {isMuted ? (
                    <MicOff className="h-4 w-4 text-red-400" />
                  ) : (
                    <Mic className="h-4 w-4 text-[hsl(var(--primary))]" />
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main call button */}
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              size="icon"
              className={cn(
                'rounded-full transition-all duration-200',
                isActive
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/80 text-[hsl(var(--void))]',
                isConnecting && 'opacity-80 cursor-wait'
              )}
              onClick={isActive ? handleEndCall : handleStartCall}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isActive ? (
                <PhoneOff className="h-5 w-5" />
              ) : (
                <Phone className="h-5 w-5" />
              )}
            </Button>
          </motion.div>
        </div>
      </div>

      {/* Live Transcript */}
      <div
        className={cn(
          'bg-[hsl(var(--void))]/30 backdrop-blur-sm',
          'border border-[hsl(var(--border))]/30 rounded-xl',
          'p-4 mb-4 overflow-y-auto scroll-smooth',
          'min-h-[300px] max-h-[400px]'
        )}
      >
        {transcript.length === 0 && !interimText && !isSpeaking && (
          <div className="flex items-center justify-center h-full text-[hsl(var(--text-muted))] text-sm">
            {isActive ? 'Start speaking...' : 'Click the call button to start testing'}
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {transcript.map((message, index) => (
              <motion.div
                key={message.id}
                className={cn(
                  'flex gap-2',
                  message.speaker === 'user' ? 'justify-end' : 'justify-start'
                )}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
              >
                {message.speaker === 'agent' && (
                  <div className="h-6 w-6 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="h-3 w-3 text-[hsl(var(--primary))]" />
                  </div>
                )}

                <div className="flex flex-col gap-1 max-w-[85%]">
                  <div
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm',
                      message.speaker === 'agent'
                        ? 'bg-[hsl(var(--surface))] border border-[hsl(var(--border))] text-[hsl(var(--text-high))]'
                        : 'bg-[hsl(var(--primary))] text-[hsl(var(--void))]'
                    )}
                  >
                    <p className="leading-relaxed">{message.text}</p>
                  </div>
                  <span className="text-xs text-[hsl(var(--text-muted))] px-2">
                    {message.timestamp.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>

                {message.speaker === 'user' && (
                  <div className="h-6 w-6 rounded-full bg-[hsl(var(--secondary))]/10 flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="h-3 w-3 text-[hsl(var(--secondary))]" />
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Interim user text (gray, not final) */}
          {interimText && (
            <motion.div
              className="flex gap-2 justify-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                  'bg-[hsl(var(--surface))] border border-[hsl(var(--border))]',
                  'text-[hsl(var(--text-muted))] italic'
                )}
              >
                <p className="leading-relaxed">{interimText}</p>
              </div>

              <div className="h-6 w-6 rounded-full bg-[hsl(var(--secondary))]/10 flex items-center justify-center flex-shrink-0 mt-1">
                <User className="h-3 w-3 text-[hsl(var(--text-muted))]" />
              </div>
            </motion.div>
          )}

          {/* Agent speaking indicator */}
          {agentIsSpeaking && (
            <motion.div
              className="flex gap-2 justify-start"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="h-6 w-6 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-3 w-3 text-[hsl(var(--primary))]" />
              </div>
              <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl px-3 py-2">
                <div className="flex gap-1">
                  <motion.span
                    className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]"
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      repeatDelay: 0,
                    }}
                  />
                  <motion.span
                    className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]"
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: 0.2,
                    }}
                  />
                  <motion.span
                    className="h-2 w-2 rounded-full bg-[hsl(var(--primary))]"
                    animate={{ y: [0, -6, 0] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: 0.4,
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={transcriptEndRef} />
        </div>
      </div>

      {/* Integration Function Calls */}
      {functionCalls.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-[hsl(var(--text-muted))] mb-2">
            Function Calls
          </h4>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {functionCalls.map((call) => (
                <IntegrationBadge
                  key={call.id}
                  functionName={call.name}
                  timestamp={call.timestamp}
                  status={call.status}
                  args={call.args}
                  error={call.error}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </Card>
  );
}

export default TestPanel;
