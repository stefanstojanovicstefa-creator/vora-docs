/**
 * Agent Compiler Service
 *
 * The CORE service of Vora Voice platform.
 * Transforms natural language descriptions into structured agent configurations.
 *
 * Default model: minimax-m2:free (free tier via Routeway API)
 * Fallback: gemini-2.5-flash (via Google Gemini API)
 *
 * Supported models (see model-capabilities.ts for full registry):
 * - FREE: minimax-m2:free, gpt-oss-120b:free, deepseek-chat:free, deepseek-r1:free
 * - Gemini: gemini-2.5-pro, gemini-2.5-flash
 * - Claude: claude-4-sonnet, claude-4-haiku
 * - Llama: meta-llama/llama-4-maverick, meta-llama/llama-4-scout
 * - OpenAI: gpt-4o, gpt-4o-mini
 * - xAI: grok-2
 *
 * ENHANCED: Includes automatic provider selection based on detected language
 */

import { jsonrepair } from 'jsonrepair';
import {
  AgentConfigSchema,
  type AgentConfig,
} from '../schemas/agent-config.schema';
import { fillAgentCompilerPrompt } from '../templates/agent-compiler-prompt';
import { createLogger } from '../utils/logger';
import { providerSelectorService, type SelectedProviders } from './provider-selector.service';
import { languageDetectorService, type DetectionResult } from './language-detector.service';
import { correctConfig, type CorrectionResult } from './semantic-corrector.service';
import { AGENT_CONFIG_RESPONSE_FORMAT, AGENT_CONFIG_JSON_MODE } from '../schemas/agent-config.json-schema';
import { validateConfigSecurity, type SecurityIssue } from '../security/config-security-validator';

/**
 * Error codes for agent compilation failures
 */
export type AgentCompilationErrorCode =
  | 'API_TIMEOUT'
  | 'INVALID_JSON'
  | 'VALIDATION_FAILED'
  | 'API_ERROR';

/**
 * Custom error class for agent compilation failures
 * Includes specific error codes for frontend handling
 */
export class AgentCompilationError extends Error {
  public readonly errorCode: AgentCompilationErrorCode;
  public readonly details?: string;

  constructor(
    message: string,
    errorCode: AgentCompilationErrorCode,
    details?: string
  ) {
    super(message);
    this.name = 'AgentCompilationError';
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, AgentCompilationError.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      errorCode: this.errorCode,
      details: this.details,
    };
  }
}

const logger = createLogger('AgentCompiler.service');

// API configuration
// Primary: Routeway API with MiniMax M2 (OpenAI-compatible)
const ROUTEWAY_BASE_URL = 'https://api.routeway.ai/v1';
const ROUTEWAY_MODEL = 'minimax-m2:free'; // MiniMax M2 - optimized for coding/agentic workflows

// Fallback: Google Gemini API
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_MODEL = 'gemini-2.5-flash'; // Fast, capable model

// OpenRouter response interface
interface OpenRouterChoice {
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: OpenRouterChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Enhanced compilation interfaces
export interface CompileAgentInput {
  userPrompt: string;
  agentId?: string;  // For override lookups
  priority?: 'quality' | 'cost' | 'latency' | 'balanced';
  explicitLanguage?: string;  // Override language detection
  businessUrl?: string;  // For URL-based language detection
}

export interface CompiledAgent extends AgentConfig {
  // Provider configuration
  providers: {
    mode: 'traditional' | 'speech-to-speech';
    stt?: { provider: string; model: string; tier: string; latencyMs: number };
    tts?: { provider: string; model: string; tier: string; latencyMs: number };
    llm?: { provider: string; model: string; tier: string; latencyMs: number };
    e2e?: { provider: string; model: string; tier: string; latencyMs: number };
  };

  // Detected language info
  language_detection: {
    code: string;
    confidence: number;
    region?: string;
    detectionMethod: string;
  };

