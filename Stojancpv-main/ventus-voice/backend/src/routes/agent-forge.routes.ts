/**
 * Agent Forge API Routes
 * Freeform agent creation flow (chat-first, voice-compatible)
 *
 * Pattern: requireAuth → zodValidation → handler
 */

import { Router, Request, Response } from 'express';
import { requireAuth, optionalAuth, clerkClient } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { prisma } from '../config/database';
import { createLogger } from '../utils/logger';
import { createId as cuid } from '@paralleldrive/cuid2';
import {
  startForgeSchema,
  sendForgeMessageSchema,
  completeForgeSchema,
  getForgeSessionSchema,
  startForgeVoiceSchema,
  storeForgeVoiceTranscriptSchema,
  applyForgeVoiceBlueprintSchema,
} from '../schemas/agent-forge.schema';
import { getAgentForgeService } from '../services/agent-forge.service';
import { ForgeError, ForgeErrorCode } from '../errors/forge.error';
import { getLiveKitRoomManager } from '../services/livekit-room.service';
import { isPrismaMissingTableError } from '../utils/prisma-errors';
import { checkPlanLimits } from '../services/subscription.service';
import {
  VOICE_ERROR_CODES,
  ERROR_CODE_TO_STATUS,
  createVoiceErrorResponse,
  createForgeErrorResponse,
} from '../constants/error-codes';
import { forgeCheckpointService } from '../services/forge-checkpoint.service';
import { contextSummaryService } from '../services/context-summary.service';
import { sessionDeviceService } from '../services/session-device.service';
import { RoomServiceClient, DataPacket_Kind } from 'livekit-server-sdk';
import { previewUpdateService } from '../services/preview-update.service';

const logger = createLogger('AgentForge.routes');

/** Shared secret for server-to-server auth (backend ↔ Python runtime) */
const RUNTIME_SECRET = process.env.RUNTIME_SECRET;
if (!RUNTIME_SECRET) {
  console.warn('[SECURITY] RUNTIME_SECRET not set - server-to-server auth will reject all requests');
}

const router = Router();
const forgeService = getAgentForgeService();
const livekitManager = () => getLiveKitRoomManager();

/**
 * Map ForgeErrorCode to HTTP status codes.
 */
const FORGE_ERROR_TO_STATUS: Record<ForgeErrorCode, number> = {
  [ForgeErrorCode.SESSION_NOT_FOUND]: 404,
  [ForgeErrorCode.SESSION_EXPIRED]: 410,
  [ForgeErrorCode.COMPILATION_FAILED]: 500,
  [ForgeErrorCode.COMPILATION_TIMEOUT]: 504,
  [ForgeErrorCode.INVALID_INPUT]: 400,
  [ForgeErrorCode.RATE_LIMITED]: 429,
  [ForgeErrorCode.FORBIDDEN]: 403,
  [ForgeErrorCode.INTERNAL_ERROR]: 500,
};

/**
 * Handle ForgeError instances with consistent HTTP responses and logging.
 *
 * Maps ForgeErrorCode to appropriate HTTP status codes and returns
 * a consistent { error, code } response format.
 *
 * @param res - Express response object
 * @param error - The error to handle
 * @param context - Optional context string for logging
 * @returns true if error was handled, false if not a ForgeError
 */
function handleForgeError(res: Response, error: unknown, context?: string): boolean {
  if (!ForgeError.isForgeError(error)) {
    return false;
  }

  const status = FORGE_ERROR_TO_STATUS[error.code];
  const isClientError = status >= 400 && status < 500;

  // Log with appropriate severity (warn for 4xx, error for 5xx)
  if (isClientError) {
    logger.warn(context || 'Forge client error', {
      code: error.code,
      message: error.message,
      details: error.details,
    });
  } else {
    logger.error(context || 'Forge server error', {
      code: error.code,
      message: error.message,
      details: error.details,
      stack: error.stack,
    });
  }

  res.status(status).json({
    error: error.message,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
  });

  return true;
}

function replyForgeNotConfigured(res: Response, error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (!error.message.toLowerCase().includes('forge guide not configured')) return false;
  const errorResponse = createForgeErrorResponse(
    VOICE_ERROR_CODES.FORGE_CONFIG_MISSING,
    'Forge is not configured yet. Set XAI_API_KEY and XAI_ARCHITECT_MODEL on the backend.',
    { requiredEnvVars: ['XAI_API_KEY', 'XAI_ARCHITECT_MODEL'] },
  );
  res.status(ERROR_CODE_TO_STATUS[VOICE_ERROR_CODES.FORGE_CONFIG_MISSING]).json(errorResponse);
  return true;
}

/**
 * Classify error type for standardized Forge error responses
 */
