/**
 * Environment Variable Validation Module
 * Validates required and optional environment variables on startup
 * Provides clear error messages and configuration guidance
 */

export interface EnvVarConfig {
  value: string | undefined;
  description: string;
  example: string;
  validation?: (val: string) => boolean;
  validationError?: string;
}

export interface OptionalEnvVarConfig {
  value: string | undefined;
  description: string;
  impact: string;
  howToFix: string[];
}

export interface ValidationResult {
  valid: boolean;
  missing: Array<{ key: string; description: string; example: string }>;
  invalid: Array<{ key: string; reason: string }>;
  warnings: Array<{
    key: string;
    description: string;
    impact: string;
    howToFix: string[];
  }>;
}

function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL_ENV === 'production' ||
    (process.env.FLY_APP_NAME || '').toLowerCase().includes('prod')
  );
}

/**
 * CRITICAL REQUIRED VARIABLES - Application will NOT start without these
 */
function getRequiredEnvVars(): Record<string, EnvVarConfig> {
  // Database
  const required: Record<string, EnvVarConfig> = {
    DATABASE_URL: {
      value: process.env.DATABASE_URL,
      description: 'PostgreSQL database connection string with pgvector extension',
      example: 'postgresql://user:password@host:5432/database?schema=public',
      validation: (val: string) => val.startsWith('postgresql://') || val.startsWith('postgres://'),
      validationError: 'Must be a valid PostgreSQL connection string',
    },

    // LiveKit (Real-time Voice)
    LIVEKIT_API_KEY: {
      value: process.env.LIVEKIT_API_KEY,
      description: 'LiveKit API key for real-time voice sessions',
      example: 'APIxxxxxxxxxxxxx',
      validation: (val: string) => val.startsWith('API'),
      validationError: 'Must start with API (LiveKit API key format)',
    },

    LIVEKIT_API_SECRET: {
      value: process.env.LIVEKIT_API_SECRET,
      description: 'LiveKit API secret for token generation',
      example: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      validation: (val: string) => val.length >= 32,
      validationError: 'Must be at least 32 characters long',
    },

    LIVEKIT_WS_URL: {
      value: process.env.LIVEKIT_WS_URL,
      description: 'LiveKit WebSocket URL',
      example: 'wss://your-project.livekit.cloud',
      validation: (val: string) => val.startsWith('ws://') || val.startsWith('wss://'),
      validationError: 'Must be a valid WebSocket URL (ws:// or wss://)',
    },

    // Encryption (provider credential storage)
    ENCRYPTION_MASTER_KEY: {
      value: process.env.ENCRYPTION_MASTER_KEY,
      description: 'Master encryption key for provider credential storage (64 hex chars)',
      example: '0000000000000000000000000000000000000000000000000000000000000000',
      validation: (val: string) => /^[0-9a-fA-F]{64}$/.test(val),
      validationError: 'Must be exactly 64 hexadecimal characters (32 bytes)',
    },
  };

  // Authentication requirements depend on environment + demo mode.
  const demoMode = !isProductionEnvironment() && process.env.DEMO_MODE === 'true';
  const hasClerk = !!process.env.CLERK_SECRET_KEY;
  const hasDemoApiKey = !!process.env.DEMO_API_KEY;

  if (isProductionEnvironment() || !demoMode || !hasDemoApiKey) {
    required.CLERK_SECRET_KEY = {
      value: process.env.CLERK_SECRET_KEY,
      description: 'Clerk authentication secret key (must start with sk_)',
      example: 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      validation: (val: string) => val.startsWith('sk_'),
      validationError: 'Must start with sk_ (Clerk secret key format)',
    };
  }

  if (demoMode && !hasClerk) {
    required.DEMO_API_KEY = {
      value: process.env.DEMO_API_KEY,
      description: 'Demo API key used to bootstrap a local test user + API key auth (non-production only)',
      example: 'demo_e2e_key_change_me',
      validation: (val: string) => val.trim().length >= 12,
      validationError: 'Must be at least 12 characters long',
    };
  }

  return required;
}

/**
 * OPTIONAL BUT RECOMMENDED VARIABLES - Application will run with reduced functionality
 */
