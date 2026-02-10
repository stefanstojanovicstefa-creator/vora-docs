/**
 * Agent Test Page
 *
 * A focused, minimal page for testing a newly created agent.
 * Features a voice-reactive glowing orb and transcript drawer.
 */

import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Settings,
  MessageSquare,
  X,
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Loader2,
  AlertCircle,
  Volume2,
  LayoutDashboard,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GlowingOrb } from '@/components/Voice/GlowingOrb';
import { useInterviewVoice } from '@/hooks/useInterviewVoice';
import { useAgentApi } from '@/hooks/useAgentApi';
import { voiceCallService } from '@/services/voice-call.service';
import { toast } from '@/lib/toast';
import type { Agent } from '@/types/agent';

const log = import.meta.env.DEV ? console.log.bind(console, '[AgentTestPage]') : () => {};

export default function AgentTestPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation(['agent', 'common']);
  const agentApi = useAgentApi();

  const [showTranscript, setShowTranscript] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Fetch agent data
  const {
    data: agent,
    isLoading: agentLoading,
    error: agentError,
  } = useQuery<Agent>({
    queryKey: ['agent', agentId],
    queryFn: () => agentApi.getAgent(agentId!),
    enabled: !!agentId,
    staleTime: 30000,
  });

  // Voice hook
  const {
    startVoiceSession,
    endVoiceSession,
    isVoiceActive,
    transcript,
    isSpeaking,
    agentIsSpeaking,
    audioLevel,
    isConnecting,
    isMuted,
    toggleMute,
    canPlaybackAudio,
    enableAudioPlayback,
    voiceState,
    sessionId,
  } = useInterviewVoice({
    onError: (error) => {
      toast.error('Voice Error', { description: error });
      setIsStarting(false);
    },
  });

  // Start voice call
  const handleStartCall = useCallback(async () => {
    if (!agentId || !agent) return;

    setIsStarting(true);

    try {
      // Get voice token from backend
      const response = await voiceCallService.startCall({
        agentId,
        participantName: 'User',
      });

      if (!response.token || !response.roomName) {
        throw new Error('Invalid voice session response');
      }

      // Get LiveKit URL from response or environment
      const wsUrl = response.serverUrl || import.meta.env.VITE_LIVEKIT_URL;
      if (!wsUrl) {
        throw new Error('LiveKit server URL not configured');
      }

      await startVoiceSession({
        sessionId: response.sessionId || agentId,
        roomName: response.roomName,
        participantToken: response.token,
        wsUrl,
      });

      setIsStarting(false);
    } catch (err) {
      console.error('[AgentTestPage] Failed to start call:', err);
      toast.error('Failed to start call', {
        description: err instanceof Error ? err.message : 'Please try again',
      });
      setIsStarting(false);
    }
  }, [agentId, agent, startVoiceSession]);

  // End voice call — persist transcript to backend first so the room_finished
  // webhook can find it and run memory extraction.
  const handleEndCall = useCallback(async () => {
    if (transcript.length > 0 && sessionId) {
      try {
        log('Submitting transcript (%d messages) for session %s', transcript.length, sessionId);
        await voiceCallService.submitTranscript(sessionId, transcript);
      } catch (err) {
        console.error('[AgentTestPage] Failed to submit transcript:', err);
      }
    }
    await endVoiceSession();
    if (transcript.length > 0) {
      window.dispatchEvent(new CustomEvent('tutorial:validation', { detail: { key: 'agent_tested' } }));
    }
  }, [endVoiceSession, transcript, sessionId]);

  // Toggle transcript
  const handleToggleTranscript = useCallback(() => {
    setShowTranscript((prev) => !prev);
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    if (showTranscript && transcript.length > 0) {
      const container = document.getElementById('transcript-container');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [transcript, showTranscript]);

  // Loading state
  if (agentLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[hsl(var(--background))]">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--primary))]" />
      </div>
    );
  }

  // Error state
  if (agentError || !agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[hsl(var(--background))] p-6">
        <AlertCircle className="h-12 w-12 text-[hsl(var(--destructive))] mb-4" />
        <h1 className="text-xl font-semibold text-[hsl(var(--text-high))] mb-2">
          Agent Not Found
        </h1>
        <p className="text-[hsl(var(--text-muted))] mb-6">
          The agent you're looking for doesn't exist or you don't have access.
        </p>
        <Button variant="outline" onClick={() => navigate('/agents')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[hsl(var(--background))] overflow-hidden">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-high))]"
          >
            <Link to="/dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-high))]"
          >
            <Link to="/agents">
              <Users className="h-4 w-4 mr-2" />
              All Agents
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={
              isVoiceActive
                ? 'border-green-500/50 text-green-400'
                : 'border-[hsl(var(--border))]'
            }
          >
            {isVoiceActive ? 'Connected' : 'Ready'}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            asChild
          >
            <Link to={`/agents/${agentId}?tab=config`}>
              <Settings className="h-4 w-4 mr-2" />
              Edit Agent
            </Link>
          </Button>
        </div>
      </div>

      {/* Agent Name */}
      <div className="absolute top-16 left-0 right-0 text-center">
        <h1 className="text-2xl font-bold text-[hsl(var(--text-high))]">
          {agent.name}
        </h1>
        <p className="text-sm text-[hsl(var(--text-muted))]">
          {agent.useCase || 'Voice Agent'}
        </p>
        {agent.status !== 'ACTIVE' && (
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/30">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <span className="text-sm text-yellow-500">
              Agent must be deployed before testing voice calls
            </span>
          </div>
        )}
      </div>

      {/* Main Content - Glowing Orb */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-80 h-80 md:w-96 md:h-96">
          <GlowingOrb
            isSpeaking={isSpeaking}
            agentIsSpeaking={agentIsSpeaking}
            audioLevel={audioLevel}
            onClick={handleToggleTranscript}
          />
        </div>
      </div>

      {/* Call Controls */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
        {!isVoiceActive ? (
          <Button
            size="lg"
            onClick={handleStartCall}
            disabled={isStarting || isConnecting}
            className="bg-green-600 hover:bg-green-700 text-white rounded-full px-8"
          >
            {isStarting || isConnecting ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Phone className="h-5 w-5 mr-2" />
            )}
            {isStarting ? 'Connecting...' : 'Start Call'}
          </Button>
        ) : (
          <>
            {/* Mute Button */}
            <Button
              size="lg"
              variant="outline"
              onClick={toggleMute}
              className={`rounded-full ${
                isMuted
                  ? 'bg-red-500/20 border-red-500/50 text-red-400'
                  : 'bg-[hsl(var(--surface))]/50'
              }`}
            >
              {isMuted ? (
                <MicOff className="h-5 w-5" />
              ) : (
                <Mic className="h-5 w-5" />
              )}
            </Button>

            {/* End Call Button */}
            <Button
              size="lg"
              onClick={handleEndCall}
              className="bg-red-600 hover:bg-red-700 text-white rounded-full px-8"
            >
              <PhoneOff className="h-5 w-5 mr-2" />
              End Call
            </Button>

            {/* Transcript Toggle */}
            <Button
              size="lg"
              variant="outline"
              onClick={handleToggleTranscript}
              className={`rounded-full ${
                showTranscript
                  ? 'bg-[hsl(var(--primary))]/20 border-[hsl(var(--primary))]/50'
                  : 'bg-[hsl(var(--surface))]/50'
              }`}
            >
              <MessageSquare className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      {/* Audio Enable Button (if needed) */}
      {isVoiceActive && !canPlaybackAudio && (
        <div className="absolute bottom-24 left-0 right-0 flex justify-center">
          <Button
            size="sm"
            onClick={enableAudioPlayback}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            <Volume2 className="h-4 w-4 mr-2" />
            Enable Audio
          </Button>
        </div>
      )}

      {/* Transcript Drawer */}
      <AnimatePresence>
        {showTranscript && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="absolute bottom-0 left-0 right-0 z-20"
          >
            <Card className="rounded-t-2xl rounded-b-none border-b-0 bg-[hsl(var(--surface))]/95 backdrop-blur-xl max-h-[50vh]">
              {/* Drawer Handle */}
              <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]/50">
                <h3 className="text-sm font-medium text-[hsl(var(--text-high))]">
                  Conversation
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleToggleTranscript}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Transcript Content */}
              <div
                id="transcript-container"
                className="p-4 space-y-3 max-h-[40vh] overflow-y-auto"
              >
                {transcript.length === 0 ? (
                  <p className="text-center text-[hsl(var(--text-muted))] text-sm py-8">
                    Start talking to see the conversation here...
                  </p>
                ) : (
                  transcript.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.speaker === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          message.speaker === 'user'
                            ? 'bg-[hsl(var(--primary))] text-white'
                            : 'bg-[hsl(var(--surface-raised))] text-[hsl(var(--text-high))]'
                        }`}
                      >
                        <p className="text-sm">{message.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice State Indicator (for debugging in dev) */}
      {import.meta.env.DEV && (
        <div className="absolute top-4 right-4 text-xs text-[hsl(var(--text-muted))] font-mono">
          {voiceState}
        </div>
      )}
    </div>
  );
}
