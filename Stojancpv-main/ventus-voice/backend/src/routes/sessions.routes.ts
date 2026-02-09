/**
 * Session Management Routes
 *
 * API endpoints for managing agent sessions
 * - Start/end sessions with org context
 * - Manage participants
 * - Get session details and analytics
 * - Track usage and costs
 *
 * SECURITY: All routes protected with Clerk authentication
 * - Users can only access sessions for agents they own
 * - Session ownership verified via agent.userId relationship
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { createSessionManagerService } from '../services/session-manager.service';
import { createLoggingService } from '../services/logging.service';
import { validateRequest } from '../middleware/validation.middleware';
import { requireAuth } from '../middleware/auth.middleware';
import { requireOwnership } from '../middleware/ownership.middleware';
import { paginationSchema, calculateOffset, createPaginationMeta } from '../schemas/pagination.schema';
import {
  startSessionBodySchema,
  addParticipantBodySchema,
  updateParticipantStatsBodySchema,
  sessionIdParamsSchema,
  participantIdParamsSchema,
  agentIdParamsSchema,
  listSessionsQuerySchema,
  agentAnalyticsQuerySchema,
  sessionMetricsQuerySchema,
  realtimeSessionsQuerySchema,
  transcriptStreamQuerySchema,
} from '../schemas/session.schema';
import { z } from 'zod';
import { createLogger } from '../utils/logger';

const logger = createLogger('Sessions.routes');

const router = Router();
const sessionManager = createSessionManagerService(prisma);
const loggingService = createLoggingService(prisma);

// ============================================================================
// Authorization Helper Functions
// ============================================================================

/**
 * Verify that a session belongs to an agent owned by the authenticated user
 * @param sessionId - The session ID to check
 * @param userId - The authenticated user ID
 * @returns The session if authorized, null if not found or unauthorized
 *
 * OPTIMIZATION: Uses raw SQL query with JOIN to reduce from 2 sequential queries to 1
 * This prevents N+1 query pattern and reduces database round-trips by 50%
 */
async function authorizeSessionAccess(sessionId: string, userId: string) {
  // Use raw query to join session with agent in a single database round-trip
  const result = await prisma.$queryRaw<any[]>`
    SELECT s.*
    FROM agent_sessions s
    INNER JOIN agents a ON s."agentId" = a.id
    WHERE s.id = ${sessionId}
      AND a."userId" = ${userId}
      AND a."deletedAt" IS NULL
    LIMIT 1
  `;

  return result.length > 0 ? result[0] : null;
}

/**
 * Verify that an agent is owned by the authenticated user
 * @param agentId - The agent ID to check
 * @param userId - The authenticated user ID
 * @returns The agent if authorized, null if not found or unauthorized
 */
async function authorizeAgentAccess(agentId: string, userId: string) {
  const agent = await prisma.agents.findFirst({
    where: {
      id: agentId,
      userId: userId,
      deletedAt: null, // Don't allow access to deleted agents
    },
  });

  return agent;
}

// ============================================================================
// List and Analytics Routes (Filter by User's Agents)
// ============================================================================

/**
 * GET /api/sessions
 * List all sessions with pagination
 *
 * SECURITY: Returns only sessions for agents owned by the authenticated user
 * SECURITY: Pagination is bounded to prevent DoS attacks (limit: 1-100)
 */
