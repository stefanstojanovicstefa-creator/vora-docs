/**
 * Vora Voice Backend API
 * Main entry point
 */

// ⚠️ CRITICAL: Sentry MUST be imported FIRST before any other imports
import { Sentry } from './instrument';

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { ensurePrismaMigrationsApplied } from './utils/prisma-migrate';
import { connectDatabase, disconnectDatabase, prisma } from './config/database';
import {
  requireAuth,
  optionalAuth,
  authHealthCheck,
  getAuthConfig,
  clerkClient,
} from './middleware/auth.middleware';
import {
  createConnectionMonitor,
  gracefulShutdown as cleanupConnectionMonitor,
  healthCheckHandler,
} from './middleware/connection-monitor.middleware';
import { apiKeyAuth } from './middleware/api-key-auth.middleware';
import { initializeWebSocket, shutdownWebSocket } from './services/websocket.service';
import agentsRouter from './routes/agents.routes';
import agentInterviewRouter from './routes/agent-interview.routes';
import agentForgeRouter from './routes/agent-forge.routes';
import tokensRouter from './routes/tokens.routes';
import callsRouter from './routes/calls.routes';
import deployRouter from './routes/deploy.routes';
import analyticsRouter from './routes/analytics.routes';
import knowledgeBaseRouter from './routes/knowledge-base.routes';
import functionsRouter from './routes/functions.routes';
import customFunctionsRouter from './routes/custom-functions.routes';
import providersRouter from './routes/providers.routes';
import providerKeysRouter from './routes/provider-keys.routes';
import voicesRouter from './routes/voices.routes';
import sessionsRouter from './routes/sessions.routes';
import transcriptsRouter from './routes/transcripts.routes';
import voiceProvidersRouter from './routes/voice-providers.routes';
import serviceTemplatesRouter from './routes/service-templates.routes';
import webhooksRouter from './routes/webhooks.routes';
import apiKeysRouter from './routes/api-keys.routes';
import healthRouter from './routes/health.routes';
import websocketRouter from './routes/websocket.routes';
import deploymentsRouter from './routes/deployments.routes';
import crmRouter from './routes/crm.routes';
import calendarRouter from './routes/calendar.routes';
import brandsRouter from './routes/brands.routes';
import gdprRouter from './routes/gdpr.routes';
// REMOVED: prewarm routes - feature not in use (PRD-001)
import promptAssistantRouter from './routes/prompt-assistant.routes';
import metricsRouter from './routes/metrics.routes';
import alertsRouter from './routes/alerts.routes';
import usageRouter from './routes/usage.routes';
import subscriptionRouter from './routes/subscription.routes';
import creditPacksRouter from './routes/credit-packs.routes';
import autoTopupRouter from './routes/auto-topup.routes';
import callAnalyticsRouter from './routes/call-analytics.routes';
import providerHealthRouter from './routes/provider-health.routes';
import functionSchemaGeneratorRouter from './routes/function-schema-generator.routes';
import livekitRouter from './routes/livekit.routes';
import builderRouter from './routes/builder.routes';
import flowRouter from './routes/flow.routes';
import componentRouter from './routes/component.routes';
import abTestRouter from './routes/ab-test.routes';
import sipRouter from './routes/sip.routes';
import sipWebhookRouter from './routes/sip-webhook.routes';
import functionVersioningRouter from './routes/function-versioning.routes';
import hubspotRouter from './routes/hubspot.routes';
import crmFunctionsRouter from './routes/crm-functions.routes';
// REMOVED: flyMachinesRouter - per-agent Fly.io deployment deprecated (PRD-002)
// REMOVED: workersRouter - per-agent Fly.io deployment deprecated (PRD-002)
import functionTemplatesRouter from './routes/function-templates.routes';
import functionWizardRouter from './routes/function-wizard.routes';
import messagingRouter from './routes/messaging.routes';
import tutorialRouter from './routes/tutorial.routes';
import contextRouter from './routes/context.routes';
import monitoringRouter from './api/monitoring.routes';
import adminToolsRouter from './routes/admin-tools.routes';
import sqliteV2Router from './routes/sqlite'; // OpenClaw SQLite API v2
import customerMemoryRouter from './routes/customer-memory.routes';
import memoryRouter from './api/memory.routes';
import knowledgeInjectionRouter from './api/knowledge-injection.routes';
import mcpCatalogRouter from './routes/mcp-catalog.routes';
import mcpConnectionsRouter from './routes/mcp-connections.routes';
import mcpExecutionRouter from './routes/mcp-execution.routes';
import mcpOAuthRouter from './routes/mcp-oauth.routes';
import { createLogger } from './utils/logger';
import { initializeCRMProviders } from './integrations/crm/crm-registry';
import { validateEnv, isFeatureEnabled } from './config/env-validation';
import {
  initializeQueueMonitoring,
  stopHealthCheckInterval,
} from './services/queue-health.service';
import { loadEnv } from './config/load-env';
import { validateForgeConfig } from './config/forge-validation';
import crypto from 'crypto';
import { createId as cuid } from '@paralleldrive/cuid2';
import { createCacheWarmingWorker, scheduleOffPeakCacheWarming } from './jobs/cache-warming.job';
import {
  startPruneExpiredMemoriesWorker,
  scheduleDailyPruning,
  stopPruneExpiredMemoriesWorker,
} from './jobs/prune-expired-memories.job';
import {
  startRecalculateRIFScoresWorker,
  scheduleWeeklyRIFRecalculation,
  stopRecalculateRIFScoresWorker,
} from './jobs/recalculate-rif-scores.job';
import {
  startCompressConversationWorker,
  stopCompressConversationWorker,
} from './jobs/compress-conversation.job';
import { startExtractEntitiesWorker, stopExtractEntitiesWorker } from './jobs/extract-entities.job';
import { startSqliteWorkers, stopSqliteWorkers } from './workers/sqlite.workers';
import {
  scheduleDailyPruning as scheduleSqliteDailyPruning,
  scheduleWeeklyRecalculation as scheduleSqliteWeeklyRecalculation,
} from './jobs/sqlite';