  // Performance metrics
  performance: {
    estimatedLatencyMs: number;
    estimatedCostPer1000: number;
    confidence: number;
  };

  // Warnings and recommendations
  warnings?: string[];

  // Compiler warnings from semantic correction (low confidence corrections)
  _compilerWarnings?: string[];

  // Corrections applied during semantic correction
  _corrections?: CorrectionResult[];

  // Security warnings from security validation
  _securityWarnings?: string[];

  // Security issues (for transparency)
  _securityIssues?: SecurityIssue[];
}

type CompilerBackend = 'routeway' | 'gemini';

export class AgentCompilerService {
  private apiKey: string;
  private backend: CompilerBackend;

  /**
   * Whether Routeway API supports json_schema response format
   * null = unknown, true = supported, false = not supported (use json_object)
   */
  private supportsJsonSchema: boolean | null = null;

  /**
   * Result of last security validation (for including in response)
   */
  private lastSecurityResult?: {
    warnings: string[];
    issues: SecurityIssue[];
  };

  constructor(apiKey: string, backend: CompilerBackend = 'routeway') {
    this.apiKey = apiKey;
    this.backend = backend;
  }

  /**
   * Compiles a user prompt into a complete agent configuration with automatic provider selection
   *
   * @param input - Compilation input (can be string for backward compatibility or CompileAgentInput)
   * @returns Complete agent configuration with selected providers
   */
  async compileAgent(input: string | CompileAgentInput): Promise<CompiledAgent> {
    // Support backward compatibility with string input
    const compileInput: CompileAgentInput =
      typeof input === 'string' ? { userPrompt: input, priority: 'balanced' } : input;

    const { userPrompt, priority = 'balanced', explicitLanguage, businessUrl } = compileInput;

    // Fill the prompt template
    const fullPrompt = fillAgentCompilerPrompt(userPrompt);

    const modelName = this.backend === 'gemini' ? GEMINI_MODEL : ROUTEWAY_MODEL;
    logger.info(`Compiling agent with ${this.backend} (${modelName})`, {
      promptLength: fullPrompt.length,
      model: modelName,
      priority,
      backend: this.backend,
    });

    // Add 90s timeout to prevent indefinite hangs on slow AI responses
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    let jsonText: string;

    if (this.backend === 'gemini') {
      // Call Google Gemini API
      jsonText = await this.callGeminiAPI(fullPrompt, controller, timeoutId);
    } else {
      // Call Routeway API (OpenAI-compatible) with Gemini fallback
      try {
        jsonText = await this.callRoutewayAPI(fullPrompt, controller, timeoutId);
      } catch (routewayError) {
        // If Routeway fails (empty response, API error), fallback to Gemini
        const geminiKey = process.env.GEMINI_COMPILER_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
        if (geminiKey) {
          logger.warn('Routeway failed, falling back to Gemini', {
            error: routewayError instanceof Error ? routewayError.message : String(routewayError),
          });
          // Create new controller and timeout for Gemini attempt
          const geminiController = new AbortController();
          const geminiTimeoutId = setTimeout(() => geminiController.abort(), 90000);
          // Temporarily store original API key and switch to Gemini
          const originalApiKey = this.apiKey;
          this.apiKey = geminiKey;
          try {
            jsonText = await this.callGeminiAPI(fullPrompt, geminiController, geminiTimeoutId);
          } finally {
            this.apiKey = originalApiKey;
          }
        } else {
          // No Gemini key available, rethrow original error
          throw routewayError;
        }
      }
    }

    // Parse JSON with automatic repair for malformed output
    // (includes semantic correction for typos/aliases)
    const configJson = this.parseWithRepair(jsonText);

    // Security validation (SSRF, voice ID format, prompt injection)
    const securityResult = validateConfigSecurity(configJson as Record<string, unknown>);

    // Store security warnings for later
    this.lastSecurityResult = {
      warnings: securityResult.warnings,
      issues: securityResult.errors,
    };

    if (!securityResult.valid) {
      const errorMessages = securityResult.errors
        .filter(e => e.severity === 'error')
        .map(e => `${e.field}: ${e.message}`)
        .join('; ');

      logger.error('Security validation failed', {
        errors: securityResult.errors,
        warnings: securityResult.warnings,
      });

      throw new AgentCompilationError(
        'Configuration failed security validation',
        'VALIDATION_FAILED',
        errorMessages
      );
    }

    // Use sanitized config for Zod validation
    const configToValidate = securityResult.sanitizedConfig || configJson;

    // Validate with Zod schema
    let baseConfig: AgentConfig;
    try {
      baseConfig = AgentConfigSchema.parse(configToValidate);
      logger.info('Agent compiled successfully', { agentName: baseConfig.name });
    } catch (error) {
      // Log the full validation error and the config that failed
      logger.error('Zod validation failed', {
        error: error instanceof Error ? error.message : String(error),
        configKeys: Object.keys(configToValidate || {}),
        configPreview: JSON.stringify(configToValidate || {}).substring(0, 1000),
      });
      throw new AgentCompilationError(
        'Generated agent configuration is invalid',
        'VALIDATION_FAILED',
        error instanceof Error ? error.message : 'Unknown validation error'
      );
    }

    // Detect language and select providers
    const languageDetection = await this.detectAgentLanguage(
      baseConfig,
      explicitLanguage,
      businessUrl
    );

    const selectedProviders = await this.selectProvidersForAgent(
      languageDetection.detectedLanguage,
      priority
    );

    // Enhance the base config with provider and language information
    const enhancedConfig = this.enhanceConfig(
      baseConfig,
      languageDetection,
      selectedProviders,
      priority,
      this.lastCorrectionResult,
      this.lastSecurityResult
    );

    // Clear temporary results after use
    this.lastCorrectionResult = undefined;
    this.lastSecurityResult = undefined;

    return enhancedConfig;
  }

