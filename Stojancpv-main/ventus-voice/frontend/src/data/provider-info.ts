import { ProviderType, ProviderCategory } from '../types/providers';

// ============================================================================
// Enhanced Provider Information
// ============================================================================

export interface ProviderFeatures {
  streaming: boolean;
  functionCalling?: boolean;
  multimodal?: boolean;
  languages: number;
  maxContextTokens?: number;
  voiceCloning?: boolean;
  realtime?: boolean;
}

export interface ProviderPricing {
  inputCost?: number; // per M tokens/chars
  outputCost?: number;
  costPerMinute?: number;
  unit: 'tokens' | 'characters' | 'seconds';
  currency: string;
}

export interface ProviderPerformance {
  latency: 'low' | 'medium' | 'high';
  quality: number; // 0-100
  reliability: number; // 0-100
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  contextWindow?: number;
  inputCost?: number;
  outputCost?: number;
  costPerMinute?: number;
  features?: string[];
}

export interface DetailedProviderInfo {
  id: ProviderType;
  name: string;
  displayName: string;
  type: ProviderCategory[];
  logo?: string;
  description: string;
  longDescription: string;

  features: ProviderFeatures;
  pricing: ProviderPricing;
  performance: ProviderPerformance;

  models: ModelInfo[];

  useCases: string[];
  pros: string[];
  cons: string[];

  websiteUrl?: string;
  docsUrl?: string;
  pricingUrl?: string;

  badges?: ('fastest' | 'cheapest' | 'best-quality' | 'recommended' | 'popular')[];
}

// ============================================================================
// LLM Provider Data
// ============================================================================

