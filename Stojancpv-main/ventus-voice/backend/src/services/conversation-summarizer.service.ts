/**
 * Conversation Summarizer Service
 *
 * Generates AI-powered summaries of conversations for efficient storage
 * and later retrieval. Uses Gemini Pro for high-quality summarization.
 *
 * RESPONSIBILITIES:
 * - Generate brief and detailed summaries
 * - Extract key topics, action items, and questions
 * - Analyze sentiment trajectory
 * - Extract facts for long-term memory storage
 *
 * @module ConversationSummarizerService
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLogger } from '../utils/logger';
import { getCacheService } from './cache.service';
import Sentry from '@sentry/node';
import { modelRouter } from './ai/model-router.service';

const logger = createLogger('ConversationSummarizer');

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface ConversationSummary {
  briefSummary: string;          // 1-2 sentence summary
  detailedSummary: string;       // Full summary with context
  keyTopics: string[];           // Main topics discussed
  actionItems: ActionItem[];     // Tasks or follow-ups
  questionsAsked: string[];      // Questions from the user
  objectionsRaised: string[];    // Concerns or objections
  sentimentTrajectory: 'improving' | 'declining' | 'stable';
  extractedFacts: ExtractedFact[]; // Facts for long-term memory
  overallOutcome: 'positive' | 'negative' | 'neutral';
}

export interface ActionItem {
  description: string;
  assignee: 'agent' | 'customer' | 'business';
  priority: 'high' | 'medium' | 'low';
  deadline?: string;
}

export interface ExtractedFact {
  content: string;
  type: 'preference' | 'personal_info' | 'intent' | 'feedback' | 'history';
  confidence: number;  // 0.0-1.0
}

export interface SummarizerOptions {
  model?: string;          // LLM model to use
  timeout?: number;        // Timeout in ms
  includeTranscript?: boolean;  // Include raw transcript in output
  maxMessages?: number;    // Max messages to process (default: no limit)
}

export interface SummarizationResult {
  summary: ConversationSummary;
  tokensUsed: number;
  generationTimeMs: number;
  modelUsed: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Use model router for summarization task - routes to appropriate model tier
const ROUTED_SUMMARIZATION = modelRouter.getModel('summarization');
const DEFAULT_MODEL = 'gemini-1.5-pro'; // Kept as Gemini SDK model name (router guides cost tracking)
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const MAX_TRANSCRIPT_CHARS = 50000; // ~12.5k tokens

// Summarization prompt template
const SUMMARIZATION_PROMPT = `You are analyzing a conversation between a customer and a voice AI assistant.

CONVERSATION TRANSCRIPT:
{transcript}

Analyze this conversation and provide a JSON response with the following structure:

{
  "briefSummary": "1-2 sentence high-level summary of what happened",
  "detailedSummary": "Comprehensive 3-5 sentence summary capturing key details, context, and outcomes",
  "keyTopics": ["topic1", "topic2", ...],
  "actionItems": [
    {
      "description": "What needs to be done",
      "assignee": "agent|customer|business",
      "priority": "high|medium|low",
      "deadline": "optional deadline or timeframe"
    }
  ],
  "questionsAsked": ["Question 1?", "Question 2?", ...],
  "objectionsRaised": ["Objection or concern 1", ...],
  "sentimentTrajectory": "improving|declining|stable",
  "extractedFacts": [
    {
      "content": "Specific fact about the customer",
      "type": "preference|personal_info|intent|feedback|history",
      "confidence": 0.0-1.0
    }
  ],
  "overallOutcome": "positive|negative|neutral"
}

IMPORTANT GUIDELINES:
1. Extract only EXPLICIT facts - don't infer or assume
2. Preferences should be specific (e.g., "prefers email over phone" not "likes communication")
3. Personal info includes name, location, company, role, etc.
4. Intent captures what the customer wants to achieve
5. Feedback is opinions about products/services
6. History is past interactions or purchases mentioned
7. Confidence should reflect how explicitly the fact was stated

Respond with JSON only, no additional text.`;

// ============================================================================
// CONVERSATION SUMMARIZER SERVICE
// ============================================================================

export class ConversationSummarizerService {
  private prisma: PrismaClient;
  private gemini: GoogleGenerativeAI | null = null;
  private cache = getCacheService();
  private options: Required<SummarizerOptions>;

  constructor(prisma: PrismaClient, options: SummarizerOptions = {}) {
    this.prisma = prisma;
    this.options = {
      model: options.model || DEFAULT_MODEL,
      timeout: options.timeout || DEFAULT_TIMEOUT,
      includeTranscript: options.includeTranscript ?? false,
      maxMessages: options.maxMessages || 0,
    };

    this.initializeGemini();
  }

  private initializeGemini(): void {
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (apiKey) {
      this.gemini = new GoogleGenerativeAI(apiKey);
    } else {
      logger.warn('Gemini API key not configured - summarization disabled');
    }
  }

  /**
   * Summarize a conversation from messages
   */
  async summarize(
    messages: ConversationMessage[],
    sessionId?: string
  ): Promise<SummarizationResult> {
    const startTime = Date.now();

    if (!this.gemini) {
      throw new Error('Gemini not initialized - cannot summarize');
    }

    // Apply message limit if set
    let processMessages = messages;
    if (this.options.maxMessages > 0) {
      processMessages = messages.slice(-this.options.maxMessages);
    }

    // Build transcript string
    const transcript = this.buildTranscript(processMessages);

    // Truncate if too long
    const truncatedTranscript = transcript.length > MAX_TRANSCRIPT_CHARS
      ? transcript.slice(0, MAX_TRANSCRIPT_CHARS) + '\n[Transcript truncated due to length]'
      : transcript;

    try {
      const model = this.gemini.getGenerativeModel({
        model: this.options.model,
        generationConfig: {
          temperature: 0.3, // Low temperature for consistent analysis
          maxOutputTokens: 2048,
        },
      });

      const prompt = SUMMARIZATION_PROMPT.replace('{transcript}', truncatedTranscript);

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);

      let result;
      try {
        result = await model.generateContent(prompt);
        clearTimeout(timeoutId);
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }

      const responseText = result.response.text().trim();
      const tokensUsed = result.response.usageMetadata?.totalTokenCount || 0;

      // Parse JSON response
      const summary = this.parseResponse(responseText);

      const generationTimeMs = Date.now() - startTime;

      logger.info('Conversation summarized', {
        sessionId,
        messageCount: processMessages.length,
        tokensUsed,
        generationTimeMs,
        factsExtracted: summary.extractedFacts.length,
      });

      return {
        summary,
        tokensUsed,
        generationTimeMs,
        modelUsed: this.options.model,
      };
    } catch (error) {
      logger.error('Summarization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        sessionId,
      });
      Sentry.captureException(error, {
        tags: { operation: 'conversation_summarization' },
        extra: { sessionId, messageCount: processMessages.length },
      });
      throw error;
    }
  }

  /**
   * Summarize a session from the database
   */
  async summarizeSession(sessionId: string): Promise<SummarizationResult | null> {
    try {
      // Fetch messages from database
      const messages = await this.prisma.agent_messages.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' },
        select: {
          role: true,
          content: true,
          createdAt: true,
        },
      });

      if (messages.length === 0) {
        logger.warn('No messages found for session', { sessionId });
        return null;
      }

      // Convert to ConversationMessage format
      const conversationMessages: ConversationMessage[] = messages.map((m) => ({
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        timestamp: m.createdAt,
      }));

      return await this.summarize(conversationMessages, sessionId);
    } catch (error) {
      logger.error('Failed to summarize session', {
        sessionId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Store summary in database
   */
  async storeSummary(
    sessionId: string,
    result: SummarizationResult,
    callId?: string
  ): Promise<string> {
    try {
      const summary = await this.prisma.conversation_summaries.create({
        data: {
          sessionId,
          callId,
          summaryType: 'detailed',
          summaryText: result.summary.detailedSummary,
          keyTopics: result.summary.keyTopics,
          actionItems: result.summary.actionItems as any,
          questionsAsked: result.summary.questionsAsked,
          objectionsRaised: result.summary.objectionsRaised,
          sentimentTrajectory: result.summary.sentimentTrajectory,
          modelUsed: result.modelUsed,
          tokensUsed: result.tokensUsed,
          generationTimeMs: result.generationTimeMs,
        },
      });

      logger.info('Summary stored', { sessionId, summaryId: summary.id });
      return summary.id;
    } catch (error) {
      // Handle duplicate summary (session already summarized)
      if ((error as any).code === 'P2002') {
        logger.warn('Summary already exists for session', { sessionId });

        // Update existing summary
        const updated = await this.prisma.conversation_summaries.update({
          where: { sessionId },
          data: {
            summaryText: result.summary.detailedSummary,
            keyTopics: result.summary.keyTopics,
            actionItems: result.summary.actionItems as any,
            questionsAsked: result.summary.questionsAsked,
            objectionsRaised: result.summary.objectionsRaised,
            sentimentTrajectory: result.summary.sentimentTrajectory,
            modelUsed: result.modelUsed,
            tokensUsed: result.tokensUsed,
            generationTimeMs: result.generationTimeMs,
            generatedAt: new Date(),
          },
        });
        return updated.id;
      }
      throw error;
    }
  }

  /**
   * Build transcript string from messages
   */
  private buildTranscript(messages: ConversationMessage[]): string {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        const role = m.role === 'user' ? 'Customer' : 'Agent';
        const timestamp = m.timestamp
          ? ` [${m.timestamp.toISOString()}]`
          : '';
        return `${role}${timestamp}: ${m.content}`;
      })
      .join('\n\n');
  }

  /**
   * Parse LLM response into ConversationSummary
   */
  private parseResponse(responseText: string): ConversationSummary {
    // Clean up JSON from markdown code blocks
    let jsonStr = responseText;
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    }
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }

    try {
      const parsed = JSON.parse(jsonStr.trim());

      // Validate and normalize response
      return {
        briefSummary: parsed.briefSummary || 'No summary available',
        detailedSummary: parsed.detailedSummary || parsed.briefSummary || 'No summary available',
        keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
        actionItems: this.validateActionItems(parsed.actionItems),
        questionsAsked: Array.isArray(parsed.questionsAsked) ? parsed.questionsAsked : [],
        objectionsRaised: Array.isArray(parsed.objectionsRaised) ? parsed.objectionsRaised : [],
        sentimentTrajectory: this.validateSentiment(parsed.sentimentTrajectory),
        extractedFacts: this.validateFacts(parsed.extractedFacts),
        overallOutcome: this.validateOutcome(parsed.overallOutcome),
      };
    } catch (parseError) {
      logger.error('Failed to parse summarization response', {
        error: parseError instanceof Error ? parseError.message : 'Unknown error',
        responsePreview: responseText.slice(0, 200),
      });

      // Return minimal summary on parse failure
      return {
        briefSummary: 'Summary generation failed',
        detailedSummary: 'Unable to parse conversation summary',
        keyTopics: [],
        actionItems: [],
        questionsAsked: [],
        objectionsRaised: [],
        sentimentTrajectory: 'stable',
        extractedFacts: [],
        overallOutcome: 'neutral',
      };
    }
  }

  /**
   * Validate action items array
   */
  private validateActionItems(items: any): ActionItem[] {
    if (!Array.isArray(items)) return [];

    return items
      .filter((item) => item && typeof item.description === 'string')
      .map((item) => ({
        description: item.description,
        assignee: ['agent', 'customer', 'business'].includes(item.assignee)
          ? item.assignee
          : 'business',
        priority: ['high', 'medium', 'low'].includes(item.priority)
          ? item.priority
          : 'medium',
        deadline: item.deadline || undefined,
      }));
  }

  /**
   * Validate sentiment value
   */
  private validateSentiment(
    sentiment: any
  ): 'improving' | 'declining' | 'stable' {
    if (['improving', 'declining', 'stable'].includes(sentiment)) {
      return sentiment;
    }
    return 'stable';
  }

  /**
   * Validate extracted facts array
   */
  private validateFacts(facts: any): ExtractedFact[] {
    if (!Array.isArray(facts)) return [];

    const validTypes = ['preference', 'personal_info', 'intent', 'feedback', 'history'];

    return facts
      .filter((fact) => fact && typeof fact.content === 'string')
      .map((fact) => ({
        content: fact.content,
        type: validTypes.includes(fact.type) ? fact.type : 'preference',
        confidence: typeof fact.confidence === 'number'
          ? Math.max(0, Math.min(1, fact.confidence))
          : 0.7,
      }));
  }

  /**
   * Validate outcome value
   */
  private validateOutcome(outcome: any): 'positive' | 'negative' | 'neutral' {
    if (['positive', 'negative', 'neutral'].includes(outcome)) {
      return outcome;
    }
    return 'neutral';
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

let serviceInstance: ConversationSummarizerService | null = null;

export function getConversationSummarizerService(
  prisma: PrismaClient,
  options?: SummarizerOptions
): ConversationSummarizerService {
  if (!serviceInstance) {
    serviceInstance = new ConversationSummarizerService(prisma, options);
  }
  return serviceInstance;
}