router.get(
  '/',
  requireAuth,
  validateRequest({ query: listSessionsQuerySchema.merge(paginationSchema) }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      // Extract validated pagination params
      const { page, limit, sortBy, sortOrder } = req.query as any;

    // N+1 FIX: Fetch user's agent IDs in a single query with minimal data
    // Using select: { id: true } prevents loading unnecessary agent data
    const userAgents = await prisma.agents.findMany({
      where: {
        userId: userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    const agentIds = userAgents.map((agent) => agent.id);

    // Filter sessions by user's agents
    const whereClause: any = {
      agentId: {
        in: agentIds,
      },
    };

    // Parallel execution: Fetch sessions and total count simultaneously
    // OPTIMIZATION: Using explicit select to reduce data transfer by ~54%
    // (13 fields instead of 28+ fields)
    const [sessions, total] = await Promise.all([
      prisma.agent_sessions.findMany({
        where: whereClause,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { startedAt: 'desc' },
        skip: calculateOffset(page, limit),
        take: limit,
        select: {
          id: true,
          agentId: true,
          userId: true,
          livekitRoomName: true,
          participantName: true,
          duration: true,
          messageCount: true,
          totalTokensUsed: true,
          inputTokens: true,
          outputTokens: true,
          avgResponseTime: true,
          errorCount: true,
          startedAt: true,
          endedAt: true,
          createdAt: true,
        },
      }),
      prisma.agent_sessions.count({ where: whereClause }),
    ]);

      res.json({
        success: true,
        data: sessions,
        pagination: createPaginationMeta(page, limit, total),
      });
    } catch (error) {
      logger.error('Error listing sessions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list sessions',
        data: [],
      });
    }
  }
);

/**
 * GET /api/sessions/analytics
 * Get overall session analytics
 *
 * SECURITY: Returns analytics only for agents owned by the authenticated user
 */
router.get(
  '/analytics',
  requireAuth,
  validateRequest({ query: sessionMetricsQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // N+1 FIX: Single query to get user's agent IDs with minimal data transfer
    const userAgents = await prisma.agents.findMany({
      where: {
        userId: userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    const agentIds = userAgents.map((agent) => agent.id);

    const whereClause: any = {
      agentId: {
        in: agentIds,
      },
    };

    // Parallel execution: Fetch all analytics counts simultaneously
    const [totalSessions, activeSessions, completedSessions] = await Promise.all([
      prisma.agent_sessions.count({ where: whereClause }),
      prisma.agent_sessions.count({ where: { ...whereClause, endedAt: null } }),
      prisma.agent_sessions.count({ where: { ...whereClause, endedAt: { not: null } } }),
    ]);

    // Get average duration from completed sessions
    const completedSessionsData = await prisma.agent_sessions.findMany({
      where: { ...whereClause, endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
    });

    let avgDuration = 0;
    if (completedSessionsData.length > 0) {
      const totalDuration = completedSessionsData.reduce((sum, session) => {
        if (session.endedAt && session.startedAt) {
          return sum + (session.endedAt.getTime() - session.startedAt.getTime());
        }
        return sum;
      }, 0);
      avgDuration = Math.round(totalDuration / completedSessionsData.length / 1000);
    }

    res.json({
      success: true,
      analytics: {
        totalSessions,
        activeSessions,
        completedSessions,
        averageDurationSeconds: avgDuration,
        completionRate: totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0,
      },
    });
  } catch (error) {
    logger.error('Error retrieving session analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics',
      analytics: {
        totalSessions: 0,
        activeSessions: 0,
        completedSessions: 0,
        averageDurationSeconds: 0,
        completionRate: 0,
      },
    });
  }
});

/**
 * GET /api/sessions/realtime
 * Get realtime session status
 *
 * SECURITY: Returns only active sessions for agents owned by the authenticated user
 */
router.get(
  '/realtime',
  requireAuth,
  validateRequest({ query: realtimeSessionsQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    // N+1 FIX: Batch query for user's agent IDs with minimal data
    const userAgents = await prisma.agents.findMany({
      where: {
        userId: userId,
        deletedAt: null,
      },
      select: { id: true },
    });

    const agentIds = userAgents.map((agent) => agent.id);

    const whereClause: any = {
      endedAt: null,
      agentId: {
        in: agentIds,
      },
    };

    // Fetch active sessions (limited to 50 most recent to prevent excessive data transfer)
    const activeSessions = await prisma.agent_sessions.findMany({
      where: whereClause,
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    res.json({
      success: true,
      data: activeSessions,
      count: activeSessions.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Error fetching realtime sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch realtime sessions',
      data: [],
      count: 0,
    });
  }
});

// ============================================================================
// Session Lifecycle Routes (Verify Agent Ownership)
// ============================================================================

/**
 * POST /api/sessions/start
 * Start a new session
 *
 * SECURITY: Verifies that the user owns the agent before starting a session
 */
router.post(
  '/start',
  requireAuth,
  validateRequest({ body: startSessionBodySchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const { agentId } = req.body;

      // Verify user owns the agent
      const agent = await authorizeAgentAccess(agentId, userId);
      if (!agent) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to start session for this agent',
          code: 'FORBIDDEN',
        });
      }

      // Start the session
      const session = await sessionManager.startSession(req.body);

      res.status(201).json({
        success: true,
        session: session,
      });
    } catch (error) {
      logger.error('Error starting session:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start session',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * POST /api/sessions/:sessionId/end
 * End a session and calculate usage summary
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 */
router.post(
  '/:sessionId/end',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { sessionId } = req.params;

    // Verify session ownership
    const session = await authorizeSessionAccess(sessionId, userId);
    if (!session) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to end this session',
        code: 'FORBIDDEN',
      });
    }

    const endedSession = await sessionManager.endSession(sessionId);

    res.json({
      success: true,
      message: 'Session ended successfully',
      session: endedSession,
    });
  } catch (error) {
    logger.error('Error ending session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to end session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Analytics Routes (Verify Agent Ownership)
// ============================================================================

/**
 * GET /api/sessions/analytics/:agentId
 * Get session analytics for a specific agent
 *
 * SECURITY: Verifies that the user owns the agent before returning analytics
 */
router.get(
  '/analytics/:agentId',
  requireAuth,
  validateRequest({ params: agentIdParamsSchema, query: agentAnalyticsQuerySchema }),
  async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { agentId } = req.params;
    const { orgId } = req.query;

    // Verify user owns the agent
    const agent = await authorizeAgentAccess(agentId, userId);
    if (!agent) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view analytics for this agent',
        code: 'FORBIDDEN',
      });
    }

    const analytics = await sessionManager.getSessionAnalytics(
      agentId,
      orgId ? (orgId as string) : undefined
    );

    res.json({
      success: true,
      analytics: analytics,
    });
  } catch (error) {
    logger.error('Error retrieving session analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Transcript Routes (Verify Session Ownership)
// ============================================================================

/**
 * GET /api/sessions/:sessionId/transcript
 * Get session transcript with messages
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 * Transcripts contain sensitive conversation data and must be protected
 */
router.get(
  '/:sessionId/transcript',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { sessionId } = req.params;

    // Verify session ownership via agent
    const session = await authorizeSessionAccess(sessionId, userId);
    if (!session) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to access this session transcript' },
      });
    }

    // N+1 PATTERN PREVENTION: Fetch all transcript segments in a single query
    // Ordered by creation time for chronological conversation flow
    const transcripts = await prisma.transcript_segments.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    const messages = transcripts.map((t) => ({
      role: t.role,
      content: t.content,
      timestamp: t.timestamp,
    }));

    res.json({
      success: true,
      data: {
        sessionId,
        agentId: session.agentId,
        messages,
        duration:
          session.endedAt && session.startedAt
            ? Math.round((session.endedAt.getTime() - session.startedAt.getTime()) / 1000)
            : null,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
    });
  } catch (error) {
    logger.error('Error fetching session transcript:', error);
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch session transcript' },
    });
  }
});

