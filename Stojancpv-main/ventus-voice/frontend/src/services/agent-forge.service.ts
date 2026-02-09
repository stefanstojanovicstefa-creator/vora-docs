/**
 * Agent Forge Service
 * Frontend API client for the freeform agent creation flow.
 */

import { apiClient } from '@/lib/api-client';

export type ForgeMessageDto = {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
};

export type ForgeBlueprintDto = {
  industry?: string;
  agent_name?: string;
  role?: string;
  main_goal?: string;
  primary_tasks?: string[];
  personality_vibe?: string;
  opening_message?: string;
  handoff_destinations?: string;
  handoff_rules?: string;
  knowledge_base_plan?: string[];
  notes?: string;
  language?: string;
};

export type SuggestedUpload = 'Pricing' | 'Menu' | 'FAQ' | 'WorkingHours' | 'Policies' | 'Other';

export type KbGatekeeperData = {
  knowledgeBaseId: string;
  suggestedUploads: SuggestedUpload[];
  message: string;
  createdAt: string;
};

export type ForgeEventDto =
  | {
      type: 'KB_GATEKEEPER';
      knowledgeBaseId: string;
      suggestedUploads: SuggestedUpload[];
      message: string;
    }
  | {
      type: 'WRAP_UP_SUGGESTED';
      message: string;
    };

export type StartForgeResponse = {
  sessionId: string;
  agentId: string;
  knowledgeBaseId: string;
  assistantMessage: string;
};

export type StartForgeVoiceResponse = {
  sessionId: string;
  agentId: string;
  knowledgeBaseId: string;
  roomName: string;
  participantToken: string;
  wsUrl: string;
};

export type GetForgeSessionResponse = {
  sessionId: string;
  agentId: string;
  knowledgeBaseId: string;
  messages: ForgeMessageDto[];
  blueprint: ForgeBlueprintDto;
  isComplete: boolean;
  /** True when voice agent has gathered enough info - show create agent CTA */
  shouldComplete?: boolean;
  /** Knowledge Base gatekeeper prompt (when heavy data detected in voice) */
  kbGatekeeper?: KbGatekeeperData;
};

export type SendForgeMessageResponse = {
  assistantMessage: string;
  messages: ForgeMessageDto[];
  blueprint: ForgeBlueprintDto;
  events: ForgeEventDto[];
  isComplete: boolean;
};

export type CompleteForgeResponse = {
  success: boolean;
  agentId: string;
  agentConfig: unknown;
};

/** US-008: Voice provider configuration */
export type VoiceProviderInfo = {
  provider: string;
  model: string;
  reason: string;
};

export type VoiceProvidersResponse = {
  stt: VoiceProviderInfo;
  llm: VoiceProviderInfo;
  tts: VoiceProviderInfo;
};

export type IncompleteForgeSessionResponse = {
  hasIncompleteSession: boolean;
  session: null | {
    sessionId: string;
    currentQuestionIndex: number;
    totalQuestions: number;
    progress: number;
    createdAt: string;
    firstIncompleteStage?: string;
  };
};

export type ForgeConfigResponse = {
  forge: {
    configured: boolean;
    model: 'set' | 'missing';
  };
  voice: {
    configured: boolean;
    livekitWsUrl: 'set' | 'missing';
  };
};

export type ForgeCheckpointDto = {
  sessionId: string;
  agentId: string;
  knowledgeBaseId: string;
  progressPercent: number;
  lastActivity: string;
  blueprint: ForgeBlueprintDto;
  contextSummary?: string;
};

export type ResumeContextDto = {
  contextSummary: string;
  lastCheckpoint: ForgeCheckpointDto;
};

