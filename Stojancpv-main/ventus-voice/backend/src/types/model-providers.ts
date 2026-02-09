/**
 * Model Provider System
 * Flexible architecture for pluggable AI model providers
 *
 * LiveKit Compatible: https://docs.livekit.io/agents/models/
 */

// ========================================
// Custom 3rd Party Provider Config
// ========================================
export interface CustomProviderConfig {
  // Custom provider implementation details
  providerName: string; // e.g., "My Custom STT Provider"
  baseUrl?: string; // API endpoint
  authToken?: string; // Authentication
  modelId?: string; // Model identifier
  additionalParams?: Record<string, any>; // Any extra config
}

// ========================================
// STT (Speech-to-Text) Providers
// ========================================
export type STTProvider =
  | 'deepgram'
  | 'assemblyai'
  | 'whisper'
  | 'google-stt'
  | 'azure-stt'
  | 'custom'; // 3rd party custom STT

export interface STTConfig {
  provider: STTProvider;
  model?: string; // Provider-specific model name
  language?: string;
  enablePunctuation?: boolean;
  enableDiarization?: boolean; // Speaker detection
  apiKey?: string; // If different from default
  // For custom providers
  customConfig?: CustomProviderConfig;
}

// ========================================
// TTS (Text-to-Speech) Providers
// ========================================
export type TTSProvider =
  | 'elevenlabs'
  | 'playht'
  | 'google-tts'
  | 'azure-tts'
  | 'cartesia'
  | 'openai-tts'
  | 'amazon-polly'
  | 'custom'; // 3rd party custom TTS

export interface TTSConfig {
  provider: TTSProvider;
  voice?: string; // Provider-specific voice ID
  model?: string; // e.g., elevenlabs-v2, tts-1-hd
  speed?: number; // 0.5 - 2.0
  pitch?: number; // Provider-specific
  apiKey?: string;
  // For custom providers
  customConfig?: CustomProviderConfig;
}

// ========================================
// LLM (Language Model) Providers
// ========================================
export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'azure-openai'
  | 'groq'
  | 'together'
  | 'ollama'
  | 'perplexity'
  | 'cerebras'
  | 'custom'; // 3rd party custom LLM

export interface LLMConfig {
  provider: LLMProvider;
  model: string; // e.g., gpt-4o, claude-3-opus, gemini-2.5-flash
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  apiKey?: string;
  // For custom providers
  customConfig?: CustomProviderConfig;
}

// ========================================
// Realtime Multimodal Providers
// ========================================
export type RealtimeProvider =
  | 'openai-realtime'
  | 'google-realtime'
  | 'azure-realtime';

export interface RealtimeConfig {
  provider: RealtimeProvider;
  model: string; // e.g., gpt-4o-realtime, gemini-2.5-flash-native-audio
  voice?: string;
  temperature?: number;
  enableVAD?: boolean; // Voice Activity Detection
  turnDetection?: 'server' | 'client';
  apiKey?: string;
}

// ========================================
// Complete Agent Model Configuration
// ========================================
export interface AgentModelConfig {
  // Choose between separate components or realtime mode
  mode: 'realtime' | 'component-based';

  // Component-based mode (STT + LLM + TTS separately)
  stt?: STTConfig;
  tts?: TTSConfig;
  llm?: LLMConfig;

  // Realtime mode (single multimodal model)
  realtime?: RealtimeConfig;
}

// ========================================
// Provider Capabilities
// ========================================
export interface ProviderCapabilities {
  streaming: boolean;
  languages: string[];
  maxInputLength?: number;
  supportsCustomVoices: boolean;
  latency: 'low' | 'medium' | 'high';
  cost: 'low' | 'medium' | 'high';
}

// ========================================
// Provider Metadata (for UI selection)
// ========================================
export interface ProviderMetadata {
  id: string;
  name: string;
  type: 'stt' | 'tts' | 'llm' | 'realtime';
  description: string;
  capabilities: ProviderCapabilities;
  models: Array<{
    id: string;
    name: string;
    description?: string;
  }>;
  requiresApiKey: boolean;
  defaultApiKeyEnvVar?: string; // e.g., DEEPGRAM_API_KEY
}