// Load environment variables
loadEnv();

const logger = createLogger('Server');

/**
 * Validates required and optional environment variables at startup
 * Uses centralized env-validation module
 * Exits process if critical variables are missing
 * Logs warnings for optional but recommended variables
 */
function validateEnvironment(): void {
  logger.info('🔍 Validating environment configuration...');

  const result = validateEnv();

  // ============================================================
  // REPORT VALIDATION RESULTS
  // ============================================================

  // Handle critical errors
  if (!result.valid) {
    logger.error('');
    logger.error('╔═══════════════════════════════════════════════════════════════════════════╗');
    logger.error('║                     ❌ STARTUP FAILED - CONFIGURATION ERROR                ║');
    logger.error('╚═══════════════════════════════════════════════════════════════════════════╝');
    logger.error('');

    if (result.missing.length > 0) {
      logger.error('Missing REQUIRED environment variables:');
      logger.error('');
      result.missing.forEach(({ key, description, example }) => {
        logger.error(`  ❌ ${key}`);
        logger.error(`     Description: ${description}`);
        logger.error(`     Example: ${example}`);
        logger.error('');
      });
    }

    if (result.invalid.length > 0) {
      logger.error('Invalid environment variable formats:');
      logger.error('');
      result.invalid.forEach(({ key, reason }) => {
        logger.error(`  ❌ ${key}`);
        logger.error(`     ${reason}`);
        logger.error('');
      });
    }

    logger.error('╔═══════════════════════════════════════════════════════════════════════════╗');
    logger.error('║                           HOW TO FIX                                      ║');
    logger.error('╚═══════════════════════════════════════════════════════════════════════════╝');
    logger.error('');
    logger.error('  1. Copy .env.example to .env in the ventus-voice/backend directory');
    logger.error('  2. Fill in the missing required variables listed above');
    logger.error('  3. Verify the format of invalid variables');
    logger.error('  4. Restart the backend server');
    logger.error('');
    logger.error('For detailed setup instructions, see: ventus-voice/backend/README.md');
    logger.error('');

    process.exit(1);
  }

  // Log warnings for optional variables (only show first 5 to avoid overwhelming output)
  if (result.warnings.length > 0) {
    logger.warn('');
    logger.warn('╔═══════════════════════════════════════════════════════════════════════════╗');
    logger.warn('║              ⚠️  WARNINGS - Optional Configuration Missing                 ║');
    logger.warn('╚═══════════════════════════════════════════════════════════════════════════╝');
    logger.warn('');
    logger.warn('The following optional environment variables are not configured:');
    logger.warn('The application will start but some features will be disabled.');
    logger.warn('');

    // Show only high-priority warnings (first 5) to keep logs clean
    const priorityWarnings = result.warnings.slice(0, 5);
    priorityWarnings.forEach(({ key, description, impact, howToFix }) => {
      logger.warn(`  ⚠️  ${key}`);
      logger.warn(`     Description: ${description}`);
      logger.warn(`     Impact: ${impact}`);
      logger.warn(`     How to enable:`);
      howToFix.forEach((step, idx) => {
        logger.warn(`       ${idx + 1}. ${step}`);
      });
      logger.warn('');
    });

    if (result.warnings.length > 5) {
      logger.warn(`  ... and ${result.warnings.length - 5} more optional configurations.`);
      logger.warn(`  See src/config/env-validation.ts for full list.`);
      logger.warn('');
    }
  }

  // Success message with feature availability summary
  logger.info('✅ Environment validation complete - all required variables present');

  // Log enabled features
  const enabledFeatures: string[] = [];
  if (isFeatureEnabled('gemini-ai')) enabledFeatures.push('Gemini AI');
  if (isFeatureEnabled('openai')) enabledFeatures.push('OpenAI');
  if (isFeatureEnabled('anthropic')) enabledFeatures.push('Anthropic Claude');
  if (isFeatureEnabled('elevenlabs')) enabledFeatures.push('ElevenLabs TTS');
  if (isFeatureEnabled('deepgram')) enabledFeatures.push('Deepgram STT');
  if (isFeatureEnabled('fly-deployment')) enabledFeatures.push('Fly.io Deployment');
  if (isFeatureEnabled('sentry')) enabledFeatures.push('Sentry Monitoring');
  if (isFeatureEnabled('openrouter')) enabledFeatures.push('OpenRouter AI');
  if (isFeatureEnabled('paddle')) enabledFeatures.push('Paddle Billing');

  if (enabledFeatures.length > 0) {
    logger.info(`🎉 Enabled features: ${enabledFeatures.join(', ')}`);
  }
  logger.info('');
}

