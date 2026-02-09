/**
 * Agents API Routes
 */

import { Router } from 'express';
import { prisma } from '../config/database';
import { getAgentCompiler, AgentCompilationError } from '../services/agent-compiler.service';
import { createAgentManagerService } from '../services/agent-manager.service';
import { generateEmbedCode } from '../utils/embed-code-generator';
// REMOVED: pythonCodeGenerator - per-agent deployment deprecated (PRD-002)
import { getAgentKnowledgeHelper } from '../services/agent-knowledge-helper.service';
import { getDocumentProcessor } from '../services/document-processor.service';
import { getVersionManagementService } from '../services/version-management.service';
import { getCustomerMemoryInjectionService } from '../services/customer-memory-injection.service';
import { getCustomerMemoryService } from '../services/customer-memory.service';
import { AgentStatus, VersionChangeType } from '@prisma/client';
import { AgentSoftDeleteService } from '../services/agent-soft-delete.service';
import { validateRequest } from '../middleware/validation.middleware';
import { createAgentSchema } from '../schemas/request-validation.schema';
import { strictRateLimiter } from '../middleware/rate-limit.middleware';
import {
  validateAgentConfig,
  formatValidationErrors,
  defaultAgentConfig,
} from '../schemas/agent-config.schema';
import {
  paginationSchema,
  calculateOffset,
  createPaginationMeta,
} from '../schemas/pagination.schema';
import { createId as cuid } from '@paralleldrive/cuid2';
import { createLogger } from '../utils/logger';
import { requireAuth, clerkClient } from '../middleware/auth.middleware';
import { requireOwnership } from '../middleware/ownership.middleware';
import { z } from 'zod';

const logger = createLogger('Agents.routes');

/** Shared secret for server-to-server auth (backend ↔ Python runtime) */
const RUNTIME_SECRET = process.env.RUNTIME_SECRET;
if (!RUNTIME_SECRET) {
  console.warn(
    '[SECURITY] RUNTIME_SECRET not set - server-to-server auth will reject all requests'
  );
}

const router = Router();
const agentManager = createAgentManagerService(prisma);
const versionService = getVersionManagementService(prisma);
const softDeleteService = new AgentSoftDeleteService(prisma);

// ============================================================================
// ASYNC AGENT CREATION - Job tracking for long-running LLM compilations
// ============================================================================
// Fly.io proxy has a hard 10-second timeout that cannot be configured.
// Agent compilation takes 15-30 seconds via LLM. Solution: return immediately
// with a job ID, run compilation in background, client polls for completion.

interface AgentCreationJob {
  id: string;
  userId: string;
  prompt: string;
  status: 'pending' | 'compiling' | 'saving' | 'completed' | 'failed';
  progress: number; // 0-100
  agent?: any;
  error?: { message: string; code?: string; details?: any };
  createdAt: Date;
  completedAt?: Date;
  warnings?: string[];
}

// In-memory job storage (single instance deployment on Fly.io)
// Jobs expire after 10 minutes to prevent memory leaks
const agentCreationJobs = new Map<string, AgentCreationJob>();

// Cleanup old jobs every 5 minutes
setInterval(
  () => {
    const now = Date.now();
    const TEN_MINUTES = 10 * 60 * 1000;
    for (const [jobId, job] of agentCreationJobs.entries()) {
      if (now - job.createdAt.getTime() > TEN_MINUTES) {
        agentCreationJobs.delete(jobId);
        logger.debug(`🧹 Cleaned up expired job: ${jobId}`);
      }
    }
  },
  5 * 60 * 1000
);

const createAgentRateLimiter = (req: any, res: any, next: any) => {
  if (process.env.DEMO_MODE === 'true') {
    return next();
  }
  return strictRateLimiter(req, res, next);
};

/**
 * GET /api/agents/create-status/:jobId
 * Poll for async agent creation status
 * Returns job status, progress, and agent data when complete
 */
router.get('/create-status/:jobId', requireAuth, async (req, res) => {
  const { jobId } = req.params;
  const userId = req.auth?.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const job = agentCreationJobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      error: 'Job not found',
      message: 'The job may have expired or does not exist',
    });
  }

  // Security: Only allow the job owner to check status
  if (job.userId !== userId) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Return appropriate response based on status
  if (job.status === 'completed') {
    return res.status(200).json({
      status: 'completed',
      progress: 100,
      agent: job.agent,
      warnings: job.warnings,
    });
  }

  if (job.status === 'failed') {
    return res.status(200).json({
      status: 'failed',
      progress: job.progress,
      error: job.error,
    });
  }

  // Still in progress
  return res.status(200).json({
    status: job.status,
    progress: job.progress,
  });
});

/**
 * POST /api/agents/create-direct
 * Creates a new agent directly from a full config (no AI compilation)
 * Used by the Agent Wizard which collects all config from the user
 */
