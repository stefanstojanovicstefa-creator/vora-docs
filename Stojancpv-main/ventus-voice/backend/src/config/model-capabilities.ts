/**
 * Model Capabilities Registry
 *
 * Tracks which features each LLM model supports to prevent runtime errors
 * when using unsupported features like response_format JSON mode.
 */

export interface ModelCapabilities {
  /** Supports response_format: { type: 'json_object' } */
  supportsJsonMode: boolean;
  /** Supports tool/function calling */
  supportsToolCalls: boolean;
  /** Supports streaming responses */
  supportsStreaming: boolean;
  /** Maximum context window in tokens */
  maxContextTokens: number;
  /** Maximum output tokens */
  maxOutputTokens: number;
  /** Model produces reasoning tokens (e.g., <think>...</think>) */
  reasoningModel: boolean;
  /** Pattern to strip reasoning tokens (if reasoningModel is true) */
  reasoningPattern?: RegExp;
}

/**
 * Registry of model capabilities
 *
 * Add new models here when switching providers to document their capabilities
 * and prevent issues like the MiniMax M2 JSON mode incompatibility.
 */
export const MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  // Routeway API models (free tier)
  'minimax-m2:free': {
    supportsJsonMode: false,
    supportsToolCalls: false,
    supportsStreaming: true,
    maxContextTokens: 128000,
    maxOutputTokens: 8192,
    reasoningModel: true,
    reasoningPattern: /<think>[\s\S]*?<\/think>/g,
  },
  'gpt-oss-120b:free': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 128000,
    maxOutputTokens: 4096,
    reasoningModel: false,
  },
  'deepseek-chat:free': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 64000,
    maxOutputTokens: 4096,
    reasoningModel: false,
  },
  'deepseek-r1:free': {
    supportsJsonMode: false,
    supportsToolCalls: false,
    supportsStreaming: true,
    maxContextTokens: 64000,
    maxOutputTokens: 8192,
    reasoningModel: true,
    reasoningPattern: /<think>[\s\S]*?<\/think>/g,
  },
  // xAI Grok models
  'grok-2': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 131072,
    maxOutputTokens: 4096,
    reasoningModel: false,
  },
  // OpenAI models
  'gpt-4o': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 128000,
    maxOutputTokens: 16384,
    reasoningModel: false,
  },
  'gpt-4o-mini': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 128000,
    maxOutputTokens: 16384,
    reasoningModel: false,
  },
  // Google Gemini models
  'gemini-2.0-flash-exp': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 1000000,
    maxOutputTokens: 8192,
    reasoningModel: false,
  },
  'gemini-2.5-pro': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 1000000,
    maxOutputTokens: 65536,
    reasoningModel: true,
    reasoningPattern: /<think>[\s\S]*?<\/think>/g,
  },
  'gemini-2.5-flash': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 1000000,
    maxOutputTokens: 65536,
    reasoningModel: true,
    reasoningPattern: /<think>[\s\S]*?<\/think>/g,
  },
  // Anthropic Claude models
  'claude-4-sonnet': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 200000,
    maxOutputTokens: 16384,
    reasoningModel: false,
  },
  'claude-4-haiku': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 200000,
    maxOutputTokens: 8192,
    reasoningModel: false,
  },
  // Meta Llama models (via OpenRouter/Groq)
  'meta-llama/llama-4-maverick': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 1000000,
    maxOutputTokens: 65536,
    reasoningModel: false,
  },
  'meta-llama/llama-4-scout': {
    supportsJsonMode: true,
    supportsToolCalls: true,
    supportsStreaming: true,
    maxContextTokens: 512000,
    maxOutputTokens: 65536,
    reasoningModel: false,
  },
};

/**
 * Get capabilities for a model, with safe defaults for unknown models
 */
export function getModelCapabilities(modelId: string): ModelCapabilities {
  const capabilities = MODEL_CAPABILITIES[modelId];

  if (capabilities) {
    return capabilities;
  }

  // Safe defaults for unknown models - assume most restrictive
  console.warn(`Unknown model "${modelId}" - using safe defaults (no JSON mode, no reasoning)`);
  return {
    supportsJsonMode: false,
    supportsToolCalls: false,
    supportsStreaming: true,
    maxContextTokens: 32000,
    maxOutputTokens: 4096,
    reasoningModel: false,
  };
}

/**
 * Clean response from a reasoning model by stripping reasoning tokens
 */
export function cleanReasoningTokens(content: string, modelId: string): string {
  const capabilities = getModelCapabilities(modelId);

  if (!capabilities.reasoningModel || !capabilities.reasoningPattern) {
    return content;
  }

  return content.replace(capabilities.reasoningPattern, '').trim();
}