// ========================================
// Provider Registry
// ========================================
export const STT_PROVIDERS: Record<STTProvider, ProviderMetadata> = {
  'deepgram': {
    id: 'deepgram',
    name: 'Deepgram',
    type: 'stt',
    description: 'Industry-leading speech recognition with low latency',
    capabilities: {
      streaming: true,
      languages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'medium',
    },
    models: [
      { id: 'nova-2', name: 'Nova 2', description: 'Latest general-purpose model' },
      { id: 'enhanced', name: 'Enhanced', description: 'Highest accuracy' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'DEEPGRAM_API_KEY',
  },
  'assemblyai': {
    id: 'assemblyai',
    name: 'AssemblyAI',
    type: 'stt',
    description: 'Advanced transcription with speaker diarization',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'medium',
    },
    models: [
      { id: 'best', name: 'Best', description: 'Highest accuracy' },
      { id: 'nano', name: 'Nano', description: 'Fastest, lower cost' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'ASSEMBLYAI_API_KEY',
  },
  'whisper': {
    id: 'whisper',
    name: 'OpenAI Whisper',
    type: 'stt',
    description: 'Open-source multilingual speech recognition',
    capabilities: {
      streaming: false,
      languages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko', 'ru', 'ar'],
      supportsCustomVoices: false,
      latency: 'medium',
      cost: 'low',
    },
    models: [
      { id: 'whisper-1', name: 'Whisper v1', description: 'OpenAI hosted model' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'OPENAI_API_KEY',
  },
  'google-stt': {
    id: 'google-stt',
    name: 'Google Cloud Speech-to-Text',
    type: 'stt',
    description: 'Google\'s speech recognition service',
    capabilities: {
      streaming: true,
      languages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'medium',
    },
    models: [
      { id: 'chirp', name: 'Chirp', description: 'Latest model' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'GOOGLE_CLOUD_API_KEY',
  },
  'azure-stt': {
    id: 'azure-stt',
    name: 'Azure Speech Services',
    type: 'stt',
    description: 'Microsoft Azure speech recognition',
    capabilities: {
      streaming: true,
      languages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'medium',
    },
    models: [
      { id: 'unified', name: 'Unified', description: 'Latest model' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'AZURE_SPEECH_KEY',
  },
  'custom': {
    id: 'custom',
    name: 'Custom STT Provider',
    type: 'stt',
    description: 'Bring your own speech-to-text provider',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: true,
      latency: 'medium',
      cost: 'low',
    },
    models: [
      { id: 'custom-model', name: 'Custom Model', description: 'Your custom STT implementation' },
    ],
    requiresApiKey: false,
    defaultApiKeyEnvVar: undefined,
  },
};

export const TTS_PROVIDERS: Record<TTSProvider, ProviderMetadata> = {
  'elevenlabs': {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    type: 'tts',
    description: 'Ultra-realistic voice synthesis',
    capabilities: {
      streaming: true,
      languages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko'],
      supportsCustomVoices: true,
      latency: 'low',
      cost: 'high',
    },
    models: [
      { id: 'eleven_turbo_v2_5', name: 'Turbo v2.5', description: 'Fastest, lowest latency' },
      { id: 'eleven_multilingual_v2', name: 'Multilingual v2', description: 'Best quality' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'ELEVENLABS_API_KEY',
  },
  'playht': {
    id: 'playht',
    name: 'Play.ht',
    type: 'tts',
    description: 'High-quality text-to-speech',
    capabilities: {
      streaming: true,
      languages: ['en', 'es', 'fr', 'de', 'pt'],
      supportsCustomVoices: true,
      latency: 'medium',
      cost: 'medium',
    },
    models: [
      { id: 'play3.0-mini', name: 'Play 3.0 Mini', description: 'Fast and efficient' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'PLAYHT_API_KEY',
  },
  'google-tts': {
    id: 'google-tts',
    name: 'Google Cloud Text-to-Speech',
    type: 'tts',
    description: 'Google\'s voice synthesis service',
    capabilities: {
      streaming: true,
      languages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'low',
    },
    models: [
      { id: 'neural2', name: 'Neural2', description: 'Latest neural voices' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'GOOGLE_CLOUD_API_KEY',
  },
  'azure-tts': {
    id: 'azure-tts',
    name: 'Azure Text-to-Speech',
    type: 'tts',
    description: 'Microsoft Azure voice synthesis',
    capabilities: {
      streaming: true,
      languages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'medium',
    },
    models: [
      { id: 'neural', name: 'Neural', description: 'Latest neural voices' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'AZURE_SPEECH_KEY',
  },
  'cartesia': {
    id: 'cartesia',
    name: 'Cartesia',
    type: 'tts',
    description: 'Ultra-low latency voice synthesis',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'medium',
    },
    models: [
      { id: 'sonic', name: 'Sonic', description: 'Ultra-fast streaming' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'CARTESIA_API_KEY',
  },
  'openai-tts': {
    id: 'openai-tts',
    name: 'OpenAI TTS',
    type: 'tts',
    description: 'OpenAI text-to-speech',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'medium',
      cost: 'low',
    },
    models: [
      { id: 'tts-1-hd', name: 'TTS-1 HD', description: 'High quality' },
      { id: 'tts-1', name: 'TTS-1', description: 'Standard quality' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'OPENAI_API_KEY',
  },
  'amazon-polly': {
    id: 'amazon-polly',
    name: 'Amazon Polly',
    type: 'tts',
    description: 'AWS text-to-speech service',
    capabilities: {
      streaming: true,
      languages: ['en', 'es', 'fr', 'de', 'pt', 'zh', 'ja', 'ko'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'low',
    },
    models: [
      { id: 'neural', name: 'Neural', description: 'Natural sounding voices' },
      { id: 'standard', name: 'Standard', description: 'Standard quality' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'AWS_ACCESS_KEY_ID',
  },
  'custom': {
    id: 'custom',
    name: 'Custom TTS Provider',
    type: 'tts',
    description: 'Bring your own text-to-speech provider',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: true,
      latency: 'medium',
      cost: 'low',
    },
    models: [
      { id: 'custom-model', name: 'Custom Model', description: 'Your custom TTS implementation' },
    ],
    requiresApiKey: false,
    defaultApiKeyEnvVar: undefined,
  },
};

export const REALTIME_PROVIDERS: Record<RealtimeProvider, ProviderMetadata> = {
  'google-realtime': {
    id: 'google-realtime',
    name: 'Google Gemini Realtime',
    type: 'realtime',
    description: 'Gemini with native audio input/output',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: true,
      latency: 'low',
      cost: 'medium',
    },
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and efficient' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Coming soon' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'GOOGLE_GEMINI_API_KEY',
  },
  'openai-realtime': {
    id: 'openai-realtime',
    name: 'OpenAI Realtime API',
    type: 'realtime',
    description: 'GPT-4o with native audio',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'high',
    },
    models: [
      { id: 'gpt-4o-realtime', name: 'GPT-4o Realtime', description: 'Latest multimodal model' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'OPENAI_API_KEY',
  },
  'azure-realtime': {
    id: 'azure-realtime',
    name: 'Azure OpenAI Realtime',
    type: 'realtime',
    description: 'Azure-hosted OpenAI Realtime API',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'high',
    },
    models: [
      { id: 'gpt-4o-realtime', name: 'GPT-4o Realtime', description: 'Azure-hosted' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'AZURE_OPENAI_KEY',
  },
};

// ========================================
// LLM Provider Registry
// ========================================
export const LLM_PROVIDERS: Record<LLMProvider, ProviderMetadata> = {
  'openai': {
    id: 'openai',
    name: 'OpenAI',
    type: 'llm',
    description: 'GPT models from OpenAI',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'high',
    },
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Latest multimodal model' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Fast and powerful' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Cost-effective' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'OPENAI_API_KEY',
  },
  'anthropic': {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'llm',
    description: 'Claude models from Anthropic',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'high',
    },
    models: [
      { id: 'claude-4-sonnet', name: 'Claude 4 Sonnet', description: 'Best balance of quality and speed' },
      { id: 'claude-4-haiku', name: 'Claude 4 Haiku', description: 'Fastest Claude model' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Previous gen, most capable' },
      { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', description: 'Previous gen, balanced' },
      { id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Previous gen, fast' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'ANTHROPIC_API_KEY',
  },
  'google': {
    id: 'google',
    name: 'Google',
    type: 'llm',
    description: 'Gemini models from Google',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'medium',
    },
    models: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and efficient' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Previous generation' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'GOOGLE_GEMINI_API_KEY',
  },
  'azure-openai': {
    id: 'azure-openai',
    name: 'Azure OpenAI',
    type: 'llm',
    description: 'OpenAI models on Azure',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'high',
    },
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Azure-hosted' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Azure-hosted' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'AZURE_OPENAI_KEY',
  },
  'groq': {
    id: 'groq',
    name: 'Groq',
    type: 'llm',
    description: 'Ultra-fast inference with Groq LPU',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'low',
    },
    models: [
      { id: 'llama-4-maverick', name: 'Llama 4 Maverick', description: 'Latest Llama, 1M context' },
      { id: 'llama-4-scout', name: 'Llama 4 Scout', description: 'Latest Llama, efficient' },
      { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', description: 'Fast and powerful' },
      { id: 'mixtral-8x7b', name: 'Mixtral 8x7B', description: 'Mixture of experts' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'GROQ_API_KEY',
  },
  'together': {
    id: 'together',
    name: 'Together AI',
    type: 'llm',
    description: 'Open-source models via Together AI',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'medium',
      cost: 'low',
    },
    models: [
      { id: 'llama-3.1-405b', name: 'Llama 3.1 405B', description: 'Largest Llama model' },
      { id: 'mixtral-8x22b', name: 'Mixtral 8x22B', description: 'Large mixture model' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'TOGETHER_API_KEY',
  },
  'ollama': {
    id: 'ollama',
    name: 'Ollama',
    type: 'llm',
    description: 'Run models locally with Ollama',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'medium',
      cost: 'low',
    },
    models: [
      { id: 'llama3', name: 'Llama 3', description: 'Run locally' },
      { id: 'mistral', name: 'Mistral', description: 'Fast local model' },
    ],
    requiresApiKey: false,
    defaultApiKeyEnvVar: undefined,
  },
  'perplexity': {
    id: 'perplexity',
    name: 'Perplexity',
    type: 'llm',
    description: 'Perplexity AI models',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'medium',
    },
    models: [
      { id: 'pplx-70b-online', name: 'Perplexity 70B Online', description: 'With web search' },
      { id: 'pplx-7b-chat', name: 'Perplexity 7B Chat', description: 'Fast chat model' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'PERPLEXITY_API_KEY',
  },
  'cerebras': {
    id: 'cerebras',
    name: 'Cerebras',
    type: 'llm',
    description: 'Ultra-fast inference with Cerebras',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'low',
      cost: 'low',
    },
    models: [
      { id: 'llama-3.1-70b', name: 'Llama 3.1 70B', description: 'Cerebras-accelerated' },
      { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', description: 'Fast and efficient' },
    ],
    requiresApiKey: true,
    defaultApiKeyEnvVar: 'CEREBRAS_API_KEY',
  },
  'custom': {
    id: 'custom',
    name: 'Custom LLM Provider',
    type: 'llm',
    description: 'Bring your own language model provider',
    capabilities: {
      streaming: true,
      languages: ['en'],
      supportsCustomVoices: false,
      latency: 'medium',
      cost: 'low',
    },
    models: [
      { id: 'custom-model', name: 'Custom Model', description: 'Your custom LLM implementation' },
    ],
    requiresApiKey: false,
    defaultApiKeyEnvVar: undefined,
  },
};