export const LLM_PROVIDERS: DetailedProviderInfo[] = [
  {
    id: 'openai',
    name: 'openai',
    displayName: 'OpenAI',
    type: ['llm'],
    description: 'Industry-leading GPT models with strong reasoning',
    longDescription: 'OpenAI offers the most advanced language models with GPT-4 and GPT-4 Turbo, providing exceptional reasoning, code generation, and conversational abilities.',
    features: {
      streaming: true,
      functionCalling: true,
      multimodal: true,
      languages: 50,
      maxContextTokens: 128000,
    },
    pricing: {
      inputCost: 2.50,
      outputCost: 10.00,
      unit: 'tokens',
      currency: 'USD',
    },
    performance: {
      latency: 'medium',
      quality: 95,
      reliability: 98,
    },
    models: [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Latest GPT-4 with 128K context window',
        contextWindow: 128000,
        inputCost: 10.00,
        outputCost: 30.00,
        features: ['multimodal', 'function-calling', 'json-mode'],
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'Most capable model for complex tasks',
        contextWindow: 8192,
        inputCost: 30.00,
        outputCost: 60.00,
        features: ['multimodal', 'function-calling'],
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Fast and cost-effective',
        contextWindow: 16384,
        inputCost: 0.50,
        outputCost: 1.50,
        features: ['function-calling', 'json-mode'],
      },
    ],
    useCases: ['Customer Support', 'Complex Reasoning', 'Code Generation', 'General Purpose'],
    pros: ['Best reasoning abilities', 'Multimodal support', 'Function calling', 'Large context window'],
    cons: ['Higher cost', 'Moderate latency', 'Rate limits on free tier'],
    websiteUrl: 'https://openai.com',
    docsUrl: 'https://platform.openai.com/docs',
    pricingUrl: 'https://openai.com/pricing',
    badges: ['recommended', 'best-quality'],
  },
  {
    id: 'anthropic',
    name: 'anthropic',
    displayName: 'Anthropic',
    type: ['llm'],
    description: 'Claude models with exceptional instruction following',
    longDescription: 'Anthropic\'s Claude models excel at following complex instructions, maintaining context, and providing thoughtful, nuanced responses with strong safety features.',
    features: {
      streaming: true,
      functionCalling: true,
      multimodal: true,
      languages: 40,
      maxContextTokens: 200000,
    },
    pricing: {
      inputCost: 3.00,
      outputCost: 15.00,
      unit: 'tokens',
      currency: 'USD',
    },
    performance: {
      latency: 'medium',
      quality: 96,
      reliability: 97,
    },
    models: [
      {
        id: 'claude-4-sonnet',
        name: 'Claude 4 Sonnet',
        description: 'Best balance of intelligence and speed',
        contextWindow: 200000,
        inputCost: 3.00,
        outputCost: 15.00,
        features: ['multimodal', 'function-calling', 'extended-context'],
      },
      {
        id: 'claude-4-haiku',
        name: 'Claude 4 Haiku',
        description: 'Fastest Claude model, great for real-time',
        contextWindow: 200000,
        inputCost: 0.80,
        outputCost: 4.00,
        features: ['multimodal', 'function-calling', 'extended-context'],
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        description: 'Previous generation, highly capable',
        contextWindow: 200000,
        inputCost: 3.00,
        outputCost: 15.00,
        features: ['multimodal', 'function-calling', 'extended-context'],
      },
    ],
    useCases: ['Long Conversations', 'Document Analysis', 'Creative Writing', 'Research'],
    pros: ['Largest context window', 'Excellent instruction following', 'Strong safety', 'Thoughtful responses'],
    cons: ['Higher cost', 'Smaller model selection'],
    websiteUrl: 'https://anthropic.com',
    docsUrl: 'https://docs.anthropic.com',
    pricingUrl: 'https://www.anthropic.com/pricing',
    badges: ['best-quality', 'recommended'],
  },
  {
    id: 'gemini',
    name: 'gemini',
    displayName: 'Google Gemini',
    type: ['llm'],
    description: 'Google\'s multimodal AI with large context',
    longDescription: 'Google Gemini provides powerful multimodal capabilities with industry-leading context windows and competitive pricing.',
    features: {
      streaming: true,
      functionCalling: true,
      multimodal: true,
      languages: 100,
      maxContextTokens: 1000000,
    },
    pricing: {
      inputCost: 1.25,
      outputCost: 5.00,
      unit: 'tokens',
      currency: 'USD',
    },
    performance: {
      latency: 'low',
      quality: 92,
      reliability: 95,
    },
    models: [
      {
        id: 'gemini-2.5-pro',
        name: 'Gemini 2.5 Pro',
        description: 'Most capable Gemini with deep reasoning',
        contextWindow: 1000000,
        inputCost: 1.25,
        outputCost: 10.00,
        features: ['multimodal', 'function-calling', 'massive-context', 'reasoning'],
      },
      {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        description: 'Fast and cost-effective with reasoning',
        contextWindow: 1000000,
        inputCost: 0.15,
        outputCost: 0.60,
        features: ['multimodal', 'function-calling', 'massive-context', 'reasoning'],
      },
      {
        id: 'gemini-1.5-pro',
        name: 'Gemini 1.5 Pro',
        description: 'Previous generation, 1M context',
        contextWindow: 1000000,
        inputCost: 1.25,
        outputCost: 5.00,
        features: ['multimodal', 'function-calling', 'massive-context'],
      },
    ],
    useCases: ['High Volume', 'Document Processing', 'Multimodal Tasks', 'Cost-Sensitive'],
    pros: ['Massive context window', 'Competitive pricing', 'Fast Flash model', 'Good multimodal'],
    cons: ['Less reasoning depth', 'Newer ecosystem'],
    websiteUrl: 'https://deepmind.google/technologies/gemini',
    docsUrl: 'https://ai.google.dev/docs',
    pricingUrl: 'https://ai.google.dev/pricing',
    badges: ['cheapest', 'fastest'],
  },
  {
    id: 'groq',
    name: 'groq',
    displayName: 'Groq',
    type: ['llm'],
    description: 'Ultra-fast inference with open models',
    longDescription: 'Groq provides blazing-fast inference speeds using custom hardware acceleration, running open-source models like Llama and Mixtral.',
    features: {
      streaming: true,
      functionCalling: true,
      multimodal: false,
      languages: 30,
      maxContextTokens: 32768,
    },
    pricing: {
      inputCost: 0.10,
      outputCost: 0.10,
      unit: 'tokens',
      currency: 'USD',
    },
    performance: {
      latency: 'low',
      quality: 85,
      reliability: 94,
    },
    models: [
      {
        id: 'llama-4-maverick',
        name: 'Llama 4 Maverick',
        description: 'Latest Llama with 1M context window',
        contextWindow: 1000000,
        inputCost: 0.50,
        outputCost: 0.75,
        features: ['function-calling', 'massive-context', 'multimodal'],
      },
      {
        id: 'llama-4-scout',
        name: 'Llama 4 Scout',
        description: 'Efficient Llama 4 with 512K context',
        contextWindow: 512000,
        inputCost: 0.20,
        outputCost: 0.35,
        features: ['function-calling', 'extended-context', 'multimodal'],
      },
      {
        id: 'llama-3.1-70b-versatile',
        name: 'Llama 3.1 70B',
        description: 'Previous gen, fast and capable',
        contextWindow: 32768,
        inputCost: 0.59,
        outputCost: 0.79,
        features: ['function-calling', 'extended-context'],
      },
    ],
    useCases: ['Real-time Chat', 'High Throughput', 'Cost Optimization', 'Low Latency'],
    pros: ['Extremely fast', 'Very affordable', 'Open models', 'High throughput'],
    cons: ['Lower quality vs proprietary', 'Limited model selection'],
    websiteUrl: 'https://groq.com',
    docsUrl: 'https://console.groq.com/docs',
    badges: ['fastest', 'cheapest'],
  },
  {
    id: 'mistral',
    name: 'mistral',
    displayName: 'Mistral AI',
    type: ['llm'],
    description: 'European AI with strong performance',
    longDescription: 'Mistral AI offers powerful open and proprietary models with competitive performance and European data residency.',
    features: {
      streaming: true,
      functionCalling: true,
      multimodal: false,
      languages: 25,
      maxContextTokens: 32768,
    },
    pricing: {
      inputCost: 2.00,
      outputCost: 6.00,
      unit: 'tokens',
      currency: 'USD',
    },
    performance: {
      latency: 'medium',
      quality: 88,
      reliability: 95,
    },
    models: [
      {
        id: 'mistral-large-latest',
        name: 'Mistral Large',
        description: 'Most capable Mistral model',
        contextWindow: 32768,
        inputCost: 2.00,
        outputCost: 6.00,
        features: ['function-calling', 'multilingual'],
      },
      {
        id: 'mistral-small-latest',
        name: 'Mistral Small',
        description: 'Cost-effective option',
        contextWindow: 32768,
        inputCost: 0.20,
        outputCost: 0.60,
        features: ['function-calling'],
      },
    ],
    useCases: ['European Compliance', 'Multilingual', 'General Purpose'],
    pros: ['EU data residency', 'Good quality/price', 'Function calling'],
    cons: ['Smaller ecosystem', 'No multimodal'],
    websiteUrl: 'https://mistral.ai',
    docsUrl: 'https://docs.mistral.ai',
    pricingUrl: 'https://mistral.ai/technology/#pricing',
  },
  {
    id: 'cohere',
    name: 'cohere',
    displayName: 'Cohere',
    type: ['llm'],
    description: 'Enterprise-focused language models',
    longDescription: 'Cohere specializes in enterprise AI with strong retrieval-augmented generation and embedding capabilities.',
    features: {
      streaming: true,
      functionCalling: true,
      multimodal: false,
      languages: 100,
      maxContextTokens: 128000,
    },
    pricing: {
      inputCost: 3.00,
      outputCost: 15.00,
      unit: 'tokens',
      currency: 'USD',
    },
    performance: {
      latency: 'medium',
      quality: 87,
      reliability: 96,
    },
    models: [
      {
        id: 'command-r-plus',
        name: 'Command R+',
        description: 'Advanced reasoning and RAG',
        contextWindow: 128000,
        inputCost: 3.00,
        outputCost: 15.00,
        features: ['rag-optimized', 'function-calling'],
      },
      {
        id: 'command-r',
        name: 'Command R',
        description: 'Balanced performance',
        contextWindow: 128000,
        inputCost: 0.50,
        outputCost: 1.50,
        features: ['rag-optimized', 'function-calling'],
      },
    ],
    useCases: ['RAG Applications', 'Enterprise Search', 'Document Q&A'],
    pros: ['RAG optimized', 'Good multilingual', 'Enterprise features'],
    cons: ['Higher cost', 'Less general purpose'],
    websiteUrl: 'https://cohere.com',
    docsUrl: 'https://docs.cohere.com',
    pricingUrl: 'https://cohere.com/pricing',
  },
  {
    id: 'perplexity',
    name: 'perplexity',
    displayName: 'Perplexity',
    type: ['llm'],
    description: 'Search-augmented language models',
    longDescription: 'Perplexity combines language models with real-time web search for up-to-date information and citations.',
    features: {
      streaming: true,
      functionCalling: false,
      multimodal: false,
      languages: 30,
      maxContextTokens: 127072,
    },
    pricing: {
      inputCost: 1.00,
      outputCost: 1.00,
      unit: 'tokens',
      currency: 'USD',
    },
    performance: {
      latency: 'medium',
      quality: 89,
      reliability: 93,
    },
    models: [
      {
        id: 'llama-3.1-sonar-large-128k-online',
        name: 'Sonar Large Online',
        description: 'Search-augmented with citations',
        contextWindow: 127072,
        inputCost: 1.00,
        outputCost: 1.00,
        features: ['web-search', 'citations'],
      },
      {
        id: 'llama-3.1-sonar-small-128k-online',
        name: 'Sonar Small Online',
        description: 'Fast search-augmented',
        contextWindow: 127072,
        inputCost: 0.20,
        outputCost: 0.20,
        features: ['web-search', 'citations'],
      },
    ],
    useCases: ['Current Events', 'Research', 'Fact-Checking', 'News'],
    pros: ['Real-time search', 'Citations', 'Up-to-date info'],
    cons: ['No function calling', 'Limited to search tasks'],
    websiteUrl: 'https://www.perplexity.ai',
    docsUrl: 'https://docs.perplexity.ai',
  },
];