  /**
   * Call Routeway API (OpenAI-compatible) for agent compilation
   * Uses JSON Schema for constrained output when supported, falls back to json_object mode
   */
  private async callRoutewayAPI(
    fullPrompt: string,
    controller: AbortController,
    timeoutId: ReturnType<typeof setTimeout>
  ): Promise<string> {
    // Try with JSON schema first if we haven't determined support yet
    if (this.supportsJsonSchema !== false) {
      try {
        const result = await this.callRoutewayWithResponseFormat(
          fullPrompt,
          controller,
          timeoutId,
          AGENT_CONFIG_RESPONSE_FORMAT
        );
        this.supportsJsonSchema = true;
        logger.info('Routeway API supports json_schema response format');
        return result;
      } catch (error) {
        // Check if error indicates json_schema is not supported
        if (this.isSchemaNotSupportedError(error)) {
          logger.warn('Routeway does not support json_schema, falling back to json_object mode');
          this.supportsJsonSchema = false;
          // Fall through to json_object mode
        } else {
          // Re-throw other errors
          throw error;
        }
      }
    }

    // Use json_object mode (fallback)
    return this.callRoutewayWithResponseFormat(
      fullPrompt,
      controller,
      timeoutId,
      AGENT_CONFIG_JSON_MODE
    );
  }

  /**
   * Check if an error indicates json_schema response format is not supported
   */
  private isSchemaNotSupportedError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    const details = error instanceof AgentCompilationError ? error.details : '';

    // Check for common error indicators
    const notSupportedIndicators = [
      'json_schema',
      'response_format',
      'unsupported',
      'invalid.*format',
      'unknown.*parameter',
    ];

    const fullMessage = `${message} ${details}`.toLowerCase();
    return notSupportedIndicators.some(indicator => {
      const regex = new RegExp(indicator, 'i');
      return regex.test(fullMessage);
    });
  }

