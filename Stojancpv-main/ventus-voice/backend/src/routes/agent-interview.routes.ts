/**
 * Agent Interview API Routes
 * 12-question interview flow for agent creation
 *
 * Pattern: requireAuth → zodValidation → handler
 */

import { Router, Request, Response } from 'express';
import { requireAuth, clerkClient } from '../middleware/auth.middleware';
import { apiKeyAuth } from '../middleware/api-key-auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { getAgentInterviewService } from '../services/agent-interview.service';
import { createAgentManagerService } from '../services/agent-manager.service';
import { generateEmbedCode } from '../utils/embed-code-generator';
import { getAgentKnowledgeHelper } from '../services/agent-knowledge-helper.service';
import { prisma } from '../config/database';
import { createLogger } from '../utils/logger';
import { createId as cuid } from '@paralleldrive/cuid2';
import { isPrismaMissingTableError } from '../utils/prisma-errors';
import {
  startInterviewSchema,
  submitAnswerSchema,
  completeInterviewSchema,
  getSessionSchema,
  startVoiceInterviewSchema,
  storeVoiceAnswerSchema,
  getNextQuestionSchema,
  completeVoiceInterviewSchema,
  getVoiceSessionSchema,
  cancelVoiceInterviewSchema,
} from '../schemas/agent-interview.schema';
import { getVoiceInterviewService } from '../services/interview-voice.service';

const logger = createLogger('AgentInterview.routes');
const router = Router();
const interviewService = getAgentInterviewService();
const voiceInterviewService = getVoiceInterviewService();
const agentManager = createAgentManagerService(prisma);

function replyMigrationsPending(res: Response, error: unknown): boolean {
  if (!isPrismaMissingTableError(error, ['interview_sessions'])) return false;
  res.status(503).json({
    error: 'Service Unavailable',
    code: 'MIGRATIONS_PENDING',
    message: 'Database migrations are not applied yet. Please retry in a minute.',
  });
  return true;
}

/**
 * POST /api/agent-interview/start
 * Start a new interview session
 *
 * Response: { sessionId, firstQuestion, totalQuestions }
 */
router.post(
  '/start',
  requireAuth,
  validateRequest({ body: startInterviewSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to start an interview',
        });
      }

      // Start interview session
      const result = await interviewService.startSession(userId);

      res.json({
        sessionId: result.sessionId,
        firstQuestion: result.firstQuestion,
        totalQuestions: 12,
      });
    } catch (error) {
      logger.error('Failed to start interview session:', error);
      if (replyMigrationsPending(res, error)) return;
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to start interview',
      });
    }
  }
);

/**
 * POST /api/agent-interview/answer
 * Submit an answer and get next question
 *
 * Request: { sessionId, questionIndex, answer }
 * Response: { nextQuestion, questionIndex, updatedPreview, isComplete }
 */