// Run validation before any server initialization
validateEnvironment();

// Log feature flags
import { logFeatureFlags } from './config/feature-flags';
logFeatureFlags();

const app = express();
// On Fly.io, always use port 8080
const PORT = process.env.NODE_ENV === 'production' ? 8080 : Number(process.env.PORT) || 3001;

// Middleware - CORS with flexible origin support
// Primary: Read from CORS_ORIGIN env var (comma-separated)
const corsOrigins =
  process.env.CORS_ORIGIN?.split(',')
    .map(s => s.trim())
    .filter(Boolean) || [];

const allowedOrigins: (string | RegExp)[] = [
  // Origins from environment variable
  ...corsOrigins,
  // Production domains
  'https://dashboard.voicevora.com',
  'https://voicevora.com',
  'https://www.voicevora.com',
  // Allow all Vercel preview deployments for all projects
  /https:\/\/vora-frontend-.*\.vercel\.app$/,
  /https:\/\/vocal-flow-vortex-main-.*\.vercel\.app$/,
  /https:\/\/vora-voice-platform-.*\.vercel\.app$/, // Production preview deployments
  /https:\/\/vora-marketing-.*\.vercel\.app$/, // Marketing preview deployments
];

// Add multiple frontend URLs from env if they exist
const frontendUrls = [
  process.env.FRONTEND_URL,
  process.env.NEXT_PUBLIC_API_URL,
  process.env.VITE_API_URL,
  process.env.API_URL,
].filter((url): url is string => Boolean(url));

frontendUrls.forEach(url => {
  if (!allowedOrigins.includes(url)) {
    allowedOrigins.push(url);
  }
});

// Add all localhost variations for development
if (process.env.NODE_ENV === 'development') {
  allowedOrigins.push('http://localhost:8082');
  allowedOrigins.push('http://localhost:8083');
  allowedOrigins.push(/^http:\/\/localhost:\d+$/); // Match any localhost port
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc)
      if (!origin) return callback(null, true);

      // Check if origin matches allowed origins or patterns
      const isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        }
        // RegExp pattern
        return allowed.test(origin);
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logger.warn('CORS blocked origin', { origin });
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Request-ID',
      'X-API-Key',
      'X-Vora-Api-Key',
    ],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Request-ID'],
    maxAge: 86400, // 24 hours
  })
);
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// ✅ SECURITY: HTTP Security Headers
app.use((req, res, next) => {
  // Prevent clickjacking attacks
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // XSS protection for legacy browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Enforce HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Content Security Policy - restrictive default, allow WebSocket and API calls
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
      "connect-src 'self' wss: ws: https:; " +
      "script-src 'self' 'unsafe-inline'; " + // Required for Swagger UI
      "style-src 'self' 'unsafe-inline'; " + // Required for Swagger UI
      "img-src 'self' data: https:; " + // Allow data URIs and HTTPS images
      "frame-ancestors 'none'"
  );

  // Referrer policy - balance privacy and functionality
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy - disable unnecessary browser features
  res.setHeader(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()'
  );

  next();
});

// ✅ TRACING: Request ID tracking for distributed tracing
import { requestIdMiddleware } from './middleware/request-id.middleware';
app.use(requestIdMiddleware);