const OPTIONAL_ENV_VARS: Record<string, OptionalEnvVarConfig> = {
  // AI Provider Keys (at least ONE recommended for full functionality)
  GOOGLE_GEMINI_API_KEY: {
    value: process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
    description: 'Google Gemini API key for AI agent compilation and brand analysis',
    impact: 'AI agent compilation, brand analysis, and prompt generation will be disabled',
    howToFix: [
      'Get API key from https://aistudio.google.com/app/apikey',
      'Add to .env: GOOGLE_GEMINI_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  // Agent Forge (freeform creation)
  XAI_API_KEY: {
    value: process.env.XAI_API_KEY,
    description: 'xAI API key for the Agent Forge guide (chat)',
    impact: 'Forge will fall back to a basic scripted prompt (reduced quality)',
    howToFix: [
      'Get an xAI API key from your xAI dashboard',
      'Add to .env: XAI_API_KEY=<your-key>',
      'Set XAI_ARCHITECT_MODEL to your chosen model name',
      'Restart backend server',
    ],
  },

  XAI_ARCHITECT_MODEL: {
    value: process.env.XAI_ARCHITECT_MODEL,
    description: 'Model name used by the Agent Forge guide (xAI)',
    impact: 'Forge will fall back to a basic scripted prompt (reduced quality)',
    howToFix: [
      'Pick a supported model name on your xAI account',
      'Add to .env: XAI_ARCHITECT_MODEL=<model-name>',
      'Restart backend server',
    ],
  },

  GEMINI_COMPILER_API_KEY: {
    value:
      process.env.GEMINI_COMPILER_API_KEY ||
      process.env.GOOGLE_GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY,
    description: 'Gemini API key used by the backend-only Agent Forge compiler',
    impact: 'Forge completion (agent config compilation) will fail unless another Gemini key is set',
    howToFix: [
      'Get API key from https://aistudio.google.com/app/apikey',
      'Add to .env: GEMINI_COMPILER_API_KEY=<your-key>',
      'Optionally set GEMINI_COMPILER_MODEL to your desired Flash model',
      'Restart backend server',
    ],
  },

  OPENAI_API_KEY: {
    value: process.env.OPENAI_API_KEY,
    description: 'OpenAI API key for GPT models (LLM, STT, TTS)',
    impact: 'OpenAI GPT models, Whisper STT, and OpenAI TTS will be unavailable',
    howToFix: [
      'Get API key from https://platform.openai.com/api-keys',
      'Add to .env: OPENAI_API_KEY=sk-xxxxxxxx',
      'Restart backend server',
    ],
  },

  ANTHROPIC_API_KEY: {
    value: process.env.ANTHROPIC_API_KEY,
    description: 'Anthropic API key for Claude models',
    impact: 'Claude LLM models will be unavailable',
    howToFix: [
      'Get API key from https://console.anthropic.com/',
      'Add to .env: ANTHROPIC_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  // Voice Provider Keys
  ELEVENLABS_API_KEY: {
    value: process.env.ELEVENLABS_API_KEY,
    description: 'ElevenLabs API key for high-quality TTS',
    impact: 'ElevenLabs TTS voices will be unavailable',
    howToFix: [
      'Get API key from https://elevenlabs.io/app/settings/api-keys',
      'Add to .env: ELEVENLABS_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  DEEPGRAM_API_KEY: {
    value: process.env.DEEPGRAM_API_KEY,
    description: 'Deepgram API key for fast, accurate STT',
    impact: 'Deepgram STT will be unavailable',
    howToFix: [
      'Get API key from https://console.deepgram.com/',
      'Add to .env: DEEPGRAM_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  CARTESIA_API_KEY: {
    value: process.env.CARTESIA_API_KEY,
    description: 'Cartesia API key for ultra-low-latency TTS',
    impact: 'Cartesia TTS will be unavailable',
    howToFix: [
      'Get API key from https://cartesia.ai/',
      'Add to .env: CARTESIA_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  ASSEMBLYAI_API_KEY: {
    value: process.env.ASSEMBLYAI_API_KEY,
    description: 'AssemblyAI API key for STT with sentiment analysis',
    impact: 'AssemblyAI STT will be unavailable',
    howToFix: [
      'Get API key from https://www.assemblyai.com/',
      'Add to .env: ASSEMBLYAI_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  // Agent Forge Compiler (Routeway)
  ROUTEWAY_API_KEY: {
    value: process.env.ROUTEWAY_API_KEY,
    description: 'Routeway API key for Agent Wizard compilation (MiniMax M2)',
    impact: 'Agent Wizard will not be able to compile agent configurations',
    howToFix: [
      'Get API key from https://routeway.ai/',
      'Add to .env: ROUTEWAY_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  // Billing (Paddle)
  PADDLE_API_KEY: {
    value: process.env.PADDLE_API_KEY,
    description: 'Paddle API key for subscription management and billing',
    impact: 'Subscription management, minute pack purchases, and billing webhooks will be disabled',
    howToFix: [
      'Get API key from Paddle dashboard',
      'Add to .env: PADDLE_API_KEY=<your-key>',
      'Also set PADDLE_WEBHOOK_SECRET for webhook verification',
      'Restart backend server',
    ],
  },

  // Infrastructure & Deployment
  FLY_API_TOKEN: {
    value: process.env.FLY_API_TOKEN,
    description: 'Fly.io API token for agent deployment to production',
    impact: 'Agent deployment to Fly.io will NOT work',
    howToFix: [
      'Run: flyctl auth token',
      'Add to .env: FLY_API_TOKEN=<your-token>',
      'Restart backend server',
    ],
  },

  // Monitoring & Observability
  SENTRY_DSN: {
    value: process.env.SENTRY_DSN,
    description: 'Sentry DSN for error tracking and performance monitoring',
    impact: 'Error tracking, performance monitoring, and alerting will be disabled',
    howToFix: [
      'Create a Sentry project at https://sentry.io',
      'Copy the DSN from project settings',
      'Add to .env: SENTRY_DSN=<your-dsn>',
      'Restart backend server',
    ],
  },

  // Redis & Queue Management
  UPSTASH_REDIS_REST_URL: {
    value: process.env.UPSTASH_REDIS_REST_URL,
    description: 'Upstash Redis REST API URL for serverless Redis',
    impact: 'BullMQ job queues and rate limiting will use local Redis fallback',
    howToFix: [
      'Create Redis database at https://console.upstash.com/',
      'Copy REST URL from database details',
      'Add to .env: UPSTASH_REDIS_REST_URL=<your-url>',
      'Add to .env: UPSTASH_REDIS_REST_TOKEN=<your-token>',
      'Restart backend server',
    ],
  },

  UPSTASH_REDIS_REST_TOKEN: {
    value: process.env.UPSTASH_REDIS_REST_TOKEN,
    description: 'Upstash Redis REST API token',
    impact: 'BullMQ job queues and rate limiting will use local Redis fallback',
    howToFix: [
      'Copy REST token from Upstash database details',
      'Add to .env: UPSTASH_REDIS_REST_TOKEN=<your-token>',
      'Restart backend server',
    ],
  },

  REDIS_HOST: {
    value: process.env.REDIS_HOST,
    description: 'Redis host for local development or self-hosted Redis',
    impact: 'Falls back to localhost:6379 for local development',
    howToFix: [
      'Install Redis locally or use Docker: docker run -d -p 6379:6379 redis',
      'Add to .env: REDIS_HOST=localhost',
      'Optionally set REDIS_PORT, REDIS_PASSWORD',
      'Restart backend server',
    ],
  },

  // CRM Integrations
  HUBSPOT_CLIENT_ID: {
    value: process.env.HUBSPOT_CLIENT_ID,
    description: 'HubSpot OAuth Client ID for CRM integration',
    impact: 'HubSpot CRM integration will be unavailable',
    howToFix: [
      'Create HubSpot app at https://developers.hubspot.com/',
      'Add to .env: HUBSPOT_CLIENT_ID=<your-client-id>',
      'Add to .env: HUBSPOT_CLIENT_SECRET=<your-client-secret>',
      'Restart backend server',
    ],
  },

  SALESFORCE_CLIENT_ID: {
    value: process.env.SALESFORCE_CLIENT_ID,
    description: 'Salesforce OAuth Client ID for CRM integration',
    impact: 'Salesforce CRM integration will be unavailable',
    howToFix: [
      'Create Salesforce Connected App',
      'Add to .env: SALESFORCE_CLIENT_ID=<your-client-id>',
      'Add to .env: SALESFORCE_CLIENT_SECRET=<your-client-secret>',
      'Restart backend server',
    ],
  },

  // Additional LLM Providers
  GROQ_API_KEY: {
    value: process.env.GROQ_API_KEY,
    description: 'Groq API key for ultra-fast LLM inference',
    impact: 'Groq LLM models will be unavailable',
    howToFix: [
      'Get API key from https://console.groq.com/',
      'Add to .env: GROQ_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  MISTRAL_API_KEY: {
    value: process.env.MISTRAL_API_KEY,
    description: 'Mistral AI API key for European-focused LLM models',
    impact: 'Mistral LLM models will be unavailable',
    howToFix: [
      'Get API key from https://console.mistral.ai/',
      'Add to .env: MISTRAL_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  COHERE_API_KEY: {
    value: process.env.COHERE_API_KEY,
    description: 'Cohere API key for embeddings and LLM models',
    impact: 'Cohere models will be unavailable',
    howToFix: [
      'Get API key from https://dashboard.cohere.com/',
      'Add to .env: COHERE_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  PERPLEXITY_API_KEY: {
    value: process.env.PERPLEXITY_API_KEY,
    description: 'Perplexity API key for real-time web-aware LLM',
    impact: 'Perplexity models will be unavailable',
    howToFix: [
      'Get API key from https://www.perplexity.ai/',
      'Add to .env: PERPLEXITY_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  AI21_API_KEY: {
    value: process.env.AI21_API_KEY,
    description: 'AI21 Labs API key for Jurassic models',
    impact: 'AI21 Jurassic models will be unavailable',
    howToFix: [
      'Get API key from https://studio.ai21.com/',
      'Add to .env: AI21_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  // AI Routing & Brand Analysis
  OPENROUTER_API_KEY: {
    value: process.env.OPENROUTER_API_KEY,
    description: 'OpenRouter API key for brand analysis AI routing',
    impact: 'Brand analysis via OpenRouter models will be unavailable',
    howToFix: [
      'Get API key from https://openrouter.ai/keys',
      'Add to .env: OPENROUTER_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },

  PADDLE_WEBHOOK_SECRET: {
    value: process.env.PADDLE_WEBHOOK_SECRET,
    description: 'Paddle webhook secret for verifying billing event signatures',
    impact: 'Paddle webhook verification will fail — billing events will be rejected',
    howToFix: [
      'Copy webhook secret from Paddle developer settings → Notifications',
      'Add to .env: PADDLE_WEBHOOK_SECRET=<your-secret>',
      'Restart backend server',
    ],
  },

  // Google Cloud Services
  GOOGLE_APPLICATION_CREDENTIALS: {
    value: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    description: 'Path to Google Cloud service account JSON for STT/TTS',
    impact: 'Google Cloud STT and TTS will be unavailable',
    howToFix: [
      'Create service account at https://console.cloud.google.com/',
      'Download JSON key file',
      'Add to .env: GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json',
      'Restart backend server',
    ],
  },

  GOOGLE_CLOUD_API_KEY: {
    value: process.env.GOOGLE_CLOUD_API_KEY,
    description: 'Google Cloud API key for STT/TTS services',
    impact: 'Google Cloud STT and TTS will be unavailable (if not using service account)',
    howToFix: [
      'Create API key in Google Cloud Console',
      'Add to .env: GOOGLE_CLOUD_API_KEY=<your-key>',
      'Restart backend server',
    ],
  },
} as const;

/**
 * Validates all environment variables
 * Returns detailed validation results with missing/invalid vars and warnings
 */
export function validateEnv(): ValidationResult {
  if (process.env.SKIP_ENV_VALIDATION === 'true') {
    const isProduction =
      isProductionEnvironment();

    if (isProduction) {
      console.error('╔═══════════════════════════════════════════════════════════════╗');
      console.error('║  FATAL: SKIP_ENV_VALIDATION=true in production environment!  ║');
      console.error('║  This is a security violation. Remove this setting.          ║');
      console.error('╚═══════════════════════════════════════════════════════════════╝');
      process.exit(1);
    }

    console.warn('⚠️ Environment validation skipped (non-production only)');
    return {
      valid: true,
      missing: [],
      invalid: [],
      warnings: [
        {
          key: 'SKIP_ENV_VALIDATION',
          description: 'Environment validation was skipped',
          impact: 'Required environment variables may be missing or invalid',
          howToFix: ['Remove SKIP_ENV_VALIDATION=true and restart the server'],
        },
      ],
    };
  }

  const missing: Array<{ key: string; description: string; example: string }> = [];
  const invalid: Array<{ key: string; reason: string }> = [];
  const warnings: Array<{
    key: string;
    description: string;
    impact: string;
    howToFix: string[];
  }> = [];

  const REQUIRED_ENV_VARS = getRequiredEnvVars();

  // Check required variables
  for (const [key, config] of Object.entries(REQUIRED_ENV_VARS)) {
    if (!config.value) {
      missing.push({
        key,
        description: config.description,
        example: config.example,
      });
    } else if (config.validation && !config.validation(config.value)) {
      invalid.push({
        key,
        reason: config.validationError || `Invalid format. ${config.description}. Example: ${config.example}`,
      });
    }
  }

  // Check optional variables
  for (const [key, config] of Object.entries(OPTIONAL_ENV_VARS)) {
    if (!config.value) {
      warnings.push({
        key,
        description: config.description,
        impact: config.impact,
        howToFix: config.howToFix,
      });
    }
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
    warnings,
  };
}

/**
 * Gets a comprehensive list of all environment variable keys
 * Useful for documentation and .env.example generation
 */
export function getAllEnvVarKeys(): {
  required: string[];
  optional: string[];
} {
  const REQUIRED_ENV_VARS = getRequiredEnvVars();
  return {
    required: Object.keys(REQUIRED_ENV_VARS),
    optional: Object.keys(OPTIONAL_ENV_VARS),
  };
}

/**
 * Checks if a specific feature is enabled based on its required env vars
 */
export function isFeatureEnabled(feature: string): boolean {
  const featureEnvMap: Record<string, string[]> = {
    'gemini-ai': ['GOOGLE_GEMINI_API_KEY', 'GOOGLE_API_KEY'],
    'openai': ['OPENAI_API_KEY'],
    'anthropic': ['ANTHROPIC_API_KEY'],
    'elevenlabs': ['ELEVENLABS_API_KEY'],
    'deepgram': ['DEEPGRAM_API_KEY'],
    'cartesia': ['CARTESIA_API_KEY'],
    'assemblyai': ['ASSEMBLYAI_API_KEY'],
    'fly-deployment': ['FLY_API_TOKEN'],
    'sentry': ['SENTRY_DSN'],
    'upstash-redis': ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'],
    'hubspot': ['HUBSPOT_CLIENT_ID', 'HUBSPOT_CLIENT_SECRET'],
    'salesforce': ['SALESFORCE_CLIENT_ID', 'SALESFORCE_CLIENT_SECRET'],
    'groq': ['GROQ_API_KEY'],
    'mistral': ['MISTRAL_API_KEY'],
    'cohere': ['COHERE_API_KEY'],
    'perplexity': ['PERPLEXITY_API_KEY'],
    'ai21': ['AI21_API_KEY'],
    'google-cloud': ['GOOGLE_APPLICATION_CREDENTIALS', 'GOOGLE_CLOUD_API_KEY'],
    'openrouter': ['OPENROUTER_API_KEY'],
    'paddle': ['PADDLE_API_KEY'],
    'routeway': ['ROUTEWAY_API_KEY'],
    'SEMANTIC_CACHE_WARMING': ['SEMANTIC_CACHE_WARMING'],
  };

  const requiredVars = featureEnvMap[feature];
  if (!requiredVars) return false;

  // Check if ANY of the required vars are set (for features with alternatives)
  return requiredVars.some(envVar => !!process.env[envVar]);
}
