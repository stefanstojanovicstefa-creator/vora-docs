/**
 * Knowledge Base API Routes
 *
 * Endpoints for managing agent knowledge bases:
 * - Creating/listing knowledge bases
 * - Uploading and processing documents
 * - Searching for relevant information (RAG)
 */

import { Router } from 'express';
import { z } from 'zod';
import { validateRequest } from '../middleware/validation.middleware';
import {
  createKnowledgeBaseSchema,
  updateKnowledgeBaseSchema,
  getKnowledgeBasesQuerySchema,
  knowledgeBaseIdParamsSchema,
  uploadFileSchema,
  ingestSchema,
  querySchema,
  queryAgentKnowledgeBaseSchema,
  documentIdParamsSchema,
  reprocessDocumentSchema,
  getKnowledgeBaseStatsSchema,
} from '../schemas/knowledge-base.schema';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { requireOwnership } from '../middleware/ownership.middleware';
import { getDocumentProcessor } from '../services/document-processor.service';
import { getRAGSearchService } from '../services/rag-search.service';
import { getWebScraperService } from '../services/web-scraper.service';
import { getPlaywrightScraperService } from '../services/scraping/playwright-scraper.service';
import { WebScraperError, SCRAPER_ERROR_TO_STATUS } from '../errors/web-scraper.error';
import { USE_PLAYWRIGHT_SCRAPER } from '../config/feature-flags';
import { crawlAndIngest } from '../services/crawl.service';
import { createId as cuid } from '@paralleldrive/cuid2';
import multer from 'multer';import { createLogger } from '../utils/logger';
import { parsePaginationParams, createPaginatedResponse } from '../utils/pagination';

const logger = createLogger('KnowledgeBase.routes');


const router = Router();
// Lazy-load services to ensure environment variables are loaded
const getDocProcessor = () => getDocumentProcessor();
const getRagSearch = () => getRAGSearchService();

/**
 * Phase 2: Get scraper based on feature flag
 * USE_PLAYWRIGHT_SCRAPER=true (default) → Playwright (modern, SSRF-protected)
 * USE_PLAYWRIGHT_SCRAPER=false → Puppeteer (legacy)
 */
const getWebScraper = () => {
  if (USE_PLAYWRIGHT_SCRAPER) {
    return getPlaywrightScraperService();
  }
  return getWebScraperService();
};

/**
 * Helper function to verify user has access to a knowledge base
 * Checks both agent-linked and direct ownership
 */
async function verifyKnowledgeBaseAccess(
  kbId: string,
  userId: string,
  orgId?: string
): Promise<{ hasAccess: boolean; kb?: any }> {
  const kb = await prisma.knowledge_bases.findUnique({
    where: { id: kbId },
  });

  if (!kb) {
    return { hasAccess: false };
  }

  // If KB is linked to an agent, verify agent ownership
  if (kb.agentId) {
    const agent = await prisma.agents.findFirst({
      where: {
        id: kb.agentId,
        ...(orgId ? { orgId } : { userId }),
      },
    });
    return { hasAccess: !!agent, kb };
  }

  // If KB is not linked to an agent, verify direct ownership
  const hasAccess = orgId
    ? kb.organizationId === orgId
    : kb.userId === userId;

  return { hasAccess, kb };
}

/**
 * Helper function to verify user has access to a document via its knowledge base
 */
async function verifyDocumentAccess(
  docId: string,
  userId: string,
  orgId?: string
): Promise<{ hasAccess: boolean; document?: any }> {
  const document = await prisma.documents.findUnique({
    where: { id: docId },
  });

  if (!document) {
    return { hasAccess: false };
  }

  // Verify access through the knowledge base
  const { hasAccess } = await verifyKnowledgeBaseAccess(
    document.knowledgeBaseId,
    userId,
    orgId
  );

  return { hasAccess, document };
}

// Configure multer for file uploads (store in memory for processing)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/plain',
      'text/markdown',
      'application/json',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: TXT, MD, JSON, PDF, DOCX'));
    }
  },
});