// ✅ SECURITY: Request timeout middleware - prevent slow requests from hanging
app.use((req, res, next) => {
  // Skip timeout for WebSocket connections and long-polling endpoints
  const isWebSocketUpgrade = req.headers.upgrade === 'websocket';
  const isSocketIO = req.path.startsWith('/socket.io');
  const isLongPolling = req.query._poll === 'true';

  if (isWebSocketUpgrade || isSocketIO || isLongPolling) {
    return next();
  }

  // Determine timeout based on route characteristics
  let timeoutMs = 30000; // Default: 30 seconds

  // Short timeout for simple CRUD operations (10s)
  const shortTimeoutRoutes = [
    '/api/agents',
    '/api/voices',
    '/api/sessions',
    '/api/transcripts',
    '/api/api-keys',
    '/api/tokens',
    '/api/provider-keys',
    '/api/alerts',
    '/api/metrics',
    '/health',
    '/ping',
  ];

  // Long timeout for AI, file uploads, and deployments (120s)
  const longTimeoutRoutes = [
    '/api/deploy',
    '/api/brands', // Web scraping and AI analysis
    '/api/prompt-assistant', // AI generation
    '/api/function-schemas', // AI generation
    '/api/function-wizard', // AI function generation
    '/api/calls', // Voice call processing
    '/api/livekit', // Real-time media
    '/api/sip', // Phone integration
    '/api/fly-machines', // Deployment operations
    '/api/agent-forge', // Forge agent creation - LLM compilation takes 15-30s
    '/api/agent-interview', // Interview flow - LLM operations
    // '/api/prewarm', // REMOVED: Machine pre-warming not in use (PRD-001)
  ];

  // Apply route-specific timeouts
  if (shortTimeoutRoutes.some(route => req.path.startsWith(route))) {
    timeoutMs = 10000; // 10 seconds
  } else if (longTimeoutRoutes.some(route => req.path.startsWith(route))) {
    timeoutMs = 120000; // 120 seconds (2 minutes)
  }

  // Set request timeout
  req.setTimeout(timeoutMs, () => {
    if (!res.headersSent) {
      logger.warn('Request timeout', {
        method: req.method,
        path: req.path,
        timeout: timeoutMs,
        requestId: (req as any).id,
      });

      res.status(408).json({
        error: 'Request Timeout',
        message: `The request took too long to process (timeout: ${timeoutMs / 1000}s)`,
        code: 'REQUEST_TIMEOUT',
        requestId: (req as any).id,
      });
    }
  });

  next();
});

// ✅ SECURITY: Lightweight auth parsing for rate limit tier detection
// This runs BEFORE rate limiting to populate req.auth for tier detection.
// It's non-blocking: invalid tokens continue as unauthenticated.
app.use('/api/', optionalAuth);

// ✅ ADMIN: Admin rate limit override (sets UNLIMITED tier for platform owners)
// Checks RATE_LIMIT_ADMIN_USERS env var for whitelisted Clerk user IDs
// Must run AFTER optionalAuth (needs req.auth.userId) and BEFORE rateLimitMiddleware
import { adminRateLimitOverride } from './middleware/admin-rate-limit.middleware';
app.use('/api/', adminRateLimitOverride);

// ✅ SECURITY: Rate limiting for API endpoints with auto tier detection
// 'auto' mode intelligently assigns tier based on authentication:
// - Unauthenticated: FREE (100 requests/hour)
// - Authenticated (no org): BASIC (1000 requests/hour)
// - Organization users: Based on org plan (FREE, PRO, ENTERPRISE)
// - Admin users: UNLIMITED (set by adminRateLimitOverride above)
import { rateLimitMiddleware } from './middleware/rate-limit.middleware';
app.use('/api/', rateLimitMiddleware('auto'));

// Request logging and connection monitoring
const connectionMonitor = createConnectionMonitor();

// Enhanced request logging
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  logger.http('Incoming request', {
    method: req.method,
    path: req.path,
    ip,
    userAgent: userAgent.substring(0, 50),
  });
  next();
});

// Add connection monitoring
app.use(connectionMonitor);

// ✅ MONITORING: Prometheus metrics tracking
import { metricsMiddleware, register as metricsRegister } from './middleware/metrics.middleware';
app.use(metricsMiddleware);

// Enhanced health check with connection monitoring and auth status
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'vora-backend',
    version: '1.0.0',
    services: {
      database: 'checking...',
      migrations: 'checking...',
      clerk: 'checking...',
      sentry: 'checking...',
      livekit: 'checking...',
    },
    environment: process.env.NODE_ENV || 'development',
  };

  // Check database
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.services.database = 'connected';
  } catch (error) {
    health.services.database = 'disconnected';
    health.status = 'unhealthy';
  }

  // Check migrations
  try {
    const migrations = await prisma.$queryRaw<
      Array<{
        migration_name: string;
        finished_at: Date | null;
      }>
    >`
      SELECT migration_name, finished_at
      FROM _prisma_migrations
      ORDER BY started_at DESC
      LIMIT 1
    `;

    if (migrations.length > 0 && migrations[0].finished_at) {
      health.services.migrations = 'applied';
    } else if (migrations.length > 0) {
      health.services.migrations = 'pending';
      health.status = 'degraded';
    } else {
      health.services.migrations = 'none';
    }
  } catch (error) {
    health.services.migrations = 'error';
  }

  // Check Clerk - configuration only, no API call
  try {
    const clerkConfigured = !!process.env.CLERK_SECRET_KEY;
    const validFormat = process.env.CLERK_SECRET_KEY?.startsWith('sk_');
    health.services.clerk = clerkConfigured && validFormat ? 'configured' : 'not_configured';
  } catch (error) {
    health.services.clerk = 'error';
  }

  // Check Sentry
  health.services.sentry = process.env.SENTRY_DSN ? 'configured' : 'not configured';

  // Check LiveKit
  health.services.livekit =
    process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET ? 'configured' : 'not configured';

  res.json(health);
});

