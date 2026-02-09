/**
 * OpenRouter Service
 * Integration with GPT-OSS-120B via OpenRouter API
 * Uses OpenAI-compatible API client
 */

import OpenAI from 'openai';
import { Logger } from '../../utils/simple-logger';

// Tool definition for auto-generated tools
export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, { type: string; description: string; required?: boolean }>;
}

// MCP suggestion from industry analysis
export interface MCPSuggestion {
  id: string;
  name: string;
  reason: string;
}

// Recommended integrations based on industry detection
export interface RecommendedIntegrations {
  industry: string;
  region: string;
  primary_mcps: MCPSuggestion[];
  optional_mcps: MCPSuggestion[];
  auto_tools: ToolDefinition[];
  workflow_pack?: {
    name: string;
    description: string;
  };
}

// Reuse the same response type structure with enhanced integrations
export interface OpenRouterAnalysisResponse {
  brand_book: {
    colors: {
      primary: string[];
      secondary: string[];
      accent: string[];
      neutral: string[];
    };
    typography: {
      heading: { fontFamily: string; fontWeight: string; fontSize: string[] };
      body: { fontFamily: string; fontWeight: string; fontSize: string[] };
    };
    brandVoice: {
      tone: string[];
      personality: string[];
      adjectives: string[];
    };
    coreValues: string[];
    missionStatement: string;
    visionStatement: string;
    positioning: {
      targetAudience: string;
      uniqueValueProposition: string;
      differentiators: string[];
    };
  };
  system_prompt: {
    identity: { role: string; expertise: string[] };
    communicationStyle: { tone: string; language: string; responseLength: string };
    guidelines: { dos: string[]; donts: string[] };
    guardrails: { topicRestrictions: string[]; responseConstraints: string[] };
    promptTemplate: string;
  };
  knowledge_base: {
    companyInfo: {
      name: string;
      description: string;
      industry: string;
      location: string;
    };
    products: Array<{
      name: string;
      description: string;
      category: string;
      features: string[];
      pricing: string;
    }>;
    services: Array<{
      name: string;
      description: string;
      category: string;
      benefits: string[];
    }>;
    faqs: Array<{ question: string; answer: string; category: string }>;
    policies: { privacy: string; terms: string };
    contact: {
      email: string;
      phone: string;
      address: string;
      supportHours: string;
    };
  };
  // NEW: Industry-based integration recommendations
  recommended_integrations?: RecommendedIntegrations;
  // Auto-detected website language (ISO 639-1 code)
  detected_language?: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenRouterUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
}

const DEFAULT_CONFIG: Partial<OpenRouterConfig> = {
  baseURL: 'https://api.routeway.ai/v1', // Routeway API (OpenAI-compatible)
  model: 'minimax-m2:free', // MiniMax M2 - good instruction following, handles complex JSON
  maxTokens: 8000,
  temperature: 0.7,
};

// GPT-OSS-120B:free pricing (free tier)
const PRICING = {
  inputTokensPerMillion: 0, // Free
  outputTokensPerMillion: 0, // Free
};

export class OpenRouterService {
  private client: OpenAI;
  private config: Required<OpenRouterConfig>;
  private logger: Logger;

