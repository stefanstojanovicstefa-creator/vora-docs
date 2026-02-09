/**
 * Context Summary Service
 *
 * AI-powered context summary generation using GPT-OSS-120B via OpenRouter (free tier).
 * Runs on each blueprint update, creating human-readable summaries for voice session resumption.
 *
 * Model: GPT-OSS-120B (117B MoE, 5.1B active params)
 * Provider: OpenRouter (free tier)
 * Endpoint: https://openrouter.ai/api/v1
 */

import OpenAI from 'openai';
import { createLogger } from '../utils/logger';
import { modelRouter } from './ai/model-router.service';

const logger = createLogger('ContextSummary.service');

// Use model router to select model for context summarization
const routedModel = modelRouter.getModel('context-summary');

const openai = new OpenAI({
  baseURL: routedModel.route.baseUrl,
  apiKey: process.env.OPENROUTER_API_KEY || process.env.ROUTEWAY_API_KEY || '',
  defaultHeaders: {
    'HTTP-Referer': process.env.APP_URL || 'https://vora.ai',
    'X-Title': 'Vora Voice AI',
  },
});

const MODEL = routedModel.route.model;

export interface ForgeBlueprint {
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
  integrations?: string[];
}

export interface SummaryInput {
  blueprint: ForgeBlueprint;
  messages?: Array<{ role: 'user' | 'assistant'; content: string }>;
  turnCount?: number;
}

/**
 * Generate AI-powered context summary for voice session resumption.
 * Falls back to simple summary if AI generation fails.
 */
export async function generateSummary(input: SummaryInput): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    logger.warn('OPENROUTER_API_KEY not configured, falling back to simple summary');
    return generateSimpleSummary(input.blueprint);
  }

  // Build prompt outside try/catch so it's accessible in fallback
  const filledFields = extractFilledFields(input.blueprint);
  const coveredTopics = inferCoveredTopics(input.blueprint);
  const totalFields = 11; // industry, agent_name, role, main_goal, primary_tasks, personality_vibe, opening_message, handoff_destinations, handoff_rules, knowledge_base_plan, integrations
  const progress = Math.round((coveredTopics.length / totalFields) * 100);

  const recentMessages = (input.messages || [])
    .slice(-6)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');

  const prompt = [
    'You are a context summarizer for Vora Voice AI agent creation sessions.',
    'Create a concise, human-readable summary of the agent blueprint progress for voice session resumption.',
    '',
    'STYLE:',
    '- Brief (2-3 sentences max)',
    '- Natural conversational tone',
    '- Focus on what\'s been defined and what\'s missing',
    '- NO jargon, NO technical field names',
    '',
    'BLUEPRINT FIELDS:',
    JSON.stringify(filledFields, null, 2),
    '',
    'COVERED TOPICS:',
    coveredTopics.join(', '),
    '',
    'PROGRESS:',
    `${progress}% complete (${coveredTopics.length}/${totalFields} fields)`,
    '',
    recentMessages ? `RECENT CONVERSATION:\n${recentMessages}\n` : '',
    'Generate a summary that helps the voice agent understand where we left off and what to ask next.',
  ].join('\n');

  try {
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200,
    });

    const summary = completion.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      logger.warn('AI summary generation returned empty result, using fallback');
      return generateSimpleSummary(input.blueprint);
    }

    // Log routed call metrics
    modelRouter.logRoutedCall(
      'context-summary',
      MODEL,
      completion.usage?.prompt_tokens ?? 0,
      completion.usage?.completion_tokens ?? 0,
      Date.now() - startTime,
    );

    logger.info('AI summary generated successfully', {
      length: summary.length,
      progress,
      coveredTopics: coveredTopics.length,
    });

    return summary;
  } catch (error) {
    // Try fallback model before falling back to simple summary
    try {
      const fallbackRoute = routedModel.fallback;
      logger.warn('Primary model failed, trying fallback model', { fallbackModel: fallbackRoute.model, error });

      const fallbackClient = new OpenAI({
        baseURL: fallbackRoute.baseUrl,
        apiKey: process.env.ROUTEWAY_API_KEY || process.env.OPENROUTER_API_KEY || '',
        defaultHeaders: {
          'HTTP-Referer': process.env.APP_URL || 'https://vora.ai',
          'X-Title': 'Vora Voice AI',
        },
      });

      const startTime = Date.now();
      const fallbackCompletion = await fallbackClient.chat.completions.create({
        model: fallbackRoute.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 200,
      });

      const fallbackSummary = fallbackCompletion.choices?.[0]?.message?.content?.trim();
      if (fallbackSummary) {
        modelRouter.logRoutedCall(
          'context-summary',
          fallbackRoute.model,
          fallbackCompletion.usage?.prompt_tokens ?? 0,
          fallbackCompletion.usage?.completion_tokens ?? 0,
          Date.now() - startTime,
          true,
        );
        return fallbackSummary;
      }
    } catch (fallbackError) {
      logger.error('Fallback model also failed', { fallbackError });
    }

    logger.error('Failed to generate AI summary, falling back to simple summary', { error });
    return generateSimpleSummary(input.blueprint);
  }
}

/**
 * Generate a simple rule-based summary when AI is unavailable.
 * This is the fallback mechanism.
 */