export const agentForgeService = {
  getConfig: async (): Promise<ForgeConfigResponse> => {
    return apiClient.get<ForgeConfigResponse>('/api/agent-forge/config');
  },

  start: async (params?: { language?: string; idempotencyKey?: string }): Promise<StartForgeResponse> => {
    return apiClient.post<StartForgeResponse>('/api/agent-forge/start', params ?? {});
  },

  startVoice: async (params?: { language?: string; sessionId?: string; isResuming?: boolean; idempotencyKey?: string }): Promise<StartForgeVoiceResponse> => {
    // Extended timeout: Room creation + agent dispatch + checkpoint fetch can take 30-60s
    return apiClient.post<StartForgeVoiceResponse>('/api/agent-forge/voice/start', params ?? {}, { timeout: 120000 });
  },

  storeVoiceTranscript: async (params: {
    sessionId: string;
    speaker: 'user' | 'assistant';
    transcript: string;
    isFinal: boolean;
    language?: string;
    timestamp?: string;
  }): Promise<{ ok: true }> => {
    return apiClient.post<{ ok: true }>('/api/agent-forge/voice/transcript', params);
  },

  getSession: async (sessionId: string): Promise<GetForgeSessionResponse> => {
    return apiClient.get<GetForgeSessionResponse>(`/api/agent-forge/${sessionId}`);
  },

  sendMessage: async (params: { sessionId: string; message: string }): Promise<SendForgeMessageResponse> => {
    return apiClient.post<SendForgeMessageResponse>('/api/agent-forge/message', params);
  },

  complete: async (sessionId: string): Promise<CompleteForgeResponse> => {
    return apiClient.post<CompleteForgeResponse>('/api/agent-forge/complete', { sessionId });
  },

  getIncompleteSession: async (): Promise<IncompleteForgeSessionResponse> => {
    // Use shorter timeout (5s) since this is non-critical UI enhancement
    // Returns default "no session" response on any failure
    return apiClient.get<IncompleteForgeSessionResponse>('/api/agent-forge/incomplete', {
      timeout: 5000,
    });
  },

  getLatestCheckpoint: async (sessionId: string): Promise<ForgeCheckpointDto | null> => {
    try {
      return apiClient.get<ForgeCheckpointDto>(`/api/agent-forge/${sessionId}/latest-checkpoint`);
    } catch {
      return null;
    }
  },

  getResumeContext: async (sessionId: string): Promise<ResumeContextDto> => {
    return apiClient.get<ResumeContextDto>(`/api/agent-forge/${sessionId}/resume-context`);
  },

  clearCheckpoints: async (sessionId: string): Promise<{ ok: true }> => {
    return apiClient.post<{ ok: true }>(`/api/agent-forge/${sessionId}/clear-checkpoints`, {});
  },

  createCheckpoint: async (sessionId: string, data: { progressPercent: number; contextSummary?: string }): Promise<{ ok: true }> => {
    return apiClient.post<{ ok: true }>(`/api/agent-forge/${sessionId}/checkpoint`, data);
  },

  /**
   * FRG-11: Change language during active voice session
   * Updates agent configuration for STT/TTS language settings
   */
  changeLanguage: async (params: { sessionId: string; language: string; roomName: string }): Promise<{ ok: true; message?: string }> => {
    return apiClient.post<{ ok: true; message?: string }>('/api/agent-forge/voice/change-language', params);
  },

  /**
   * Acknowledge that KB documents were uploaded during the Forge voice session.
   * This clears kbGatekeeper state so the UI dismisses the upload prompt
   * and the voice agent knows documents are now available.
   */
  acknowledgeKbUpload: async (sessionId: string, documentCount?: number): Promise<{ ok: true; message: string }> => {
    return apiClient.post<{ ok: true; message: string }>(`/api/agent-forge/${sessionId}/kb-upload-complete`, {
      documentCount,
    });
  },

  /**
   * US-008: Get voice provider configuration based on language
   * Returns the STT/LLM/TTS stack being used for the session.
   */
  getVoiceProviders: async (language?: string): Promise<VoiceProvidersResponse> => {
    const params = language ? `?language=${encodeURIComponent(language)}` : '';
    return apiClient.get<VoiceProvidersResponse>(`/api/agent-forge/voice/providers${params}`);
  },
};