function classifyForgeError(error: unknown): {
  code: typeof VOICE_ERROR_CODES[keyof typeof VOICE_ERROR_CODES];
  message: string;
  details?: Record<string, unknown>;
} {
  if (!(error instanceof Error)) {
    return {
      code: VOICE_ERROR_CODES.FORGE_SESSION_CREATION_FAILED,
      message: 'An unexpected error occurred',
    };
  }

  const errorMsg = error.message.toLowerCase();

  // Config/env var errors
  if (errorMsg.includes('not configured') ||
      errorMsg.includes('api_key') ||
      errorMsg.includes('missing') && (errorMsg.includes('xai') || errorMsg.includes('routeway'))) {
    return {
      code: VOICE_ERROR_CODES.FORGE_CONFIG_MISSING,
      message: error.message,
      details: { type: 'configuration' },
    };
  }

  // Database/Prisma errors
  if (errorMsg.includes('prisma') ||
      errorMsg.includes('database') ||
      errorMsg.includes('transaction') ||
      error.message.match(/P\d{4}/) || // Prisma error codes like P2002
      errorMsg.includes('unique constraint') ||
      errorMsg.includes('foreign key')) {
    return {
      code: VOICE_ERROR_CODES.FORGE_DATABASE_ERROR,
      message: 'Database operation failed',
      details: { originalError: error.message },
    };
  }

  // AI service errors (OpenAI, xAI, Routeway)
  if (errorMsg.includes('openai') ||
      errorMsg.includes('xai') ||
      errorMsg.includes('routeway') ||
      errorMsg.includes('openrouter') ||
      errorMsg.includes('api request failed') ||
      errorMsg.includes('model returned empty') ||
      errorMsg.includes('compilation') ||
      errorMsg.includes('timeout') && errorMsg.includes('agent')) {
    return {
      code: VOICE_ERROR_CODES.FORGE_AI_SERVICE_ERROR,
      message: 'AI service request failed',
      details: { originalError: error.message },
    };
  }

  // Default to session creation failed
  return {
    code: VOICE_ERROR_CODES.FORGE_SESSION_CREATION_FAILED,
    message: error.message,
  };
}

function replyLiveKitNotConfigured(res: Response): void {
  const errorResponse = createVoiceErrorResponse(
    VOICE_ERROR_CODES.LIVEKIT_NOT_CONFIGURED,
    'Voice is not configured yet. Set LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_WS_URL on the backend.',
  );
  res.status(ERROR_CODE_TO_STATUS[VOICE_ERROR_CODES.LIVEKIT_NOT_CONFIGURED]).json(errorResponse);
}

async function ensureUserExists(clerkUserId: string): Promise<void> {
  const existing = await prisma.users.findUnique({ where: { id: clerkUserId } });
  if (existing) return;

  let clerkUser:
    | { emailAddresses?: Array<{ emailAddress: string }>; firstName?: string | null; lastName?: string | null }
    | null = null;
  try {
    clerkUser = await clerkClient.users.getUser(clerkUserId);
  } catch (error) {
    logger.warn('Could not fetch Clerk user data', { error });
  }

  const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || `${clerkUserId}@placeholder.vora.ai`;
  const userName = clerkUser?.firstName
    ? `${clerkUser.firstName}${clerkUser.lastName ? ' ' + clerkUser.lastName : ''}`
    : 'Vora User';

  await prisma.users.create({
    data: {
      id: clerkUserId,
      email: userEmail,
      name: userName,
      passwordHash: 'oauth_user',
      apiKey: cuid(),
      updatedAt: new Date(),
    },
  });
}

function extractForgeRefs(previewData: unknown): { agentId: string; knowledgeBaseId: string } | null {
  const data = previewData as any;
  const forge = data?.forge;
  if (!forge?.agentId || !forge?.knowledgeBaseId) return null;
  return { agentId: String(forge.agentId), knowledgeBaseId: String(forge.knowledgeBaseId) };
}

/**
 * Notify the previous device that a handoff has occurred
 * Sends a LiveKit data message to the old room to trigger graceful disconnect
 */
async function notifyPreviousDevice(roomName: string, previousDeviceId: string): Promise<void> {
  try {
    if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_WS_URL) {
      logger.warn('Cannot notify previous device - LiveKit not configured');
      return;
    }

    const roomClient = new RoomServiceClient(
      process.env.LIVEKIT_WS_URL,
      process.env.LIVEKIT_API_KEY,
      process.env.LIVEKIT_API_SECRET
    );

    const handoffMessage = JSON.stringify({
      type: 'device_handoff',
      message: 'This session has been resumed on another device',
      previousDeviceId: previousDeviceId.substring(0, 8),
      timestamp: new Date().toISOString(),
    });

    await roomClient.sendData(roomName, Buffer.from(handoffMessage), DataPacket_Kind.RELIABLE, {
      destinationIdentities: [], // Broadcast to all participants
    });

    logger.info('Handoff notification sent to previous device', {
      roomName,
      previousDeviceId: previousDeviceId.substring(0, 8),
    });
  } catch (error) {
    logger.error('Failed to notify previous device about handoff', {
      roomName,
      error,
    });
    // Non-critical error - continue with handoff
  }
}

/**
 * POST /api/agent-forge/start
 * Creates a draft agent + knowledge base and starts a freeform session.
 */