  constructor(config: OpenRouterConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as Required<OpenRouterConfig>;

    this.client = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseURL,
      timeout: 60000, // 60-second timeout
    });

    this.logger = new Logger('OpenRouterService');

    // Debug logging (remove after fixing)
    this.logger.info(`Initialized with baseURL: ${this.config.baseURL}`);
    this.logger.info(`API key prefix: ${this.config.apiKey.substring(0, 10)}...`);
    this.logger.info(`API key length: ${this.config.apiKey.length}`);
  }

  /**
   * Analyze brand from scraped content
   */
  async analyzeBrand(
    websiteUrl: string,
    scrapedPages: Array<{ url: string; title: string; content: string; textContent: string }>
  ): Promise<{ analysis: OpenRouterAnalysisResponse; usage: OpenRouterUsage }> {
    try {
      this.logger.info(
        `Starting brand analysis for ${websiteUrl} with ${scrapedPages.length} pages`
      );

      // Construct the prompt
      const prompt = this.constructBrandAnalysisPrompt(websiteUrl, scrapedPages);

      this.logger.debug(`Prompt length: ${prompt.length} characters`);

      // Call OpenRouter API
      const startTime = Date.now();
      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content:
              'You are a brand analysis expert. Analyze website content and generate comprehensive brand guidelines, system prompts for AI agents, and knowledge bases. Always respond with valid JSON only, no additional text.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        // NOTE: response_format removed - MiniMax M2 doesn't support JSON mode
        // JSON output is enforced via system prompt instructions
      });

      const apiDurationMs = Date.now() - startTime;
      this.logger.info('Routeway API call completed', {
        event: 'routeway_api_call',
        durationMs: apiDurationMs,
        model: this.config.model,
        tokensUsed: response.usage?.total_tokens || 0,
      });

      // Log full response for debugging (truncated)
      this.logger.debug('OpenRouter response received', {
        model: response.model,
        id: response.id,
        hasChoices: !!response.choices,
        choicesCount: response.choices?.length ?? 0,
        usage: response.usage,
      });

      // Extract response - use optional chaining before array access to handle undefined choices
      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        // Log the full response when empty to help debug API issues
        this.logger.error('Empty response from OpenRouter', {
          hasChoices: !!response.choices,
          choicesLength: response.choices?.length,
          firstChoice: response.choices?.[0],
          fullResponse: JSON.stringify(response).substring(0, 500),
        });
        throw new Error('No content in OpenRouter response');
      }

      // Parse JSON response with MiniMax M2 reasoning tag handling
      let analysis: OpenRouterAnalysisResponse;
      try {
        const cleaned = this.cleanJsonResponse(content);
        analysis = JSON.parse(cleaned);
      } catch (error) {
        this.logger.error('Failed to parse OpenRouter response as JSON', error);
        throw new Error('Invalid JSON response from OpenRouter');
      }

      // Calculate usage and cost
      const usage = this.calculateUsage(response.usage!);

      this.logger.info(
        `Brand analysis completed - Tokens: ${usage.totalTokens}, Cost: $${usage.costUsd.toFixed(4)}`
      );

      // Validate response structure
      this.validateAnalysisResponse(analysis);

      return { analysis, usage };
    } catch (error) {
      this.logger.error('Brand analysis failed', error);
      throw error;
    }
  }

  /**
   * Construct the brand analysis prompt
   */
  private constructBrandAnalysisPrompt(
    websiteUrl: string,
    scrapedPages: Array<{ url: string; title: string; textContent: string }>
  ): string {
    // Combine all scraped content
    const contentSections = scrapedPages
      .map(
        (page, index) => `
=== PAGE ${index + 1}: ${page.title} ===
URL: ${page.url}

${page.textContent}
`
      )
      .join('\n\n');

    return `
# Brand Analysis Request

Analyze the following website content from **${websiteUrl}** and generate a comprehensive brand analysis.

## Task

Generate three structured outputs:

1. **Brand Book**: Visual identity, brand voice, core values, positioning
2. **System Prompt**: AI agent configuration including personality, guidelines, and communication style
3. **Knowledge Base**: Structured information about products, services, FAQs, and policies

## Website Content

${contentSections}

## Output Format

Respond with ONLY valid JSON in this exact structure:

\`\`\`json
{
  "brand_book": {
    "colors": {
      "primary": ["#XXXXXX"],
      "secondary": ["#XXXXXX"],
      "accent": ["#XXXXXX"],
      "neutral": ["#XXXXXX"]
    },
    "typography": {
      "heading": {
        "fontFamily": "Font Name",
        "fontWeight": "600",
        "fontSize": ["32px", "24px", "20px"]
      },
      "body": {
        "fontFamily": "Font Name",
        "fontWeight": "400",
        "fontSize": ["16px", "14px"]
      }
    },
    "brandVoice": {
      "tone": ["adjective1", "adjective2", "adjective3"],
      "personality": ["trait1", "trait2", "trait3"],
      "adjectives": ["word1", "word2", "word3"]
    },
    "coreValues": ["value1", "value2", "value3"],
    "missionStatement": "Mission statement text",
    "visionStatement": "Vision statement text",
    "positioning": {
      "targetAudience": "Description of target audience",
      "uniqueValueProposition": "What makes this brand unique",
      "differentiators": ["differentiator1", "differentiator2"]
    }
  },
  "system_prompt": {
    "identity": {
      "role": "Role description",
      "expertise": ["area1", "area2", "area3"]
    },
    "communicationStyle": {
      "tone": "Tone description",
      "language": "Language style description",
      "responseLength": "Length guidance"
    },
    "guidelines": {
      "dos": ["guideline1", "guideline2", "guideline3"],
      "donts": ["restriction1", "restriction2", "restriction3"]
    },
    "guardrails": {
      "topicRestrictions": ["restricted topic1", "restricted topic2"],
      "responseConstraints": ["constraint1", "constraint2"]
    },
    "promptTemplate": "You are a [role] for [company]. [Full system prompt text here...]"
  },
  "knowledge_base": {
    "companyInfo": {
      "name": "Company Name",
      "description": "Company description",
      "industry": "Industry",
      "location": "Location"
    },
    "products": [
      {
        "name": "Product name",
        "description": "Product description",
        "category": "Category",
        "features": ["feature1", "feature2"],
        "pricing": "Pricing info"
      }
    ],
    "services": [
      {
        "name": "Service name",
        "description": "Service description",
        "category": "Category",
        "benefits": ["benefit1", "benefit2"]
      }
    ],
    "faqs": [
      {
        "question": "Question text",
        "answer": "Answer text",
        "category": "Category"
      }
    ],
    "policies": {
      "privacy": "Privacy policy summary",
      "terms": "Terms of service summary"
    },
    "contact": {
      "email": "email@example.com",
      "phone": "+1234567890",
      "address": "Address",
      "supportHours": "Mon-Fri 9am-5pm"
    }
  }
}
\`\`\`

**Important**:
- Respond with ONLY the JSON object, no markdown code blocks, no explanations
- Ensure all fields are filled with meaningful data based on the website content
- If information is not available for a field, use reasonable defaults or omit optional fields
- The system_prompt.promptTemplate should be a complete, production-ready prompt for a voice AI agent

## Additional Analysis: Industry & Integration Detection

Also analyze and provide a "recommended_integrations" section:

\`\`\`json
{
  "recommended_integrations": {
    "industry": "restaurant | healthcare | salon_spa | ecommerce | saas | real_estate | general",
    "region": "Global | India | SE_Asia | MENA",
    "primary_mcps": [
      {"id": "google_calendar", "name": "Google Calendar", "reason": "For booking reservations"},
      {"id": "whatsapp", "name": "WhatsApp", "reason": "For sending confirmations"}
    ],
    "optional_mcps": [
      {"id": "google_sheets", "name": "Google Sheets", "reason": "For logging orders"}
    ],
    "auto_tools": [
      {"name": "book_reservation", "description": "Book a table for the customer"},
      {"name": "check_availability", "description": "Check available times"}
    ],
    "workflow_pack": {
      "name": "Booking Agent",
      "description": "Calendar + WhatsApp confirmations + Payment"
    }
  }
}
\`\`\`

Industry detection guidelines:
- **restaurant**: Food service, dining, cafes, bars, catering
- **healthcare**: Medical clinics, dental, therapy, wellness centers
- **salon_spa**: Hair salons, spas, beauty services, nail bars
- **ecommerce**: Online stores, retail, product sales
- **saas**: Software products, tech services, B2B platforms
- **real_estate**: Property listings, real estate agencies, rentals
- **general**: Anything that doesn't fit above categories

Region detection (look for indicators):
- **India**: .in domain, INR prices, Indian cities, Hindi text
- **SE_Asia**: .sg/.my/.th/.vn domains, SGD/MYR prices, Southeast Asian cities
- **MENA**: .ae/.sa/.eg domains, AED/SAR prices, Arabic text, Middle Eastern cities
- **Global**: Default for unclear or multi-region

## Additional Analysis: Website Language Detection

Also include a top-level "detected_language" field with the ISO 639-1 two-letter language code of the website's primary content language.

Detection rules:
- Analyze the actual text content (not just meta tags)
- Use the dominant language of the body content
- Common codes: "en" (English), "ja" (Japanese), "fr" (French), "de" (German), "es" (Spanish), "pt" (Portuguese), "ar" (Arabic), "zh" (Chinese), "ko" (Korean), "hi" (Hindi), "ru" (Russian), "it" (Italian), "nl" (Dutch), "pl" (Polish), "tr" (Turkish), "sr" (Serbian), "hr" (Croatian), "cs" (Czech), "sv" (Swedish), "da" (Danish), "fi" (Finnish), "el" (Greek), "th" (Thai), "vi" (Vietnamese), "id" (Indonesian)
- If multilingual, use the majority language
- Default to "en" only if genuinely English

Example:
\`\`\`json
{
  "detected_language": "ja"
}
\`\`\`
`;
  }

  /**
   * Calculate usage and cost
   */
  private calculateUsage(usage: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  }): OpenRouterUsage {
    const promptTokens = usage.prompt_tokens || 0;
    const completionTokens = usage.completion_tokens || 0;
    const totalTokens = usage.total_tokens || promptTokens + completionTokens;

    const inputCost = (promptTokens / 1_000_000) * PRICING.inputTokensPerMillion;
    const outputCost = (completionTokens / 1_000_000) * PRICING.outputTokensPerMillion;
    const costUsd = inputCost + outputCost;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      costUsd,
    };
  }

  /**
   * Validate the analysis response structure
   */
  private validateAnalysisResponse(analysis: OpenRouterAnalysisResponse): void {
    // Basic validation
    if (!analysis.brand_book) {
      throw new Error('Missing brand_book in response');
    }
    if (!analysis.system_prompt) {
      throw new Error('Missing system_prompt in response');
    }
    if (!analysis.knowledge_base) {
      throw new Error('Missing knowledge_base in response');
    }

    // Validate brand_book
    if (!analysis.brand_book.colors || !analysis.brand_book.brandVoice) {
      throw new Error('Incomplete brand_book structure');
    }

    // Validate system_prompt
    if (!analysis.system_prompt.identity || !analysis.system_prompt.promptTemplate) {
      throw new Error('Incomplete system_prompt structure');
    }

    // Validate knowledge_base
    if (!analysis.knowledge_base.companyInfo) {
      throw new Error('Incomplete knowledge_base structure');
    }

    this.logger.debug('Analysis response validation passed');
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
   * Test OpenRouter connection
   */
  async testConnection(): Promise<boolean> {
    try {
      this.logger.info('Testing OpenRouter connection...');

      const response = await this.client.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'user',
            content: 'Say "connection successful" if you can read this.',
          },
        ],
        max_tokens: 50,
      });

      const content = response.choices?.[0]?.message?.content;
      this.logger.info(`Connection test response: ${content}`);

      return !!content;
    } catch (error) {
      this.logger.error('Connection test failed', error);
      return false;
    }
  }
}

// Factory function
export function createOpenRouterService(config?: Partial<OpenRouterConfig>): OpenRouterService {
  const apiKey = config?.apiKey || process.env.ROUTEWAY_API_KEY;

  if (!apiKey) {
    throw new Error(
      'ROUTEWAY_API_KEY is required. Set it in environment variables or get one at https://routeway.ai'
    );
  }

  // IMPORTANT: Spread config first, then override with valid apiKey
  // This prevents config.apiKey (undefined) from overwriting the env var value
  return new OpenRouterService({
    ...config,
    apiKey,
  });
}