// Simple health check for quick ping (no monitoring overhead)
app.get('/ping', (req, res) => {
  res.json({
    status: 'pong',
    timestamp: new Date().toISOString(),
    service: 'vora-backend',
  });
});

// ✅ MONITORING: Prometheus metrics endpoint (public for scraping)
// Using dedicated metrics router for better organization
app.use('/', metricsRouter);

// Authentication status and configuration endpoints
app.get('/api/auth/health', authHealthCheck);
app.get('/api/auth/config', getAuthConfig);

// Sentry test endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.get('/api/sentry-test', (req, res) => {
    try {
      throw new Error('Sentry test error from backend - this is intentional!');
    } catch (error) {
      Sentry.captureException(error);
      res.json({
        success: true,
        message: 'Test error sent to Sentry. Check your Sentry dashboard.',
        sentryEventId: Sentry.lastEventId(),
      });
    }
  });
}

// Create combined auth middleware (tries API key first, then Clerk)
const combinedAuth = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  // First try API key auth
  const apiKey = req.headers['x-api-key'] || req.headers['x-vora-api-key'] || req.query.api_key;

  if (apiKey) {
    return apiKeyAuth(req, res, next);
  }

  // Fall back to Clerk auth
  return optionalAuth(req, res, next);
};

// API Routes (with combined authentication: API keys or Clerk)
// combinedAuth tries API key first, then falls back to Clerk auth
app.use('/api/agents', combinedAuth, agentsRouter);
app.use('/api/agents', combinedAuth, builderRouter); // Command Center builder endpoints
app.use('/api/agents', combinedAuth, flowRouter); // Flow Studio visual flow builder
app.use('/api/agents', combinedAuth, componentRouter); // Component library CRUD (Phase 4)
app.use('/api/agents', combinedAuth, abTestRouter); // A/B test management (Phase 4)
app.use('/api/agent-interview', combinedAuth, agentInterviewRouter); // 12-question interview flow
app.use('/api/agent-forge', combinedAuth, agentForgeRouter); // Freeform chat/voice agent creation
app.use('/api/tokens', combinedAuth, tokensRouter);
app.use('/api/calls', combinedAuth, callsRouter); // Voice call lifecycle management
app.use('/api/deploy', combinedAuth, deployRouter);
app.use('/api/analytics', combinedAuth, analyticsRouter);
app.use('/api/knowledge-base', combinedAuth, knowledgeBaseRouter);
app.use('/api/functions', combinedAuth, functionsRouter);
app.use('/api/custom-functions', combinedAuth, customFunctionsRouter); // Frontend compatibility + template library for HTTP custom functions
app.use('/api/function-templates', combinedAuth, functionTemplatesRouter); // Pre-built function templates library
app.use('/api/function-wizard', combinedAuth, functionWizardRouter); // AI-powered function generator from natural language
app.use('/api/voices', combinedAuth, voicesRouter);
app.use('/api/sessions', combinedAuth, sessionsRouter);
app.use('/api/transcripts', combinedAuth, transcriptsRouter);
app.use('/api/api-keys', combinedAuth, apiKeysRouter); // API key management (requires auth)
app.use('/api/deployments', combinedAuth, deploymentsRouter); // Deployment management
app.use('/api/crm', combinedAuth, crmRouter); // CRM integration (Salesforce, HubSpot, Pipedrive, Zoho)
app.use('/api/gdpr', combinedAuth, gdprRouter); // GDPR compliance (delete/export customer data)
app.use('/api/customer-memory', combinedAuth, customerMemoryRouter); // Customer memory identification, retrieval, GDPR
app.use('/api/memory', combinedAuth, memoryRouter); // Short-term memory sessions, messages, context
app.use('/api/knowledge-injection', combinedAuth, knowledgeInjectionRouter); // Knowledge injection settings and analytics

// OpenClaw SQLite API v2 - Hybrid Knowledge Bases and Customer Memory
// Routes: /api/v2/orgs/:orgId/knowledge-bases, /api/v2/orgs/:orgId/search, /api/v2/orgs/:orgId/customers
app.use('/api/v2', sqliteV2Router);

// MCP (Model Context Protocol) - Marketplace, Connections, Tool Execution, Agent Bindings
app.use('/api/mcp', combinedAuth, mcpCatalogRouter);
app.use('/api/mcp/connections', combinedAuth, mcpConnectionsRouter);
app.use('/api/mcp', combinedAuth, mcpExecutionRouter);
app.use('/api/mcp/oauth', mcpOAuthRouter); // OAuth routes - auth applied selectively (callback is public)

