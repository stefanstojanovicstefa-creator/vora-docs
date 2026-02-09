/**
 * Brand Analysis Type Definitions
 * Structured types for brand analysis results from AI
 */

/**
 * Brand Book - Visual identity and brand guidelines
 */
export interface BrandBook {
  // Visual Identity
  colors: {
    primary: string[];
    secondary: string[];
    accent: string[];
    neutral: string[];
  };

  typography: {
    heading: {
      fontFamily: string;
      fontWeight: string;
      fontSize: string[];
    };
    body: {
      fontFamily: string;
      fontWeight: string;
      fontSize: string[];
    };
  };

  // Brand Voice
  brandVoice: {
    tone: string[]; // e.g., ["professional", "friendly", "innovative"]
    personality: string[]; // e.g., ["trustworthy", "approachable", "expert"]
    adjectives: string[];
  };

  // Core Values
  coreValues: string[];
  missionStatement?: string;
  visionStatement?: string;

  // Brand Positioning
  positioning: {
    targetAudience: string;
    uniqueValueProposition: string;
    competitors?: string[];
    differentiators?: string[];
  };

  // Visual Elements
  visualElements?: {
    logoUsage?: string;
    imagery?: string;
    iconography?: string;
  };
}

/**
 * System Prompt - Configuration for AI voice agent
 */
export interface SystemPrompt {
  // Agent Identity
  identity: {
    role: string; // e.g., "Customer Support Representative"
    name?: string; // Optional agent name
    expertise: string[];
  };

  // Communication Style (can be object or string for compatibility)
  communicationStyle:
    | {
        tone: string; // e.g., "friendly and professional"
        language: string; // e.g., "conversational, avoiding jargon"
        responseLength: string; // e.g., "concise, 2-3 sentences"
        greeting?: string; // Optional custom greeting
      }
    | string;

  // Behavioral Guidelines
  guidelines: {
    dos: string[]; // Things the agent should do
    donts: string[]; // Things the agent should avoid
    escalationTriggers?: string[]; // When to escalate to human
  };

  // Conversation Examples
  examples?: Array<{
    scenario: string;
    userMessage: string;
    agentResponse: string;
  }>;

  // Guardrails
  guardrails: {
    topicRestrictions?: string[]; // Topics to avoid
    responseConstraints?: string[]; // Response limitations
    complianceRequirements?: string[]; // Legal/compliance rules
  };

  // Context
  contextInstructions?: string; // Additional context for the agent
  promptTemplate: string; // The actual system prompt text

  // Legacy/Alternate fields for compatibility
  systemInstructions?: string; // Alternate name for promptTemplate
  voiceGuidelines?: string; // Voice guidelines as plain text
  exampleInteractions?: Array<{
    userMessage: string;
    agentResponse: string;
  }>;
}

/**
 * Knowledge Base - Structured information about the brand
 */
export interface KnowledgeBase {
  // Company Information
  companyInfo: {
    name: string;
    description: string;
    industry: string;
    founded?: string;
    location?: string;
    size?: string;
  };

  // Products and Services
  products: Array<{
    name: string;
    description: string;
    category: string;
    features?: string[];
    pricing?: string;
    url?: string;
  }>;

  services: Array<{
    name: string;
    description: string;
    category: string;
    benefits?: string[];
    pricing?: string;
    url?: string;
  }>;

  // FAQs
  faqs: Array<{
    question: string;
    answer: string;
    category?: string;
  }>;

  // Policies
  policies: {
    shipping?: string;
    returns?: string;
    privacy?: string;
    terms?: string;
    [key: string]: string | undefined;
  };

  // Contact Information
  contact: {
    email?: string;
    phone?: string;
    address?: string;
    socialMedia?: {
      [platform: string]: string; // e.g., { "twitter": "@company", "linkedin": "company" }
    };
    supportHours?: string;
  };

  // Additional Resources
  resources?: Array<{
    title: string;
    description: string;
    url: string;
    type: string; // "blog", "documentation", "video", etc.
  }>;
}

/**
 * Tool Definition for auto-generated agent tools
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, { type: string; description: string; required?: boolean }>;
}

/**
 * MCP Suggestion from industry analysis
 */
export interface MCPSuggestion {
  id: string;
  name: string;
  reason: string;
}

/**
 * Recommended Integrations based on industry detection
 */
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

/**
 * DeepSeek Analysis Response (now used with OpenRouter/GPT-OSS-120B)
 */
export interface DeepSeekAnalysisResponse {
  brand_book: BrandBook;
  system_prompt: SystemPrompt;
  knowledge_base: KnowledgeBase;
  recommended_integrations?: RecommendedIntegrations;
  detected_language?: string; // ISO 639-1 code
}

/**
 * Brand Analysis Request
 */
export interface BrandAnalysisRequest {
  websiteUrl: string;
  customerId?: string;
  scrapedContent: Array<{
    url: string;
    title: string;
    content: string;
    textContent: string;
  }>;
}

/**
 * Brand Analysis Result (what gets stored in database)
 * Aligned with Prisma brands schema
 */
export interface BrandAnalysisResult {
  brandId: string;
  websiteUrl: string;
  customerId?: string;
  brandBook: BrandBook;
  systemPrompt: SystemPrompt;
  knowledgeBase: KnowledgeBase;
  recommendedIntegrations?: RecommendedIntegrations; // Industry-based MCP suggestions
  detectedLanguage?: string; // ISO 639-1 code of the website's primary language
  pagesScraped: number; // Matches Prisma schema field
  analysisCost: number; // Matches Prisma schema field (stored as Decimal)
  tokensUsed: number; // Matches Prisma schema field
  scrapeDuration?: number; // Matches Prisma schema field
  circuitBreakerTriggered?: boolean; // True if analysis was cut short by circuit breaker
}

/**
 * Brand Analysis Status
 */
export enum BrandAnalysisStatus {
  PENDING = 'PENDING',
  SCRAPING = 'SCRAPING',
  ANALYZING = 'ANALYZING',
  COMPLETED = 'COMPLETED',
  COMPLETED_PARTIAL = 'COMPLETED_PARTIAL',
  FAILED = 'FAILED',
}

/**
 * Brand Analysis Progress Event
 */
export interface BrandAnalysisProgress {
  brandId: string;
  status: BrandAnalysisStatus;
  progress: number; // 0-100
  message: string;
  currentStep?: string;
  estimatedTimeRemaining?: number; // seconds
}