router.post(
  '/start',
  requireAuth,
  validateRequest({ body: startForgeSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      await ensureUserExists(userId);

      const limits = await checkPlanLimits(userId);
      if (!limits.canCreateAgent) {
        return res.status(402).json({
          error: 'Quota exceeded',
          code: 'AGENTS_LIMIT_REACHED',
          message: 'Agent limit reached for your plan. Upgrade to create more agents.',
          details: {
            agentsRemaining: limits.agentsRemaining,
          },
        });
      }

      const languageHint =
        typeof req.body?.language === 'string' && req.body.language.trim().length > 0
          ? req.body.language.trim()
          : undefined;

      const idempotencyKey =
        typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim().length > 0
          ? req.body.idempotencyKey.trim()
          : undefined;

      const result = await forgeService.startSession({ clerkUserId: userId, languageHint, idempotencyKey });
      return res.json(result);
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to start forge session')) return;

      logger.error('Failed to start forge session', { error });
      if (isPrismaMissingTableError(error, ['interview_sessions'])) {
        const errorResponse = createForgeErrorResponse(
          VOICE_ERROR_CODES.FORGE_DATABASE_ERROR,
          'Database migrations are not applied yet. Please retry in a minute.',
          { code: 'MIGRATIONS_PENDING' },
        );
        return res.status(ERROR_CODE_TO_STATUS[VOICE_ERROR_CODES.FORGE_DATABASE_ERROR]).json(errorResponse);
      }
      if (replyForgeNotConfigured(res, error)) return;

      // Classify and return standardized error response
      const classified = classifyForgeError(error);
      const errorResponse = createForgeErrorResponse(
        classified.code as any,
        classified.message,
        classified.details,
      );
      return res.status(ERROR_CODE_TO_STATUS[classified.code]).json(errorResponse);
    }
  },
);

/**
 * POST /api/agent-forge/voice/start
 * Voice-first Forge flow: creates/reuses a Forge session, then creates a LiveKit room
 * and returns a participant token for the user.
 */