// Calendar routes - OAuth callbacks need to be public, all others require auth
app.use('/api/calendar', calendarRouter); // Calendar integration (Google Calendar, Calendly, Outlook, Apple Calendar)

// Messaging routes - WhatsApp Business and other messaging platforms
app.use('/api/messaging', combinedAuth, messagingRouter); // Messaging integration (WhatsApp, Twilio, MessageBird)

// Tutorial routes - Interactive onboarding tutorial (Phase 1 - P0 Journey)
app.use('/api/tutorial', combinedAuth, tutorialRouter);

// Context Manager - RLM-Lite context selection (Phase 9: Latency Optimization)
app.use('/api/context', combinedAuth, contextRouter);

// Brand analysis endpoints - enabled with Gemini AI and Playwright
app.use('/api/brands', combinedAuth, brandsRouter);

// REMOVED: Prewarm routes - feature not in use (PRD-001)
// app.use('/api/prewarm', combinedAuth, prewarmRouter);

// Prompt Assistant - AI-powered prompt generation, analysis, and improvement
app.use('/api/prompt-assistant', combinedAuth, promptAssistantRouter);

// Alert configuration and monitoring
app.use('/api/alerts', combinedAuth, alertsRouter);

// Usage Analytics - session metrics, token usage, geographic distribution
app.use('/api/usage', combinedAuth, usageRouter);

// ✅ PERFORMANCE: Voice latency metrics endpoint (requires auth)
// Mount under /api/metrics for authenticated latency metrics access
app.use('/api/metrics', combinedAuth, metricsRouter);

// Subscription & Billing - Stripe/Paddle integration
app.use('/api/subscription', combinedAuth, subscriptionRouter);

// Credit Packs - One-time credit purchases (1 credit = 1 minute = $1)
app.use('/api/credit-packs', combinedAuth, creditPacksRouter);

// Auto Top-up - Automatic minute refill configuration
app.use('/api/auto-topup', combinedAuth, autoTopupRouter);

// Call Analytics - dashboard statistics and trends
app.use('/api/call-analytics', combinedAuth, callAnalyticsRouter);
// Alias to avoid adblockers that block URLs containing "analytics".
app.use('/api/call-metrics', combinedAuth, callAnalyticsRouter);

// Provider Health - status monitoring and fallback management
app.use('/api/provider-health', combinedAuth, providerHealthRouter);

// Function Schema Generator - AI-assisted function creation
app.use('/api/function-schemas', combinedAuth, functionSchemaGeneratorRouter);

// LiveKit - WebRTC room management and tokens
app.use('/api/livekit', combinedAuth, livekitRouter);

// SIP - Phone integration for voice calls
app.use('/api/sip', combinedAuth, sipRouter);

// Function Versioning - version history and rollback
app.use('/api/function-versioning', combinedAuth, functionVersioningRouter);

// HubSpot - CRM integration specific endpoints
app.use('/api/hubspot', combinedAuth, hubspotRouter);

// CRM Functions - CRM data sync and automation
app.use('/api/crm-functions', combinedAuth, crmFunctionsRouter);

// REMOVED: Fly.io Machine Management - per-agent deployment deprecated (PRD-002)
// REMOVED: Workers routes - per-agent deployment deprecated (PRD-002)

// Admin Tools - Platform owner utilities (user ID lookup, rate limit status)
app.use('/api/admin', adminToolsRouter);

// Public endpoints - no auth needed
app.use('/api/webhooks', webhooksRouter); // Webhooks (Clerk, etc.)
app.use('/api/sip/webhook', sipWebhookRouter); // SIP webhooks (Telnyx, Twilio - external provider callbacks)
app.use('/api/providers', providersRouter); // Provider catalog
app.use('/api/voice-providers', voiceProvidersRouter); // Voice provider catalog
app.use('/api/services', serviceTemplatesRouter); // Service integration templates

// Provider Keys Management - REQUIRES AUTH (routes have requireAuth middleware)
app.use('/api/provider-keys', providerKeysRouter); // User-specific provider API keys (protected)

// Health check endpoints (public for monitoring)
app.use('/health', healthRouter);

// Monitoring endpoints (SCL-08, SCL-12, SCL-16) - public for Prometheus/Grafana
app.use('/monitoring', monitoringRouter);

// WebSocket info endpoint (public)
app.use('/api/websocket', websocketRouter);

// API Documentation (Swagger/OpenAPI)
import { setupSwagger } from './docs/swagger';
setupSwagger(app);

// Error handling middleware (MUST be registered AFTER all routes)
import {
  errorHandler,
  notFoundHandler,
  setupUnhandledRejectionHandler,
  setupUncaughtExceptionHandler,
} from './middleware/error-handler.middleware';