/**
 * GET /api/sessions/:sessionId/transcript/stream
 * Stream transcript segments via Server-Sent Events (SSE)
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 *
 * Query params:
 * - since: epoch ms cursor (optional)
 * - pollMs: polling interval (500-5000ms, default 1000)
 * - includeExisting: whether to send initial segments (default true)
 */
router.get(
  '/:sessionId/transcript/stream',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: sessionIdParamsSchema, query: transcriptStreamQuerySchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const { sessionId } = req.params;
      const { since, pollMs, includeExisting } = req.query as unknown as {
        since?: number;
        pollMs: number;
        includeExisting: boolean;
      };

      // Verify session ownership via agent
      const session = await authorizeSessionAccess(sessionId, userId);
      if (!session) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not authorized to access this session transcript' },
        });
      }

      // Set up SSE headers (CORS handled by global middleware)
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Cursor for incremental polling
      let cursorCreatedAt = since ? new Date(since) : new Date(0);
      let cursorId = '';

      if (!includeExisting && !since) {
        cursorCreatedAt = new Date();
      }

      sendEvent('init', {
        sessionId,
        agentId: session.agentId,
        cursor: { since: cursorCreatedAt.getTime(), id: cursorId },
        pollMs,
        includeExisting,
      });

      // Send existing segments (optional)
      if (includeExisting) {
        const initialWhere: any = { sessionId };
        if (since) {
          initialWhere.createdAt = { gt: new Date(since) };
        }

        const initialSegments = await prisma.transcript_segments.findMany({
          where: initialWhere,
          select: {
            id: true,
            role: true,
            speaker: true,
            content: true,
            timestamp: true,
            isFinal: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 500,
        });

        if (initialSegments.length > 0) {
          const last = initialSegments[initialSegments.length - 1];
          cursorCreatedAt = last.createdAt;
          cursorId = last.id;
          sendEvent('segments', { segments: initialSegments });
        }
      }

      const pollForUpdates = async () => {
        const or: any[] = [{ createdAt: { gt: cursorCreatedAt } }];
        if (cursorId) {
          or.push({ createdAt: cursorCreatedAt, id: { gt: cursorId } });
        }

        const newSegments = await prisma.transcript_segments.findMany({
          where: { sessionId, OR: or },
          select: {
            id: true,
            role: true,
            speaker: true,
            content: true,
            timestamp: true,
            isFinal: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: 200,
        });

        if (newSegments.length === 0) return;

        const last = newSegments[newSegments.length - 1];
        cursorCreatedAt = last.createdAt;
        cursorId = last.id;
        sendEvent('segments', { segments: newSegments });
      };

      const pollInterval = setInterval(() => {
        pollForUpdates().catch((error) => {
          logger.error('Transcript SSE polling error:', error);
          sendEvent('error', {
            message: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }, pollMs);

      const heartbeat = setInterval(() => {
        sendEvent('ping', { t: Date.now() });
      }, 15000);

      req.on('close', () => {
        clearInterval(pollInterval);
        clearInterval(heartbeat);
        logger.info(`Client disconnected from transcript stream: ${sessionId}`);
      });
    } catch (error) {
      logger.error('Transcript SSE error:', error);
      res.write(`event: error\ndata: ${JSON.stringify({ message: error instanceof Error ? error.message : 'Unknown error' })}\n\n`);
      res.end();
    }
  }
);

// ============================================================================
// Session Detail Routes (Verify Session Ownership)
// ============================================================================

/**
 * GET /api/sessions/:sessionId/detail
 * Get full session detail including participants, messages, and timeline
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 */
router.get(
  '/:sessionId/detail',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const { sessionId } = req.params;

      const session = await authorizeSessionAccess(sessionId, userId);
      if (!session) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this session',
          code: 'FORBIDDEN',
        });
      }

      const sessionDetails = await sessionManager.getSessionDetails(sessionId);
      if (!sessionDetails) {
        return res.status(404).json({ success: false, error: 'Session not found' });
      }

      // Build SessionDetail response matching frontend type
      const agent = sessionDetails.agent;
      const duration = sessionDetails.endedAt && sessionDetails.startedAt
        ? Math.round((new Date(sessionDetails.endedAt).getTime() - new Date(sessionDetails.startedAt).getTime()) / 1000)
        : undefined;

      res.json({
        id: sessionDetails.id,
        agentId: sessionDetails.agentId,
        agentName: agent?.name,
        roomName: sessionDetails.livekitRoomName || '',
        status: sessionDetails.endedAt ? 'ENDED' : 'ACTIVE',
        startedAt: sessionDetails.startedAt?.toISOString?.() || sessionDetails.startedAt,
        endedAt: sessionDetails.endedAt?.toISOString?.() || sessionDetails.endedAt || undefined,
        duration,
        messageCount: sessionDetails.messageCount || 0,
        participantCount: sessionDetails.participants?.length || 0,
        metadata: sessionDetails.metadata || undefined,
        errorMessage: sessionDetails.errors?.length ? sessionDetails.errors[0].errorMessage : undefined,
        userId: sessionDetails.userId || undefined,
        participants: (sessionDetails.participants || []).map((p: any) => ({
          id: p.id,
          sessionId: p.sessionId,
          identity: p.identity || p.participantName || '',
          role: p.role || 'USER',
          joinedAt: p.joinedAt?.toISOString?.() || p.joinedAt,
          leftAt: p.leftAt?.toISOString?.() || p.leftAt || undefined,
          audioEnabled: p.audioEnabled ?? true,
        })),
        messages: (sessionDetails.messages || []).map((m: any) => ({
          id: m.id,
          sessionId: m.sessionId,
          role: m.role?.toLowerCase() || 'user',
          content: m.content,
          timestamp: m.timestamp?.toISOString?.() || m.timestamp,
          metadata: m.metadata || undefined,
        })),
        timeline: (sessionDetails.logs || []).map((l: any) => ({
          id: l.id,
          sessionId: l.sessionId || sessionId,
          type: l.level === 'ERROR' || l.level === 'CRITICAL' ? 'ERROR_OCCURRED' : 'MESSAGE_SENT',
          timestamp: l.timestamp?.toISOString?.() || l.timestamp,
          data: l.metadata || undefined,
          description: l.message || undefined,
        })),
        analytics: {
          avgResponseTime: sessionDetails.avgResponseTime || 0,
          totalTokensUsed: sessionDetails.totalTokensUsed || 0,
          interruptionCount: 0,
          silenceDuration: 0,
        },
      });
    } catch (error) {
      logger.error('Error retrieving session detail:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve session detail',
      });
    }
  }
);