// ============================================================================
// STT Provider Data
// ============================================================================

export const STT_PROVIDERS: DetailedProviderInfo[] = [
  {
    id: 'deepgram',
    name: 'deepgram',
    displayName: 'Deepgram',
    type: ['stt'],
    description: 'Fast and accurate speech recognition',
    longDescription: 'Deepgram provides industry-leading speech recognition with real-time streaming, high accuracy, and extensive language support.',
    features: {
      streaming: true,
      languages: 30,
      realtime: true,
    },
    pricing: {
      costPerMinute: 0.0043,
      unit: 'seconds',
      currency: 'USD',
    },
    performance: {
      latency: 'low',
      quality: 95,
      reliability: 98,
    },
    models: [
      {
        id: 'nova-2',
        name: 'Nova-2',
        description: 'Latest model with best accuracy',
        costPerMinute: 0.0059,
        features: ['streaming', 'punctuation', 'diarization'],
      },
      {
        id: 'nova',
        name: 'Nova',
        description: 'Balanced performance and cost',
        costPerMinute: 0.0043,
        features: ['streaming', 'punctuation'],
      },
    ],
    useCases: ['Real-time Transcription', 'Call Centers', 'Voice Assistants'],
    pros: ['Very fast', 'High accuracy', 'Good pricing', 'Streaming support'],
    cons: ['Requires stable connection'],
    websiteUrl: 'https://deepgram.com',
    docsUrl: 'https://developers.deepgram.com',
    pricingUrl: 'https://deepgram.com/pricing',
    badges: ['recommended', 'fastest'],
  },
  {
    id: 'assemblyai',
    name: 'assemblyai',
    displayName: 'AssemblyAI',
    type: ['stt'],
    description: 'Advanced transcription with AI features',
    longDescription: 'AssemblyAI offers high-quality transcription with advanced features like speaker diarization, sentiment analysis, and content moderation.',
    features: {
      streaming: true,
      languages: 20,
      realtime: true,
    },
    pricing: {
      costPerMinute: 0.00037,
      unit: 'seconds',
      currency: 'USD',
    },
    performance: {
      latency: 'medium',
      quality: 92,
      reliability: 96,
    },
    models: [
      {
        id: 'best',
        name: 'Best',
        description: 'Highest accuracy',
        costPerMinute: 0.00037,
        features: ['diarization', 'sentiment', 'entities'],
      },
      {
        id: 'nano',
        name: 'Nano',
        description: 'Fast and affordable',
        costPerMinute: 0.00015,
        features: ['basic-transcription'],
      },
    ],
    useCases: ['Meeting Transcription', 'Content Moderation', 'Analytics'],
    pros: ['Advanced features', 'Competitive pricing', 'Good accuracy'],
    cons: ['Slower than Deepgram', 'Fewer languages'],
    websiteUrl: 'https://www.assemblyai.com',
    docsUrl: 'https://www.assemblyai.com/docs',
    pricingUrl: 'https://www.assemblyai.com/pricing',
    badges: ['cheapest'],
  },
  {
    id: 'google',
    name: 'google',
    displayName: 'Google Cloud STT',
    type: ['stt'],
    description: 'Enterprise-grade speech recognition',
    longDescription: 'Google Cloud Speech-to-Text offers enterprise features with extensive language support and integration with Google Cloud ecosystem.',
    features: {
      streaming: true,
      languages: 125,
      realtime: true,
    },
    pricing: {
      costPerMinute: 0.006,
      unit: 'seconds',
      currency: 'USD',
    },
    performance: {
      latency: 'medium',
      quality: 90,
      reliability: 97,
    },
    models: [
      {
        id: 'latest_long',
        name: 'Latest Long',
        description: 'Optimized for long audio',
        costPerMinute: 0.009,
        features: ['streaming', 'punctuation'],
      },
      {
        id: 'latest_short',
        name: 'Latest Short',
        description: 'Optimized for short queries',
        costPerMinute: 0.006,
        features: ['streaming', 'punctuation'],
      },
    ],
    useCases: ['Enterprise', 'Multilingual', 'Google Cloud Integration'],
    pros: ['Most languages', 'Enterprise SLA', 'GCP integration'],
    cons: ['Higher cost', 'Complex setup'],
    websiteUrl: 'https://cloud.google.com/speech-to-text',
    docsUrl: 'https://cloud.google.com/speech-to-text/docs',
    pricingUrl: 'https://cloud.google.com/speech-to-text/pricing',
  },
];