router.post(
  '/answer',
  requireAuth,
  validateRequest({ body: submitAnswerSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, questionIndex, answer } = req.body;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to submit answers',
        });
      }

      // Verify session belongs to user
      const session = await interviewService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Interview session ${sessionId} does not exist`,
        });
      }

      if (session.userId !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this interview session',
        });
      }

      // Process answer
      const result = await interviewService.processAnswer(sessionId, questionIndex, answer);

      res.json({
        nextQuestion: result.nextQuestion,
        questionIndex: result.isComplete ? questionIndex : questionIndex + 1,
        updatedPreview: result.updatedPreview,
        isComplete: result.isComplete,
      });
    } catch (error) {
      logger.error('Failed to process answer:', error);
      if (replyMigrationsPending(res, error)) return;

      // Handle validation errors
      if (error instanceof Error && error.message.includes('Invalid question index')) {
        return res.status(400).json({
          error: 'Invalid Request',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to process answer',
      });
    }
  }
);

/**
 * POST /api/agent-interview/complete
 * Complete interview and compile agent
 *
 * Request: { sessionId }
 * Response: { success, agentConfig, agentId }
 */
router.post(
  '/complete',
  requireAuth,
  validateRequest({ body: completeInterviewSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to complete interview',
        });
      }

      // Verify session belongs to user
      const session = await interviewService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Interview session ${sessionId} does not exist`,
        });
      }

      if (session.userId !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this interview session',
        });
      }

      // Ensure user exists in database
      let user = await prisma.users.findUnique({ where: { id: userId } });
      if (!user) {
        logger.info(`👤 Creating user from Clerk authentication: ${userId}`);

        // Fetch real user data from Clerk
        let clerkUser: { emailAddresses?: Array<{ emailAddress: string }>; firstName?: string | null; lastName?: string | null } | null = null;
        try {
          clerkUser = await clerkClient.users.getUser(userId);
        } catch (clerkError) {
          logger.warn(`⚠️ Could not fetch Clerk user data for ${userId}:`, clerkError);
        }

        const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || `${userId}@placeholder.vora.ai`;
        const userName = clerkUser?.firstName
          ? `${clerkUser.firstName}${clerkUser.lastName ? ' ' + clerkUser.lastName : ''}`
          : 'Vora User';

        user = await prisma.users.create({
          data: {
            id: userId,
            email: userEmail,
            name: userName,
            passwordHash: 'oauth_user',
            apiKey: cuid(),
            updatedAt: new Date(),
          },
        });

        logger.info(`✅ User created with email: ${userEmail.substring(0, 3)}***@***`);
      }

      // Compile agent configuration
      logger.info(`🔄 Compiling agent for session ${sessionId}...`);
      const config = await interviewService.compileAgent(sessionId);

      logger.info('✅ Agent configuration generated:', { name: config.name });

      // Generate embed code (temporary ID, will be replaced)
      const tempAgentId = 'temp_' + Date.now();
      const embedCode = generateEmbedCode(tempAgentId);

      // Save to database using session preview name as original prompt reference
      const agent = await agentManager.createAgent({
        userId,
        originalPrompt: `Interview Bot: ${session.preview.name}`,
        config,
        embedCode,
      });

      // Check for knowledge base
      logger.info('📚 Checking for knowledge base...');
      const knowledgeHelper = getAgentKnowledgeHelper();
      const knowledgeInfo = await knowledgeHelper.getAgentKnowledgeInfo(agent.id);

      if (knowledgeInfo.hasKnowledgeBase) {
        logger.info(`✅ Found ${knowledgeInfo.knowledgeBases.length} knowledge base(s)`);
      }

      // NOTE: Python code generation removed - using shared runtime (PRD-002)
      logger.info('✅ Agent creation complete:', {
        agentId: agent.id,
      });

      res.json({
        success: true,
        agentConfig: config,
        agentId: agent.id,
        embedCode: agent.embedCode,
      });
    } catch (error) {
      logger.error('Failed to complete interview:', error);
      if (replyMigrationsPending(res, error)) return;

      // Handle incomplete interview
      if (error instanceof Error && error.message.includes('Interview not complete')) {
        return res.status(400).json({
          error: 'Invalid Request',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to complete interview',
      });
    }
  }
);

/**
 * GET /api/agent-interview/incomplete
 * Get user's most recent incomplete session
 *
 * Response: { hasIncompleteSession, session? }
 */
router.get(
  '/incomplete',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to check for incomplete sessions',
        });
      }

      // Get incomplete session
      const session = await interviewService.getIncompleteSession(userId);

      if (!session) {
        return res.json({
          hasIncompleteSession: false,
        });
      }

      // Convert Map to plain object for JSON serialization
      const answersObject: Record<number, string> = {};
      session.answers.forEach((value, key) => {
        answersObject[key] = value;
      });

      res.json({
        hasIncompleteSession: true,
        session: {
          sessionId: session.id,
          answers: answersObject,
          preview: session.preview,
          currentQuestionIndex: Math.min(session.currentQuestionIndex, 12),
          totalQuestions: 12,
          progress: Math.min(100, Math.round((session.currentQuestionIndex / 12) * 100)),
          createdAt: session.createdAt.toISOString(),
        },
      });
    } catch (error) {
      logger.error('Failed to check for incomplete sessions:', error);
      if (replyMigrationsPending(res, error)) return;
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to check for incomplete sessions',
      });
    }
  }
);

/**
 * GET /api/agent-interview/:sessionId
 * Get existing session (for resume)
 *
 * Response: { sessionId, answers, preview, currentQuestionIndex, isComplete }
 */