// Setup global error handlers
setupUnhandledRejectionHandler();
setupUncaughtExceptionHandler();

// Sentry error handler (must be AFTER routes, BEFORE other error handlers)
Sentry.setupExpressErrorHandler(app);

// Database error handler - handles connection pool exhaustion gracefully
import { databaseErrorHandler } from './middleware/database-error-handler.middleware';

// 404 handler - catches all undefined routes
app.use(notFoundHandler);

// Database error handler - BEFORE global error handler
app.use(databaseErrorHandler);

// Global error handler - catches all errors
app.use(errorHandler);

// ✅ REAL-TIME: Create HTTP server (needed for WebSocket)
const httpServer = createServer(app);

// Start server
async function startServer() {
  try {
    // Connect to database
    await connectDatabase();
    // Safety net: if Fly release_command didn't run for any reason, attempt to apply migrations
    // before starting to accept traffic (keeps readiness probes from failing on missing tables).
    await ensurePrismaMigrationsApplied();

    // Validate Forge configuration (optional feature - logs warning but doesn't exit)
    try {
      validateForgeConfig();
      logger.info('Forge configuration validated');
    } catch (forgeError) {
      // Forge is optional - log warning but don't exit
      // The feature will be disabled at runtime if config is missing
      logger.warn('Forge configuration incomplete - Agent Forge feature will be disabled', {
        error: forgeError instanceof Error ? forgeError.message : String(forgeError),
      });
    }

    // E2E/test bootstrap: NEVER run in production environments.
    const isProductionEnvironment =
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL_ENV === 'production' ||
      (process.env.FLY_APP_NAME || '').toLowerCase().includes('prod');

    if (isProductionEnvironment && process.env.DEMO_MODE === 'true') {
      logger.error('SECURITY: DEMO_MODE=true detected in production environment. Ignoring.');
    }

    if (!isProductionEnvironment && process.env.DEMO_MODE === 'true' && process.env.DEMO_API_KEY) {
      const bcrypt = await import('bcrypt');

      const demoApiKey = process.env.DEMO_API_KEY;
      const demoUserId =
        process.env.DEMO_USER_ID ||
        `test-user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

      // Create a clearly-identifiable test user with a real password hash.
      const hashedPassword = await bcrypt.hash('test-password-not-for-production', 12);

      await prisma.users.upsert({
        where: { id: demoUserId },
        update: { updatedAt: new Date() },
        create: {
          id: demoUserId,
          email: `test-${Date.now()}@test.vora.local`,
          name: 'E2E Test User',
          passwordHash: hashedPassword,
          // Note: users.apiKey is required in the current schema; do NOT store the demo API key here.
          apiKey: cuid(),
          updatedAt: new Date(),
        },
      });

      // Store only derived material for the API key + ensure it expires.
      const keyHash = crypto.createHash('sha256').update(demoApiKey).digest('hex');
      const keyPrefix = demoApiKey.substring(0, 16);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await prisma.api_keys.upsert({
        where: { id: 'e2e_demo_api_key' },
        update: {
          userId: demoUserId,
          name: 'E2E Test Key (Auto-Expires)',
          key: `${keyPrefix}...`,
          keyPrefix,
          keyHash,
          isActive: true,
          revokedAt: null,
          expiresAt,
          updatedAt: new Date(),
        },
        create: {
          id: 'e2e_demo_api_key',
          userId: demoUserId,
          name: 'E2E Test Key (Auto-Expires)',
          key: `${keyPrefix}...`,
          keyPrefix,
          keyHash,
          isActive: true,
          expiresAt,
          updatedAt: new Date(),
        },
      });

      logger.info('✅ Test environment ready (non-production only)', {
        demoUserId,
        expiresAt: expiresAt.toISOString(),
      });
    }

    // Initialize CRM provider factories (non-blocking, optional)
    await initializeCRMProviders();

    // Initialize queue health monitoring (SCL-08)
    initializeQueueMonitoring();
    logger.info('✅ Queue health monitoring initialized');

    // Initialize cache warming worker and scheduler (Phase 9: SEM-07)
    if (isFeatureEnabled('SEMANTIC_CACHE_WARMING')) {
      try {
        createCacheWarmingWorker();
        await scheduleOffPeakCacheWarming();
        logger.info('✅ Cache warming job initialized and scheduled');
      } catch (error) {
        logger.warn('Failed to initialize cache warming job', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Initialize memory management workers (Advanced Memory System)
    try {
      // Conversation compression worker (triggered by webhooks on room_finished)
      startCompressConversationWorker(prisma);
      logger.info('✅ Conversation compression worker started');

      // Entity extraction worker for Knowledge Graph (Phase 6)
      startExtractEntitiesWorker(prisma);
      logger.info('✅ Entity extraction worker started');

      // Memory pruning worker (daily job at 3 AM UTC)
      startPruneExpiredMemoriesWorker(prisma);
      await scheduleDailyPruning();
      logger.info('✅ Memory pruning worker started and scheduled');

      // RIF recalculation worker (weekly job on Sundays at 2 AM UTC)
      startRecalculateRIFScoresWorker(prisma);
      await scheduleWeeklyRIFRecalculation();
      logger.info('✅ RIF recalculation worker started and scheduled');
    } catch (error) {
      logger.warn('Failed to initialize memory management workers', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Initialize SQLite memory management workers (OpenClaw)
    try {
      const sqliteWorkersStarted = startSqliteWorkers();

      if (sqliteWorkersStarted > 0) {
        // Schedule recurring jobs only if workers started successfully
        await scheduleSqliteDailyPruning();
        logger.info('✅ SQLite memory pruning scheduled (daily at 3 AM UTC)');

        await scheduleSqliteWeeklyRecalculation();
        logger.info('✅ SQLite RIF recalculation scheduled (weekly Sundays at 2 AM UTC)');
      }
    } catch (error) {
      logger.warn('Failed to initialize SQLite workers', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Initialize WebSocket service
    initializeWebSocket(httpServer);

    // Start listening - default to 0.0.0.0 so localhost/127.0.0.1/IPv6 can all reach the server reliably in dev/E2E.
    const HOST = process.env.HOST || '0.0.0.0';
    // Dynamic import for health check logging (avoids linter stripping top-level import)
    const redisModule = await import('./config/redis');

    httpServer.listen(PORT, HOST, () => {
      logger.info('🚀 Vora AI Voice Platform - Backend API started', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        healthCheck: `http://localhost:${PORT}/health`,
        websocket: `ws://localhost:${PORT}/socket.io`,
        compiler: 'Gemini 2.5 Pro',
      });

      // Memory extraction dependency health check
      const geminiEnvVars = [
        'GOOGLE_AI_API_KEY',
        'GEMINI_API_KEY',
        'GOOGLE_GEMINI_API_KEY',
        'GOOGLE_API_KEY',
      ];
      const geminiKeyVar = geminiEnvVars.find(k => process.env[k]);
      if (geminiKeyVar) {
        logger.info(`Memory extraction: Gemini API key found via ${geminiKeyVar}`);
      } else {
        logger.warn('Memory extraction: No Gemini API key found - extraction disabled');
      }

      if (redisModule.redisConnection) {
        logger.info('Memory extraction: BullMQ queue available (Redis TCP connected)');
      } else {
        logger.warn('Memory extraction: BullMQ unavailable, using non-blocking fallback');
      }

      // MCP OAuth token auto-refresh (every 4 minutes)
      setInterval(
        async () => {
          try {
            const { mcpOAuthService } = await import('./services/mcp-oauth.service');
            await mcpOAuthService.refreshExpiringTokens();
          } catch (err) {
            console.error('[MCP OAuth] Token refresh failed:', err);
          }
        },
        4 * 60 * 1000
      );
      logger.info('MCP OAuth token auto-refresh scheduled (every 4 minutes)');
    });
  } catch (error) {
    logger.error(
      'Failed to start server',
      error instanceof Error ? error : new Error(String(error))
    );

    // Cleanup queue monitoring
    stopHealthCheckInterval();

    process.exit(1);
  }
}

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, starting graceful shutdown...');

  try {
    // Stop queue health monitoring
    stopHealthCheckInterval();
    logger.info('Queue health monitoring stopped');

    // Stop memory management workers
    await stopCompressConversationWorker();
    await stopExtractEntitiesWorker();
    await stopPruneExpiredMemoriesWorker();
    await stopRecalculateRIFScoresWorker();
    logger.info('Memory management workers stopped');

    // Stop SQLite workers
    await stopSqliteWorkers();
    logger.info('SQLite workers stopped');

    // Shutdown WebSocket connections
    await shutdownWebSocket();
    logger.info('WebSocket connections closed');

    // Cleanup connection monitor
    await cleanupConnectionMonitor();
    logger.info('Connection monitor cleaned up');

    // Disconnect from database
    await disconnectDatabase();
    logger.info('Database disconnected');

    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, starting graceful shutdown...');

  try {
    stopHealthCheckInterval();
    await stopCompressConversationWorker();
    await stopExtractEntitiesWorker();
    await stopPruneExpiredMemoriesWorker();
    await stopRecalculateRIFScoresWorker();
    await stopSqliteWorkers();
    await shutdownWebSocket();
    await cleanupConnectionMonitor();
    await disconnectDatabase();
    logger.info('✅ Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown', error);
    process.exit(1);
  }
});

// ✅ GRACEFUL SHUTDOWN: Comprehensive shutdown handler
import { registerShutdownHandlers } from './utils/shutdown';
registerShutdownHandlers(httpServer);

// Start
startServer();
