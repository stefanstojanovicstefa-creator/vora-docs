/**
 * Forge Configuration
 *
 * Centralized configuration for all Agent Forge settings.
 * Values are read from environment variables with sensible defaults.
 */

/**
 * Forge configuration object - central source of truth for all Forge settings.
 *
 * @property compiler.model - AI model used for agent compilation (default: minimax-m2:free, free tier)
 * @property compiler.baseUrl - Base URL for the compiler API (default: Routeway)
 * @property compiler.timeoutMs - Maximum time to wait for compilation (default: 90s)
 * @property session.maxTurns - Maximum conversation turns before suggesting wrap-up
 * @property session.maxUserMessages - Maximum user messages to include in AI context
 */
export const forgeConfig = {
  /**
   * Compiler settings - controls the AI model that generates final AgentConfig
   */
  compiler: {
    /** AI model for agent compilation (OpenAI-compatible) */
    model: process.env.FORGE_COMPILER_MODEL || 'minimax-m2:free',

    /** Base URL for compiler API (OpenAI-compatible endpoint) */
    baseUrl: process.env.FORGE_COMPILER_BASE_URL || 'https://api.routeway.ai/v1',

    /** Compilation timeout in milliseconds (default: 90 seconds) */
    timeoutMs: parseInt(process.env.FORGE_COMPILATION_TIMEOUT_MS || '90000', 10),
  },

  /**
   * Session settings - controls conversation flow and limits
   */
  session: {
    /** Maximum conversation turns before suggesting wrap-up (default: 12) */
    maxTurns: parseInt(process.env.FORGE_MAX_TURNS || '12', 10),

    /** Maximum user messages to include in AI context window (default: 10) */
    maxUserMessages: parseInt(process.env.FORGE_MAX_USER_MESSAGES || '10', 10),
  },
} as const;

export type ForgeConfig = typeof forgeConfig;