router.get(
  '/:sessionId',
  requireAuth,
  validateRequest({ params: getSessionSchema.shape.params }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to access sessions',
        });
      }

      // Get session
      const session = await interviewService.getSession(sessionId);
      if (!session) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Interview session ${sessionId} does not exist`,
        });
      }

      // Verify ownership
      if (session.userId !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this interview session',
        });
      }

      // Convert Map to plain object for JSON serialization
      const answersObject: Record<number, string> = {};
      session.answers.forEach((value, key) => {
        answersObject[key] = value;
      });

      res.json({
        sessionId: session.id,
        answers: answersObject,
        preview: session.preview,
        currentQuestionIndex: session.currentQuestionIndex,
        isComplete: session.completedAt !== null,
        createdAt: session.createdAt.toISOString(),
        completedAt: session.completedAt?.toISOString() || null,
      });
    } catch (error) {
      logger.error('Failed to get session:', error);
      if (replyMigrationsPending(res, error)) return;
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to get session',
      });
    }
  }
);

/**
 * ==========================================
 * VOICE INTERVIEW API ENDPOINTS
 * Used by Interview Conductor Python Agent
 * Pattern: requireAuth → zodValidation → handler
 * ==========================================
 */

/**
 * POST /api/agent-interview/voice/start
 * Start a new voice interview session with LiveKit room
 *
 * Response: { sessionId, roomName, participantToken, firstQuestion, totalQuestions, wsUrl }
 */
router.post(
  '/voice/start',
  requireAuth,
  validateRequest({ body: startVoiceInterviewSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to start a voice interview',
        });
      }

      const { sessionId: existingSessionId } = req.body as { sessionId?: string };
      const result = await voiceInterviewService.startVoiceSession(userId, existingSessionId);

      res.json(result);
    } catch (error) {
      logger.error('Failed to start voice interview session:', error);
      if (replyMigrationsPending(res, error)) return;
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to start voice interview',
      });
    }
  },
);

/**
 * POST /api/agent-interview/voice/answer
 * Store answer from voice interview (called by Python agent)
 *
 * SECURITY: Accepts API key authentication for service-to-service calls.
 * The Python agent should pass the agent's API key in X-API-Key header.
 *
 * Request: { sessionId, questionIndex, answer }
 * Response: { question, questionIndex, isComplete, updatedPreview, questionsRemaining }
 */
router.post(
  '/voice/answer',
  apiKeyAuth,
  validateRequest({ body: storeVoiceAnswerSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId, questionIndex, answer } = req.body;

      const result = await voiceInterviewService.storeVoiceAnswer(sessionId, questionIndex, answer);

      res.json(result);
    } catch (error) {
      logger.error('Failed to store voice answer:', error);
      if (replyMigrationsPending(res, error)) return;

      // Handle validation errors
      if (error instanceof Error && error.message.includes('Invalid question index')) {
        return res.status(400).json({
          error: 'Invalid Request',
          message: error.message,
        });
      }

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Session not found',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to store answer',
      });
    }
  },
);

/**
 * GET /api/agent-interview/voice/next-question/:sessionId
 * Get next question for voice interview (called by Python agent)
 *
 * SECURITY: Accepts API key authentication for service-to-service calls.
 * The Python agent should pass the agent's API key in X-API-Key header.
 *
 * Response: { question, questionIndex, isComplete, preview }
 */
router.get(
  '/voice/next-question/:sessionId',
  apiKeyAuth,
  validateRequest({ params: getNextQuestionSchema.shape.params }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const result = await voiceInterviewService.getNextQuestion(sessionId);

      res.json(result);
    } catch (error) {
      logger.error('Failed to get next question:', error);
      if (replyMigrationsPending(res, error)) return;

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Session not found',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to get next question',
      });
    }
  },
);

/**
 * POST /api/agent-interview/voice/complete
 * Complete voice interview and compile agent
 *
 * Request: { sessionId }
 * Response: { success, agentConfig, agentId, embedCode, pythonCodePath }
 */
router.post(
  '/voice/complete',
  requireAuth,
  validateRequest({ body: completeVoiceInterviewSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to complete interview',
        });
      }

      // Verify session belongs to user
      const sessionData = await interviewService.getSession(sessionId);
      if (!sessionData) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Interview session ${sessionId} does not exist`,
        });
      }

      if (sessionData.userId !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this interview session',
        });
      }

      // Ensure user exists in database
      let user = await prisma.users.findUnique({ where: { id: userId } });
      if (!user) {
        logger.info(`👤 Creating user from voice interview: ${userId}`);

        // Fetch real user data from Clerk
        let clerkUser: { emailAddresses?: Array<{ emailAddress: string }>; firstName?: string | null; lastName?: string | null } | null = null;
        try {
          clerkUser = await clerkClient.users.getUser(userId);
        } catch (clerkError) {
          logger.warn(`⚠️ Could not fetch Clerk user data for ${userId}:`, clerkError);
        }

        const userEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || `${userId}@placeholder.vora.ai`;
        const userName = clerkUser?.firstName
          ? `${clerkUser.firstName}${clerkUser.lastName ? ' ' + clerkUser.lastName : ''}`
          : 'Vora User';

        user = await prisma.users.create({
          data: {
            id: userId,
            email: userEmail,
            name: userName,
            passwordHash: 'oauth_user',
            apiKey: cuid(),
            updatedAt: new Date(),
          },
        });

        logger.info(`✅ User created with email: ${userEmail.substring(0, 3)}***@***`);
      }

      // Complete voice interview and compile agent
      const config = await voiceInterviewService.completeVoiceInterview(sessionId);

      logger.info('✅ Voice interview agent configuration generated:', { name: config.name });

      // Generate embed code
      const tempAgentId = 'temp_' + Date.now();
      const embedCode = generateEmbedCode(tempAgentId);

      // Save to database
      const agent = await agentManager.createAgent({
        userId,
        originalPrompt: `Voice Interview: ${sessionData.preview.name}`,
        config,
        embedCode,
      });

      // Check for knowledge base
      const knowledgeHelper = getAgentKnowledgeHelper();
      const knowledgeInfo = await knowledgeHelper.getAgentKnowledgeInfo(agent.id);

      if (knowledgeInfo.hasKnowledgeBase) {
        logger.info(`✅ Found ${knowledgeInfo.knowledgeBases.length} knowledge base(s)`);
      }

      // NOTE: Python code generation removed - using shared runtime (PRD-002)
      logger.info('✅ Voice interview agent creation complete:', {
        agentId: agent.id,
      });

      res.json({
        success: true,
        agentConfig: config,
        agentId: agent.id,
        embedCode: agent.embedCode,
      });
    } catch (error) {
      logger.error('Failed to complete voice interview:', error);
      if (replyMigrationsPending(res, error)) return;

      if (error instanceof Error && error.message.includes('Interview not complete')) {
        return res.status(400).json({
          error: 'Invalid Request',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to complete voice interview',
      });
    }
  },
);

