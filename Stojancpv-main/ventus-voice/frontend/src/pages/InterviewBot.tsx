/**
 * Agent Forge Page
 * Freeform chat/voice experience for building an agent
 */

import { useState, useEffect, useRef, lazy, Suspense, useCallback, useMemo } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  MessageCircle,
  ArrowLeft,
  Send,
  CheckCircle2,
  Sparkles,
  Eye,
  Bot,
  User,
  Mic,
  MicOff,
  PhoneOff,
  MessagesSquare,
  AlertTriangle,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DocumentUploader } from "@/components/KnowledgeBase";
import { useKnowledgeBaseManager } from "@/hooks/useKnowledgeBase";
import { useForgeSession } from "@/hooks/useForgeSession";
import { useInterviewVoice } from "@/hooks/useInterviewVoice";
import { useVoiceState, type VoiceState } from "@/hooks/useVoiceState";
import { useCreationIntentTimeout } from "@/hooks/useCreationIntentTimeout";
import { agentForgeService } from "@/services/agent-forge.service";
import { AgentPreviewCard } from "@/components/agents/AgentPreviewCard";
import { ErrorBanner } from "@/components/interview/ErrorBanner";
import { InterviewErrorBoundary } from "@/components/interview/InterviewErrorBoundary";
import {
  MicPermissionPrompt,
  type MicPermissionState,
} from "@/components/interview/MicPermissionPrompt";
import { ResumeSessionModal, CreationRecoveryUI } from "@/components/Forge";
import { AgentCreationOverlay } from "@/components/Forge/AgentCreationOverlay";
import {
  VoiceConnectionStatus,
  type ConnectionStatus,
} from "@/components/interview/VoiceConnectionStatus";
import { VoiceControls } from "@/components/interview/VoiceControls";
import { ReconnectionOverlay } from "@/components/interview/ReconnectionOverlay";
import { ConnectionIndicator } from "@/components/interview/ConnectionIndicator";
import { HandoffNotification } from "@/components/interview/HandoffNotification";
import { LanguageSelectorCompact } from "@/components/interview/LanguageSelector";
// ProviderInfo removed - US-010: Provider selection UI no longer shown to users
import { GlowingOrb } from "@/components/Voice/GlowingOrb";
import {
  VoiceConnectionProgress,
  type ConnectionStage,
} from "@/components/interview/VoiceConnectionProgress";
import { toast } from "@/lib/toast";
import { ErrorType } from "@/lib/error-handling";
import { allowE2EAuthBypass, allowE2EVoiceTesting } from "@/lib/e2e-auth-bypass";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { checkMicPermission, requestMicPermission } from "@/lib/media-permissions";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { ApiClientError } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getItem, setItem } from "@/lib/safeLocalStorage";
import {
  getLanguageCoverage,
  getCoverageWarning,
  hasLimitedCoverage,
} from "@/lib/language-coverage";

// Lazy load mobile preview modal for better initial load performance
const MobilePreviewModal = lazy(() =>
  import("@/components/interview/MobilePreviewModal").then(module => ({
    default: module.MobilePreviewModal,
  }))
);

// US-010: fetchProviderInfo removed - provider selection UI no longer shown