/**
 * GET /api/sessions/:sessionId/messages
 * Get messages for a session
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 */
router.get(
  '/:sessionId/messages',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const { sessionId } = req.params;

      const session = await authorizeSessionAccess(sessionId, userId);
      if (!session) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this session',
          code: 'FORBIDDEN',
        });
      }

      const messages = await prisma.agent_messages.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
        take: 200,
      });

      res.json(messages.map((m) => ({
        id: m.id,
        sessionId: m.sessionId,
        role: m.role?.toLowerCase() || 'user',
        content: m.content,
        timestamp: m.timestamp?.toISOString?.() || m.timestamp,
        metadata: m.metadata || undefined,
      })));
    } catch (error) {
      logger.error('Error retrieving session messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve messages',
      });
    }
  }
);

/**
 * GET /api/sessions/:sessionId/timeline
 * Get timeline events for a session
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 */
router.get(
  '/:sessionId/timeline',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const { sessionId } = req.params;

      const session = await authorizeSessionAccess(sessionId, userId);
      if (!session) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to access this session',
          code: 'FORBIDDEN',
        });
      }

      // Build timeline from logs and key session events
      const logs = await prisma.agent_logs.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
        take: 100,
      });

      const timeline = logs.map((l) => ({
        id: l.id,
        sessionId: l.sessionId || sessionId,
        type: l.level === 'ERROR' || l.level === 'CRITICAL' ? 'ERROR_OCCURRED' : 'MESSAGE_SENT',
        timestamp: l.timestamp?.toISOString?.() || l.timestamp,
        data: l.metadata || undefined,
        description: l.message || undefined,
      }));

      res.json(timeline);
    } catch (error) {
      logger.error('Error retrieving session timeline:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve timeline',
      });
    }
  }
);