router.post(
  '/voice/start',
  requireAuth,
  validateRequest({ body: startForgeVoiceSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      if (!process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_API_SECRET || !process.env.LIVEKIT_WS_URL) {
        return replyLiveKitNotConfigured(res);
      }

      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      await ensureUserExists(userId);

      const limits = await checkPlanLimits(userId);
      if (!limits.canUseMinutes) {
        return res.status(402).json({
          error: 'Quota exceeded',
          code: 'MINUTES_LIMIT_REACHED',
          message: 'Minutes limit reached for your plan. Upgrade to continue using voice.',
          details: {
            minutesRemaining: limits.minutesRemaining,
          },
        });
      }

      const languageHint =
        typeof req.body?.language === 'string' && req.body.language.trim().length > 0
          ? req.body.language.trim()
          : undefined;

      const existingSessionId =
        typeof req.body?.sessionId === 'string' && req.body.sessionId.trim().length > 0
          ? req.body.sessionId.trim()
          : undefined;

      const idempotencyKey =
        typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim().length > 0
          ? req.body.idempotencyKey.trim()
          : undefined;

      let sessionId = existingSessionId;
      let agentId: string;
      let knowledgeBaseId: string;

      if (!sessionId) {
        if (!limits.canCreateAgent) {
          return res.status(402).json({
            error: 'Quota exceeded',
            code: 'AGENTS_LIMIT_REACHED',
            message: 'Agent limit reached for your plan. Upgrade to create more agents.',
            details: {
              agentsRemaining: limits.agentsRemaining,
            },
          });
        }
        const started = await forgeService.startSession({ clerkUserId: userId, languageHint, seedAssistantMessage: false, idempotencyKey });
        sessionId = started.sessionId;
        agentId = started.agentId;
        knowledgeBaseId = started.knowledgeBaseId;
      } else {
        const session = await prisma.interview_sessions.findUnique({ where: { id: sessionId } });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.clerkUserId !== userId) return res.status(403).json({ error: 'Forbidden' });

        const refs = extractForgeRefs(session.previewData);
        if (!refs) return res.status(400).json({ error: 'Invalid session data' });
        agentId = refs.agentId;
        knowledgeBaseId = refs.knowledgeBaseId;
      }

      // Device tracking and handoff detection
      const userAgent = req.headers['user-agent'] || 'unknown';
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
                       (req.headers['x-real-ip'] as string) ||
                       req.ip ||
                       'unknown';
      const deviceId = sessionDeviceService.generateDeviceId(userAgent, clientIp);

      const roomName = `room_forge-conductor_${sessionId}`;

      // Register device and check for handoff
      let handoffInfo: { isHandoff: boolean; previousDeviceId?: string } | null = null;

      if (sessionDeviceService.isAvailable()) {
        const { isNewDevice, previousDevice } = await sessionDeviceService.registerDevice(sessionId, {
          deviceId,
          userAgent,
          connectedAt: new Date(),
          roomSid: roomName,
        });

        if (isNewDevice && previousDevice) {
          handoffInfo = {
            isHandoff: true,
            previousDeviceId: previousDevice.deviceId,
          };

          // Create a fresh checkpoint before handoff to preserve state
          try {
            const session = await prisma.interview_sessions.findUnique({
              where: { id: sessionId },
              select: { previewData: true },
            });

            if (session) {
              const previewData = session.previewData as any;
              await forgeCheckpointService.createCheckpoint({
                sessionId,
                blueprint: previewData?.forge?.blueprint || {},
                messages: previewData?.forge?.messages || [],
                turnCount: previewData?.forge?.turnCount || 0,
              });
              logger.info('Pre-handoff checkpoint created', { sessionId });
            }
          } catch (err) {
            logger.warn('Failed to create pre-handoff checkpoint', { sessionId, error: err });
          }

          // Notify previous device
          if (previousDevice.roomSid) {
            await notifyPreviousDevice(previousDevice.roomSid, previousDevice.deviceId);
          }
        }
      }

      // Fetch resume context if session has checkpoints
      // Phase 3 - FR-001: Handle null contextSummary with fallback
      let resumeContext: string | null = null;
      let isResuming = false;

      if (existingSessionId) {
        try {
          const checkpoint = await forgeCheckpointService.getLatestCheckpoint(sessionId);
          if (checkpoint) {
            const contextSummary = checkpoint.contextSummary;
            const blueprintJson = checkpoint.blueprintJson;

            if (contextSummary && contextSummary.trim() !== '') {
              // Use AI-generated context summary
              resumeContext = contextSummaryService.formatForAgentPrompt(
                contextSummary,
                blueprintJson,
              );
              isResuming = true;
              logger.info('Resume context prepared with AI summary', {
                sessionId,
                progressPercent: checkpoint.progressPercent,
              });
            } else if (blueprintJson) {
              // Fallback: Generate minimal context from blueprint when contextSummary is null
              const fallbackSummary = contextSummaryService.generateSimpleSummary(blueprintJson);
              resumeContext = contextSummaryService.formatForAgentPrompt(
                fallbackSummary,
                blueprintJson,
              );
              isResuming = true;
              logger.warn('Resume context prepared with fallback (no AI summary)', {
                sessionId,
                progressPercent: checkpoint.progressPercent,
              });
            }
          }
        } catch (err) {
          logger.warn('Failed to fetch resume context, proceeding without', { sessionId, error: err });
        }
      }

      // Create a usage session record so voice minutes are tracked via LiveKit webhooks.
      // This keeps billing/analytics consistent with "voice calls" sessions.
      const existingUsageSession = await prisma.agent_sessions.findFirst({
        where: { livekitRoomName: roomName, userId },
        select: { id: true },
      });

      if (!existingUsageSession) {
        await prisma.agent_sessions.create({
          data: {
            id: cuid(),
            agentId,
            userId,
            livekitRoomName: roomName,
            participantName: 'Forge Participant',
            metadata: {
              flow: 'forge_voice',
              forgeSessionId: sessionId,
              knowledgeBaseId,
            },
          },
        });
      }

      const roomMetadata = {
        agent_id: 'forge-conductor',
        session_id: sessionId,
        sessionId,
        flow: 'forge_voice',
        agentId,
        knowledgeBaseId,
        languageHint,
        // Resume context for voice session continuation
        resumeContext: resumeContext || undefined,
        isResuming,
      };

      await livekitManager().createRoom(roomName, {
        emptyTimeout: 600, // 10 minutes
        maxParticipants: 2, // user + agent worker
        metadata: roomMetadata,
      });

      // Explicitly dispatch the Vora agent to the room
      // Required for LiveKit Agents SDK v1.0+ with agent_name registration
      // Note: dispatchAgent now includes automatic cache warming for agentId
      await livekitManager().dispatchAgent(roomName, JSON.stringify(roomMetadata));

      logger.info(`Room created and agent dispatched: ${roomName}`, { sessionId });

      const participantToken = await livekitManager().generateParticipantToken(
        roomName,
        `user_${userId}`,
        'Forge Participant',
        { type: 'user', sessionId },
        // No longer using token-based dispatch - using explicit API dispatch above
      );

      const wsUrl = process.env.LIVEKIT_WS_URL;
      if (!wsUrl) {
        return replyLiveKitNotConfigured(res);
      }

      return res.json({
        sessionId,
        agentId,
        knowledgeBaseId,
        roomName,
        participantToken,
        wsUrl,
        isResuming,
        deviceId,
        handoffInfo: handoffInfo || undefined,
      });
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to start forge voice session')) return;

      logger.error('Failed to start forge voice session', { error });
      if (isPrismaMissingTableError(error, ['interview_sessions'])) {
        const errorResponse = createForgeErrorResponse(
          VOICE_ERROR_CODES.FORGE_DATABASE_ERROR,
          'Database migrations are not applied yet. Please retry in a minute.',
          { code: 'MIGRATIONS_PENDING' },
        );
        return res.status(ERROR_CODE_TO_STATUS[VOICE_ERROR_CODES.FORGE_DATABASE_ERROR]).json(errorResponse);
      }
      if (replyForgeNotConfigured(res, error)) return;

      // Classify and return standardized error response
      const classified = classifyForgeError(error);
      const errorResponse = createForgeErrorResponse(
        classified.code as any,
        classified.message,
        classified.details,
      );
      return res.status(ERROR_CODE_TO_STATUS[classified.code]).json(errorResponse);
    }
  },
);

/**
 * GET /api/agent-forge/config
 * Returns a minimal, non-secret view of whether Forge/Voice are configured.
 */