// ============================================================================
// TTS Provider Data
// ============================================================================

export const TTS_PROVIDERS: DetailedProviderInfo[] = [
  {
    id: 'elevenlabs',
    name: 'elevenlabs',
    displayName: 'ElevenLabs',
    type: ['tts'],
    description: 'Most natural and expressive voices',
    longDescription: 'ElevenLabs provides the most human-like text-to-speech with exceptional emotion, intonation, and voice cloning capabilities.',
    features: {
      streaming: true,
      languages: 29,
      voiceCloning: true,
      realtime: true,
    },
    pricing: {
      inputCost: 0.30,
      unit: 'characters',
      currency: 'USD',
    },
    performance: {
      latency: 'medium',
      quality: 98,
      reliability: 96,
    },
    models: [
      {
        id: 'eleven_multilingual_v2',
        name: 'Multilingual v2',
        description: 'Best quality, 29 languages',
        inputCost: 0.30,
        features: ['multilingual', 'emotion', 'streaming'],
      },
      {
        id: 'eleven_turbo_v2',
        name: 'Turbo v2',
        description: 'Faster with good quality',
        inputCost: 0.15,
        features: ['low-latency', 'streaming'],
      },
    ],
    useCases: ['Audiobooks', 'Content Creation', 'Voice Assistants', 'Premium Quality'],
    pros: ['Best quality', 'Voice cloning', 'Emotional range', 'Multilingual'],
    cons: ['Higher cost', 'Moderate latency', 'Character limits'],
    websiteUrl: 'https://elevenlabs.io',
    docsUrl: 'https://docs.elevenlabs.io',
    pricingUrl: 'https://elevenlabs.io/pricing',
    badges: ['best-quality', 'recommended'],
  },
  {
    id: 'openai',
    name: 'openai',
    displayName: 'OpenAI TTS',
    type: ['tts'],
    description: 'Natural voices with good quality',
    longDescription: 'OpenAI TTS offers natural-sounding voices with reliable performance and simple integration.',
    features: {
      streaming: true,
      languages: 30,
      voiceCloning: false,
      realtime: true,
    },
    pricing: {
      inputCost: 15.00,
      unit: 'characters',
      currency: 'USD',
    },
    performance: {
      latency: 'low',
      quality: 88,
      reliability: 98,
    },
    models: [
      {
        id: 'tts-1-hd',
        name: 'TTS-1-HD',
        description: 'High definition quality',
        inputCost: 30.00,
        features: ['hd-quality', 'streaming'],
      },
      {
        id: 'tts-1',
        name: 'TTS-1',
        description: 'Standard quality',
        inputCost: 15.00,
        features: ['streaming', 'low-latency'],
      },
    ],
    useCases: ['Voice Assistants', 'Notifications', 'General Purpose'],
    pros: ['Fast', 'Reliable', 'Good quality', 'Simple API'],
    cons: ['No voice cloning', 'Limited customization'],
    websiteUrl: 'https://platform.openai.com/docs/guides/text-to-speech',
    docsUrl: 'https://platform.openai.com/docs/guides/text-to-speech',
    pricingUrl: 'https://openai.com/pricing',
    badges: ['fastest'],
  },
  {
    id: 'google',
    name: 'google',
    displayName: 'Google Cloud TTS',
    type: ['tts'],
    description: 'Enterprise TTS with many voices',
    longDescription: 'Google Cloud TTS provides extensive voice options with WaveNet and Neural2 technologies for natural-sounding speech.',
    features: {
      streaming: true,
      languages: 220,
      voiceCloning: false,
      realtime: true,
    },
    pricing: {
      inputCost: 16.00,
      unit: 'characters',
      currency: 'USD',
    },
    performance: {
      latency: 'medium',
      quality: 85,
      reliability: 97,
    },
    models: [
      {
        id: 'neural2',
        name: 'Neural2',
        description: 'Latest neural voices',
        inputCost: 16.00,
        features: ['neural', 'multilingual'],
      },
      {
        id: 'wavenet',
        name: 'WaveNet',
        description: 'Classic WaveNet quality',
        inputCost: 16.00,
        features: ['wavenet', 'multilingual'],
      },
    ],
    useCases: ['Enterprise', 'Multilingual', 'High Volume'],
    pros: ['Most languages', 'Many voices', 'Enterprise SLA'],
    cons: ['Moderate quality', 'Complex pricing'],
    websiteUrl: 'https://cloud.google.com/text-to-speech',
    docsUrl: 'https://cloud.google.com/text-to-speech/docs',
    pricingUrl: 'https://cloud.google.com/text-to-speech/pricing',
  },
  {
    id: 'cartesia',
    name: 'cartesia',
    displayName: 'Cartesia',
    type: ['tts'],
    description: 'Ultra-low latency real-time voices',
    longDescription: 'Cartesia Sonic provides the fastest text-to-speech with ultra-low latency, perfect for real-time voice interactions.',
    features: {
      streaming: true,
      languages: 14,
      voiceCloning: true,
      realtime: true,
    },
    pricing: {
      inputCost: 5.00,
      unit: 'characters',
      currency: 'USD',
    },
    performance: {
      latency: 'low',
      quality: 87,
      reliability: 95,
    },
    models: [
      {
        id: 'sonic-english',
        name: 'Sonic English',
        description: 'Ultra-fast English voices',
        inputCost: 5.00,
        features: ['ultra-low-latency', 'streaming'],
      },
      {
        id: 'sonic-multilingual',
        name: 'Sonic Multilingual',
        description: 'Fast multilingual support',
        inputCost: 7.50,
        features: ['ultra-low-latency', 'multilingual'],
      },
    ],
    useCases: ['Real-time Chat', 'Live Conversations', 'Gaming', 'Interactive Apps'],
    pros: ['Fastest latency', 'Voice cloning', 'Affordable'],
    cons: ['Fewer languages', 'Newer provider'],
    websiteUrl: 'https://cartesia.ai',
    docsUrl: 'https://docs.cartesia.ai',
    badges: ['fastest', 'cheapest'],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getAllProviders(): DetailedProviderInfo[] {
  return [...LLM_PROVIDERS, ...STT_PROVIDERS, ...TTS_PROVIDERS];
}

export function getProvidersByType(type: ProviderCategory): DetailedProviderInfo[] {
  switch (type) {
    case 'llm':
      return LLM_PROVIDERS;
    case 'stt':
      return STT_PROVIDERS;
    case 'tts':
      return TTS_PROVIDERS;
    default:
      return [];
  }
}

export function getProviderById(id: ProviderType): DetailedProviderInfo | undefined {
  return getAllProviders().find(p => p.id === id);
}

export function getRecommendedProviders(
  type: ProviderCategory,
  criteria: 'cost' | 'quality' | 'speed' | 'balanced'
): DetailedProviderInfo[] {
  const providers = getProvidersByType(type);

  switch (criteria) {
    case 'cost':
      return providers.filter(p => p.badges?.includes('cheapest'));
    case 'quality':
      return providers.filter(p => p.badges?.includes('best-quality'));
    case 'speed':
      return providers.filter(p => p.badges?.includes('fastest'));
    case 'balanced':
      return providers.filter(p => p.badges?.includes('recommended'));
    default:
      return providers;
  }
}