router.post('/create-direct', createAgentRateLimiter, requireAuth, async (req, res) => {
  try {
    const { name, config } = req.body;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to create agents',
      });
    }

    if (!name || !config) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Both name and config are required',
      });
    }

    // Ensure user exists (create if needed for OAuth users)
    let user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      logger.info(`Creating user from Clerk authentication: ${userId}`);

      let clerkUser: {
        emailAddresses?: Array<{ emailAddress: string }>;
        firstName?: string | null;
        lastName?: string | null;
      } | null = null;
      if (process.env.DEMO_MODE !== 'true') {
        try {
          clerkUser = await clerkClient.users.getUser(userId);
        } catch (clerkError) {
          logger.warn(`Could not fetch Clerk user data for ${userId}:`, clerkError);
        }
      }

      const userEmail =
        clerkUser?.emailAddresses?.[0]?.emailAddress || `${userId}@placeholder.vora.ai`;
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

      logger.info(`User created with email: ${userEmail.substring(0, 3)}***@***`);
    }

    // Build the full config with defaults
    const fullConfig = {
      name,
      description: config.description || `Voice agent: ${name}`,
      system_prompt:
        config.systemPrompt ||
        config.system_prompt ||
        `You are ${name}, a helpful voice assistant.`,
      greeting: config.greeting || `Hello! I'm ${name}. How can I help you today?`,
      llm_model: config.llmModel || config.llm_model || 'gemini-2.5-flash',
      voice: {
        gender: config.voice?.gender || 'female',
        age_range: config.voice?.age_range || 'adult',
        accent: config.voice?.accent || 'US',
        speed: config.voice?.speed || 1.0,
        pitch: config.voice?.pitch || 0,
      },
      personality: config.personality || {
        tone: 'friendly',
        style: 'conversational',
        response_length: 'moderate',
        formality_level: 3,
      },
      language: config.language || 'en-US',
      livekit_config: config.livekit_config || {
        vad_mode: 'moderate',
        max_session_duration: 1800,
        allow_interruptions: true,
        silence_detection: true,
        silence_timeout: 3,
      },
      stt_provider: config.sttProvider || config.stt_provider || 'deepgram',
      tts_provider: config.voiceProvider || config.tts_provider || 'elevenlabs',
      // Store voice provider selection for runtime
      voiceProvider: config.voiceProvider,
      voiceId: config.voiceId,
      llmProvider: config.llmProvider,
      ...config,
    };

    // Validate config (allow partial since we filled defaults)
    const validation = validateAgentConfig(fullConfig);
    if (!validation.success) {
      logger.warn('Agent config validation failed', {
        errors: formatValidationErrors(validation.errors!),
      });
      // Log but don't block - we have defaults
    }

    // Generate embed code
    const tempAgentId = 'temp_' + Date.now();
    const embedCode = generateEmbedCode(tempAgentId);

    // Save to database
    const agent = await agentManager.createAgent({
      userId,
      originalPrompt: config.systemPrompt || config.system_prompt || name,
      config: fullConfig,
      embedCode,
    });

    // Update embed code with real agent ID
    const finalEmbedCode = generateEmbedCode(agent.id);
    const updatedAgent = await prisma.agents.update({
      where: { id: agent.id },
      data: {
        embedCode: finalEmbedCode,
        name, // Ensure name is set
      },
    });

    // Create initial version
    if (process.env.DEMO_MODE !== 'true') {
      try {
        await versionService.createVersion(userId, {
          agentId: agent.id,
          config: fullConfig as any,
          systemPrompt: fullConfig.system_prompt,
          description: 'Initial version created via wizard',
          changeType: 'MAJOR' as any,
          setAsCurrent: true,
          createdBy: userId,
          versionTag: 'v1.0.0',
        });
      } catch (versionError) {
        logger.warn('Failed to create initial version, continuing', versionError);
      }
    }

    logger.info(`Agent created directly: ${agent.id} (${name})`);

    res.status(201).json({
      success: true,
      agent: {
        id: updatedAgent.id,
        name: updatedAgent.name,
        description: updatedAgent.description,
        status: updatedAgent.status,
        config: updatedAgent.config,
        embedCode: updatedAgent.embedCode,
        createdAt: updatedAgent.createdAt,
      },
    });
  } catch (error) {
    logger.error('Error creating agent directly:', error);
    res.status(500).json({
      error: 'Failed to create agent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/agents/create
 * Creates a new agent from a user prompt (ASYNC)
 *
 * Returns 202 Accepted immediately with a jobId.
 * Client polls GET /api/agents/create-status/:jobId for completion.
 *
 * This async pattern is required because:
 * - Fly.io proxy has a hard 10-second timeout (not configurable)
 * - LLM compilation takes 15-30 seconds
 * - Without async, proxy closes connection before response is sent
 */
router.post(
  '/create',
  createAgentRateLimiter,
  requireAuth,
  validateRequest({ body: createAgentSchema.shape.body }),
  async (req, res) => {
    const { prompt, brandId } = req.body;
    const userId = req.auth?.userId;

    // Quick validation before starting async job
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to create agents',
      });
    }

    if (!prompt) {
      return res.status(400).json({
        error: 'Missing required field: prompt',
      });
    }

    // Create job and return immediately
    const jobId = cuid();
    const job: AgentCreationJob = {
      id: jobId,
      userId,
      prompt,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
    };
    agentCreationJobs.set(jobId, job);

    logger.info(`🚀 Starting async agent creation job: ${jobId}`);

    // Return 202 Accepted immediately with job ID
    res.status(202).json({
      success: true,
      jobId,
      message: 'Agent creation started. Poll /api/agents/create-status/:jobId for progress.',
    });

    // Run compilation in background (after response is sent)
    setImmediate(async () => {
      try {
        // Step 0: Ensure user exists (create if needed for OAuth users)
        job.status = 'compiling';
        job.progress = 10;

        let user = await prisma.users.findUnique({ where: { id: userId } });
        if (!user) {
          logger.info(`👤 Creating user from Clerk authentication: ${userId}`);

          let clerkUser: {
            emailAddresses?: Array<{ emailAddress: string }>;
            firstName?: string | null;
            lastName?: string | null;
          } | null = null;
          if (process.env.DEMO_MODE !== 'true') {
            try {
              clerkUser = await clerkClient.users.getUser(userId);
            } catch (clerkError) {
              logger.warn(`⚠️ Could not fetch Clerk user data for ${userId}:`, clerkError);
            }
          }

          const userEmail =
            clerkUser?.emailAddresses?.[0]?.emailAddress || `${userId}@placeholder.vora.ai`;
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

        job.progress = 20;

        // Step 1: Compile agent configuration using LLM
        logger.info(`🔄 [Job ${jobId}] Compiling agent from prompt...`);
        let config;
        if (process.env.DEMO_MODE === 'true') {
          const demoConfigResult = validateAgentConfig({
            ...defaultAgentConfig,
            name: `Demo Agent ${new Date().toISOString()}`,
            description: 'Demo agent created without external compilation',
            system_prompt: `You are a helpful voice agent.\n\nUser prompt:\n${prompt}`,
          });

          if (!demoConfigResult.success) {
            throw new AgentCompilationError(
              'Demo agent config validation failed',
              'VALIDATION_FAILED',
              JSON.stringify(formatValidationErrors(demoConfigResult.errors!))
            );
          }

          config = demoConfigResult.data!;
        } else {
          const compiler = getAgentCompiler();
          config = await compiler.compileAgent(prompt);
        }

        job.progress = 60;
        logger.info(`✅ [Job ${jobId}] Agent configuration generated:`, { name: config.name });

        // Step 2: Generate embed code
        job.status = 'saving';
        const tempAgentId = 'temp_' + Date.now();
        const embedCode = generateEmbedCode(tempAgentId);

        // Step 3: Save to database
        const agent = await agentManager.createAgent({
          userId,
          originalPrompt: prompt,
          config,
          embedCode,
        });

        job.progress = 75;

        // Step 4: Check for knowledge base
        logger.info(`📚 [Job ${jobId}] Checking for knowledge base...`);
        if (process.env.DEMO_MODE === 'true') {
          const finalEmbedCode = generateEmbedCode(agent.id);
          const updatedAgent = await prisma.agents.update({
            where: { id: agent.id },
            data: {
              embedCode: finalEmbedCode,
              status: AgentStatus.ACTIVE, // Activate agent so it can receive calls
            },
          });

          logger.info(`✅ [Job ${jobId}] Demo agent created and activated: ${agent.id}`);
          job.status = 'completed';
          job.progress = 100;
          job.agent = updatedAgent;
          job.completedAt = new Date();
          return;
        }

        // Step 4a: Create KB from brand analysis if brandId provided (URL wizard flow)
        if (brandId) {
          logger.info(`📚 [Job ${jobId}] Creating KB from brand analysis ${brandId}...`);
          try {
            const brand = await prisma.brands.findFirst({
              where: { id: brandId, userId },
            });

            if (brand && brand.knowledgeBase) {
              // Create knowledge_bases record linked to the new agent
              const kbContent = JSON.stringify(brand.knowledgeBase, null, 2);

              const kb = await prisma.knowledge_bases.create({
                data: {
                  id: cuid(),
                  name: `Brand KB: ${brand.websiteUrl}`,
                  description: `Knowledge base auto-generated from brand analysis of ${brand.websiteUrl}`,
                  type: 'brand',
                  userId,
                  agentId: agent.id,
                  updatedAt: new Date(),
                },
              });

              // Process document through document processor for chunking + embeddings
              const docProcessor = getDocumentProcessor();
              const processingResult = await docProcessor.processDocument({
                knowledgeBaseId: kb.id,
                filename: `brand-kb-${brand.websiteUrl.replace(/[^a-z0-9]/gi, '-')}.json`,
                fileContent: kbContent,
                fileType: 'json',
                chunkingStrategy: { strategy: 'semantic', chunkSize: 500 },
              });

              if (processingResult.status === 'COMPLETED') {
                logger.info(
                  `✅ [Job ${jobId}] KB created: ${kb.id} with ${processingResult.chunkCount} chunks linked to agent ${agent.id}`
                );
              } else {
                logger.warn(
                  `⚠️ [Job ${jobId}] KB created but document processing failed: ${processingResult.error}`
                );
              }
            } else {
              logger.warn(`⚠️ [Job ${jobId}] Brand ${brandId} not found or has no KB data`);
            }
          } catch (kbError) {
            // KB creation failure should not block agent creation
            logger.error(`⚠️ [Job ${jobId}] KB creation from brand failed (non-blocking):`, kbError);
          }
        }

        const knowledgeHelper = getAgentKnowledgeHelper();
        const knowledgeInfo = await knowledgeHelper.getAgentKnowledgeInfo(agent.id);

        if (knowledgeInfo.hasKnowledgeBase) {
          logger.info(
            `✅ [Job ${jobId}] Found ${knowledgeInfo.knowledgeBases.length} knowledge base(s)`
          );
        }

        job.progress = 85;

        // Step 5: Update embed code with real agent ID and activate
        const finalEmbedCode = generateEmbedCode(agent.id);
        const updatedAgent = await prisma.agents.update({
          where: { id: agent.id },
          data: {
            embedCode: finalEmbedCode,
            status: AgentStatus.ACTIVE, // Activate agent so it can receive calls
          },
        });

        // Step 6: Create initial version (v1)
        logger.info(`📦 [Job ${jobId}] Creating initial version (v1)...`);
        await versionService.createVersion(userId, {
          agentId: agent.id,
          config: config as any,
          systemPrompt: config.system_prompt,
          description: 'Initial version created automatically',
          changeType: 'MAJOR' as any,
          setAsCurrent: true,
          createdBy: userId,
          versionTag: 'v1.0.0',
        });

        // Check for model fallback warnings
        const warnings: string[] = [];
        if (config.llm_model === 'gemini-2.5-pro') {
          warnings.push(
            'Model Fallback: Gemini 2.5 Pro is not yet available with native audio. ' +
              'Your agent is using Gemini 2.5 Flash instead. This is temporary until Google releases the Pro model.'
          );
        }

        // Job completed successfully
        job.status = 'completed';
        job.progress = 100;
        job.agent = {
          id: updatedAgent.id,
          name: updatedAgent.name,
          description: updatedAgent.description,
          status: updatedAgent.status,
          config: updatedAgent.config,
          embedCode: updatedAgent.embedCode,
          createdAt: updatedAgent.createdAt,
        };
        job.warnings = warnings.length > 0 ? warnings : undefined;
        job.completedAt = new Date();

        logger.info(`✅ [Job ${jobId}] Agent created: ${agent.id}`);
      } catch (error) {
        logger.error(`❌ [Job ${jobId}] Agent creation failed:`, error);

        job.status = 'failed';
        job.completedAt = new Date();

        if (error instanceof AgentCompilationError) {
          job.error = {
            message: error.message,
            code: error.errorCode,
            details: error.details,
          };
        } else {
          job.error = {
            message: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }
    });
  }
);

/**
 * POST /api/agents/:agentId/duplicate
 * Duplicates an existing agent
 */
router.post('/:agentId/duplicate', requireAuth, requireOwnership('agent'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to duplicate agents',
      });
    }

    // Get the original agent with related data
    const originalAgent = await prisma.agents.findUnique({
      where: { id: agentId },
    });

    // Fetch knowledge bases separately
    const knowledgeBases = await prisma.knowledge_bases.findMany({
      where: { agentId },
    });

    // Fetch custom functions separately
    const customFunctions = await prisma.custom_functions.findMany({
      where: { agentId },
    });

    if (!originalAgent) {
      return res.status(404).json({
        error: 'Agent not found',
        message: 'The agent you are trying to duplicate does not exist',
      });
    }

    logger.info(`🔄 Duplicating agent: ${originalAgent.name} (${agentId})`);

    // Create a new agent with "-Copy" suffix
    const newName = `${originalAgent.name} - Copy`;
    const newDescription = originalAgent.description
      ? `${originalAgent.description} (Duplicated from ${originalAgent.name})`
      : `Duplicated from ${originalAgent.name}`;

    // Generate new embed code
    const tempAgentId = 'temp_' + Date.now();
    const embedCode = generateEmbedCode(tempAgentId);

    // Create the duplicate agent
    const duplicateAgent = await agentManager.createAgent({
      userId,
      originalPrompt: originalAgent.originalPrompt || `Duplicate of ${originalAgent.name}`,
      config: originalAgent.config as any,
      embedCode,
    });

    // Update with copied data
    const updatedDuplicate = await prisma.agents.update({
      where: { id: duplicateAgent.id },
      data: {
        name: newName,
        description: newDescription,
        embedCode: embedCode.replace(tempAgentId, duplicateAgent.id),
      },
    });

    // N+1 FIX: Batch insert knowledge bases using createMany
    // This reduces N individual INSERT queries to a single batched query
    if (knowledgeBases.length > 0) {
      await prisma.knowledge_bases.createMany({
        data: knowledgeBases.map(kb => ({
          id: cuid(),
          agentId: duplicateAgent.id,
          userId: kb.userId,
          name: kb.name,
          description: kb.description,
          type: kb.type,
          isActive: kb.isActive,
          organizationId: kb.organizationId,
          updatedAt: new Date(),
        })),
      });
      logger.info(`📚 Duplicated ${knowledgeBases.length} knowledge base(s)`);
    }

    // N+1 FIX: Batch insert custom functions using createMany
    // This reduces N individual INSERT queries to a single batched query
    if (customFunctions.length > 0) {
      await (prisma.custom_functions as any).createMany({
        data: customFunctions.map(func => ({
          id: cuid(),
          agentId: duplicateAgent.id,
          name: func.name,
          description: func.description,
          method: func.method,
          url: func.url,
          headers: func.headers,
          bodyTemplate: (func as any).bodyTemplate,
          parameters: func.parameters,
          authType: func.authType,
          authConfig: func.authConfig,
          responseMapping: func.responseMapping,
          isActive: func.isActive,
          updatedAt: new Date(),
        })),
      });
      logger.info(`⚙️ Duplicated ${customFunctions.length} custom function(s)`);
    }

    // Create initial version for duplicate
    await versionService.createVersion(userId, {
      agentId: duplicateAgent.id,
      config: originalAgent.config as any,
      systemPrompt: (originalAgent.config as any)?.system_prompt || '',
      description: `Initial version (duplicated from ${originalAgent.name})`,
      changeType: 'MAJOR' as any,
      setAsCurrent: true,
      createdBy: userId,
      versionTag: 'v1.0.0',
    });

    // NOTE: Python code generation removed - using shared runtime (PRD-002)
    logger.info(`✅ Agent duplicated: ${duplicateAgent.id}`);

    res.status(201).json({
      success: true,
      agent: {
        id: updatedDuplicate.id,
        name: updatedDuplicate.name,
        description: updatedDuplicate.description,
        status: updatedDuplicate.status,
        config: updatedDuplicate.config,
        embedCode: updatedDuplicate.embedCode,
        createdAt: updatedDuplicate.createdAt,
      },
      message: `Successfully duplicated "${originalAgent.name}"`,
    });
  } catch (error) {
    logger.error('Error duplicating agent:', error);
    res.status(500).json({
      error: 'Failed to duplicate agent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/agents
 * Lists all agents for a user with pagination
 *
 * SECURITY: Pagination is bounded to prevent DoS attacks (limit: 1-100)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to view agents',
      });
    }

    // Validate and parse pagination params
    const { page, limit, sortBy, sortOrder } = paginationSchema.parse(req.query);
    const onlyDeleted = req.query.onlyDeleted === 'true';

    // Build where clause based on whether we want deleted or active agents
    const RETENTION_DAYS = 7;
    const retentionCutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const whereClause = onlyDeleted
      ? {
          userId,
          deletedAt: {
            not: null as null,
            gte: retentionCutoff, // Only within 7-day retention window
          },
        }
      : {
          userId,
          deletedAt: null as null,
          status: { not: AgentStatus.DELETED },
        };

    // Count total for pagination
    const total = await prisma.agents.count({
      where: whereClause,
    });

    // Fetch with pagination
    const agents = await prisma.agents.findMany({
      where: whereClause,
      skip: calculateOffset(page, limit),
      take: limit,
      orderBy: onlyDeleted
        ? { deletedAt: 'desc' as const }
        : sortBy
          ? { [sortBy]: sortOrder }
          : { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        createdAt: true,
        lastDeployedAt: true,
        updatedAt: true,
        ...(onlyDeleted ? { deletedAt: true } : {}),
      },
    });

    res.json({
      success: true,
      agents: agents,
      pagination: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    logger.error('Error listing agents:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid pagination parameters',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to list agents',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/agents/:agentId
 * Gets a specific agent
 */
router.get('/:agentId', requireAuth, requireOwnership('agent'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to view agent details',
      });
    }

    const agent = await agentManager.getAgent(agentId, userId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found or you do not have access' });
    }

    // Get stats
    const stats = await agentManager.getAgentStats(agentId, userId);

    res.json({
      success: true,
      agent: {
        id: agent.id,
        name: agent.name,
        description: agent.description,
        status: agent.status,
        config: agent.config,
        originalPrompt: agent.originalPrompt,
        embedCode: agent.embedCode,
        deploymentUrl: agent.deploymentUrl,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        lastDeployedAt: agent.lastDeployedAt,
        stats,
      },
    });
  } catch (error) {
    logger.error('Error getting agent:', error);
    res.status(500).json({
      error: 'Failed to get agent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * PATCH /api/agents/:agentId
 * Updates an agent
 */
router.patch('/:agentId', requireAuth, requireOwnership('agent'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const { updates } = req.body;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to update agents',
      });
    }

    // Verify agent ownership before update
    const existingAgent = await agentManager.getAgent(agentId, userId);
    if (!existingAgent) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Agent not found or you do not have permission to modify it',
      });
    }

    const updatedAgent = await agentManager.updateAgent(agentId, userId, updates);

    res.json({
      success: true,
      agent: updatedAgent,
    });
  } catch (error) {
    logger.error('Error updating agent:', error);
    res.status(500).json({
      error: 'Failed to update agent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/agents/:agentId/deploy
 * Activates an agent for the shared runtime (PRD-002 - no per-agent deployment)
 * Simply sets agent status to ACTIVE so it can receive calls
 */
router.post('/:agentId/deploy', requireAuth, requireOwnership('agent'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to deploy agents',
      });
    }

    // Verify agent exists and belongs to user
    const agent = await agentManager.getAgent(agentId, userId);
    if (!agent) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Agent not found or you do not have permission to deploy it',
      });
    }

    // Check if agent has required config for deployment
    const config = agent.config as any;
    if (!config?.systemPrompt && !config?.system_prompt) {
      return res.status(400).json({
        error: 'Invalid configuration',
        message: 'Agent must have a system prompt before deployment',
      });
    }

    // Activate the agent for shared runtime
    const updatedAgent = await agentManager.updateAgent(agentId, userId, {
      status: 'ACTIVE',
    });

    logger.info(`Agent ${agentId} published (activated) successfully`);

    res.json({
      success: true,
      agent: updatedAgent,
      deploymentUrl: `https://api.vora.ai/v1/agents/${agentId}`, // Virtual URL for shared runtime
      message: 'Agent activated successfully',
    });
  } catch (error) {
    logger.error('Error deploying agent:', error);
    res.status(500).json({
      error: 'Failed to publish agent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/agents/:agentId
 * Deletes an agent (soft delete) and removes Fly.io deployment
 */
router.delete('/:agentId', requireAuth, requireOwnership('agent'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to delete agents',
      });
    }

    // Get agent to check if it has a Fly.io deployment and verify ownership
    const agent = await agentManager.getAgent(agentId, userId);
    if (!agent) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Agent not found or you do not have permission to delete it',
      });
    }

    // NOTE: Per-agent Fly.io deployment removed - using shared runtime (PRD-002)
    // Agents are now deactivated in database only, no Fly.io app to delete

    // Soft delete from database
    await agentManager.deleteAgent(agentId, userId);

    res.json({
      success: true,
      message: 'Agent deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting agent:', error);
    res.status(500).json({
      error: 'Failed to delete agent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/agents/:agentId/restore
 * Restores a soft-deleted agent (within 7-day retention window)
 */
router.post('/:agentId/restore', requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to restore agents',
      });
    }

    const restoredAgent = await softDeleteService.restore(agentId, userId);

    logger.info(`Agent restored: ${agentId}`);

    res.json({
      success: true,
      agent: {
        id: restoredAgent.id,
        name: restoredAgent.name,
        description: restoredAgent.description,
        status: restoredAgent.status,
        createdAt: restoredAgent.createdAt,
        updatedAt: restoredAgent.updatedAt,
      },
      message: 'Agent restored successfully',
    });
  } catch (error) {
    logger.error('Error restoring agent:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    if (message.includes('not found') || message.includes('not deleted')) {
      return res.status(404).json({
        error: 'Agent not found',
        message,
      });
    }

    if (message.includes('expired')) {
      return res.status(410).json({
        error: 'Restoration expired',
        message,
      });
    }

    if (message.includes('unauthorized') || message.includes('not belong')) {
      return res.status(403).json({
        error: 'Forbidden',
        message,
      });
    }

    res.status(500).json({
      error: 'Failed to restore agent',
      message,
    });
  }
});