router.get('/config', requireAuth, async (_req: Request, res: Response) => {
  return res.json({
    forge: {
      configured: Boolean(process.env.XAI_API_KEY && process.env.XAI_ARCHITECT_MODEL),
      model: process.env.XAI_ARCHITECT_MODEL ? 'set' : 'missing',
    },
    voice: {
      configured: Boolean(process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET && process.env.LIVEKIT_WS_URL),
      livekitWsUrl: process.env.LIVEKIT_WS_URL ? 'set' : 'missing',
    },
  });
});

/**
 * GET /api/agent-forge/:sessionId/preview-stream
 * Phase 5 FR-002: SSE endpoint for real-time preview updates.
 * Falls back to polling if SSE connection fails.
 */
router.get(
  '/:sessionId/preview-stream',
  requireAuth,
  async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const userId = req.auth?.userId;

    // Verify session ownership
    const session = await prisma.interview_sessions.findUnique({
      where: { id: sessionId },
      select: { clerkUserId: true },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.clerkUserId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.flushHeaders();

    // Helper to send SSE events
    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Subscribe to preview updates
    const unsubscribe = previewUpdateService.subscribe(sessionId, (update) => {
      sendEvent('preview_update', update);
    });

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30000);

    // Cleanup on close
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      logger.debug('SSE connection closed', { sessionId });
    });

    // Send connected event
    sendEvent('connected', { sessionId, timestamp: new Date().toISOString() });

    logger.info('SSE preview stream started', { sessionId, userId });
  }
);

/**
 * POST /api/agent-forge/voice/transcript
 * Persist voice transcript segments (final only) into Forge session state.
 * Intended for frontend usage (LiveKit transcription forwarding).
 */
router.post(
  '/voice/transcript',
  validateRequest({ body: storeForgeVoiceTranscriptSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, speaker, transcript, isFinal, language, timestamp } = req.body;
      await forgeService.ingestVoiceTranscript({ sessionId, speaker, transcript, isFinal, language, timestamp });
      return res.json({ ok: true });
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to ingest forge voice transcript')) return;

      logger.error('Failed to ingest forge voice transcript', { error });
      const msg = error instanceof Error ? error.message : 'Failed to ingest transcript';
      const status = msg === 'Session not found' ? 404 : msg === 'Invalid session data' ? 400 : 500;
      return res.status(status).json({ error: msg });
    }
  },
);

/**
 * POST /api/agent-forge/voice/blueprint
 * Apply blueprint updates coming from the voice conductor model/tool calls.
 */
router.post(
  '/voice/blueprint',
  validateRequest({ body: applyForgeVoiceBlueprintSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, blueprintUpdates, shouldWrapUp, language } = req.body;
      const result = await forgeService.applyVoiceBlueprintUpdates({
        sessionId,
        blueprintUpdates,
        shouldWrapUp,
        language,
      });

      // Phase 5: Publish update to SSE subscribers
      if (result?.blueprint) {
        previewUpdateService.publish(sessionId, {
          type: 'blueprint_updated',
          blueprint: result.blueprint,
          timestamp: new Date().toISOString(),
          sessionId,
        });
      }

      return res.json({ ok: true });
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to apply forge blueprint updates')) return;

      logger.error('Failed to apply forge blueprint updates', { error });
      const msg = error instanceof Error ? error.message : 'Failed to apply updates';
      const status = msg === 'Session not found' ? 404 : msg === 'Invalid session data' ? 400 : 500;
      return res.status(status).json({ error: msg });
    }
  },
);

/**
 * POST /api/agent-forge/:sessionId/kb-upload-complete
 * Acknowledge that KB documents were uploaded during the Forge voice session.
 * Clears kbGatekeeper state so UI dismisses upload prompt and voice agent knows docs are available.
 */
router.post(
  '/:sessionId/kb-upload-complete',
  requireAuth,
  validateRequest({ params: getForgeSessionSchema.shape.params }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { sessionId } = req.params;
      const documentCount = typeof req.body?.documentCount === 'number' ? req.body.documentCount : undefined;

      // Verify session ownership
      const session = await prisma.interview_sessions.findUnique({
        where: { id: sessionId },
        select: { clerkUserId: true },
      });

      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.clerkUserId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const result = await forgeService.acknowledgeKbUpload({ sessionId, documentCount });

      return res.json(result);
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to acknowledge KB upload')) return;

      logger.error('Failed to acknowledge KB upload', { error });
      if (isPrismaMissingTableError(error, ['interview_sessions'])) {
        return res.status(503).json({ error: 'Service Unavailable', code: 'MIGRATIONS_PENDING' });
      }
      const msg = error instanceof Error ? error.message : 'Failed to acknowledge upload';
      const status = msg === 'Session not found' ? 404 : msg === 'Invalid session data' ? 400 : 500;
      return res.status(status).json({ error: msg });
    }
  },
);

/**
 * GET /api/agent-forge/incomplete
 * Returns the most recent incomplete Forge session for the authenticated user.
 *
 * Shape intentionally mirrors the legacy interview "incomplete" card.
 */