/**
 * @openapi
 * /api/knowledge-base/create:
 *   post:
 *     summary: Create a knowledge base
 *     description: Creates a new knowledge base linked to a specific agent. The agent must belong to the authenticated user's organization.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentId, name]
 *             properties:
 *               agentId:
 *                 type: string
 *                 description: Agent to link the knowledge base to
 *               name:
 *                 type: string
 *                 description: Knowledge base name
 *               description:
 *                 type: string
 *                 description: Optional description
 *     responses:
 *       201:
 *         description: Knowledge base created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 knowledgeBase:
 *                   $ref: '#/components/schemas/KnowledgeBase'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/create',
  requireAuth,
  validateRequest({
    body: createKnowledgeBaseSchema.shape.body,
  }),
  async (req, res) => {
  try {
    const { agentId, name, description } = req.body;
    const { userId, orgId } = req.auth!;

    // Verify agent exists and belongs to user's organization
    const agent = await prisma.agents.findFirst({
      where: {
        id: agentId,
        ...(orgId ? { orgId } : { userId }),
      },
    });

    if (!agent) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Agent not found or you do not have permission to access it',
      });
    }

    // Create knowledge base
    const knowledgeBase = await prisma.knowledge_bases.create({
      data: {
        id: cuid(),
        agentId,
        userId: agent.userId,
        name,
        description: description || null,
        isActive: true,
        updatedAt: new Date(),
      },
    });

    logger.info(`📚 Knowledge base created: ${knowledgeBase.id}`);

    res.status(201).json({
      success: true,
      knowledgeBase: {
        id: knowledgeBase.id,
        agentId: knowledgeBase.agentId,
        name: knowledgeBase.name,
        description: knowledgeBase.description,
        isActive: knowledgeBase.isActive,
        totalDocuments: 0,
        totalChunks: 0,
        totalSize: 0,
        createdAt: knowledgeBase.createdAt,
        updatedAt: knowledgeBase.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error creating knowledge base:', error);
    res.status(500).json({
      error: 'Failed to create knowledge base',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/agent/{agentId}:
 *   get:
 *     summary: List knowledge bases for an agent
 *     description: Returns paginated knowledge bases for a specific agent with document counts.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *     responses:
 *       200:
 *         description: Paginated list of knowledge bases
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/KnowledgeBase'
 *                 total:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/agent/:agentId',
  requireAuth,
  validateRequest({
    params: getKnowledgeBasesQuerySchema.shape.params,
    query: getKnowledgeBasesQuerySchema.shape.query,
  }),
  async (req, res) => {
  try {
    const { agentId } = req.params;
    const { userId, orgId } = req.auth!;
    const { limit = 50, offset = 0 } = req.query as { limit?: number; offset?: number };

    // Verify agent belongs to user's organization
    const agent = await prisma.agents.findFirst({
      where: {
        id: agentId,
        ...(orgId ? { orgId } : { userId }),
      },
    });

    if (!agent) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Agent not found or you do not have permission to access it',
      });
    }

    // Get total count
    const total = await prisma.knowledge_bases.count({
      where: { agentId },
    });

    // Get paginated knowledge bases
    const knowledgeBases = await prisma.knowledge_bases.findMany({
      where: { agentId },
      include: {
        _count: {
          select: { documents: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });

    const mappedKBs = knowledgeBases.map((kb) => ({
      id: kb.id,
      agentId: kb.agentId,
      name: kb.name,
      description: kb.description,
      isActive: kb.isActive,
      totalDocuments: kb.totalDocuments,
      totalChunks: kb.totalChunks,
      totalSize: kb.totalSize,
      createdAt: kb.createdAt,
      updatedAt: kb.updatedAt,
    }));

    res.json(createPaginatedResponse(mappedKBs, limit, offset, total));
  } catch (error) {
    logger.error('Error listing knowledge bases:', error);
    res.status(500).json({
      error: 'Failed to list knowledge bases',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/{kbId}:
 *   get:
 *     summary: Get a knowledge base
 *     description: Returns a specific knowledge base with its documents list.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: Knowledge base with documents
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 knowledgeBase:
 *                   allOf:
 *                     - $ref: '#/components/schemas/KnowledgeBase'
 *                     - type: object
 *                       properties:
 *                         documents:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Document'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:kbId',
  requireAuth,
  requireOwnership('knowledgeBase'),
  validateRequest({
    params: knowledgeBaseIdParamsSchema.shape.params,
  }),
  async (req, res) => {
  try {
    const { kbId } = req.params;
    const { userId, orgId } = req.auth!;

    const knowledgeBase = await prisma.knowledge_bases.findUnique({
      where: { id: kbId },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!knowledgeBase) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    // Verify access: check if KB belongs to user's org or directly to user
    if (knowledgeBase.agentId) {
      // KB is linked to an agent - verify agent ownership
      const agent = await prisma.agents.findFirst({
        where: {
          id: knowledgeBase.agentId,
          ...(orgId ? { orgId } : { userId }),
        },
      });

      if (!agent) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to access this knowledge base',
        });
      }
    } else {
      // KB is not linked to an agent - verify direct ownership
      const hasAccess = orgId
        ? knowledgeBase.organizationId === orgId
        : knowledgeBase.userId === userId;

      if (!hasAccess) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to access this knowledge base',
        });
      }
    }

    res.json({
      success: true,
      knowledgeBase: {
        id: knowledgeBase.id,
        name: knowledgeBase.name,
        description: knowledgeBase.description,
        isActive: knowledgeBase.isActive,
        totalDocuments: knowledgeBase.totalDocuments,
        totalChunks: knowledgeBase.totalChunks,
        totalSize: knowledgeBase.totalSize,
        documents: knowledgeBase.documents.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          status: doc.status,
          chunkCount: doc.chunkCount,
          createdAt: doc.createdAt,
          processedAt: doc.processedAt,
          errorMessage: doc.errorMessage,
        })),
        createdAt: knowledgeBase.createdAt,
        updatedAt: knowledgeBase.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error getting knowledge base:', error);
    res.status(500).json({
      error: 'Failed to get knowledge base',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/{kbId}/upload:
 *   post:
 *     summary: Upload a document
 *     description: Uploads and processes a document into the knowledge base. Supported formats are TXT, MD, JSON, PDF, and DOCX. Max size 10MB.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Document file (TXT, MD, JSON, PDF, DOCX)
 *               chunkingStrategy:
 *                 type: string
 *                 enum: [fixed, semantic, paragraph]
 *                 default: fixed
 *               chunkSize:
 *                 type: integer
 *                 default: 500
 *               chunkOverlap:
 *                 type: integer
 *                 default: 50
 *     responses:
 *       201:
 *         description: Document uploaded and processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 document:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     filename:
 *                       type: string
 *                     status:
 *                       type: string
 *                     chunkCount:
 *                       type: integer
 *                     totalTokens:
 *                       type: integer
 *       400:
 *         description: No file uploaded or invalid file type
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:kbId/upload',
  requireAuth,
  requireOwnership('knowledgeBase'),
  upload.single('file'),
  validateRequest({
    params: uploadFileSchema.shape.params,
    body: uploadFileSchema.shape.body,
  }),
  async (req, res) => {
  try {
    const { kbId } = req.params;
    const { chunkingStrategy, chunkSize, chunkOverlap } = req.body;
    const { userId, orgId } = req.auth!;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Verify knowledge base exists and user has access
    const { hasAccess, kb } = await verifyKnowledgeBaseAccess(kbId, userId, orgId);

    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this knowledge base',
      });
    }

    // Determine file type
    const fileType = file.originalname.split('.').pop()?.toLowerCase() || 'txt';

    // Lazy-load service
    const documentProcessor = getDocProcessor();

    // Process document
    logger.info(`📤 Uploading document: ${file.originalname}`);
    const result = await documentProcessor.processDocument({
      knowledgeBaseId: kbId,
      filename: file.originalname,
      fileContent: file.buffer,
      fileType,
      chunkingStrategy: {
        strategy: chunkingStrategy || 'fixed',
        chunkSize: chunkSize || 500,
        chunkOverlap: chunkOverlap || 50,
      },
    });

    if (result.status === 'FAILED') {
      return res.status(500).json({
        error: 'Document processing failed',
        message: result.error,
      });
    }

    res.status(201).json({
      success: true,
      document: {
        id: result.documentId,
        filename: file.originalname,
        status: result.status,
        chunkCount: result.chunkCount,
        totalTokens: result.totalTokens,
      },
    });
  } catch (error) {
    logger.error('Error uploading document:', error);
    res.status(500).json({
      error: 'Failed to upload document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/{kbId}/add-url:
 *   post:
 *     summary: Add URL content to knowledge base
 *     description: Scrapes a URL and adds the content as a document. Supports single-page scraping and multi-page crawling.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: URL to scrape
 *               chunkingStrategy:
 *                 type: string
 *                 enum: [fixed, semantic, paragraph]
 *               chunkSize:
 *                 type: integer
 *               chunkOverlap:
 *                 type: integer
 *               crawl:
 *                 type: boolean
 *                 description: Enable multi-page crawling
 *               maxPages:
 *                 type: integer
 *                 description: Max pages to crawl (default 90)
 *               maxDepth:
 *                 type: integer
 *                 description: Max crawl depth (default 3)
 *     responses:
 *       201:
 *         description: URL content added to knowledge base
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       422:
 *         description: Insufficient content on the page
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:kbId/add-url',
  requireAuth,
  requireOwnership('knowledgeBase'),
  validateRequest({
    params: ingestSchema.shape.params,
    body: ingestSchema.shape.body.extend({
      // Override to accept string inputs and transform them
      chunkSize: ingestSchema.shape.body.shape.chunkSize
        .optional()
        .or(z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(100).max(2000))),
      chunkOverlap: ingestSchema.shape.body.shape.chunkOverlap
        .optional()
        .or(z.string().transform(val => parseInt(val, 10)).pipe(z.number().min(0).max(500))),
    }),
  }),
  async (req, res) => {
  try {
    const { kbId } = req.params;
    const { url, chunkingStrategy, chunkSize, chunkOverlap, crawl, maxPages, maxDepth } = req.body;
    const { userId, orgId } = req.auth!;

    // Verify knowledge base exists and user has access
    const { hasAccess, kb } = await verifyKnowledgeBaseAccess(kbId, userId, orgId);

    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this knowledge base',
      });
    }

    // ==== Phase 3: Crawl Feature ====
    // If crawl=true, use the crawl service to ingest multiple pages
    if (crawl === true) {
      logger.info(`🕷️ Starting crawl for knowledge base from: ${url}`, {
        maxPages: maxPages || 90,
        maxDepth: maxDepth || 3,
      });

      const crawlResult = await crawlAndIngest({
        kbId,
        startUrl: url,
        maxPages: maxPages || 90,
        maxDepth: maxDepth || 3,
        chunkingStrategy: (chunkingStrategy as 'fixed' | 'semantic' | 'paragraph') || 'fixed',
        chunkSize: chunkSize || 500,
        chunkOverlap: chunkOverlap || 50,
      });

      return res.status(201).json({
        success: true,
        crawl: {
          startUrl: url,
          pagesProcessed: crawlResult.pagesProcessed,
          documentsCreated: crawlResult.documentsCreated,
          errors: crawlResult.errors,
          totalTokens: crawlResult.totalTokens,
          duration: `${Math.round(crawlResult.duration / 1000)}s`,
        },
      });
    }

    // ==== Single URL Scraping (Default) ====
    // Lazy-load services
    const webScraper = getWebScraper();
    const documentProcessor = getDocProcessor();

    // Scrape URL content
    logger.info(`🌐 Scraping URL for knowledge base: ${url}`);
    const scrapedContent = await webScraper.scrapeUrl(url);

    // Note: Content length validation is now done in WebScraperService
    // This check is a redundant fallback that should never be reached
    if (!scrapedContent.textContent || scrapedContent.textContent.length < 50) {
      return res.status(422).json({
        error: 'INSUFFICIENT_CONTENT',
        message: "The page doesn't have enough text content to process.",
        details: { contentLength: scrapedContent.textContent?.length ?? 0 },
      });
    }

    // Convert scraped content to buffer for processing
    const contentBuffer = Buffer.from(scrapedContent.textContent, 'utf-8');

    // Create a descriptive filename from URL
    const urlObj = new URL(url);
    const filename = `${urlObj.hostname}${urlObj.pathname}`.replace(/[^a-zA-Z0-9-_\.]/g, '_') + '.txt';

    // Process as document
    logger.info(`📤 Processing scraped content from ${url}`);
    const result = await documentProcessor.processDocument({
      knowledgeBaseId: kbId,
      filename: scrapedContent.title || filename,
      fileContent: contentBuffer,
      fileType: 'txt',
      chunkingStrategy: {
        strategy: chunkingStrategy || 'fixed',
        chunkSize: chunkSize || 500,
        chunkOverlap: chunkOverlap || 50,
      },
    });

    if (result.status === 'FAILED') {
      return res.status(500).json({
        error: 'Document processing failed',
        message: result.error,
      });
    }

    res.status(201).json({
      success: true,
      document: {
        id: result.documentId,
        filename: scrapedContent.title || filename,
        url: scrapedContent.url,
        status: result.status,
        chunkCount: result.chunkCount,
        totalTokens: result.totalTokens,
        contentLength: scrapedContent.metadata.contentLength,
        scrapedAt: scrapedContent.metadata.scrapedAt,
      },
    });
  } catch (error) {
    // ==== Phase 1: Typed Error Handling for URL Scraping ====
    if (error instanceof WebScraperError) {
      const status = SCRAPER_ERROR_TO_STATUS[error.scraperCode] || 500;
      logger.warn(`URL scraping failed [${error.scraperCode}]:`, {
        url: req.body.url,
        code: error.scraperCode,
        message: error.message,
      });
      return res.status(status).json({
        error: error.scraperCode,
        message: error.message,
        details: error.details,
      });
    }

    logger.error('Error adding URL to knowledge base:', error);
    res.status(500).json({
      error: 'UNKNOWN',
      message: 'Failed to add URL to knowledge base',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/{kbId}/search:
 *   post:
 *     summary: Search a knowledge base
 *     description: Performs a RAG (Retrieval-Augmented Generation) search against a specific knowledge base using vector similarity.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *                 description: Search query
 *               topK:
 *                 type: integer
 *                 default: 5
 *                 description: Number of results to return
 *               minSimilarity:
 *                 type: number
 *                 default: 0.7
 *                 description: Minimum similarity threshold (0-1)
 *               format:
 *                 type: string
 *                 enum: [raw, context]
 *                 description: Response format (context returns agent-ready text)
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 query:
 *                   type: string
 *                 results:
 *                   type: array
 *                   items:
 *                     type: object
 *                 count:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:kbId/search',
  requireAuth,
  requireOwnership('knowledgeBase'),
  validateRequest({
    params: querySchema.shape.params,
    body: querySchema.shape.body,
  }),
  async (req, res) => {
  try {
    const { kbId } = req.params;
    const { query, topK, minSimilarity, format } = req.body;
    const { userId, orgId } = req.auth!;

    // Verify knowledge base exists and user has access
    const { hasAccess, kb } = await verifyKnowledgeBaseAccess(kbId, userId, orgId);

    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this knowledge base',
      });
    }

    // Lazy-load service
    const ragSearch = getRagSearch();

    // Perform search
    const results = await ragSearch.search(query, {
      knowledgeBaseId: kbId,
      topK: topK || 5,
      minSimilarity: minSimilarity || 0.7,
    });

    // Format results if requested
    const response = format === 'context'
      ? ragSearch.formatContextForAgent(results)
      : results;

    res.json({
      success: true,
      query,
      results: response,
      count: Array.isArray(response) ? response.length : undefined,
    });
  } catch (error) {
    logger.error('Error searching knowledge base:', error);
    res.status(500).json({
      error: 'Failed to search knowledge base',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/agent/{agentId}/search:
 *   post:
 *     summary: Search all agent knowledge bases
 *     description: Performs a RAG search across all knowledge bases linked to a specific agent.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query:
 *                 type: string
 *               topK:
 *                 type: integer
 *                 default: 5
 *               minSimilarity:
 *                 type: number
 *                 default: 0.7
 *               format:
 *                 type: string
 *                 enum: [raw, context]
 *     responses:
 *       200:
 *         description: Search results across all agent knowledge bases
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/agent/:agentId/search',
  requireAuth,
  validateRequest({
    params: queryAgentKnowledgeBaseSchema.shape.params,
    body: queryAgentKnowledgeBaseSchema.shape.body,
  }),
  async (req, res) => {
  try {
    const { agentId } = req.params;
    const { query, topK, minSimilarity, format } = req.body;
    const { userId, orgId } = req.auth!;

    // Verify agent belongs to user's organization
    const agent = await prisma.agents.findFirst({
      where: {
        id: agentId,
        ...(orgId ? { orgId } : { userId }),
      },
    });

    if (!agent) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'Agent not found or you do not have permission to access it',
      });
    }

    // Lazy-load service
    const ragSearch = getRagSearch();

    // Perform search across all agent's knowledge bases
    const results = await ragSearch.search(query, {
      agentId,
      topK: topK || 5,
      minSimilarity: minSimilarity || 0.7,
    });

    // Format results if requested
    const response = format === 'context'
      ? ragSearch.formatContextForAgent(results)
      : results;

    res.json({
      success: true,
      query,
      results: response,
      count: Array.isArray(response) ? response.length : undefined,
    });
  } catch (error) {
    logger.error('Error searching knowledge base:', error);
    res.status(500).json({
      error: 'Failed to search knowledge base',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/document/{docId}:
 *   delete:
 *     summary: Delete a document
 *     description: Deletes a document and all its chunks from the knowledge base.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     responses:
 *       200:
 *         description: Document deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/document/:docId',
  requireAuth,
  validateRequest({
    params: documentIdParamsSchema.shape.params,
  }),
  async (req, res) => {
  try {
    const { docId } = req.params;
    const { userId, orgId } = req.auth!;

    // Verify document exists and user has access
    const { hasAccess, document } = await verifyDocumentAccess(docId, userId, orgId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to delete this document',
      });
    }

    // Lazy-load service
    const documentProcessor = getDocProcessor();

    await documentProcessor.deleteDocument(docId);

    res.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({
      error: 'Failed to delete document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/document/{docId}/reprocess:
 *   post:
 *     summary: Reprocess a document
 *     description: Reprocesses a failed or existing document with optional new chunking parameters.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: docId
 *         required: true
 *         schema:
 *           type: string
 *         description: Document ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               chunkingStrategy:
 *                 type: string
 *                 enum: [fixed, semantic, paragraph]
 *               chunkSize:
 *                 type: integer
 *               chunkOverlap:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Document reprocessed
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/document/:docId/reprocess',
  requireAuth,
  validateRequest({
    params: reprocessDocumentSchema.shape.params,
    body: reprocessDocumentSchema.shape.body,
  }),
  async (req, res) => {
  try {
    const { docId } = req.params;
    const { chunkingStrategy, chunkSize, chunkOverlap } = req.body;
    const { userId, orgId } = req.auth!;

    // Verify document exists and user has access
    const { hasAccess, document } = await verifyDocumentAccess(docId, userId, orgId);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to reprocess this document',
      });
    }

    // Lazy-load service
    const documentProcessor = getDocProcessor();

    const result = await documentProcessor.reprocessDocument(docId, {
      strategy: chunkingStrategy || 'fixed',
      chunkSize: chunkSize || 500,
      chunkOverlap: chunkOverlap || 50,
    });

    res.json({
      success: true,
      document: {
        id: result.documentId,
        status: result.status,
        chunkCount: result.chunkCount,
        totalTokens: result.totalTokens,
        error: result.error,
      },
    });
  } catch (error) {
    logger.error('Error reprocessing document:', error);
    res.status(500).json({
      error: 'Failed to reprocess document',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/{kbId}:
 *   delete:
 *     summary: Delete a knowledge base
 *     description: Permanently deletes a knowledge base and all its documents and chunks (cascade).
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: Knowledge base deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:kbId',
  requireAuth,
  requireOwnership('knowledgeBase'),
  validateRequest({
    params: knowledgeBaseIdParamsSchema.shape.params,
  }),
  async (req, res) => {
  try {
    const { kbId } = req.params;
    const { userId, orgId } = req.auth!;

    // Verify knowledge base exists and user has access
    const { hasAccess, kb } = await verifyKnowledgeBaseAccess(kbId, userId, orgId);

    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to delete this knowledge base',
      });
    }

    // Delete knowledge base (cascade deletes documents and chunks)
    await prisma.knowledge_bases.delete({
      where: { id: kbId },
    });

    logger.info(`🗑️ Knowledge base deleted: ${kbId}`);

    res.json({
      success: true,
      message: 'Knowledge base deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting knowledge base:', error);
    res.status(500).json({
      error: 'Failed to delete knowledge base',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/{kbId}:
 *   patch:
 *     summary: Update a knowledge base
 *     description: Updates the name, description, or active status of a knowledge base.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Knowledge base updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 knowledgeBase:
 *                   $ref: '#/components/schemas/KnowledgeBase'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.patch(
  '/:kbId',
  requireAuth,
  requireOwnership('knowledgeBase'),
  validateRequest({
    params: updateKnowledgeBaseSchema.shape.params,
    body: updateKnowledgeBaseSchema.shape.body,
  }),
  async (req, res) => {
  try {
    const { kbId } = req.params;
    const { name, description, isActive } = req.body;
    const { userId, orgId } = req.auth!;

    // Verify knowledge base exists and user has access
    const { hasAccess, kb } = await verifyKnowledgeBaseAccess(kbId, userId, orgId);

    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to update this knowledge base',
      });
    }

    const updatedKB = await prisma.knowledge_bases.update({
      where: { id: kbId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({
      success: true,
      knowledgeBase: {
        id: updatedKB.id,
        name: updatedKB.name,
        description: updatedKB.description,
        isActive: updatedKB.isActive,
        updatedAt: updatedKB.updatedAt,
      },
    });
  } catch (error) {
    logger.error('Error updating knowledge base:', error);
    res.status(500).json({
      error: 'Failed to update knowledge base',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /api/knowledge-base/{kbId}/stats:
 *   get:
 *     summary: Get knowledge base statistics
 *     description: Returns detailed statistics including document counts, chunk counts, and size metrics.
 *     tags: [Knowledge Base]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: kbId
 *         required: true
 *         schema:
 *           type: string
 *         description: Knowledge base ID
 *     responses:
 *       200:
 *         description: Knowledge base statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:kbId/stats',
  requireAuth,
  requireOwnership('knowledgeBase'),
  validateRequest({
    params: getKnowledgeBaseStatsSchema.shape.params,
  }),
  async (req, res) => {
  try {
    const { kbId } = req.params;
    const { userId, orgId } = req.auth!;

    // Verify knowledge base exists and user has access
    const { hasAccess, kb } = await verifyKnowledgeBaseAccess(kbId, userId, orgId);

    if (!kb) {
      return res.status(404).json({ error: 'Knowledge base not found' });
    }

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Access denied',
        message: 'You do not have permission to access this knowledge base',
      });
    }

    // Lazy-load service
    const ragSearch = getRagSearch();

    const stats = await ragSearch.getKnowledgeBaseStats(kbId);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Error getting knowledge base stats:', error);
    res.status(500).json({
      error: 'Failed to get knowledge base stats',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