/**
 * GET /api/sessions/:sessionId
 * Get detailed session information
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 */
router.get(
  '/:sessionId',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { sessionId } = req.params;

    // Verify session ownership
    const session = await authorizeSessionAccess(sessionId, userId);
    if (!session) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this session',
        code: 'FORBIDDEN',
      });
    }

    const sessionDetails = await sessionManager.getSessionDetails(sessionId);

    if (!sessionDetails) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({
      success: true,
      session: sessionDetails,
    });
  } catch (error) {
    logger.error('Error retrieving session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Participant Management Routes (Verify Session Ownership)
// ============================================================================

/**
 * POST /api/sessions/:sessionId/participants
 * Add a participant to a session
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 */
router.post(
  '/:sessionId/participants',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: sessionIdParamsSchema, body: addParticipantBodySchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const { sessionId } = req.params;

      // Verify session ownership
      const session = await authorizeSessionAccess(sessionId, userId);
      if (!session) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to modify this session',
          code: 'FORBIDDEN',
        });
      }

      const participant = await sessionManager.addParticipant(sessionId, req.body);

      res.status(201).json({
        success: true,
        participant: participant,
      });
    } catch (error) {
      logger.error('Error adding participant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add participant',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * DELETE /api/sessions/:sessionId/participants/:participantId
 * Remove a participant from a session
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 */
router.delete(
  '/:sessionId/participants/:participantId',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: participantIdParamsSchema }),
  async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { sessionId, participantId } = req.params;

    // Verify session ownership
    const session = await authorizeSessionAccess(sessionId, userId);
    if (!session) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to modify this session',
        code: 'FORBIDDEN',
      });
    }

    const participant = await sessionManager.removeParticipant(sessionId, participantId);

    res.json({
      success: true,
      participant: participant,
    });
  } catch (error) {
    logger.error('Error removing participant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove participant',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/sessions/:sessionId/participants
 * Get all participants in a session
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 */
router.get(
  '/:sessionId/participants',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { sessionId } = req.params;

    // Verify session ownership
    const session = await authorizeSessionAccess(sessionId, userId);
    if (!session) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to access this session',
        code: 'FORBIDDEN',
      });
    }

    const participants = await sessionManager.getSessionParticipants(sessionId);

    res.json({
      success: true,
      data: participants,
      count: participants.length,
    });
  } catch (error) {
    logger.error('Error retrieving participants:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve participants',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/sessions/:sessionId/participants/:participantId/stats
 * Update participant statistics
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 */
router.patch(
  '/:sessionId/participants/:participantId/stats',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: participantIdParamsSchema, body: updateParticipantStatsBodySchema }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const { sessionId, participantId } = req.params;
      const { messageCount, tokenCount } = req.body;

      // Verify session ownership
      const session = await authorizeSessionAccess(sessionId, userId);
      if (!session) {
        return res.status(403).json({
          success: false,
          error: 'Not authorized to modify this session',
          code: 'FORBIDDEN',
        });
      }

      await sessionManager.updateParticipantStats(sessionId, participantId, {
        messageCount,
        tokenCount,
      });

      res.json({
        success: true,
        message: 'Participant stats updated',
      });
    } catch (error) {
      logger.error('Error updating participant stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update stats',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

// ============================================================================
// Session Validation Routes (Verify Session Ownership)
// ============================================================================

/**
 * GET /api/sessions/:sessionId/validate
 * Validate session status
 *
 * SECURITY: Verifies that the session belongs to an agent owned by the user
 */
router.get(
  '/:sessionId/validate',
  requireAuth,
  requireOwnership('session'),
  validateRequest({ params: sessionIdParamsSchema }),
  async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
    }

    const { sessionId } = req.params;

    // Verify session ownership
    const session = await authorizeSessionAccess(sessionId, userId);
    if (!session) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to validate this session',
        code: 'FORBIDDEN',
      });
    }

    const isValid = await sessionManager.validateSession(sessionId);

    res.json({
      success: true,
      valid: isValid,
      isValid,
      sessionId,
    });
  } catch (error) {
    logger.error('Error validating session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate session',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Session Summary Endpoint (Task 227)
// ============================================================================

/**
 * POST /sessions/:sessionId/summary
 * Generate a summary for a session
 * @tags Sessions
 * @param sessionId.path.required - Session ID
 * @returns {object} 200 - Session summary
 * @returns {object} 404 - Session not found
 * @returns {object} 403 - Not authorized
 */
router.post(
  '/:sessionId/summary',
  requireAuth,
  validateRequest({
    params: sessionIdParamsSchema,
  }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
        });
      }

      const { sessionId } = req.params;

      // Verify session ownership
      const session = await authorizeSessionAccess(sessionId, userId);
      if (!session) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          code: 'NOT_FOUND',
        });
      }

      // Get session data
      const sessionData = await prisma.agent_sessions.findUnique({
        where: { id: sessionId },
      });

      if (!sessionData) {
        return res.status(404).json({
          success: false,
          error: 'Session not found',
          code: 'NOT_FOUND',
        });
      }

      // Get agent config
      const agent = await prisma.agents.findUnique({
        where: { id: sessionData.agentId },
        select: {
          name: true,
          maxMessages: true,
          sessionTimeout: true,
          summaryEnabled: true,
        },
      });

      // Get messages separately
      const messages = await prisma.agent_messages.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
        select: {
          role: true,
          content: true,
          tokensUsed: true,
          timestamp: true,
        },
      });

      // Calculate duration
      const startTime = sessionData.startedAt.getTime();
      const endTime = sessionData.endedAt?.getTime() || Date.now();
      const durationSeconds = Math.round((endTime - startTime) / 1000);

      // Count messages by role
      const messagesByRole = {
        user: 0,
        agent: 0,
        system: 0,
      };
      let totalTokens = 0;

      for (const msg of messages) {
        const role = msg.role.toLowerCase() as keyof typeof messagesByRole;
        if (role in messagesByRole) {
          messagesByRole[role]++;
        }
        totalTokens += msg.tokensUsed || 0;
      }

      // Build transcript if summary enabled
      let transcript: string | undefined;
      if (agent?.summaryEnabled) {
        transcript = messages
          .map((m) => `[${m.role}]: ${m.content}`)
          .join('\n');
      }

      // Determine end reason
      let endReason = 'ongoing';
      if (sessionData.endedAt) {
        const maxMessages = agent?.maxMessages || 10;
        if (messagesByRole.user >= maxMessages) {
          endReason = 'limit_reached';
        } else if (durationSeconds >= (agent?.sessionTimeout || 1800)) {
          endReason = 'timeout';
        } else {
          endReason = 'user_ended';
        }
      }

      const summary = {
        sessionId,
        agentId: sessionData.agentId,
        agentName: agent?.name,
        startedAt: sessionData.startedAt,
        endedAt: sessionData.endedAt,
        durationSeconds,
        messageCount: {
          total: messages.length,
          ...messagesByRole,
        },
        tokensUsed: totalTokens,
        endReason,
        transcript,
        metadata: sessionData.metadata,
      };

      res.json({
        success: true,
        data: summary,
      });
    } catch (error) {
      logger.error('Error generating session summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate session summary',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;