router.get('/incomplete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    const session = await prisma.interview_sessions.findFirst({
      where: { clerkUserId: userId, isComplete: false },
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, previewData: true },
    });

    if (!session) {
      return res.json({ hasIncompleteSession: false, session: null });
    }

    const preview: any = session.previewData as any;
    const blueprint = preview?.forge?.blueprint || {};
    const shouldComplete = preview?.forge?.shouldComplete === true;

    // 7 logical stages for agent setup progress (US-007)
    const hasValue = (v: unknown): boolean =>
      v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);

    const stages = [
      { name: 'basic_info', done: hasValue(blueprint.agent_name) && hasValue(blueprint.role) && hasValue(blueprint.industry) },
      { name: 'system_prompt', done: hasValue(blueprint.main_goal) && hasValue(blueprint.primary_tasks) },
      { name: 'llm_model', done: hasValue(blueprint.personality_vibe) },
      { name: 'voice_config', done: hasValue(blueprint.opening_message) },
      { name: 'stt_config', done: hasValue(blueprint.language) },
      { name: 'knowledge_base', done: hasValue(blueprint.knowledge_base_plan) },
      { name: 'tested', done: shouldComplete },
    ];

    const completedStages = stages.filter(s => s.done).length;
    const totalStages = 7;
    // Incomplete sessions never show 100%
    const progress = completedStages >= totalStages
      ? 99
      : Math.round((completedStages / totalStages) * 100);
    // Find the first incomplete stage name for navigation
    const firstIncompleteStage = stages.find(s => !s.done)?.name || 'basic_info';

    return res.json({
      hasIncompleteSession: true,
      session: {
        sessionId: session.id,
        currentQuestionIndex: completedStages,
        totalQuestions: totalStages,
        progress,
        createdAt: session.createdAt.toISOString(),
        firstIncompleteStage,
      },
    });
  } catch (error) {
    // Handle typed ForgeError first
    if (handleForgeError(res, error, 'Failed to fetch incomplete forge session')) return;

    logger.error('Failed to fetch incomplete forge session', { error });
    if (isPrismaMissingTableError(error, ['interview_sessions'])) {
      return res.status(503).json({ error: 'Service Unavailable', code: 'MIGRATIONS_PENDING' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * GET /api/agent-forge/:sessionId
 * Fetch session state (messages + blueprint).
 */
router.get(
  '/:sessionId',
  requireAuth,
  validateRequest({ params: getForgeSessionSchema.shape.params }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { sessionId } = req.params;
      const session = await forgeService.getSession({ sessionId, clerkUserId: userId });
      return res.json(session);
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to fetch forge session')) return;

      logger.error('Failed to fetch forge session', { error });
      if (isPrismaMissingTableError(error, ['interview_sessions'])) {
        return res.status(503).json({ error: 'Service Unavailable', code: 'MIGRATIONS_PENDING' });
      }
      const msg = error instanceof Error ? error.message : 'Failed to fetch session';
      const status = msg === 'Session not found' ? 404 : msg === 'Forbidden' ? 403 : 500;
      return res.status(status).json({ error: msg });
    }
  },
);

/**
 * POST /api/agent-forge/message
 * Send a user message and receive the next assistant response + events.
 */
router.post(
  '/message',
  requireAuth,
  validateRequest({ body: sendForgeMessageSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { sessionId, message } = req.body;
      const result = await forgeService.sendMessage({ sessionId, clerkUserId: userId, message });
      return res.json(result);
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to process forge message')) return;

      logger.error('Failed to process forge message', { error });
      if (isPrismaMissingTableError(error, ['interview_sessions'])) {
        return res.status(503).json({ error: 'Service Unavailable', code: 'MIGRATIONS_PENDING' });
      }
      const msg = error instanceof Error ? error.message : 'Failed to process message';
      const status =
        msg === 'Session not found' ? 404 :
        msg === 'Forbidden' ? 403 :
        msg === 'Session already complete' ? 409 :
        500;
      return res.status(status).json({ error: msg });
    }
  },
);

/**
 * POST /api/agent-forge/complete
 * Finalizes Blueprint and compiles AgentConfig. Compiler runs on backend only.
 *
 * AUTHENTICATION: Accepts either:
 * 1. Clerk JWT token (web users)
 * 2. X-Runtime-Secret header (Python agent runtime server-to-server calls)
 */
router.post(
  '/complete',
  optionalAuth,
  validateRequest({ body: completeForgeSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;

      // Get userId from Clerk auth OR look it up from session (for runtime secret auth)
      let userId = req.auth?.userId;

      // Check for runtime secret auth (Python agent calling server-to-server)
      const runtimeSecret = req.headers['x-runtime-secret'] as string;
      const expectedSecret = RUNTIME_SECRET;

      if (!userId && expectedSecret && runtimeSecret === expectedSecret) {
        // Runtime secret valid - look up userId from session
        const session = await prisma.interview_sessions.findUnique({
          where: { id: sessionId },
          select: { clerkUserId: true },
        });
        if (session?.clerkUserId) {
          userId = session.clerkUserId;
          logger.info('Forge complete: Using runtime secret auth', { sessionId });
        }
      }

      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Clear device registration when session completes
      await sessionDeviceService.clearDevice(sessionId);

      const result = await forgeService.complete({ sessionId, clerkUserId: userId });
      return res.json({
        success: true,
        agentId: result.agentId,
        agentConfig: result.agentConfig,
      });
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to complete forge session')) return;

      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error('Failed to complete forge session', { message: errorMessage, stack: errorStack });
      if (isPrismaMissingTableError(error, ['interview_sessions'])) {
        return res.status(503).json({ error: 'Service Unavailable', code: 'MIGRATIONS_PENDING' });
      }
      const msg = error instanceof Error ? error.message : 'Failed to complete session';
      const status = msg === 'Session not found' ? 404 : msg === 'Forbidden' ? 403 : 500;
      return res.status(status).json({ error: msg });
    }
  },
);

/**
 * GET /api/agent-forge/:sessionId/resume-context
 * Get formatted resume context for agent prompt injection.
 * Returns the latest checkpoint's context summary formatted for voice agent use.
 */
router.get(
  '/:sessionId/resume-context',
  requireAuth,
  validateRequest({ params: getForgeSessionSchema.shape.params }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { sessionId } = req.params;

      // Verify session ownership
      const session = await prisma.interview_sessions.findUnique({ where: { id: sessionId } });
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.clerkUserId !== userId) return res.status(403).json({ error: 'Forbidden' });

      // Get latest checkpoint
      const checkpoint = await forgeCheckpointService.getLatestCheckpoint(sessionId);

      if (!checkpoint || !checkpoint.contextSummary) {
        return res.json({
          hasContext: false,
          formattedContext: null,
          checkpoint: null,
        });
      }

      // Format for agent prompt
      const formattedContext = contextSummaryService.formatForAgentPrompt(
        checkpoint.contextSummary,
        checkpoint.blueprintJson,
      );

      return res.json({
        hasContext: true,
        formattedContext,
        checkpoint: {
          id: checkpoint.id,
          progressPercent: checkpoint.progressPercent,
          coveredTopics: checkpoint.coveredTopics,
          checkpointAt: checkpoint.checkpointAt.toISOString(),
        },
      });
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to get resume context')) return;

      logger.error('Failed to get resume context', { error });
      if (isPrismaMissingTableError(error, ['forge_checkpoints'])) {
        return res.status(503).json({ error: 'Service Unavailable', code: 'MIGRATIONS_PENDING' });
      }
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);

/**
 * POST /api/agent-forge/:sessionId/checkpoint
 * Manually create a checkpoint for the current session state.
 * Useful for explicit checkpointing during voice sessions.
 */
router.post(
  '/:sessionId/checkpoint',
  requireAuth,
  validateRequest({ params: getForgeSessionSchema.shape.params }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { sessionId } = req.params;

      // Verify session ownership
      const session = await prisma.interview_sessions.findUnique({
        where: { id: sessionId },
        select: { clerkUserId: true, previewData: true },
      });

      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.clerkUserId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const previewData = session.previewData as any;
      const blueprint = previewData?.forge?.blueprint || {};
      const messages = previewData?.forge?.messages || [];
      const turnCount = previewData?.forge?.turnCount || 0;

      const checkpoint = await forgeCheckpointService.createCheckpoint({
        sessionId,
        blueprint,
        messages,
        turnCount,
      });

      logger.info('Manual checkpoint created', { sessionId, checkpointId: checkpoint.id });

      return res.json({
        success: true,
        checkpoint: {
          id: checkpoint.id,
          progressPercent: checkpoint.progressPercent,
          coveredTopics: checkpoint.coveredTopics,
          contextSummary: checkpoint.contextSummary,
          checkpointAt: checkpoint.checkpointAt,
        },
      });
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to create checkpoint')) return;

      logger.error('Failed to create checkpoint', { error });
      if (isPrismaMissingTableError(error, ['forge_checkpoints'])) {
        return res.status(503).json({ error: 'Service Unavailable', code: 'MIGRATIONS_PENDING' });
      }
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);

/**
 * GET /api/agent-forge/:sessionId/latest-checkpoint
 * Get the latest checkpoint for a session (raw data, not formatted for agent).
 */
router.get(
  '/:sessionId/latest-checkpoint',
  requireAuth,
  validateRequest({ params: getForgeSessionSchema.shape.params }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { sessionId } = req.params;

      // Verify session ownership
      const session = await prisma.interview_sessions.findUnique({
        where: { id: sessionId },
        select: { clerkUserId: true },
      });

      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.clerkUserId !== userId) return res.status(403).json({ error: 'Forbidden' });

      const checkpoint = await forgeCheckpointService.getLatestCheckpoint(sessionId);

      if (!checkpoint) {
        return res.json({
          hasCheckpoint: false,
          checkpoint: null,
        });
      }

      return res.json({
        hasCheckpoint: true,
        checkpoint: {
          id: checkpoint.id,
          progressPercent: checkpoint.progressPercent,
          coveredTopics: checkpoint.coveredTopics,
          contextSummary: checkpoint.contextSummary,
          blueprintJson: checkpoint.blueprintJson,
          checkpointAt: checkpoint.checkpointAt,
        },
      });
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to get latest checkpoint')) return;

      logger.error('Failed to get latest checkpoint', { error });
      if (isPrismaMissingTableError(error, ['forge_checkpoints'])) {
        return res.status(503).json({ error: 'Service Unavailable', code: 'MIGRATIONS_PENDING' });
      }
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);

/**
 * POST /api/agent-forge/:sessionId/clear-checkpoints
 * Clear all checkpoints for a session (user wants to start fresh).
 * Called by the Python agent when user indicates they want to start over.
 */
router.post(
  '/:sessionId/clear-checkpoints',
  requireAuth,
  validateRequest({ params: getForgeSessionSchema.shape.params }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { sessionId } = req.params;

      // Verify session ownership
      const session = await prisma.interview_sessions.findUnique({
        where: { id: sessionId },
        select: { clerkUserId: true },
      });

      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (session.clerkUserId !== userId) return res.status(403).json({ error: 'Forbidden' });

      // Delete all checkpoints for this session
      const deleteResult = await prisma.forge_checkpoints.deleteMany({
        where: { sessionId },
      });

      // Update session activity timestamp
      await prisma.interview_sessions.update({
        where: { id: sessionId },
        data: {
          lastActivityAt: new Date(),
        },
      });

      logger.info('Checkpoints cleared for session', {
        sessionId,
        deletedCount: deleteResult.count,
      });

      return res.json({
        success: true,
        deletedCount: deleteResult.count,
        message: 'Session cleared. Ready for fresh start.',
      });
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to clear checkpoints')) return;

      logger.error('Failed to clear checkpoints', { error });
      if (isPrismaMissingTableError(error, ['forge_checkpoints', 'interview_sessions'])) {
        return res.status(503).json({ error: 'Service Unavailable', code: 'MIGRATIONS_PENDING' });
      }
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);

/**
 * US-007: GET /voice/providers
 *
 * Returns actual voice provider configuration based on language.
 * Helps frontend show what STT/LLM/TTS stack is being used.
 */
router.get(
  '/voice/providers',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const language = (req.query.language as string) || 'en';

      // Provider selection logic based on language
      // In production, this would query actual configuration or detect dynamically
      const providerConfig = getVoiceProviderConfig(language);

      return res.json(providerConfig);
    } catch (error) {
      // Handle typed ForgeError first
      if (handleForgeError(res, error, 'Failed to get voice providers')) return;

      logger.error('Failed to get voice providers', { error });
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  },
);

/**
 * Helper: Get voice provider configuration based on language
 */
function getVoiceProviderConfig(language: string): {
  stt: { provider: string; model: string; reason: string };
  llm: { provider: string; model: string; reason: string };
  tts: { provider: string; model: string; reason: string };
} {
  // Default to English optimized stack
  const defaultConfig = {
    stt: {
      provider: 'Deepgram',
      model: 'nova-2',
      reason: 'Best accuracy for English with low latency',
    },
    llm: {
      provider: 'Google',
      model: 'gemini-2.5-flash',
      reason: 'Optimized for conversational voice with multimodal support',
    },
    tts: {
      provider: 'ElevenLabs',
      model: 'eleven_turbo_v2_5',
      reason: 'Natural voice quality with low latency',
    },
  };

  // Language-specific overrides
  const languageConfigs: Record<string, Partial<typeof defaultConfig>> = {
    // Indic languages - use Sarvam for better coverage
    hi: {
      stt: { provider: 'Sarvam', model: 'saarika:v2', reason: 'Native Hindi support' },
      tts: { provider: 'Sarvam', model: 'bulbul:v1', reason: 'Native Hindi voice' },
    },
    mr: {
      stt: { provider: 'Sarvam', model: 'saarika:v2', reason: 'Native Marathi support' },
      tts: { provider: 'Sarvam', model: 'bulbul:v1', reason: 'Native Marathi voice' },
    },
    ta: {
      stt: { provider: 'Sarvam', model: 'saarika:v2', reason: 'Native Tamil support' },
      tts: { provider: 'Sarvam', model: 'bulbul:v1', reason: 'Native Tamil voice' },
    },
    te: {
      stt: { provider: 'Sarvam', model: 'saarika:v2', reason: 'Native Telugu support' },
      tts: { provider: 'Sarvam', model: 'bulbul:v1', reason: 'Native Telugu voice' },
    },
    bn: {
      stt: { provider: 'Sarvam', model: 'saarika:v2', reason: 'Native Bengali support' },
      tts: { provider: 'Sarvam', model: 'bulbul:v1', reason: 'Native Bengali voice' },
    },
    // Arabic - use Cartesia for better Arabic TTS
    ar: {
      tts: { provider: 'Cartesia', model: 'sonic', reason: 'Better Arabic voice quality' },
    },
    // Asian languages with Deepgram support
    zh: {
      stt: { provider: 'Deepgram', model: 'nova-2', reason: 'Mandarin Chinese support' },
      tts: { provider: 'Cartesia', model: 'sonic', reason: 'Better Chinese voice quality' },
    },
    ja: {
      stt: { provider: 'Deepgram', model: 'nova-2', reason: 'Japanese support' },
      tts: { provider: 'Cartesia', model: 'sonic', reason: 'Better Japanese voice quality' },
    },
    ko: {
      stt: { provider: 'Deepgram', model: 'nova-2', reason: 'Korean support' },
      tts: { provider: 'Cartesia', model: 'sonic', reason: 'Better Korean voice quality' },
    },
  };

  const overrides = languageConfigs[language] || {};

  return {
    stt: overrides.stt || defaultConfig.stt,
    llm: overrides.llm || defaultConfig.llm,
    tts: overrides.tts || defaultConfig.tts,
  };
}

export default router;