export default function InterviewBot() {
  const TRANSCRIPT_PREF_KEY = "vora_forge_transcript_open";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["agent", "common", "navigation"]);
  const [searchParams, setSearchParams] = useSearchParams();
  const { userId, isLoaded } = useAuth();
  const effectiveUserId = userId || (allowE2EAuthBypass ? "e2e_test_user" : null);
  const [mode, setMode] = useState<"voice" | "chat">(() => {
    const requested = searchParams.get("mode");
    // Only start in voice mode if EXPLICITLY requested via ?mode=voice
    if (requested === "voice") {
      return (allowE2EAuthBypass && !allowE2EVoiceTesting) || !isFeatureEnabled("voice_enabled")
        ? "chat"
        : "voice";
    }
    // Default to chat mode - user must click Voice button to start voice
    return "chat";
  });
  const [inputValue, setInputValue] = useState("");
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState(false);
  const [isTranscriptOpen, setIsTranscriptOpen] = useState<boolean>(() => {
    // Default to FALSE - show GlowingOrb first in voice mode
    return Boolean(getItem<boolean>(TRANSCRIPT_PREF_KEY, { fallback: false }));
  });
  const [voiceStartupError, setVoiceStartupError] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallReason, setPaywallReason] = useState<
    "minutes" | "agents" | "feature_lock" | "unknown"
  >("unknown");
  const [micPermissionState, setMicPermissionState] = useState<MicPermissionState | null>(null);
  const [showKbUploadModal, setShowKbUploadModal] = useState(false);
  const [dismissedReadyCard, setDismissedReadyCard] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(() => {
    // Check localStorage first, then fall back to browser language
    const stored = localStorage.getItem("vora_voice_language");
    if (stored) return stored;
    return navigator.language?.split("-")[0] || "en";
  });
  // US-009: Persist language coverage warning dismissal per-language
  const COVERAGE_WARNING_DISMISSED_KEY = "vora_forge_coverage_warning_dismissed";
  const [dismissedCoverageWarning, setDismissedCoverageWarning] = useState<boolean>(() => {
    // Check if warning was dismissed for the current language
    const dismissed = localStorage.getItem(COVERAGE_WARNING_DISMISSED_KEY);
    if (dismissed) {
      try {
        const parsed = JSON.parse(dismissed) as Record<string, boolean>;
        return parsed[selectedLanguage] ?? false;
      } catch {
        return false;
      }
    }
    return false;
  });
  const [connectionStage, setConnectionStage] = useState<ConnectionStage>("starting-session");
  const [connectionStartTime, setConnectionStartTime] = useState<number>(0);

  // Forge overlay state — controls the creation animation independently of hook state
  const [showForgeOverlay, setShowForgeOverlay] = useState(false);
  const [forgeComplete, setForgeComplete] = useState(false);
  const pendingAgentIdRef = useRef<string | null>(null);

  // US-005: Track if transcript hint has been shown (persisted in localStorage)
  const TRANSCRIPT_HINT_KEY = "vora_forge_transcript_hint_shown";
  const [transcriptHintShown, setTranscriptHintShown] = useState<boolean>(() => {
    return Boolean(localStorage.getItem(TRANSCRIPT_HINT_KEY));
  });
  const handleDismissTranscriptHint = useCallback(() => {
    setTranscriptHintShown(true);
    localStorage.setItem(TRANSCRIPT_HINT_KEY, "true");
  }, []);

  // US-009: Handler to persist coverage warning dismissal per-language
  const handleDismissCoverageWarning = useCallback(() => {
    setDismissedCoverageWarning(true);
    // Store as per-language record in localStorage
    const dismissed = localStorage.getItem(COVERAGE_WARNING_DISMISSED_KEY);
    let parsed: Record<string, boolean> = {};
    if (dismissed) {
      try {
        parsed = JSON.parse(dismissed) as Record<string, boolean>;
      } catch {
        // ignore malformed JSON
      }
    }
    parsed[selectedLanguage] = true;
    localStorage.setItem(COVERAGE_WARNING_DISMISSED_KEY, JSON.stringify(parsed));
  }, [selectedLanguage]);

  // US-006: Track unread transcript content
  const [hasUnreadTranscript, setHasUnreadTranscript] = useState(false);
  const lastTranscriptLengthRef = useRef(0);

  // US-010: providerInfo state removed - provider selection UI no longer shown

  // FRG-16: Language coverage check for voice mode
  const languageCoverage = useMemo(() => getLanguageCoverage(selectedLanguage), [selectedLanguage]);
  const showLanguageCoverageWarning = useMemo(
    () => mode === "voice" && !dismissedCoverageWarning && hasLimitedCoverage(selectedLanguage),
    [mode, dismissedCoverageWarning, selectedLanguage]
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const transcriptSentRef = useRef<Set<string>>(new Set());
  const voiceStartAttemptedRef = useRef(false);
  const lastPaywallCodeRef = useRef<string | null>(null);
  // Track if we've auto-started voice for current mode entry (prevents repeated auto-starts)
  const hasAutoStartedVoiceRef = useRef(false);
  // P0J-06: Track consecutive voice failures for auto-switch to chat
  const voiceFailCountRef = useRef(0);
  const VOICE_FAIL_THRESHOLD = 3;

  const {
    sessionId,
    agentId,
    knowledgeBaseId,
    messages,
    isLoading,
    isComplete,
    agentPreview,
    events,
    sendMessage,
    start,
    startVoice,
    complete,
    refresh,
    resume,
    error,
    clearError,
    userMessageCount,
    shouldAutoCreate,
    isApproachingLimit,
    shouldComplete,
    kbGatekeeper,
    checkpoint,
    isLoadingCheckpoint,
    hasResumeContext,
    clearCheckpoints,
    stopVoiceMode,
    createdAgentId,
    isCreating,
  } = useForgeSession();

  // KB manager for inline upload modal (uses kbGatekeeper's knowledgeBaseId)
  const effectiveKbId = knowledgeBaseId || kbGatekeeper?.knowledgeBaseId;
  const { uploadDocuments, uploadState, addUrlAsync, isAddingUrl, resetUpload } =
    useKnowledgeBaseManager(effectiveKbId, agentId ?? undefined);

  const {
    startVoiceSession,
    endVoiceSession,
    isVoiceActive,
    isConnecting: isVoiceConnecting,
    isMuted,
    isSpeaking,
    agentIsSpeaking,
    audioLevel,
    toggleMute,
    transcript,
    status,
    canPlaybackAudio,
    enableAudioPlayback,
    connectionState,
    isReconnecting,
    reconnectAttempt,
    isHandedOff,
    changeLanguage,
    sessionId: voiceSessionId,
    roomName: voiceRoomName,
  } = useInterviewVoice({
    onError: msg => {
      setVoiceStartupError(msg);
    },
    onUploadIntentDetected: suggestedUploads => {
      // Real-time path: LiveKit RPC triggers upload modal instantly (no 5s polling wait)
      if (knowledgeBaseId && mode === "voice") {
        setShowKbUploadModal(true);
        if (!isMuted && toggleMute) {
          toggleMute();
        }
      }
    },
  });

  // US-003: Unified voice state machine
  const {
    voiceState,
    hasVoiceBeenUsed,
    resetToIdle: resetVoiceState,
  } = useVoiceState({
    isConnecting: isVoiceConnecting,
    isActive: isVoiceActive,
    hasError: !!voiceStartupError,
  });

  // Phase 4: Creation intent timeout detection
  const {
    handleTranscript: handleCreationIntentTranscript,
    showRecoveryUI: showCreationRecoveryUI,
    clearIntent: clearCreationIntent,
    attemptCount: creationAttemptCount,
  } = useCreationIntentTimeout({
    createdAgentId,
    onIntentDetected: text => {
      if (import.meta.env.DEV) {
        console.log(
          "[InterviewBot] Creation intent detected:",
          text,
          "attempts:",
          creationAttemptCount + 1
        );
      }
    },
  });

  // Phase 4: Feed transcripts to creation intent detection
  useEffect(() => {
    if (transcript && transcript.isFinal && mode === "voice") {
      handleCreationIntentTranscript(transcript.text || "", transcript.isFinal);
    }
  }, [transcript, mode, handleCreationIntentTranscript]);

  // Keep URL in sync so refresh/shared links preserve the chosen mode.
  useEffect(() => {
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set("mode", mode);
        return next;
      },
      { replace: true }
    );
  }, [mode, setSearchParams]);

  // Show resume modal when checkpoint exists and user hasn't started voice yet
  useEffect(() => {
    if (
      hasResumeContext &&
      checkpoint &&
      !isVoiceActive &&
      !isVoiceConnecting &&
      !isLoadingCheckpoint
    ) {
      setShowResumeModal(true);
    }
  }, [hasResumeContext, checkpoint, isVoiceActive, isVoiceConnecting, isLoadingCheckpoint]);

  // P0J-06: Reset voice failure counter when voice successfully connects
  useEffect(() => {
    if (isVoiceActive) {
      voiceFailCountRef.current = 0;
      setConnectionStage("connected");
    }
  }, [isVoiceActive]);

  // Update connection stage based on voice state
  useEffect(() => {
    if (isVoiceConnecting && connectionState === "Connected" && !isVoiceActive) {
      // LiveKit connected but agent hasn't joined yet
      setConnectionStage("waiting-for-agent");
    }
  }, [isVoiceConnecting, connectionState, isVoiceActive]);

  // US-009: Check localStorage for per-language dismissal when language changes
  useEffect(() => {
    const dismissed = localStorage.getItem(COVERAGE_WARNING_DISMISSED_KEY);
    if (dismissed) {
      try {
        const parsed = JSON.parse(dismissed) as Record<string, boolean>;
        setDismissedCoverageWarning(parsed[selectedLanguage] ?? false);
      } catch {
        setDismissedCoverageWarning(false);
      }
    } else {
      setDismissedCoverageWarning(false);
    }
  }, [selectedLanguage]);

  // Track elapsed connection time for user feedback
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    if (!isVoiceConnecting || connectionStartTime === 0) {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - connectionStartTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [isVoiceConnecting, connectionStartTime]);

  // Redirect to agent test page when voice agent auto-creates the agent
  useEffect(() => {
    if (!createdAgentId) return;

    // End voice session cleanly
    if (isVoiceActive) {
      endVoiceSession();
    }

    // Invalidate agents list cache so new agent appears when navigating to /agents
    void queryClient.invalidateQueries({ queryKey: queryKeys.agents.lists() });

    // Show forging overlay with completion animation (voice auto-created)
    pendingAgentIdRef.current = createdAgentId;
    setShowForgeOverlay(true);
    setForgeComplete(true);
    // Navigation happens in handleOverlayComplete after confetti
  }, [createdAgentId, isVoiceActive, endVoiceSession, queryClient]);

  // Persist transcript preference (voice mode only, but stored regardless of mode).
  useEffect(() => {
    setItem(TRANSCRIPT_PREF_KEY, isTranscriptOpen);
  }, [isTranscriptOpen]);

  // If the backend returns a stable limit code, open the paywall modal.
  useEffect(() => {
    if (!error) return;
    if (error.type !== ErrorType.TOKEN_LIMIT) return;
    if (!(error.originalError instanceof ApiClientError)) return;

    const code = error.originalError.code ?? null;
    if (code && lastPaywallCodeRef.current === code && showPaywall) return;
    lastPaywallCodeRef.current = code;

    if (code === "MINUTES_LIMIT_REACHED") setPaywallReason("minutes");
    else if (code === "AGENTS_LIMIT_REACHED") setPaywallReason("agents");
    else setPaywallReason("unknown");

    setShowPaywall(true);
  }, [error, showPaywall]);

  // Track previous kbGatekeeper by ID to detect new triggers (not reference equality)
  const prevKbGatekeeperIdRef = useRef<string | null>(null);

  // KB gatekeeper modal: auto-open and pause agent when triggered
  // This provides a focused UX where user uploads documents before continuing conversation
  useEffect(() => {
    // Only trigger in voice mode for NEW kbGatekeeper (by ID, not reference)
    if (mode !== "voice") return;
    if (!kbGatekeeper) return;
    if (prevKbGatekeeperIdRef.current === kbGatekeeper.knowledgeBaseId) return;

    prevKbGatekeeperIdRef.current = kbGatekeeper.knowledgeBaseId;

    // Auto-open the upload modal (one central modal that pauses the agent)
    setShowKbUploadModal(true);

    // Mute the microphone to pause the agent while uploading
    // This prevents the agent from continuing to talk/listen during upload
    if (!isMuted && toggleMute) {
      toggleMute();
    }
  }, [mode, kbGatekeeper, isMuted, toggleMute]);

  const attemptStartVoice = useCallback(async (): Promise<void> => {
    if (!effectiveUserId) return;
    if (allowE2EAuthBypass && !allowE2EVoiceTesting) return;
    if (!isFeatureEnabled("voice_enabled")) return;
    if (isVoiceActive || isVoiceConnecting) return;
    if (voiceStartAttemptedRef.current) return;

    voiceStartAttemptedRef.current = true;
    setVoiceStartupError(null);
    setMicPermissionState(null);
    setConnectionStartTime(Date.now());

    try {
      // Stage 1: Backend configuration check
      setConnectionStage("starting-session");
      const config = await agentForgeService.getConfig();
      if (!config.forge.configured) {
        setVoiceStartupError(
          "Forge is not configured on the backend yet. Please set XAI settings and retry."
        );
        setMode("chat");
        return;
      }
      if (!config.voice.configured) {
        setVoiceStartupError("Voice is not configured on the backend yet. Switching to chat.");
        setMode("chat");
        return;
      }

      // Stage 2: Check mic permission
      setConnectionStage("requesting-permission");
      const permissionStatus = await checkMicPermission();

      if (permissionStatus === "denied") {
        setMicPermissionState("blocked");
        setConnectionStage("error");
        return;
      }

      if (permissionStatus === "prompt") {
        setMicPermissionState("waiting");
        const granted = await requestMicPermission();

        if (!granted) {
          setMicPermissionState("denied");
          setVoiceStartupError(
            "Microphone access denied. Please allow microphone access to use voice mode."
          );
          setConnectionStage("error");
          return;
        }
      }

      // Permission granted, clear the prompt
      setMicPermissionState(null);

      // Stage 3: Start voice session with backend
      setConnectionStage("starting-session");
      const storedSessionId = localStorage.getItem("vora_agent_forge_session_id") || undefined;

      const resp = await startVoice({
        language: selectedLanguage,
        sessionId: sessionId ?? storedSessionId,
      });

      // Stage 4: Connect to LiveKit room
      setConnectionStage("connecting");
      await startVoiceSession({
        sessionId: resp.sessionId,
        roomName: resp.roomName,
        participantToken: resp.participantToken,
        wsUrl: resp.wsUrl,
      });

      // Stage 5: Connected successfully
      setConnectionStage("connected");

      // US-010: Auto-enable audio playback (within user gesture context from button click)
      // This prevents the "Enable Audio" prompt from appearing in most cases
      try {
        await enableAudioPlayback();
      } catch {
        // Browser may still block if not in user gesture context - that's ok, button will show
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t("common:status.error");
      setVoiceStartupError(message);
      setConnectionStage("error");

      // P0J-06: Track consecutive voice failures for auto-switch to chat
      voiceFailCountRef.current += 1;
      if (import.meta.env.DEV) {
        console.log(
          `[InterviewBot] Voice failure count: ${voiceFailCountRef.current}/${VOICE_FAIL_THRESHOLD}`
        );
      }

      // Auto-switch to chat mode after 3 consecutive voice failures
      if (voiceFailCountRef.current >= VOICE_FAIL_THRESHOLD) {
        toast.info(
          t("agent:forge.voiceFirst.autoSwitchToChat", {
            defaultValue: "Voice had trouble connecting. Switching to chat mode.",
          })
        );
        voiceFailCountRef.current = 0; // Reset counter
        setMode("chat");
        setVoiceStartupError(null);
        setTimeout(() => inputRef.current?.focus(), 50);
        return; // Exit early - don't show mic permission prompt
      }

      // Only show mic permission prompt for ACTUAL mic permission errors
      // NOT for connection timeouts or server errors
      const isMicPermissionError =
        message.toLowerCase().includes("microphone access denied") ||
        message.toLowerCase().includes("permission denied") ||
        message.toLowerCase().includes("not allowed");

      const isConnectionError =
        message.toLowerCase().includes("timeout") ||
        message.toLowerCase().includes("connection") ||
        message.toLowerCase().includes("disconnected") ||
        message.toLowerCase().includes("voice server") ||
        message.toLowerCase().includes("agent service") ||
        message.toLowerCase().includes("network") ||
        message.toLowerCase().includes("fully connected") ||
        message.toLowerCase().includes("participant sid") ||
        message.toLowerCase().includes("not responding");

      if (isMicPermissionError && !isConnectionError) {
        const permissionStatus = await checkMicPermission();
        if (permissionStatus === "denied") {
          setMicPermissionState("blocked");
        } else {
          setMicPermissionState("denied");
        }
      }
      // For connection errors, don't show mic permission prompt - the error banner is enough

      // Ensure a chat session can continue instantly if the user switches.
      if (!sessionId) {
        try {
          const resumed = await resume();
          if (!resumed) {
            await start();
          }
        } catch {
          // handled by hook error state
        }
      }
    }
  }, [
    effectiveUserId,
    enableAudioPlayback,
    isVoiceActive,
    isVoiceConnecting,
    resume,
    selectedLanguage,
    sessionId,
    setMode,
    start,
    startVoice,
    startVoiceSession,
    t,
  ]);

  // Voice-first: auto-start voice session after mic permission; fallback to chat if voice fails.
  // CRITICAL FIX: Use a dedicated ref to ensure we only auto-start ONCE per mode entry.
  // The previous approach with eslint-disable didn't work because attemptStartVoice changes identity.
  // BUG #4 FIX: Wait for checkpoint loading and show resume modal before auto-starting.
  useEffect(() => {
    if (mode !== "voice") {
      // Reset when leaving voice mode, so next entry can auto-start
      hasAutoStartedVoiceRef.current = false;
      return;
    }

    // Wait for checkpoint data to load before deciding whether to auto-start
    // This prevents the race condition where voice starts before resume modal can show
    if (isLoadingCheckpoint) {
      if (import.meta.env.DEV) {
        console.log("[InterviewBot] Waiting for checkpoint to load before auto-start");
      }
      return;
    }

    // If user has a resumable session, DON'T auto-start - let the resume modal handle it
    // The user should explicitly choose to "Resume" or "Start Fresh"
    if (hasResumeContext && checkpoint) {
      if (import.meta.env.DEV) {
        console.log("[InterviewBot] Resume context exists, showing modal instead of auto-start");
      }
      return;
    }

    // Only auto-start ONCE when entering voice mode
    if (hasAutoStartedVoiceRef.current) {
      if (import.meta.env.DEV) {
        console.log("[InterviewBot] Skipping auto-start: already started for this mode entry");
      }
      return;
    }
    hasAutoStartedVoiceRef.current = true;

    void attemptStartVoice();
  }, [mode, attemptStartVoice, isLoadingCheckpoint, hasResumeContext, checkpoint]); // Include checkpoint deps for resume modal handling

  // Chat mode: ensure a session exists (used for e2e + manual chat fallback).
  useEffect(() => {
    if (!effectiveUserId) return;
    if (mode !== "chat") return;
    if (sessionId) return;
    void (async () => {
      const resumed = await resume();
      if (!resumed) {
        await start();
      }
    })().catch(() => undefined);
  }, [effectiveUserId, mode, resume, sessionId, start]);

  const voiceTranscriptAsMessages = transcript.map(m => ({
    id: m.id,
    role: (m.speaker === "agent" ? "assistant" : "user") as const,
    content: m.text,
  }));

  const visibleMessages =
    mode === "voice" ? (isTranscriptOpen ? voiceTranscriptAsMessages : []) : messages;

  /**
   * FRG-07: Export transcript to TXT format
   * Formats conversation as readable text with timestamps
   */
  const handleExportTranscript = useCallback(() => {
    // Combine voice transcript and chat messages
    const allMessages = mode === "voice" ? transcript : messages;
    if (allMessages.length === 0) {
      toast.info(t("common:actions.noDataToExport", { defaultValue: "No messages to export" }));
      return;
    }

    // Format as TXT
    const lines: string[] = [
      "═══════════════════════════════════════════════════════",
      `  VORA FORGE - Transcript Export`,
      `  Session: ${sessionId || "Unknown"}`,
      `  Date: ${new Date().toLocaleDateString()}`,
      `  Time: ${new Date().toLocaleTimeString()}`,
      "═══════════════════════════════════════════════════════",
      "",
    ];

    allMessages.forEach(msg => {
      const speaker =
        "speaker" in msg
          ? msg.speaker === "agent"
            ? "Agent"
            : msg.speaker === "user"
              ? "You"
              : "System"
          : msg.role === "assistant"
            ? "Agent"
            : "You";
      const text = "text" in msg ? msg.text : msg.content;
      const timestamp =
        "timestamp" in msg && msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : "";

      lines.push(`[${timestamp || "—"}] ${speaker}:`);
      lines.push(`  ${text}`);
      lines.push("");
    });

    lines.push("═══════════════════════════════════════════════════════");
    lines.push("  Exported from Vora Voice Platform");
    lines.push("═══════════════════════════════════════════════════════");

    // Create and download file
    const content = lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vora-transcript-${sessionId || "forge"}-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t("common:actions.exported", { defaultValue: "Transcript exported" }));
  }, [mode, transcript, messages, sessionId, t]);

  /**
   * FRG-11: Handle language change during active voice call
   * Updates backend configuration and refreshes provider info
   */
  const handleLanguageChange = useCallback(
    async (newLanguage: string) => {
      setSelectedLanguage(newLanguage);
      localStorage.setItem("vora_voice_language", newLanguage);

      // FRG-11: If voice is active, change language in real-time
      if (isVoiceActive && changeLanguage) {
        try {
          await changeLanguage(newLanguage);

          // US-010: Provider info fetch removed - provider selection UI no longer shown

          toast.success(
            t("agent:forge.language.changed", {
              defaultValue: "Language changed successfully",
            }),
            {
              description: t("agent:forge.language.changedDescription", {
                defaultValue: "Voice configuration updated for the new language.",
              }),
            }
          );
        } catch (err) {
          toast.error(
            t("agent:forge.language.changeFailed", {
              defaultValue: "Failed to change language",
            }),
            {
              description: err instanceof Error ? err.message : "Please try again.",
            }
          );
        }
      } else {
        // Not active - just notify they'll need to restart
        toast.info(
          t("agent:forge.language.changeNotice", {
            defaultValue:
              "Language changed. Start a new voice session for the change to take effect.",
          })
        );
      }
    },
    [isVoiceActive, changeLanguage, t]
  );

  // Auto-scroll to bottom when visible messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mode, isTranscriptOpen, messages.length, transcript.length]);

  // US-006: Track unread transcript content
  useEffect(() => {
    // Mark as unread when transcript grows and panel is closed
    if (transcript.length > lastTranscriptLengthRef.current && !isTranscriptOpen) {
      setHasUnreadTranscript(true);
    }
    lastTranscriptLengthRef.current = transcript.length;
  }, [transcript.length, isTranscriptOpen]);

  // US-006: Clear unread state when transcript is opened
  useEffect(() => {
    if (isTranscriptOpen) {
      setHasUnreadTranscript(false);
    }
  }, [isTranscriptOpen]);

  // Show transient error toast (for non-critical errors)
  useEffect(() => {
    if (error && error.type === ErrorType.NETWORK && error.retryable) {
      toast.error(t("common:status.error"), {
        description: error.message,
        duration: 3000,
      });
    }
  }, [error, t]);

  // Handle retry action
  const handleRetry = async (): Promise<void> => {
    clearError();
    // Retry the last action - in this case, try starting again if no session
    if (!sessionId) {
      const resumed = await resume();
      if (!resumed) {
        await start();
      }
    }
  };

  // Handle restart action
  const handleRestart = (): void => {
    clearError();
    localStorage.removeItem("vora_agent_forge_session_id");
    window.location.reload();
  };

  const handleSendMessage = async () => {
    if (mode !== "chat") return;
    if (!inputValue.trim() || isLoading || isComplete) return;

    const msg = inputValue.trim();
    setInputValue("");

    await sendMessage(msg);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Overlay completion callback — navigate after the animation finishes
  const handleOverlayComplete = useCallback(() => {
    setShowForgeOverlay(false);
    setForgeComplete(false);
    const agentId = pendingAgentIdRef.current;
    if (agentId) {
      toast.success(t("agent:forge.createAgent.successTitle"), {
        description: t("agent:forge.createAgent.successDescription"),
      });
      window.dispatchEvent(new CustomEvent('tutorial:validation', { detail: { key: 'agent_created' } }));
      navigate(`/agents/${agentId}?tab=test&autostart=1`);
      pendingAgentIdRef.current = null;
    }
  }, [navigate, t]);

  const handleCreateAgent = async () => {
    try {
      if (isVoiceActive) {
        try {
          await endVoiceSession();
          stopVoiceMode(); // Stop polling when voice ends
        } catch {
          // ignore
        }
      }

      // Show the forging overlay immediately
      setShowForgeOverlay(true);
      setForgeComplete(false);

      const result = await complete();

      // Invalidate agents list cache so new agent appears when navigating to /agents
      void queryClient.invalidateQueries({ queryKey: queryKeys.agents.lists() });

      // Store agentId and trigger overlay completion animation
      pendingAgentIdRef.current = result.agentId;
      setForgeComplete(true);
      // Navigation happens in handleOverlayComplete after confetti
    } catch (err) {
      // Hide overlay on error
      setShowForgeOverlay(false);
      setForgeComplete(false);
      pendingAgentIdRef.current = null;

      // US-005: Enhanced error messaging with categorization and retry action
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errorLower = errorMessage.toLowerCase();

      // Categorize errors
      const isTimeout = errorLower.includes("timeout") || errorLower.includes("timed out");
      const isCompilerConfig = errorLower.includes("compiler not configured");
      const isInvalidSession =
        errorLower.includes("invalid session") || errorLower.includes("session not found");
      const isNetwork =
        errorLower.includes("network") ||
        errorLower.includes("fetch") ||
        errorLower.includes("failed to fetch");
      const isValidation = errorLower.includes("validation") || errorLower.includes("invalid");

      // Common retry action for recoverable errors
      const retryAction = {
        label: t("common:actions.tryAgain", { defaultValue: "Try Again" }),
        onClick: () => handleCreateAgent(),
      };

      if (isTimeout) {
        toast.error(
          t("agent:forge.createAgent.timeoutTitle", { defaultValue: "Compilation Timed Out" }),
          {
            description: t("agent:forge.createAgent.timeoutDescription", {
              defaultValue: "The AI is taking too long. Please try again.",
            }),
            duration: 8000,
            action: retryAction,
          }
        );
      } else if (isNetwork) {
        toast.error(
          t("agent:forge.createAgent.networkTitle", { defaultValue: "Connection Problem" }),
          {
            description: t("agent:forge.createAgent.networkDescription", {
              defaultValue: "Check your internet connection and try again.",
            }),
            duration: 8000,
            action: retryAction,
          }
        );
      } else if (isCompilerConfig) {
        toast.error(
          t("agent:forge.createAgent.notConfiguredTitle", {
            defaultValue: "Service Not Configured",
          }),
          {
            description: t("agent:forge.createAgent.notConfiguredDescription", {
              defaultValue: "Agent compilation is not configured yet. Contact support.",
            }),
            duration: 8000,
          }
        );
      } else if (isInvalidSession) {
        toast.error(
          t("agent:forge.createAgent.invalidSessionTitle", { defaultValue: "Session Problem" }),
          {
            description: t("agent:forge.createAgent.invalidSessionDescription", {
              defaultValue: "Chat with your agent a bit more before creating.",
            }),
            duration: 8000,
          }
        );
      } else if (isValidation) {
        toast.error(
          t("agent:forge.createAgent.validationTitle", { defaultValue: "Validation Failed" }),
          {
            description:
              errorMessage ||
              t("agent:forge.createAgent.validationDescription", {
                defaultValue:
                  "Some required information is missing. Complete the conversation first.",
              }),
            duration: 8000,
          }
        );
      } else {
        // Generic error with retry option
        toast.error(
          t("agent:forge.createAgent.serverTitle", { defaultValue: "Something Went Wrong" }),
          {
            description:
              errorMessage ||
              t("agent:forge.createAgent.serverDescription", {
                defaultValue: "An unexpected error occurred. Please try again.",
              }),
            duration: 8000,
            action: retryAction,
          }
        );
      }

      // Log detailed error for debugging
      console.error("[handleCreateAgent] Error:", {
        message: errorMessage,
        category: isTimeout
          ? "timeout"
          : isNetwork
            ? "network"
            : isCompilerConfig
              ? "config"
              : isInvalidSession
                ? "session"
                : isValidation
                  ? "validation"
                  : "server",
        error: err,
      });
    }
  };

  // Persist final voice transcript segments to backend (so sessions can be resumed + compiled).
  useEffect(() => {
    if (mode !== "voice") return;
    if (!sessionId) return;

    const pending = transcript.filter(m => m.isFinal && !transcriptSentRef.current.has(m.id));
    if (pending.length === 0) return;

    pending.forEach(m => {
      transcriptSentRef.current.add(m.id);

      void agentForgeService
        .storeVoiceTranscript({
          sessionId,
          speaker: m.speaker === "agent" ? "assistant" : "user",
          transcript: m.text,
          isFinal: true,
          language: m.language,
          timestamp: m.timestamp.toISOString(),
        })
        .catch(() => {
          // non-fatal
        });
    });
  }, [mode, sessionId, transcript]);

  // While in voice mode, poll backend for Blueprint updates coming from the realtime agent tools.
  // IMPORTANT: Use a conservative interval to avoid 429 rate limits (FREE tier = 100 requests/hour).
  // 15 second interval = 240 requests/hour max, but with real usage much lower.
  useEffect(() => {
    if (mode !== "voice") return;
    if (!sessionId) return;
    if (!isVoiceActive) return; // Only poll when voice is actually active

    const interval = window.setInterval(() => {
      void refresh();
    }, 15000); // 15 seconds - was 1.5s which caused 429 errors

    return () => window.clearInterval(interval);
  }, [mode, sessionId, refresh, isVoiceActive]);

  // CRITICAL: Keep a ref to the latest endVoiceSession so cleanup can use it.
  // This pattern allows empty-deps useEffect while accessing latest function.
  const endVoiceSessionRef = useRef(endVoiceSession);
  const isVoiceActiveRef = useRef(isVoiceActive);
  const stopVoiceModeRef = useRef(stopVoiceMode);
  useEffect(() => {
    endVoiceSessionRef.current = endVoiceSession;
  }, [endVoiceSession]);
  useEffect(() => {
    isVoiceActiveRef.current = isVoiceActive;
  }, [isVoiceActive]);
  useEffect(() => {
    stopVoiceModeRef.current = stopVoiceMode;
  }, [stopVoiceMode]);

  // CRITICAL: Clean up voice session when navigating away from this page.
  // Without this, the microphone stays active even after leaving the page.
  useEffect(() => {
    return () => {
      // Cleanup on unmount (navigation away)
      if (isVoiceActiveRef.current) {
        if (import.meta.env.DEV) {
          console.log("[InterviewBot] 🧹 Unmounting - cleaning up voice session");
        }
        // Fire and forget - we're unmounting so can't await
        endVoiceSessionRef.current().catch(() => {
          // Ignore errors during cleanup
        });
        // Stop polling too
        stopVoiceModeRef.current();
      }
    };
  }, []); // Empty deps = runs only on unmount

  if (!isLoaded && !allowE2EAuthBypass) {
    return null;
  }

  if (!effectiveUserId) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <InterviewErrorBoundary onReset={handleRestart}>
      {/* Reconnection Overlay - Full Screen */}
      <ReconnectionOverlay
        isReconnecting={isReconnecting}
        reconnectAttempt={reconnectAttempt}
        maxAttempts={5}
      />

      {/* Handoff Notification - Full Screen */}
      <HandoffNotification isOpen={isHandedOff} />

      <div className="h-[100dvh] md:h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="border-b border-[hsl(var(--border))] bg-[hsl(var(--void))]/50 backdrop-blur-sm">
          <div className="container mx-auto px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/agents/create")}
                className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-high))] h-11 px-3"
              >
                <ArrowLeft className="h-4 w-4 me-1 md:me-2" />
                <span className="hidden sm:inline">{t("navigation:breadcrumbs.back")}</span>
              </Button>
              <div className="flex items-center gap-2 md:gap-3 flex-1 justify-center md:justify-start">
                <div className="p-1.5 md:p-2 rounded-lg bg-[hsl(var(--primary))]/10">
                  <MessageCircle className="h-4 w-4 md:h-5 md:w-5 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <h1 className="text-base md:text-lg font-semibold text-[hsl(var(--text-high))]">
                    {t("agent:forge.title")}
                  </h1>
                  <p className="hidden sm:block text-sm text-[hsl(var(--text-muted))]">
                    {t("agent:forge.subtitle")}
                  </p>
                </div>
              </div>
              {/* Mode Toggle + Language Selector (desktop) */}
              <div className="hidden md:flex items-center gap-2">
                {/* FRG-11: Language Selector with runtime switching */}
                <LanguageSelectorCompact value={selectedLanguage} onChange={handleLanguageChange} />

                <Button
                  size="sm"
                  variant={mode === "voice" ? "default" : "ghost"}
                  onClick={() => {
                    setVoiceStartupError(null);
                    voiceStartAttemptedRef.current = false;
                    setMode("voice");
                  }}
                  className={cn(
                    "h-11",
                    mode === "voice" && "bg-[hsl(var(--primary))] text-[hsl(var(--void))]"
                  )}
                >
                  <Mic className="h-4 w-4 me-2" />
                  {t("agent:forge.mode.voice")}
                </Button>
                <Button
                  size="sm"
                  variant={mode === "chat" ? "default" : "ghost"}
                  onClick={async () => {
                    setVoiceStartupError(null);
                    setMode("chat");
                    if (isVoiceActive) {
                      await endVoiceSession().catch(() => undefined);
                      stopVoiceMode(); // Stop polling when switching to chat
                      voiceStartAttemptedRef.current = false;
                    }
                    setTimeout(() => inputRef.current?.focus(), 50);
                  }}
                  className={cn(
                    "h-11",
                    mode === "chat" && "bg-[hsl(var(--primary))] text-[hsl(var(--void))]"
                  )}
                >
                  <MessagesSquare className="h-4 w-4 me-2" />
                  {t("agent:forge.mode.chat")}
                </Button>
              </div>
              {/* Primary Create Agent CTA - shows when ready */}
              {shouldComplete && !isComplete && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleCreateAgent}
                        className={cn(
                          "hidden md:flex h-11 bg-[hsl(var(--primary))] text-[hsl(var(--void))] hover:bg-[hsl(var(--primary))]/90",
                          "animate-pulse hover:animate-none"
                        )}
                        disabled={isCreating}
                        data-testid="forge-header-create-agent"
                      >
                        {isCreating ? (
                          <Loader2 className="h-4 w-4 me-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 me-2" />
                        )}
                        {t("agent:forge.complete.createAgent")}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        {t("agent:forge.complete.readyTooltip", {
                          defaultValue: "Your agent is ready to be created!",
                        })}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {/* Mobile Create Agent CTA - floating action button style */}
              {shouldComplete && !isComplete && (
                <Button
                  onClick={handleCreateAgent}
                  className={cn(
                    "md:hidden h-11 px-3 bg-[hsl(var(--primary))] text-[hsl(var(--void))]",
                    "animate-pulse hover:animate-none"
                  )}
                  disabled={isCreating}
                  data-testid="forge-mobile-create-agent"
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              )}
              {/* Mobile Preview Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMobilePreviewOpen(true)}
                className="md:hidden h-11 px-3 text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-high))]"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <div className="hidden md:block w-[100px]" /> {/* Spacer for balance on desktop */}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <div className="container mx-auto px-4 md:px-6 py-3 md:py-6 h-full">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 h-full">
              {/* Left Column - Chat Interface */}
              <div className="lg:col-span-2 flex flex-col h-full min-h-0">
                {/* Error Banner */}
                {error && error.type !== ErrorType.NETWORK && (
                  <ErrorBanner
                    error={error}
                    onRetry={handleRetry}
                    onRestart={handleRestart}
                    onDismiss={clearError}
                    onUpgrade={() => setShowPaywall(true)}
                  />
                )}

                {/* FRG-16: Language Coverage Warning */}
                {showLanguageCoverageWarning && (
                  <div className="mb-3" data-testid="forge-language-coverage-warning">
                    <Card className="bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/30 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-[hsl(var(--warning))] flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-[hsl(var(--text-high))]">
                              {t("agent:forge.language.limitedCoverage", {
                                defaultValue: "Limited voice support for this language",
                              })}
                            </p>
                            <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                              {languageCoverage.suggestion ||
                                t("agent:forge.language.limitedCoverageDescription", {
                                  defaultValue:
                                    "Voice quality may vary. Consider using chat for more accurate responses.",
                                })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setMode("chat");
                              handleDismissCoverageWarning();
                            }}
                            className="text-xs"
                          >
                            {t("agent:forge.language.switchToChat", { defaultValue: "Use Chat" })}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleDismissCoverageWarning}
                            className="text-xs text-[hsl(var(--text-muted))]"
                          >
                            {t("common:actions.dismiss", { defaultValue: "Dismiss" })}
                          </Button>
                        </div>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Knowledge Base Gatekeeper - shown in chat mode only (voice mode uses toast notification) */}
                {mode === "chat" && events?.some(e => e.type === "KB_GATEKEEPER") && (
                  <div className="mb-3">
                    <Card className="bg-[hsl(var(--surface))]/70 backdrop-blur-xl border-[hsl(var(--border))]/50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-[hsl(var(--text-high))]">
                            {t("agent:forge.kbGatekeeper.title")}
                          </p>
                          <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                            {kbGatekeeper?.message || t("agent:forge.kbGatekeeper.description")}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setShowKbUploadModal(true)}
                          data-testid="forge-kb-upload-btn"
                        >
                          {t("common:actions.upload")}
                        </Button>
                      </div>
                    </Card>
                  </div>
                )}

                {/* Microphone Permission Prompt */}
                {mode === "voice" && micPermissionState && (
                  <div className="mb-3" data-testid="forge-mic-permission">
                    <MicPermissionPrompt
                      state={micPermissionState}
                      onRetry={async () => {
                        voiceStartAttemptedRef.current = false;
                        await attemptStartVoice();
                      }}
                      onSwitchToChat={async () => {
                        // FRG-03: Chat fallback when mic permission denied
                        setVoiceStartupError(null);
                        setMode("chat");
                        if (isVoiceActive) {
                          await endVoiceSession().catch(() => undefined);
                        }
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      errorMessage={voiceStartupError || undefined}
                    />
                  </div>
                )}

                {/* Voice Connection Status & Controls */}
                {mode === "voice" && !micPermissionState && (
                  <div className="mb-3 space-y-3">
                    {/* US-010: ProviderInfo removed - provider selection UI no longer shown */}

                    {/* Connection Status with Indicator */}
                    <Card className="bg-[hsl(var(--surface))]/70 backdrop-blur-xl border-[hsl(var(--border))]/50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex-1">
                          {/* US-004: Use voiceState for status (map 'ended'/'paused' to 'disconnected') */}
                          <VoiceConnectionStatus
                            status={
                              voiceState === "ended" || voiceState === "paused"
                                ? "disconnected"
                                : voiceState
                            }
                            quality="good" // BUG #5 FIX: Don't use audioLevel for connection quality - it measures mic volume, not network
                            errorMessage={voiceStartupError || undefined}
                            onRetry={async () => {
                              voiceStartAttemptedRef.current = false;
                              await attemptStartVoice();
                            }}
                          />
                        </div>
                        {/* Connection Indicator Dot */}
                        {(isVoiceActive || isVoiceConnecting || isReconnecting) && (
                          <ConnectionIndicator connectionState={connectionState} showLabel={true} />
                        )}
                      </div>
                    </Card>

                    {/* Enable Audio Button (when audio playback is blocked by browser) */}
                    {isVoiceActive && !canPlaybackAudio && (
                      <Card className="bg-[hsl(var(--warning))]/10 backdrop-blur-xl border-[hsl(var(--warning))]/30 p-4">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-[hsl(var(--warning))]/20">
                              <Mic className="h-5 w-5 text-[hsl(var(--warning))]" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-[hsl(var(--text-high))]">
                                Enable Audio to Hear the Agent
                              </p>
                              <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                                Your browser blocked audio playback. Click below to enable it.
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={async () => {
                              try {
                                await enableAudioPlayback();
                                toast.success("Audio enabled", {
                                  description: "You can now hear the AI agent.",
                                });
                              } catch (err) {
                                toast.error("Failed to enable audio", {
                                  description: "Please try clicking again.",
                                });
                              }
                            }}
                            className="bg-[hsl(var(--warning))] text-[hsl(var(--void))] hover:bg-[hsl(var(--warning))]/90"
                            data-testid="forge-enable-audio"
                          >
                            <Mic className="h-4 w-4 me-2" />
                            Enable Audio
                          </Button>
                        </div>
                      </Card>
                    )}

                    {/* Voice Controls - Active Session (US-004: connecting or connected state) */}
                    {(voiceState === "connected" || voiceState === "connecting") && (
                      <Card className="bg-[hsl(var(--surface))]/70 backdrop-blur-xl border-[hsl(var(--border))]/50 p-4">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                          {/* FRG-11: Language Selector + Transcript Toggle + Export */}
                          <div className="flex items-center gap-2 w-full md:w-auto">
                            {/* FRG-11: Language Selector visible during active call */}
                            <LanguageSelectorCompact
                              value={selectedLanguage}
                              onChange={handleLanguageChange}
                              className="md:hidden"
                            />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setIsTranscriptOpen(v => !v)}
                              className="flex-1 md:flex-none"
                              data-testid="forge-transcript-toggle"
                              aria-pressed={isTranscriptOpen}
                            >
                              <Eye className="h-4 w-4 me-2" />
                              {isTranscriptOpen
                                ? t("agent:forge.voice.actions.hideTranscript")
                                : t("agent:forge.voice.actions.showTranscript")}
                            </Button>

                            {/* FRG-07: Export Transcript Button */}
                            {transcript.length > 0 && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleExportTranscript}
                                className="flex-shrink-0"
                                data-testid="forge-export-transcript"
                                title={t("agent:forge.voice.actions.exportTranscript", {
                                  defaultValue: "Export transcript",
                                })}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                          </div>

                          {/* Voice Controls */}
                          <VoiceControls
                            isMuted={isMuted}
                            isActive={isVoiceActive}
                            isSpeaking={isSpeaking}
                            agentIsSpeaking={agentIsSpeaking}
                            audioLevel={audioLevel}
                            onToggleMute={toggleMute}
                            onStop={async () => {
                              // End voice session but do NOT reset voiceStartAttemptedRef
                              // The ref should stay true to prevent accidental auto-restart
                              // Only the explicit "Start Voice" button should reset it
                              await endVoiceSession().catch(() => undefined);
                              stopVoiceMode(); // Stop polling when voice stops
                            }}
                          />
                        </div>
                      </Card>
                    )}

                    {/* Voice Controls - Session Ended (US-004: ended state shows Continue Voice + Start Fresh) */}
                    {voiceState === "ended" && (
                      <Card className="bg-[hsl(var(--surface))]/70 backdrop-blur-xl border-[hsl(var(--border))]/50 p-4">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-[hsl(var(--text-muted))]">
                            <Mic className="h-4 w-4" />
                            <span className="text-sm">
                              {t("agent:forge.voice.sessionEnded", {
                                defaultValue: "Voice session ended",
                              })}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 w-full md:w-auto">
                            <Button
                              onClick={async () => {
                                voiceStartAttemptedRef.current = false;
                                await attemptStartVoice();
                              }}
                              disabled={isLoading}
                              className="flex-1 md:flex-none bg-[hsl(var(--primary))] text-[hsl(var(--void))]"
                              data-testid="forge-restart-voice"
                            >
                              <Mic className="h-4 w-4 me-2" />
                              {t("agent:forge.voice.actions.continueVoice", {
                                defaultValue: "Continue Voice",
                              })}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={async () => {
                                try {
                                  await clearCheckpoints();
                                  localStorage.removeItem("vora_agent_forge_session_id");
                                  window.location.reload();
                                } catch {
                                  // ignore
                                }
                              }}
                              className="flex-1 md:flex-none"
                              data-testid="forge-start-fresh"
                            >
                              {t("agent:forge.voice.actions.startFresh", {
                                defaultValue: "Start Fresh",
                              })}
                            </Button>
                            {/* Create Agent button removed - use header CTA instead */}
                          </div>
                        </div>
                      </Card>
                    )}

                    {/* Voice Completion CTA - text only, directs to header CTA */}
                    {mode === "voice" && shouldComplete && !isComplete && !dismissedReadyCard && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-3"
                      >
                        <Card className="bg-[hsl(var(--success))]/10 backdrop-blur-xl border-[hsl(var(--success))]/30 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <CheckCircle2 className="h-6 w-6 text-[hsl(var(--success))] flex-shrink-0" />
                              <div>
                                <p className="font-medium text-[hsl(var(--text-high))]">
                                  {t("agent:forge.voice.readyToCreate", {
                                    defaultValue: "Ready to create your agent!",
                                  })}
                                </p>
                                <p className="text-sm text-[hsl(var(--text-muted))]">
                                  {t("agent:forge.voice.readyToCreateCTA", {
                                    defaultValue:
                                      "Use the Create Agent button above when you're ready.",
                                  })}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDismissedReadyCard(true)}
                              data-testid="forge-voice-keep-talking"
                            >
                              {t("agent:forge.voice.dismiss", { defaultValue: "Dismiss" })}
                            </Button>
                          </div>
                        </Card>
                      </motion.div>
                    )}
                  </div>
                )}

                {/* Chat Container */}
                <Card className="flex-1 flex flex-col bg-[hsl(var(--surface))]/70 backdrop-blur-xl border-[hsl(var(--border))]/50 overflow-hidden min-h-0">
                  {/* Messages */}
                  <CardContent className="flex-1 overflow-y-auto p-3 md:p-6 space-y-3 md:space-y-4 scroll-smooth overscroll-contain">
                    {mode === "voice" && !isTranscriptOpen && (
                      <div className="h-full flex items-center justify-center px-4">
                        {/* US-004: Voice visualization based on voiceState */}
                        {voiceState === "connecting" ? (
                          <div className="flex flex-col items-center justify-center gap-6 w-full max-w-md">
                            {/* GlowingOrb with connecting state */}
                            <div className="w-48 h-48 md:w-64 md:h-64">
                              <GlowingOrb
                                isSpeaking={false}
                                agentIsSpeaking={false}
                                audioLevel={0}
                                isConnecting={true}
                                onClick={() => setIsTranscriptOpen(true)}
                              />
                            </div>
                            {/* Connection Progress Indicator */}
                            <VoiceConnectionProgress
                              currentStage={connectionStage}
                              isConnecting={true}
                              elapsedSeconds={elapsedSeconds}
                              errorMessage={voiceStartupError || undefined}
                            />
                          </div>
                        ) : voiceState === "connected" ? (
                          <div className="w-64 h-64 md:w-80 md:h-80">
                            <GlowingOrb
                              isSpeaking={isSpeaking}
                              agentIsSpeaking={agentIsSpeaking}
                              audioLevel={audioLevel}
                              isConnecting={false}
                              onClick={() => setIsTranscriptOpen(true)}
                              // US-005: Show hint if not dismissed and transcript is closed
                              showHint={!transcriptHintShown && !isTranscriptOpen}
                              hintText={t("agent:forge.voice.transcriptHint", {
                                defaultValue: "Tap to view transcript",
                              })}
                              onHintDismiss={handleDismissTranscriptHint}
                              // US-006: Pulsing indicator for unread transcript content
                              hasUnreadContent={hasUnreadTranscript}
                            />
                          </div>
                        ) : (
                          /* US-004: idle/ended/error states show Start Voice prompt */
                          <div className="text-center space-y-3 max-w-md">
                            <div className="inline-flex p-3 rounded-full bg-[hsl(var(--primary))]/10">
                              <Mic className="h-6 w-6 text-[hsl(var(--primary))]" />
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-[hsl(var(--text-high))]">
                                {t("agent:forge.voiceFirst.title")}
                              </p>
                              <p className="text-xs text-[hsl(var(--text-muted))]">
                                {t("agent:forge.voiceFirst.description")}
                              </p>
                            </div>

                            <Button
                              onClick={async () => {
                                voiceStartAttemptedRef.current = false;
                                await attemptStartVoice();
                              }}
                              disabled={isLoading}
                              className="bg-[hsl(var(--primary))] text-[hsl(var(--void))]"
                              data-testid="forge-start-voice"
                              data-tutorial-target="test-agent"
                            >
                              <Mic className="h-4 w-4 me-2" />
                              {t("agent:forge.voiceFirst.startVoice")}
                            </Button>

                            {voiceStartupError && (
                              <div className="rounded-xl border border-[hsl(var(--error))]/30 bg-[hsl(var(--error))]/10 p-3 text-start">
                                <p className="text-xs text-[hsl(var(--text-high))] font-medium">
                                  {t("common:status.error")}
                                </p>
                                <p className="text-xs text-[hsl(var(--text-muted))] mt-1">
                                  {voiceStartupError}
                                </p>
                                <div className="flex flex-wrap gap-2 mt-3">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={async () => {
                                      voiceStartAttemptedRef.current = false;
                                      await attemptStartVoice();
                                    }}
                                  >
                                    <Mic className="h-3.5 w-3.5 me-2" />
                                    {t("common:actions.tryAgain")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={async () => {
                                      setVoiceStartupError(null);
                                      setMode("chat");
                                      if (isVoiceActive) {
                                        await endVoiceSession().catch(() => undefined);
                                        stopVoiceMode(); // Stop polling when switching to chat
                                        voiceStartAttemptedRef.current = false;
                                      }
                                      setTimeout(() => inputRef.current?.focus(), 50);
                                    }}
                                    data-testid="forge-switch-to-chat-error"
                                  >
                                    <MessagesSquare className="h-3.5 w-3.5 me-2" />
                                    {t("agent:forge.voiceFirst.switchToChat")}
                                  </Button>
                                </div>
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              onClick={async () => {
                                setVoiceStartupError(null);
                                setMode("chat");
                                if (isVoiceActive) {
                                  await endVoiceSession().catch(() => undefined);
                                  stopVoiceMode(); // Stop polling when switching to chat
                                  voiceStartAttemptedRef.current = false;
                                }
                                setTimeout(() => inputRef.current?.focus(), 50);
                              }}
                              className="h-10 px-3"
                              data-testid="forge-switch-to-chat"
                              data-tutorial-target="switch-to-chat"
                            >
                              <MessagesSquare className="h-4 w-4 me-2" />
                              {t("agent:forge.voiceFirst.switchToChat")}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    <AnimatePresence mode="popLayout">
                      {visibleMessages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          className={cn(
                            "flex gap-2 md:gap-3",
                            message.role === "user" ? "justify-end" : "justify-start"
                          )}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3, delay: index * 0.05 }}
                        >
                          {message.role === "assistant" && (
                            <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center flex-shrink-0">
                              <Bot className="h-3.5 w-3.5 md:h-4 md:w-4 text-[hsl(var(--primary))]" />
                            </div>
                          )}

                          <motion.div
                            className={cn(
                              "max-w-[85%] md:max-w-[80%] rounded-2xl px-3.5 py-2.5 md:px-4 md:py-3 min-h-[44px] flex items-center",
                              message.role === "assistant"
                                ? "bg-[hsl(var(--surface))] border border-[hsl(var(--border))]"
                                : "bg-[hsl(var(--primary))] text-[hsl(var(--void))]"
                            )}
                            whileHover={{ scale: 1.02 }}
                            transition={{ duration: 0.2 }}
                            style={{ WebkitTapHighlightColor: "transparent" }}
                          >
                            <p className="text-sm md:text-base leading-relaxed">
                              {message.content}
                            </p>
                          </motion.div>

                          {message.role === "user" && (
                            <div className="h-7 w-7 md:h-8 md:w-8 rounded-full bg-[hsl(var(--secondary))]/10 flex items-center justify-center flex-shrink-0">
                              <User className="h-3.5 w-3.5 md:h-4 md:w-4 text-[hsl(var(--secondary))]" />
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    {/* Typing Indicator */}
                    {mode === "chat" && isLoading && (
                      <motion.div
                        className="flex gap-3 justify-start"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-4 w-4 text-[hsl(var(--primary))]" />
                        </div>
                        <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-2xl px-4 py-3">
                          <div className="flex gap-1">
                            <motion.span
                              className="h-2 w-2 rounded-full bg-[hsl(var(--text-muted))]"
                              animate={{ y: [0, -8, 0] }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                repeatDelay: 0,
                              }}
                            />
                            <motion.span
                              className="h-2 w-2 rounded-full bg-[hsl(var(--text-muted))]"
                              animate={{ y: [0, -8, 0] }}
                              transition={{
                                duration: 0.6,
                                repeat: Infinity,
                                delay: 0.2,
                              }}
                            />
                            <motion.span
                              className="h-2 w-2 rounded-full bg-[hsl(var(--text-muted))]"
                              animate={{ y: [0, -8, 0] }}
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

                    {/* Completion Message */}
                    {isComplete && (
                      <motion.div
                        className="flex justify-center py-6 md:py-8 px-3"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                      >
                        <div className="text-center space-y-4">
                          <div className="inline-flex p-3 md:p-4 rounded-full bg-[hsl(var(--success))]/10">
                            <CheckCircle2 className="h-10 w-10 md:h-12 md:w-12 text-[hsl(var(--success))]" />
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-lg md:text-xl font-semibold text-[hsl(var(--text-high))]">
                              {t("agent:forge.complete.title")}
                            </h3>
                            <p className="text-sm text-[hsl(var(--text-muted))] max-w-md px-2">
                              <span className="hidden lg:inline">
                                {t("agent:forge.complete.descriptionDesktop")}
                              </span>
                              <span className="lg:hidden">
                                {t("agent:forge.complete.descriptionMobile")}
                              </span>
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3 items-center justify-center">
                            <Button
                              onClick={() => setIsMobilePreviewOpen(true)}
                              variant="outline"
                              className="lg:hidden w-full sm:w-auto h-11 border-[hsl(var(--border))] hover:bg-[hsl(var(--surface))]"
                            >
                              <Eye className="h-4 w-4 me-2" />
                              {t("agent:forge.complete.showPreview")}
                            </Button>
                            <Button
                              onClick={handleCreateAgent}
                              className="bg-[hsl(var(--primary))] text-[hsl(var(--void))] hover:bg-[hsl(var(--primary))]/90 hover:shadow-[0_0_20px_rgba(153,205,255,0.3)] w-full sm:w-auto h-11"
                              size="lg"
                              disabled={isCreating}
                            >
                              {isCreating ? (
                                <Loader2 className="h-4 w-4 me-2 animate-spin" />
                              ) : (
                                <Sparkles className="h-4 w-4 me-2" />
                              )}
                              {t("agent:forge.complete.createAgent")}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div ref={messagesEndRef} />
                  </CardContent>

                  {/* Message Limit Nudge */}
                  {mode === "chat" && !isComplete && isApproachingLimit && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="border-t border-[hsl(var(--warning))]/30 bg-[hsl(var(--warning))]/5 px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-[hsl(var(--warning))]" />
                        <p className="text-sm text-[hsl(var(--text-high))]">
                          {t("agent:forge.chat.messageLimitNudge", {
                            remaining: 10 - userMessageCount,
                            defaultValue: `${10 - userMessageCount} messages left. Use the Create Agent button above when ready.`,
                          })}
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Auto-Create Prompt (hit limit + complete) - text only, CTA is in header */}
                  {mode === "chat" && shouldAutoCreate && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="border-t border-[hsl(var(--success))]/30 bg-[hsl(var(--success))]/5 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-6 w-6 text-[hsl(var(--success))] flex-shrink-0" />
                        <div>
                          <p className="font-medium text-[hsl(var(--text-high))]">
                            {t("agent:forge.chat.readyToCreate", {
                              defaultValue: "Your agent is ready!",
                            })}
                          </p>
                          <p className="text-sm text-[hsl(var(--text-muted))]">
                            {t("agent:forge.chat.readyToCreateCTA", {
                              defaultValue:
                                "Use the Create Agent button above to build your AI voice agent.",
                            })}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Input Area - Sticky on mobile for keyboard (chat only) */}
                  {mode === "chat" && !isComplete && !shouldAutoCreate && (
                    <div className="sticky bottom-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface))]/95 backdrop-blur-md">
                      <div className="p-3 md:p-4">
                        <div className="flex flex-col md:flex-row gap-2">
                          <Input
                            ref={inputRef}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            placeholder={t("agent:forge.chat.placeholder")}
                            className="bg-[hsl(var(--surface))] border-[hsl(var(--border))] focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/20 h-11 md:h-10 text-base md:text-sm"
                            disabled={isLoading}
                            autoComplete="off"
                            autoCorrect="off"
                            autoCapitalize="sentences"
                          />

                          {/* Send button only - Create Agent moved to header CTA */}
                          <Button
                            onClick={handleSendMessage}
                            disabled={!inputValue.trim() || isLoading}
                            className="bg-[hsl(var(--primary))] text-[hsl(var(--void))] hover:bg-[hsl(var(--primary))]/90 hover:shadow-[0_0_20px_rgba(153,205,255,0.3)] flex-shrink-0 h-11 w-11 md:h-10 md:w-10"
                          >
                            <Send className="h-4 w-4 md:h-5 md:w-5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              {/* Right Column - Agent Preview */}
              <div className="hidden lg:block">
                <div className="sticky top-6">
                  <AgentPreviewCard preview={agentPreview} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Preview Modal */}
        <Suspense fallback={null}>
          <MobilePreviewModal
            isOpen={isMobilePreviewOpen}
            onClose={() => setIsMobilePreviewOpen(false)}
            preview={agentPreview}
          />
        </Suspense>

        {/* Resume Session Modal - forces explicit choice before proceeding */}
        <ResumeSessionModal
          open={showResumeModal}
          checkpoint={checkpoint}
          onResume={async () => {
            setShowResumeModal(false);
            try {
              // CRITICAL: Mark BOTH refs as started BEFORE setMode to prevent useEffect
              // from also triggering voice start (which would cause duplicate agents)
              hasAutoStartedVoiceRef.current = true;
              voiceStartAttemptedRef.current = true;
              setMode("voice");
              // Start voice with resume flag
              const resp = await startVoice({
                sessionId: checkpoint!.sessionId,
                isResuming: true,
              });
              await startVoiceSession({
                sessionId: resp.sessionId,
                roomName: resp.roomName,
                participantToken: resp.participantToken,
                wsUrl: resp.wsUrl,
              });
            } catch (err) {
              const message = err instanceof Error ? err.message : t("common:status.error");
              setVoiceStartupError(message);
            }
          }}
          onStartFresh={async () => {
            setShowResumeModal(false);
            try {
              await clearCheckpoints();
              // Reset and start fresh
              localStorage.removeItem("vora_agent_forge_session_id");
              window.location.reload();
            } catch (err) {
              toast.error(t("common:status.error"), {
                description: err instanceof Error ? err.message : "Failed to start fresh",
              });
            }
          }}
          isLoading={isLoadingCheckpoint || isVoiceConnecting}
        />

        <UpgradeModal
          open={showPaywall}
          onClose={() => setShowPaywall(false)}
          source="button"
          reason={paywallReason}
        />

        {/* Knowledge Base Upload Modal - pauses agent while uploading.
             Uses Radix primitives directly (not the DialogContent wrapper) so that
             BOTH overlay and content render at z-[60], reliably above AgentCreationOverlay
             (z-50) and other Radix overlays. The default DialogContent wrapper renders
             its own DialogOverlay at z-50, which could be occluded by peer z-50 elements,
             causing intermittent click-through and focus-stealing failures. */}
        <Dialog
          open={showKbUploadModal}
          onOpenChange={open => {
            setShowKbUploadModal(open);
            // Unmute microphone when modal closes to resume conversation
            if (!open && isMuted && toggleMute) {
              toggleMute();
            }
          }}
        >
          <DialogPrimitive.Portal>
            <DialogPrimitive.Overlay
              className="fixed inset-0 z-[60] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
            />
            <DialogPrimitive.Content
              className="fixed left-[50%] top-[50%] z-[60] grid w-full max-w-xl translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg duration-200 sm:rounded-lg bg-[hsl(var(--void))] border-[hsl(var(--border))] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
              onOpenAutoFocus={e => {
                // Prevent Radix from moving focus to the close button on open;
                // this avoids focus-fight with file inputs and drag-drop zones
                e.preventDefault();
              }}
              onPointerDownOutside={e => {
                // Block accidental closure while upload is in progress
                if (uploadState.isUploading) {
                  e.preventDefault();
                }
              }}
            >
              <DialogPrimitive.Close
                className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
              <DialogHeader>
                <DialogTitle className="text-[hsl(var(--text-high))]">
                  {t("agent:forge.kbUpload.title", { defaultValue: "Upload to Knowledge Base" })}
                </DialogTitle>
                <DialogDescription className="text-[hsl(var(--text-muted))]">
                  {kbGatekeeper?.message ||
                    t("agent:forge.kbUpload.description", {
                      defaultValue:
                        "Upload documents to help your agent understand your business better. The conversation is paused while you upload.",
                    })}
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <DocumentUploader
                  onUpload={async files => {
                    try {
                      const result = await uploadDocuments(files);
                      const uploadedCount = result?.succeeded ?? files.length;
                      toast.success(
                        t("common:messages.uploadSuccess", {
                          defaultValue: "Files uploaded successfully",
                        })
                      );

                      // Notify backend that KB upload is complete - clears kbGatekeeper
                      // This allows the voice agent to know documents are now available
                      if (sessionId) {
                        try {
                          await agentForgeService.acknowledgeKbUpload(sessionId, uploadedCount);
                          // Close modal and unmute to resume conversation
                          setShowKbUploadModal(false);
                          if (isMuted && toggleMute) {
                            toggleMute();
                          }
                        } catch (ackErr) {
                          // Non-fatal: upload succeeded, just couldn't notify agent
                          console.warn("[InterviewBot] Failed to acknowledge KB upload:", ackErr);
                        }
                      }
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Upload failed");
                    }
                  }}
                  onAddUrl={async (url, crawl) => {
                    try {
                      await addUrlAsync({ url, crawl: crawl ?? false });
                      toast.success(
                        t("common:messages.urlAdded", { defaultValue: "URL added successfully" })
                      );

                      // Notify backend that KB content was added - clears kbGatekeeper
                      if (sessionId) {
                        try {
                          await agentForgeService.acknowledgeKbUpload(sessionId, 1);
                          // Close modal and unmute to resume conversation
                          setShowKbUploadModal(false);
                          if (isMuted && toggleMute) {
                            toggleMute();
                          }
                        } catch (ackErr) {
                          console.warn("[InterviewBot] Failed to acknowledge KB upload:", ackErr);
                        }
                      }
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Failed to add URL");
                    }
                  }}
                  isUploading={uploadState.isUploading}
                  uploadProgress={uploadState.progress}
                  currentFile={uploadState.currentFile}
                  disabled={!effectiveKbId}
                />
              </div>
              <div className="flex justify-end pt-2">
                <Button
                  onClick={() => {
                    setShowKbUploadModal(false);
                    // Unmute to resume conversation
                    if (isMuted && toggleMute) {
                      toggleMute();
                    }
                  }}
                  className="bg-[hsl(var(--primary))] text-[hsl(var(--void))] hover:bg-[hsl(var(--primary))]/90"
                >
                  {t("agent:forge.kbUpload.continue", { defaultValue: "Continue Conversation" })}
                </Button>
              </div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        </Dialog>

        {/* Phase 4: Creation Recovery UI - shows when voice command times out */}
        {mode === "voice" && showCreationRecoveryUI && !createdAgentId && !isCreating && (
          <CreationRecoveryUI
            onRetry={() => {
              clearCreationIntent();
              handleCreateAgent();
            }}
            onDismiss={clearCreationIntent}
          />
        )}

        {/* Forging overlay — shown during agent compilation */}
        <AgentCreationOverlay
          isVisible={showForgeOverlay}
          isComplete={forgeComplete}
          onComplete={handleOverlayComplete}
        />
      </div>
    </InterviewErrorBoundary>
  );
}