/**
 * GET /api/agent-interview/voice/session/:sessionId
 * Get voice interview session status
 *
 * Response: { sessionId, isComplete, currentQuestionIndex, totalQuestions, preview, roomName, roomActive, ... }
 */
router.get(
  '/voice/session/:sessionId',
  requireAuth,
  validateRequest({ params: getVoiceSessionSchema.shape.params }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to access session status',
        });
      }

      // Get session and verify ownership
      const sessionData = await interviewService.getSession(sessionId);
      if (!sessionData) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Interview session ${sessionId} does not exist`,
        });
      }

      if (sessionData.userId !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this interview session',
        });
      }

      const status = await voiceInterviewService.getVoiceSessionStatus(sessionId);

      res.json({
        ...status,
        createdAt: status.createdAt.toISOString(),
        completedAt: status.completedAt?.toISOString() || null,
      });
    } catch (error) {
      logger.error('Failed to get voice session status:', error);
      if (replyMigrationsPending(res, error)) return;

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Session not found',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to get session status',
      });
    }
  },
);

/**
 * POST /api/agent-interview/voice/cancel
 * Cancel voice interview session and cleanup LiveKit room
 *
 * Request: { sessionId }
 * Response: { success, message }
 */
router.post(
  '/voice/cancel',
  requireAuth,
  validateRequest({ body: cancelVoiceInterviewSchema.shape.body }),
  async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to cancel interview',
        });
      }

      // Verify session belongs to user
      const sessionData = await interviewService.getSession(sessionId);
      if (!sessionData) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Interview session ${sessionId} does not exist`,
        });
      }

      if (sessionData.userId !== userId) {
        return res.status(403).json({
          error: 'Forbidden',
          message: 'You do not have access to this interview session',
        });
      }

      await voiceInterviewService.cancelVoiceSession(sessionId);

      res.json({
        success: true,
        message: 'Voice interview session cancelled successfully',
      });
    } catch (error) {
      logger.error('Failed to cancel voice interview:', error);
      if (replyMigrationsPending(res, error)) return;

      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({
          error: 'Session not found',
          message: error.message,
        });
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Failed to cancel session',
      });
    }
  },
);

export default router;