/**
 * POST /api/agents/:agentId/regenerate
 * Regenerates agent configuration with a new prompt
 */
router.post('/:agentId/regenerate', requireAuth, requireOwnership('agent'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const { prompt } = req.body;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to regenerate agents',
      });
    }

    if (!prompt) {
      return res.status(400).json({ error: 'Missing required field: prompt' });
    }

    // Get existing agent and verify ownership
    const agent = await agentManager.getAgent(agentId, userId);
    if (!agent) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Agent not found or you do not have permission to regenerate it',
      });
    }

    // Recompile with new prompt
    const compiler = getAgentCompiler();
    const newConfig = await compiler.compileAgent(prompt);

    // Check for knowledge base and fetch context
    logger.info('📚 Checking for knowledge base...');
    const knowledgeHelper = getAgentKnowledgeHelper();
    const knowledgeInfo = await knowledgeHelper.getAgentKnowledgeInfo(agentId);

    if (knowledgeInfo.hasKnowledgeBase) {
      logger.info(`✅ Found ${knowledgeInfo.knowledgeBases.length} knowledge base(s)`);
    }

    // NOTE: Python code generation removed - using shared runtime (PRD-002)

    // Update agent
    const updatedAgent = await agentManager.updateAgent(agentId, userId, {
      config: newConfig as any,
      name: newConfig.name,
      description: newConfig.description,
      status: AgentStatus.DRAFT, // Reset to draft - needs redeployment
    });

    // Create new version for the regenerated config
    logger.info('📦 Creating new version for regenerated agent...');
    const versions = await versionService.getVersions(agentId, userId);
    const nextVersion = versions.length + 1;

    await versionService.createVersion(userId, {
      agentId,
      config: newConfig as any,
      systemPrompt: newConfig.system_prompt,
      description: 'Regenerated from new prompt',
      changeType: 'MAJOR' as any,
      setAsCurrent: true,
      createdBy: userId,
      versionTag: `v${nextVersion}.0.0`,
    });

    res.json({
      success: true,
      agent: updatedAgent,
      message: 'Agent regenerated. Redeploy to apply changes.',
    });
  } catch (error) {
    logger.error('Error regenerating agent:', error);

    // Handle AgentCompilationError with specific error codes
    if (error instanceof AgentCompilationError) {
      return res.status(400).json({
        error: 'Agent compilation failed',
        errorCode: error.errorCode,
        message: error.message,
        details: error.details,
      });
    }

    res.status(500).json({
      error: 'Failed to regenerate agent',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/agents/:agentId/versions
 * Create a new version for an agent
 */
router.post('/:agentId/versions', requireAuth, requireOwnership('agent'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const { description, changeType, versionTag, setAsCurrent } = req.body;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to create versions',
      });
    }

    // Get current agent config and verify ownership
    const agent = await agentManager.getAgent(agentId, userId);
    if (!agent) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Agent not found or you do not have permission to create versions',
      });
    }

    // Create version from current config
    const version = await versionService.createVersion(userId, {
      agentId,
      config: agent.config,
      systemPrompt: (agent.config as any).system_prompt || '',
      description,
      changeType: changeType as VersionChangeType,
      versionTag,
      setAsCurrent: setAsCurrent ?? true,
      createdBy: userId,
    });

    res.status(201).json({
      success: true,
      version,
    });
  } catch (error) {
    logger.error('Error creating version:', error);
    res.status(500).json({
      error: 'Failed to create version',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/agents/:agentId/versions
 * Get all versions for an agent
 */
router.get('/:agentId/versions', requireAuth, requireOwnership('agent'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to view versions',
      });
    }

    const versions = await versionService.getVersions(agentId, userId);

    res.json({
      success: true,
      versions,
      total: versions.length,
    });
  } catch (error) {
    logger.error('Error fetching versions:', error);
    res.status(500).json({
      error: 'Failed to fetch versions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/agents/:agentId/versions/current
 * Get the current version for an agent
 */
router.get(
  '/:agentId/versions/current',
  requireAuth,
  requireOwnership('agent'),
  async (req, res) => {
    try {
      const { agentId } = req.params;
      const userId = req.auth?.userId;

      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to view version information',
        });
      }

      const version = await versionService.getCurrentVersion(agentId, userId);

      if (!version) {
        return res.status(404).json({
          error: 'No current version found',
        });
      }

      res.json({
        success: true,
        version,
      });
    } catch (error) {
      logger.error('Error fetching current version:', error);
      res.status(500).json({
        error: 'Failed to fetch current version',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/agents/:agentId/versions/stats
 * Get version statistics for an agent
 */
router.get('/:agentId/versions/stats', requireAuth, requireOwnership('agent'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to view version statistics',
      });
    }

    const stats = await versionService.getVersionStats(agentId, userId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Error fetching version stats:', error);
    res.status(500).json({
      error: 'Failed to fetch version stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/agents/versions/:versionId
 * Get a specific version by ID
 */
router.get('/versions/:versionId', requireAuth, async (req, res) => {
  try {
    const { versionId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to view version details',
      });
    }

    const version = await versionService.getVersion(versionId, userId);

    res.json({
      success: true,
      version,
    });
  } catch (error) {
    logger.error('Error fetching version:', error);
    res.status(500).json({
      error: 'Failed to fetch version',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/agents/versions/:versionId/set-current
 * Set a version as the current version
 */
router.post('/versions/:versionId/set-current', requireAuth, async (req, res) => {
  try {
    const { versionId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to set version as current',
      });
    }

    const version = await versionService.setCurrentVersion(versionId, userId);

    res.json({
      success: true,
      version,
      message: 'Version set as current',
    });
  } catch (error) {
    logger.error('Error setting current version:', error);
    res.status(500).json({
      error: 'Failed to set current version',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/agents/versions/:versionId/revert
 * Revert agent to a specific version
 */
router.post('/versions/:versionId/revert', requireAuth, async (req, res) => {
  try {
    const { versionId } = req.params;
    const { description } = req.body;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to revert versions',
      });
    }

    const version = await versionService.revertToVersion(versionId, userId, description);

    res.json({
      success: true,
      version,
      message: 'Agent reverted to selected version',
    });
  } catch (error) {
    logger.error('Error reverting version:', error);
    res.status(500).json({
      error: 'Failed to revert version',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/agents/versions/compare
 * Compare two versions
 */
router.post('/versions/compare', requireAuth, async (req, res) => {
  try {
    const { versionId1, versionId2 } = req.body;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to compare versions',
      });
    }

    if (!versionId1 || !versionId2) {
      return res.status(400).json({ error: 'Both versionId1 and versionId2 are required' });
    }

    const comparison = await versionService.compareVersions(versionId1, versionId2, userId);

    res.json({
      success: true,
      comparison,
    });
  } catch (error) {
    logger.error('Error comparing versions:', error);
    res.status(500).json({
      error: 'Failed to compare versions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/agents/versions/:versionId
 * Delete a version
 */
router.delete('/versions/:versionId', requireAuth, async (req, res) => {
  try {
    const { versionId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to delete versions',
      });
    }

    await versionService.deleteVersion(versionId, userId);

    res.json({
      success: true,
      message: 'Version deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting version:', error);
    res.status(500).json({
      error: 'Failed to delete version',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/agents/validate-config
 * Validate an agent configuration without saving it
 */
router.post('/validate-config', requireAuth, async (req, res) => {
  try {
    const { config } = req.body;

    if (!config) {
      return res.status(400).json({ error: 'Missing config in request body' });
    }

    const validation = validateAgentConfig(config);

    if (validation.success) {
      res.json({
        success: true,
        valid: true,
        message: 'Configuration is valid',
      });
    } else {
      const formattedErrors = formatValidationErrors(validation.errors!);

      res.status(400).json({
        success: false,
        valid: false,
        errors: formattedErrors,
        message: 'Configuration validation failed',
      });
    }
  } catch (error) {
    logger.error('Error validating config:', error);
    res.status(500).json({
      error: 'Failed to validate configuration',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/agents/:agentId/sessions
 * Lists all sessions for a specific agent with pagination
 *
 * SECURITY: Pagination is bounded to prevent DoS attacks (limit: 1-100)
 */
router.get('/:agentId/sessions', requireAuth, requireOwnership('agent'), async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.auth?.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'You must be logged in to view sessions',
      });
    }

    // Verify agent ownership
    const agent = await agentManager.getAgent(agentId, userId);
    if (!agent) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Agent not found or you do not have permission to view its sessions',
      });
    }

    // Validate and parse pagination params
    const { page, limit, sortBy, sortOrder } = paginationSchema.parse(req.query);

    // Count total sessions for this agent
    const total = await prisma.agent_sessions.count({
      where: { agentId },
    });

    // N+1 PATTERN PREVENTION: Using explicit `select` to fetch only required fields
    // This avoids loading all session columns and prevents potential N+1 queries
    // if relations were added in the future without careful consideration
    const sessions = await prisma.agent_sessions.findMany({
      where: { agentId },
      orderBy: sortBy ? { [sortBy]: sortOrder } : { startedAt: 'desc' },
      skip: calculateOffset(page, limit),
      take: limit,
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        duration: true,
        messageCount: true,
        totalTokensUsed: true,
        inputTokens: true,
        outputTokens: true,
        avgResponseTime: true,
        errorCount: true,
        participantName: true,
        participantId: true,
        livekitRoomName: true,
        livekitSid: true,
        metadata: true,
      },
    });

    res.json({
      success: true,
      sessions,
      pagination: createPaginationMeta(page, limit, total),
    });
  } catch (error) {
    logger.error('Error fetching sessions:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid pagination parameters',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Failed to fetch sessions',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/agents/:agentId/runtime-config
 * Returns agent configuration for Python runtime workers
 *
 * SECURITY: Protected by X-Runtime-Secret header (shared secret between backend and Python workers)
 * This endpoint bypasses normal auth to allow Python workers to fetch config without user context.
 *
 * PURPOSE: Cache warming - Python workers call this to populate Redis cache before LiveKit dispatch.
 * Result: Reduces agent startup latency by 1-2 seconds (cache hit vs Supabase query).
 *
 * KNOWLEDGE BASE INJECTION: Fetches all knowledge base content and injects into system prompt
 * so voice agents have access to uploaded documents (menus, FAQs, etc.)
 *
 * CUSTOMER MEMORY INJECTION: Fetches customer memories for returning customers and injects
 * into system prompt for personalized interactions (Advanced Memory System - Phase 1).
 *
 * Query params:
 * - voraCustomerId: Optional customer ID for memory injection
 * - phoneNumber: Optional phone number for customer identification
 * - customerId: Optional custom identifier for customer identification
 */
router.get('/:agentId/runtime-config', async (req, res) => {
  try {
    const { agentId } = req.params;
    const { voraCustomerId, phoneNumber, customerId } = req.query;

    // Verify runtime secret
    const runtimeSecret = req.headers['x-runtime-secret'] as string;
    const expectedSecret = RUNTIME_SECRET;

    if (!expectedSecret || !runtimeSecret || runtimeSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch agent configuration with organization context
    const agent = await prisma.agents.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        status: true,
        pipelineType: true,
        realtimeModel: true,
        realtimeVoice: true,
        config: true,
        maxMessages: true,
        sessionTimeout: true,
        farewellMessage: true,
        summaryEnabled: true,
        userId: true,
        orgId: true,
      },
    });

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Get organization ID for memory operations
    const organizationId = agent.orgId || agent.userId;

    // Parse config (JSON field)
    const config = (agent.config || {}) as any;

    // KNOWLEDGE BASE INJECTION: Fetch all knowledge base content for this agent
    // This ensures voice agents can answer questions about uploaded documents (menus, FAQs, etc.)
    let knowledgeContext = '';
    try {
      const knowledgeBases = await prisma.knowledge_bases.findMany({
        where: {
          agentId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          description: true,
        },
      });

      if (knowledgeBases.length > 0) {
        // Fetch all document chunks for the agent's knowledge bases (limit to 50 chunks max to avoid huge prompts)
        const chunks = await prisma.document_chunks.findMany({
          where: {
            document: {
              knowledgeBaseId: {
                in: knowledgeBases.map(kb => kb.id),
              },
              status: 'COMPLETED',
            },
          },
          select: {
            content: true,
            document: {
              select: {
                filename: true,
              },
            },
          },
          take: 50, // Limit to avoid token overflow
          orderBy: {
            createdAt: 'asc',
          },
        });

        if (chunks.length > 0) {
          knowledgeContext = '\n\n=== KNOWLEDGE BASE CONTENT ===\n';
          knowledgeContext +=
            'Use the following information to answer user questions accurately:\n\n';

          chunks.forEach((chunk, index) => {
            knowledgeContext += `[${index + 1}] ${chunk.content}\n\n`;
          });

          knowledgeContext += '=== END OF KNOWLEDGE BASE ===\n';
          knowledgeContext +=
            '\nIMPORTANT: When users ask questions, check this knowledge base first and provide accurate answers based on this information.\n';

          logger.debug('Knowledge base content injected into runtime config', {
            agentId,
            chunkCount: chunks.length,
            knowledgeBaseCount: knowledgeBases.length,
          });
        }
      }
    } catch (kbError) {
      // Log but don't fail - knowledge base is optional
      logger.warn('Failed to fetch knowledge base content', { agentId, error: kbError });
    }

    // CUSTOMER MEMORY INJECTION: Fetch customer memories for personalized interactions
    // This enables "infinite memory" - a key competitive differentiator vs Vapi/Bland AI
    let customerMemoryContext = '';
    let resolvedVoraCustomerId: string | undefined;

    if (voraCustomerId || phoneNumber || customerId) {
      try {
        const customerMemoryService = getCustomerMemoryService(prisma);
        const memoryInjectionService = getCustomerMemoryInjectionService(prisma);

        // Identify or create customer
        let customerIdentity;
        if (voraCustomerId && typeof voraCustomerId === 'string') {
          // Direct lookup by voraCustomerId
          resolvedVoraCustomerId = voraCustomerId;
        } else {
          // Identify by phone number or custom ID
          customerIdentity = await customerMemoryService.identifyCustomer({
            organizationId,
            phoneNumber: phoneNumber as string | undefined,
            customIdentifier: customerId as string | undefined,
          });
          resolvedVoraCustomerId = customerIdentity?.voraCustomerId;
        }

        if (resolvedVoraCustomerId) {
          // Inject customer memories
          const memoryInjection = await memoryInjectionService.injectMemories(
            resolvedVoraCustomerId,
            organizationId,
            agentId,
            {
              maxMemories: 10,
              maxTokens: 2000,
              includeHistory: true,
              maxHistorySessions: 3,
            }
          );

          if (memoryInjection) {
            customerMemoryContext = memoryInjection.systemPromptAddition;
            logger.info('Customer memories injected into runtime config', {
              agentId,
              voraCustomerId: resolvedVoraCustomerId,
              isReturning: memoryInjection.customerContext.isReturning,
              memoryCount: memoryInjection.customerContext.memories.length,
              tokenCount: memoryInjection.tokenCount,
              cached: memoryInjection.cached,
            });
          }
        }
      } catch (memoryError) {
        // Log but don't fail - customer memory is optional enhancement
        logger.warn('Failed to inject customer memories', { agentId, error: memoryError });
      }
    }

    // Determine realtime provider from model name
    let realtimeProvider = 'google'; // default
    if (agent.realtimeModel?.includes('grok')) {
      realtimeProvider = 'xai';
    } else if (agent.realtimeModel?.includes('gemini')) {
      realtimeProvider = 'google';
    }

    // Normalize language field - handle both string and object formats
    // Agent forge may save language as { primary: "en-US", auto_detect: false, ... }
    let normalizedLanguage = 'en';
    if (typeof config.language === 'string') {
      normalizedLanguage = config.language;
    } else if (typeof config.language === 'object' && config.language?.primary) {
      normalizedLanguage = config.language.primary;
    }

    // Normalize voice field - handle both string and object formats
    // Agent forge may save voice as { pitch: 0, speed: 1, gender: "male", ... }
    let normalizedVoice = 'Rachel';
    if (typeof config.voice === 'string') {
      normalizedVoice = config.voice;
    } else if (typeof config.voice === 'object') {
      // Voice object doesn't contain name, use default based on agent's realtime voice if available
      normalizedVoice = agent.realtimeVoice || config.voice?.name || config.voice?.id || 'Rachel';
    }

    // Build runtime config matching Python AgentConfig schema
    // Append knowledge base and customer memory content to system prompt
    const systemPromptWithContext =
      (config.system_prompt || '') + knowledgeContext + customerMemoryContext;

    const runtimeConfig = {
      id: agent.id,
      name: agent.name,
      system_prompt: systemPromptWithContext,
      language: normalizedLanguage,
      pipeline_type: agent.pipelineType || 'realtime',
      realtime_provider: realtimeProvider,
      stt_model: config.stt_model || 'deepgram/nova-2',
      llm_model: config.llm_model || 'gemini-2.5-flash',
      tts_model: config.tts_model || 'elevenlabs/eleven_turbo_v2',
      voice: normalizedVoice,
      realtime_model: agent.realtimeModel || '',
      realtime_voice: agent.realtimeVoice || '',
      temperature: config.temperature ?? 0.7,
      max_tokens: config.max_tokens ?? 2048,
      greeting: config.greeting || '',
      functions: config.functions || [],
      metadata: config.metadata || {},
      mcp_servers: config.mcp_servers || [],
      max_messages: agent.maxMessages ?? 20,
      session_timeout: agent.sessionTimeout ?? 3600,
      farewell_message: agent.farewellMessage || '',
      summary_enabled: agent.summaryEnabled ?? false,
      // Customer memory context for Python runtime
      customer_context: resolvedVoraCustomerId
        ? {
            vora_customer_id: resolvedVoraCustomerId,
            has_memory: customerMemoryContext.length > 0,
          }
        : undefined,
    };

    logger.debug('Runtime config fetched', {
      agentId,
      cacheWarming: true,
      knowledgeInjected: knowledgeContext.length > 0,
      customerMemoryInjected: customerMemoryContext.length > 0,
      systemPromptLength: systemPromptWithContext.length,
    });

    return res.json(runtimeConfig);
  } catch (error) {
    logger.error('Failed to fetch runtime config', { error, agentId: req.params.agentId });
    return res.status(500).json({
      error: 'Failed to fetch runtime config',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/agents/:agentId/diagnose
 * Diagnostic endpoint to check if an agent is ready for voice calls
 *
 * Returns a comprehensive check of:
 * 1. Agent status (must be ACTIVE)
 * 2. Configuration completeness
 * 3. Agent-runtime health
 * 4. Provider API key availability
 * 5. Model validity
 *
 * Use this before testing to identify issues.
 */
router.get('/:agentId/diagnose', requireAuth, async (req, res) => {
  try {
    const { agentId } = req.params;
    const userId = req.auth.userId;

    const diagnostics: {
      agentId: string;
      ready: boolean;
      checks: {
        name: string;
        status: 'pass' | 'fail' | 'warn';
        message: string;
        details?: any;
      }[];
      recommendations: string[];
    } = {
      agentId,
      ready: true,
      checks: [],
      recommendations: [],
    };

    // 1. Check agent exists and ownership
    const agent = await prisma.agents.findFirst({
      where: {
        id: agentId,
        OR: [{ userId }, { orgId: userId }],
      },
      select: {
        id: true,
        name: true,
        status: true,
        pipelineType: true,
        realtimeModel: true,
        realtimeVoice: true,
        config: true,
        deploymentUrl: true,
        lastDeployedAt: true,
      },
    });

    if (!agent) {
      diagnostics.ready = false;
      diagnostics.checks.push({
        name: 'Agent Exists',
        status: 'fail',
        message: 'Agent not found or you do not have access',
      });
      return res.json(diagnostics);
    }

    diagnostics.checks.push({
      name: 'Agent Exists',
      status: 'pass',
      message: `Found agent: ${agent.name}`,
    });

    // 2. Check agent status
    if (agent.status !== 'ACTIVE') {
      diagnostics.ready = false;
      diagnostics.checks.push({
        name: 'Agent Status',
        status: 'fail',
        message: `Agent status is ${agent.status}, must be ACTIVE`,
        details: { currentStatus: agent.status },
      });
      diagnostics.recommendations.push('Deploy the agent to activate it');
    } else {
      diagnostics.checks.push({
        name: 'Agent Status',
        status: 'pass',
        message: 'Agent is ACTIVE and ready for calls',
      });
    }

    // 3. Check configuration completeness
    const config = (agent.config || {}) as any;

    // Required fields
    if (!config.system_prompt) {
      diagnostics.ready = false;
      diagnostics.checks.push({
        name: 'System Prompt',
        status: 'fail',
        message: 'Agent has no system prompt configured',
      });
      diagnostics.recommendations.push('Add a system prompt to define agent behavior');
    } else {
      diagnostics.checks.push({
        name: 'System Prompt',
        status: 'pass',
        message: `System prompt configured (${config.system_prompt.length} chars)`,
      });
    }

    // Voice configuration
    const voice = config.voice || agent.realtimeVoice;
    if (!voice) {
      diagnostics.checks.push({
        name: 'Voice Configuration',
        status: 'warn',
        message: 'No voice configured, will use default (Rachel)',
      });
    } else {
      diagnostics.checks.push({
        name: 'Voice Configuration',
        status: 'pass',
        message: `Voice: ${typeof voice === 'string' ? voice : voice.name || 'configured'}`,
      });
    }

    // 4. Check models
    const sttModel = config.stt_model || 'deepgram/nova-2';
    const llmModel = config.llm_model || 'gemini-2.5-flash';
    const ttsModel = config.tts_model || 'elevenlabs/eleven_turbo_v2';

    diagnostics.checks.push({
      name: 'STT Model',
      status: 'pass',
      message: `Speech-to-text: ${sttModel}`,
      details: { model: sttModel },
    });

    diagnostics.checks.push({
      name: 'LLM Model',
      status: 'pass',
      message: `Language model: ${llmModel}`,
      details: { model: llmModel },
    });

    diagnostics.checks.push({
      name: 'TTS Model',
      status: 'pass',
      message: `Text-to-speech: ${ttsModel}`,
      details: { model: ttsModel },
    });

    // 5. Check agent-runtime health
    const runtimeUrl = process.env.AGENT_RUNTIME_URL || 'https://vora-agent-runtime.fly.dev';
    try {
      const runtimeResponse = await fetch(`${runtimeUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (runtimeResponse.ok) {
        const runtimeHealth = await runtimeResponse.json();
        diagnostics.checks.push({
          name: 'Agent Runtime',
          status: 'pass',
          message: 'Agent runtime is healthy',
          details: runtimeHealth,
        });
      } else {
        diagnostics.ready = false;
        diagnostics.checks.push({
          name: 'Agent Runtime',
          status: 'fail',
          message: `Agent runtime returned ${runtimeResponse.status}`,
        });
        diagnostics.recommendations.push('Check agent-runtime deployment status on Fly.io');
      }
    } catch (runtimeError) {
      diagnostics.ready = false;
      diagnostics.checks.push({
        name: 'Agent Runtime',
        status: 'fail',
        message: 'Cannot reach agent runtime',
        details: { error: runtimeError instanceof Error ? runtimeError.message : 'Unknown' },
      });
      diagnostics.recommendations.push('Agent runtime may be down or unreachable');
    }

    // 6. Check provider API key availability (without exposing keys)
    const envChecks = [
      { name: 'DEEPGRAM_API_KEY', provider: 'Deepgram (STT)' },
      { name: 'ELEVENLABS_API_KEY', provider: 'ElevenLabs (TTS)' },
      { name: 'GOOGLE_API_KEY', provider: 'Google/Gemini (LLM)' },
      { name: 'LIVEKIT_API_KEY', provider: 'LiveKit (Voice)' },
      { name: 'LIVEKIT_API_SECRET', provider: 'LiveKit (Voice)' },
    ];

    for (const check of envChecks) {
      const hasKey = !!process.env[check.name];
      if (!hasKey) {
        diagnostics.checks.push({
          name: `${check.provider} API Key`,
          status: 'warn',
          message: `${check.name} not configured on backend`,
        });
        // Only mark as not ready if it's a critical key
        if (['LIVEKIT_API_KEY', 'LIVEKIT_API_SECRET'].includes(check.name)) {
          diagnostics.ready = false;
          diagnostics.recommendations.push(`Configure ${check.name} in environment`);
        }
      } else {
        diagnostics.checks.push({
          name: `${check.provider} API Key`,
          status: 'pass',
          message: `${check.name} is configured`,
        });
      }
    }

    // 7. Check pipeline type
    const pipelineType = agent.pipelineType || 'realtime';
    diagnostics.checks.push({
      name: 'Pipeline Type',
      status: 'pass',
      message: `Using ${pipelineType} pipeline`,
      details: {
        pipelineType,
        realtimeModel: agent.realtimeModel,
        realtimeVoice: agent.realtimeVoice,
      },
    });

    // Summary
    const failCount = diagnostics.checks.filter(c => c.status === 'fail').length;
    const warnCount = diagnostics.checks.filter(c => c.status === 'warn').length;

    logger.info('Agent diagnostics completed', {
      agentId,
      ready: diagnostics.ready,
      failCount,
      warnCount,
    });

    return res.json(diagnostics);
  } catch (error) {
    logger.error('Agent diagnostics failed', { error, agentId: req.params.agentId });
    return res.status(500).json({
      error: 'Diagnostics failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