export function generateSimpleSummary(blueprint: ForgeBlueprint): string {
  const coveredTopics = inferCoveredTopics(blueprint);
  const totalFields = 11;
  const progress = Math.round((coveredTopics.length / totalFields) * 100);

  const parts: string[] = [];

  // Opening context
  if (blueprint.agent_name) {
    parts.push(`Creating agent "${blueprint.agent_name}"`);
  } else {
    parts.push('Creating a new voice agent');
  }

  // Industry/role context
  if (blueprint.industry && blueprint.role) {
    parts.push(`for ${blueprint.industry} (${blueprint.role})`);
  } else if (blueprint.industry) {
    parts.push(`for ${blueprint.industry}`);
  } else if (blueprint.role) {
    parts.push(`as ${blueprint.role}`);
  }

  // Progress statement
  parts.push(`- ${progress}% complete.`);

  // What's defined
  if (coveredTopics.length > 0) {
    parts.push(`Defined: ${coveredTopics.join(', ')}.`);
  }

  // What's missing (pick the most important)
  const missingTopics: string[] = [];
  if (!blueprint.agent_name) missingTopics.push('agent name');
  if (!blueprint.main_goal) missingTopics.push('main goal');
  if (!blueprint.primary_tasks || blueprint.primary_tasks.length === 0) missingTopics.push('primary tasks');
  if (!blueprint.personality_vibe) missingTopics.push('personality');
  if (!blueprint.opening_message) missingTopics.push('opening message');

  if (missingTopics.length > 0) {
    const first3 = missingTopics.slice(0, 3);
    parts.push(`Still need: ${first3.join(', ')}.`);
  }

  return parts.join(' ');
}

/**
 * Extract filled fields from blueprint (for prompt context).
 */
export function extractFilledFields(blueprint: ForgeBlueprint): Record<string, unknown> {
  const filled: Record<string, unknown> = {};

  if (blueprint.industry) filled.industry = blueprint.industry;
  if (blueprint.agent_name) filled.agent_name = blueprint.agent_name;
  if (blueprint.role) filled.role = blueprint.role;
  if (blueprint.main_goal) filled.main_goal = blueprint.main_goal;
  if (blueprint.primary_tasks && blueprint.primary_tasks.length > 0) filled.primary_tasks = blueprint.primary_tasks;
  if (blueprint.personality_vibe) filled.personality_vibe = blueprint.personality_vibe;
  if (blueprint.opening_message) filled.opening_message = blueprint.opening_message;
  if (blueprint.handoff_destinations) filled.handoff_destinations = blueprint.handoff_destinations;
  if (blueprint.handoff_rules) filled.handoff_rules = blueprint.handoff_rules;
  if (blueprint.knowledge_base_plan && blueprint.knowledge_base_plan.length > 0) filled.knowledge_base_plan = blueprint.knowledge_base_plan;
  if (blueprint.integrations && blueprint.integrations.length > 0) filled.integrations = blueprint.integrations;
  if (blueprint.language) filled.language = blueprint.language;

  return filled;
}

/**
 * Infer which topics have been covered (for progress calculation).
 */
export function inferCoveredTopics(blueprint: ForgeBlueprint): string[] {
  const topics: string[] = [];

  if (blueprint.industry) topics.push('industry');
  if (blueprint.agent_name) topics.push('name');
  if (blueprint.role) topics.push('role');
  if (blueprint.main_goal) topics.push('goal');
  if (blueprint.primary_tasks && blueprint.primary_tasks.length > 0) topics.push('tasks');
  if (blueprint.personality_vibe) topics.push('personality');
  if (blueprint.opening_message) topics.push('greeting');
  if (blueprint.handoff_destinations) topics.push('handoff');
  if (blueprint.handoff_rules) topics.push('handoff rules');
  if (blueprint.knowledge_base_plan && blueprint.knowledge_base_plan.length > 0) topics.push('knowledge base');
  if (blueprint.integrations && blueprint.integrations.length > 0) topics.push('integrations');

  return topics;
}

/**
 * Format summary for agent prompt injection.
 * This creates the text that gets injected into the voice agent's system prompt.
 */
export function formatForAgentPrompt(summary: string, blueprint: ForgeBlueprint): string {
  const coveredTopics = inferCoveredTopics(blueprint);
  const totalFields = 11;
  const progress = Math.round((coveredTopics.length / totalFields) * 100);

  const sections: string[] = [];

  // Session context header
  sections.push('[RESUMING SESSION]');
  sections.push('');

  // Progress bar (visual indicator)
  const bars = Math.round(progress / 10);
  const progressBar = '█'.repeat(bars) + '░'.repeat(10 - bars);
  sections.push(`Progress: ${progressBar} ${progress}%`);
  sections.push('');

  // AI-generated summary
  sections.push('CONTEXT SUMMARY:');
  sections.push(summary);
  sections.push('');

  // Quick reference - what's defined
  if (coveredTopics.length > 0) {
    sections.push('DEFINED:');
    sections.push(coveredTopics.map(t => `✓ ${t}`).join('\n'));
    sections.push('');
  }

  // Quick reference - what's missing
  const allTopics = ['industry', 'name', 'role', 'goal', 'tasks', 'personality', 'greeting', 'handoff', 'handoff rules', 'knowledge base', 'integrations'];
  const missingTopics = allTopics.filter(t => !coveredTopics.includes(t));

  if (missingTopics.length > 0) {
    sections.push('STILL NEEDED:');
    sections.push(missingTopics.map(t => `○ ${t}`).join('\n'));
    sections.push('');
  }

  sections.push('[/RESUMING SESSION]');

  return sections.join('\n');
}

/**
 * Service instance for external use.
 */
export const contextSummaryService = {
  generateSummary,
  generateSimpleSummary,
  extractFilledFields,
  inferCoveredTopics,
  formatForAgentPrompt,
};