  /**
   * Call Routeway API with a specific response format
   */
  private async callRoutewayWithResponseFormat(
    fullPrompt: string,
    controller: AbortController,
    timeoutId: ReturnType<typeof setTimeout>,
    responseFormat: typeof AGENT_CONFIG_RESPONSE_FORMAT | typeof AGENT_CONFIG_JSON_MODE
  ): Promise<string> {
    let response: Response;
    try {
      response = await fetch(`${ROUTEWAY_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ROUTEWAY_MODEL,
          messages: [{ role: 'user', content: fullPrompt }],
          temperature: 0.3,
          top_p: 0.8,
          max_tokens: 8192,
          response_format: responseFormat,
        }),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        logger.error('Routeway API timeout after 90s');
        throw new AgentCompilationError('Agent compilation timed out. Please try again.', 'API_TIMEOUT');
      }
      throw new AgentCompilationError(fetchError.message || 'Failed to connect to AI service', 'API_ERROR', fetchError.message);
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch (bodyError: any) {
      clearTimeout(timeoutId);
      if (bodyError.name === 'AbortError') {
        throw new AgentCompilationError('Agent compilation timed out reading response.', 'API_TIMEOUT');
      }
      throw new AgentCompilationError(bodyError.message || 'Failed to read AI service response', 'API_ERROR', bodyError.message);
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error('Routeway API error', { status: response.status, body: responseText });
      throw new AgentCompilationError(`AI service request failed (status ${response.status})`, 'API_ERROR', responseText.substring(0, 500));
    }

    let result: OpenRouterResponse;
    try {
      result = JSON.parse(responseText) as OpenRouterResponse;
    } catch {
      logger.error('Routeway API returned invalid JSON', { body: responseText.substring(0, 500) });
      throw new AgentCompilationError('AI service returned an invalid response', 'API_ERROR', responseText.substring(0, 500));
    }

    if (!result.choices || result.choices.length === 0) {
      throw new AgentCompilationError('AI service returned no response', 'API_ERROR', 'Empty choices array');
    }

    if (result.usage) {
      logger.info('Routeway usage', {
        model: ROUTEWAY_MODEL,
        prompt_tokens: result.usage.prompt_tokens,
        completion_tokens: result.usage.completion_tokens,
        total_tokens: result.usage.total_tokens,
        usedJsonSchema: responseFormat.type === 'json_schema',
      });
    }

    return result.choices[0].message.content.trim();
  }

  /**
   * Call Google Gemini API for agent compilation (fallback when Routeway unavailable)
   */
  private async callGeminiAPI(
    fullPrompt: string,
    controller: AbortController,
    timeoutId: ReturnType<typeof setTimeout>
  ): Promise<string> {
    const url = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${this.apiKey}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            maxOutputTokens: 8192,
          },
        }),
        signal: controller.signal,
      });
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        logger.error('Gemini API timeout after 90s');
        throw new AgentCompilationError('Agent compilation timed out. Please try again.', 'API_TIMEOUT');
      }
      throw new AgentCompilationError(fetchError.message || 'Failed to connect to Gemini', 'API_ERROR', fetchError.message);
    }

    let responseText: string;
    try {
      responseText = await response.text();
    } catch (bodyError: any) {
      clearTimeout(timeoutId);
      throw new AgentCompilationError(bodyError.message || 'Failed to read Gemini response', 'API_ERROR', bodyError.message);
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      logger.error('Gemini API error', { status: response.status, body: responseText });
      throw new AgentCompilationError(`Gemini request failed (status ${response.status})`, 'API_ERROR', responseText.substring(0, 500));
    }

    let result: any;
    try {
      result = JSON.parse(responseText);
    } catch {
      logger.error('Gemini API returned invalid JSON', { body: responseText.substring(0, 500) });
      throw new AgentCompilationError('Gemini returned an invalid response', 'API_ERROR', responseText.substring(0, 500));
    }

    const content = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) {
      throw new AgentCompilationError('Gemini returned no content', 'API_ERROR', 'Empty response');
    }

    logger.info('Gemini compilation complete', { model: GEMINI_MODEL });
    return content.trim();
  }

  /**
   * Cleans JSON response by removing reasoning tokens, markdown code blocks, and extra whitespace
   * Handles MiniMax M2's <think>...</think> reasoning tags
   */
  private cleanJsonResponse(text: string): string {
    let cleaned = text.trim();

    // Remove MiniMax M2 reasoning tokens (<think>...</think>)
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '');

    // Remove markdown code blocks
    cleaned = cleaned.replace(/```json\n?/gi, '');
    cleaned = cleaned.replace(/```\n?/g, '');

    // Remove any leading/trailing whitespace
    cleaned = cleaned.trim();

    // If still can't find JSON, try to extract first JSON object
    if (!cleaned.startsWith('{')) {
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
    }

    return cleaned;
  }

  /**
   * Result of parsing with semantic correction
   */
  private lastCorrectionResult?: {
    corrections: CorrectionResult[];
    warnings: string[];
  };

  /**
   * Parses JSON with automatic repair for malformed LLM output
   * First tries standard JSON.parse, then uses jsonrepair library if that fails
   * Then applies semantic corrections for typos and aliases
   */
  private parseWithRepair(content: string): unknown {
    // First clean the response
    const cleaned = this.cleanJsonResponse(content);

    let parsed: unknown;

    // Try standard JSON.parse first
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // If standard parse fails, try jsonrepair
      logger.warn('Standard JSON parse failed, attempting repair', {
        contentPreview: cleaned.substring(0, 200),
      });

      // Try jsonrepair
      try {
        const repaired = jsonrepair(cleaned);
        parsed = JSON.parse(repaired);
        logger.warn('JSON repair succeeded', {
          originalLength: cleaned.length,
          repairedLength: repaired.length,
        });
      } catch (error) {
        logger.error('JSON repair also failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
          contentPreview: cleaned.substring(0, 500),
        });
        throw new AgentCompilationError(
          'AI returned invalid JSON that could not be repaired',
          'INVALID_JSON',
          cleaned.substring(0, 500)
        );
      }
    }

    // Apply semantic corrections for typos and aliases
    if (parsed && typeof parsed === 'object') {
      const correctionResult = correctConfig(parsed as Record<string, unknown>);

      // Store corrections for later use in response
      this.lastCorrectionResult = {
        corrections: correctionResult.corrections,
        warnings: correctionResult.warnings,
      };

      if (correctionResult.corrections.length > 0) {
        logger.info('Semantic corrections applied', {
          correctionCount: correctionResult.corrections.length,
          corrections: correctionResult.corrections.map(c => ({
            field: c.field,
            from: c.original,
            to: c.corrected,
            confidence: c.confidence,
            method: c.method,
          })),
        });
      }

      if (correctionResult.warnings.length > 0) {
        logger.warn('Semantic correction warnings', {
          warnings: correctionResult.warnings,
        });
      }

      return correctionResult.corrected;
    }

    return parsed;
  }

  /**
   * Validates an existing configuration
   */
  validateConfig(config: unknown): AgentConfig {
    return AgentConfigSchema.parse(config);
  }

  /**
   * Re-compiles an agent with a new prompt while preserving some settings
   */
  async recompileAgent(
    userPrompt: string,
    existingConfig: Partial<AgentConfig>
  ): Promise<CompiledAgent> {
    const newConfig = await this.compileAgent(userPrompt);

    // Optionally merge with existing config (preserve certain fields if needed)
    // For now, we just return the new config
    // In the future, you might want to preserve things like voice settings
    // if the user just wants to update the behavior but keep the same voice

    return newConfig;
  }

  /**
   * Detect language from agent configuration
   * Priority: explicit > language field > system prompt text > URL
   */
  private async detectAgentLanguage(
    agentConfig: AgentConfig,
    explicitLanguage?: string,
    businessUrl?: string
  ): Promise<DetectionResult> {
    // Extract language from config (could be string or object)
    let configLanguage: string | undefined;
    if (typeof agentConfig.language === 'string') {
      configLanguage = agentConfig.language;
    } else if (agentConfig.language?.primary) {
      configLanguage = agentConfig.language.primary;
    }

    // Detect language from multiple signals
    const detection = await languageDetectorService.detectLanguage({
      explicitLanguage: explicitLanguage || configLanguage,
      text: agentConfig.system_prompt,
      url: businessUrl,
    });

    logger.info('Language detected for agent', {
      detectedLanguage: detection.detectedLanguage,
      confidence: detection.confidence,
      region: detection.region,
      signals: detection.signals.length,
    });

    return detection;
  }

  /**
   * Select optimal providers based on detected language
   */
  private async selectProvidersForAgent(
    detectedLanguage: string,
    priority: 'quality' | 'cost' | 'latency' | 'balanced' = 'balanced'
  ): Promise<SelectedProviders> {
    logger.info('Selecting providers for agent', {
      language: detectedLanguage,
      priority,
    });

    // Select providers using the provider selector service
    const selection = providerSelectorService.selectProviders({
      language: detectedLanguage,
      priority,
      preferSpeechToSpeech: false, // Default to traditional stack
      maxLatencyMs: 500, // Target <500ms
    });

    // Log selection details
    logger.info('Providers selected', {
      mode: selection.mode,
      stt: selection.stt?.provider,
      tts: selection.tts?.provider,
      llm: selection.llm?.provider,
      e2e: selection.e2e?.provider,
      estimatedLatency: selection.estimatedLatencyMs,
      estimatedCost: selection.estimatedCostPer1000,
      confidence: selection.confidence,
      warnings: selection.warnings,
    });

    return selection;
  }

  /**
   * Enhance base config with provider and language information
   */
  private enhanceConfig(
    baseConfig: AgentConfig,
    languageDetection: DetectionResult,
    selectedProviders: SelectedProviders,
    priority: string,
    compilerCorrections?: { corrections: CorrectionResult[]; warnings: string[] },
    securityResult?: { warnings: string[]; issues: SecurityIssue[] }
  ): CompiledAgent {
    // Build provider info
    const providers = {
      mode: selectedProviders.mode,
      stt: selectedProviders.stt
        ? {
            provider: selectedProviders.stt.provider,
            model: selectedProviders.stt.model,
            tier: selectedProviders.stt.tier,
            latencyMs: selectedProviders.stt.latencyMs,
          }
        : undefined,
      tts: selectedProviders.tts
        ? {
            provider: selectedProviders.tts.provider,
            model: selectedProviders.tts.model,
            tier: selectedProviders.tts.tier,
            latencyMs: selectedProviders.tts.latencyMs,
          }
        : undefined,
      llm: selectedProviders.llm
        ? {
            provider: selectedProviders.llm.provider,
            model: selectedProviders.llm.model,
            tier: selectedProviders.llm.tier,
            latencyMs: selectedProviders.llm.latencyMs,
          }
        : undefined,
      e2e: selectedProviders.e2e
        ? {
            provider: selectedProviders.e2e.provider,
            model: selectedProviders.e2e.model,
            tier: selectedProviders.e2e.tier,
            latencyMs: selectedProviders.e2e.latencyMs,
          }
        : undefined,
    };

    // Extract primary detection signal for method
    const primarySignal = languageDetection.signals.find((s) => s.confidence > 70);
    const detectionMethod = primarySignal
      ? `${primarySignal.source} (${primarySignal.confidence}% confidence)`
      : 'multiple signals';

    // Collect warnings
    const warnings: string[] = [];
    if (selectedProviders.warnings) {
      warnings.push(...selectedProviders.warnings);
    }
    if (languageDetection.confidence < 50) {
      warnings.push(
        `Low language detection confidence (${languageDetection.confidence}%). Verify language setting.`
      );
    }

    // Include compiler warnings from semantic correction
    const compilerWarnings = compilerCorrections?.warnings ?? [];

    // Include security warnings
    const securityWarnings = securityResult?.warnings ?? [];

    return {
      ...baseConfig,
      providers,
      language_detection: {
        code: languageDetection.detectedLanguage,
        confidence: languageDetection.confidence,
        region: languageDetection.region,
        detectionMethod,
      },
      performance: {
        estimatedLatencyMs: selectedProviders.estimatedLatencyMs,
        estimatedCostPer1000: selectedProviders.estimatedCostPer1000,
        confidence: selectedProviders.confidence,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
      _compilerWarnings: compilerWarnings.length > 0 ? compilerWarnings : undefined,
      _corrections: compilerCorrections?.corrections && compilerCorrections.corrections.length > 0
        ? compilerCorrections.corrections
        : undefined,
      _securityWarnings: securityWarnings.length > 0 ? securityWarnings : undefined,
      _securityIssues: securityResult?.issues && securityResult.issues.length > 0
        ? securityResult.issues
        : undefined,
    };
  }

  /**
   * Preview provider selection without compiling agent
   * Useful for showing provider options before creation
   */
  async previewProviders(input: {
    language?: string;
    text?: string;
    url?: string;
    priority?: 'quality' | 'cost' | 'latency' | 'balanced';
  }): Promise<{
    detectedLanguage: DetectionResult;
    selectedProviders: SelectedProviders;
  }> {
    // Detect language
    const detectedLanguage = await languageDetectorService.detectLanguage({
      explicitLanguage: input.language,
      text: input.text,
      url: input.url,
    });

    // Select providers
    const selectedProviders = providerSelectorService.selectProviders({
      language: detectedLanguage.detectedLanguage,
      priority: input.priority || 'balanced',
    });

    return {
      detectedLanguage,
      selectedProviders,
    };
  }
}

/**
 * Singleton instance factory
 * Automatically selects backend based on available API keys:
 * 1. ROUTEWAY_API_KEY -> Routeway with MiniMax M2 (preferred)
 * 2. GOOGLE_GEMINI_API_KEY or GOOGLE_API_KEY -> Gemini Flash (fallback)
 */
let compilerInstance: AgentCompilerService | null = null;

export function getAgentCompiler(apiKey?: string): AgentCompilerService {
  if (!compilerInstance) {
    // Try Routeway first (preferred for coding/agentic tasks)
    const routewayKey = apiKey || process.env.ROUTEWAY_API_KEY;
    if (routewayKey) {
      logger.info(`🔑 Using Routeway API (MiniMax M2): ${routewayKey.substring(0, 8)}***`);
      compilerInstance = new AgentCompilerService(routewayKey, 'routeway');
      return compilerInstance;
    }

    // Fallback to Gemini
    const geminiKey = process.env.GEMINI_COMPILER_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (geminiKey) {
      logger.info(`🔑 Using Gemini API (fallback): ${geminiKey.substring(0, 8)}***`);
      compilerInstance = new AgentCompilerService(geminiKey, 'gemini');
      return compilerInstance;
    }

    // No API keys available
    throw new Error(
      'No AI compiler API key configured. Set ROUTEWAY_API_KEY (preferred) or GOOGLE_GEMINI_API_KEY (fallback). ' +
      'Get a Routeway API key from https://routeway.ai/'
    );
  }
  return compilerInstance;
}

/**
 * Reset singleton instance (useful for testing or switching API keys)
 */
export function resetAgentCompiler(): void {
  compilerInstance = null;
  logger.info('🔄 Agent compiler instance reset');
}
