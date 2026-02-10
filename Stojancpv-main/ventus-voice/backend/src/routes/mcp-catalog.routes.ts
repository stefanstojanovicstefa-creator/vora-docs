/**
 * MCP Catalog API Routes
 * Browse, search, and get recommendations from the 120+ MCP catalog
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { createLogger } from '../utils/logger';

const logger = createLogger('MCPCatalog.routes');
const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const catalogQuerySchema = z.object({
  category: z.string().optional(),
  region: z.string().optional(),
  plan: z.string().optional(),
  priority: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const recommendedQuerySchema = z.object({
  industry: z.string(),
  region: z.string().optional(),
});

// ============================================================================
// Industry Recommendations Map
// ============================================================================

const INDUSTRY_RECOMMENDATIONS: Record<string, { primary: string[]; optional: string[] }> = {
  salon_spa: {
    primary: ['google_calendar', 'whatsapp', 'stripe'],
    optional: ['gmail', 'instagram', 'square'],
  },
  healthcare: {
    primary: ['google_calendar', 'twilio_sms', 'stripe'],
    optional: ['gmail', 'slack', 'zoom'],
  },
  restaurant: {
    primary: ['google_calendar', 'whatsapp', 'stripe', 'square'],
    optional: ['gmail', 'uber_eats', 'doordash'],
  },
  real_estate: {
    primary: ['google_calendar', 'whatsapp', 'hubspot'],
    optional: ['gmail', 'docusign', 'zillow'],
  },
  education: {
    primary: ['google_calendar', 'zoom', 'gmail'],
    optional: ['slack', 'notion', 'google_sheets'],
  },
  ecommerce: {
    primary: ['shopify', 'stripe', 'whatsapp'],
    optional: ['gmail', 'zendesk', 'google_sheets'],
  },
  agency: {
    primary: ['hubspot', 'slack', 'google_calendar'],
    optional: ['jira', 'gmail', 'zapier'],
  },
  fitness: {
    primary: ['google_calendar', 'stripe', 'whatsapp'],
    optional: ['gmail', 'instagram'],
  },
  legal: {
    primary: ['google_calendar', 'gmail', 'hubspot'],
    optional: ['slack', 'docusign'],
  },
  logistics: {
    primary: ['whatsapp', 'twilio_sms', 'google_sheets'],
    optional: ['slack', 'zapier'],
  },
};

// ============================================================================
// Routes
// ============================================================================

/**
 * @openapi
 * /api/mcp/catalog:
 *   get:
 *     summary: List MCP catalog entries
 *     description: Browse the MCP catalog with optional filters for category, region, plan, priority, status, and full-text search. Results are paginated.
 *     tags: [MCP]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by MCP category
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Filter by supported region
 *       - in: query
 *         name: plan
 *         schema:
 *           type: string
 *         description: Filter by required plan tier
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *         description: Filter by priority level
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by integration status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Full-text search across name and description
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Paginated list of MCP catalog entries
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MCPCatalogItem'
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         description: Internal server error
 */
router.get('/catalog', async (req, res) => {
  try {
    const query = catalogQuerySchema.parse(req.query);
    const { page, limit, search, category, region, plan, priority, status } = query;

    const where: any = {};

    if (category) where.category = category;
    if (plan) where.requiredPlan = plan;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (region) where.regions = { has: region };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.mcpCatalog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      }),
      prisma.mcpCatalog.count({ where }),
    ]);

    res.json({ data, total, page, limit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Failed to list MCP catalog', { error });
    res.status(500).json({ error: 'Failed to list MCP catalog' });
  }
});

/**
 * @openapi
 * /api/mcp/catalog/recommended:
 *   get:
 *     summary: Get recommended MCPs for an industry
 *     description: Returns primary and optional MCP recommendations based on the specified industry vertical.
 *     tags: [MCP]
 *     parameters:
 *       - in: query
 *         name: industry
 *         required: true
 *         schema:
 *           type: string
 *           enum: [salon_spa, healthcare, restaurant, real_estate, education, ecommerce, agency, fitness, legal, logistics]
 *         description: Industry vertical for recommendations
 *       - in: query
 *         name: region
 *         schema:
 *           type: string
 *         description: Optional region filter
 *     responses:
 *       200:
 *         description: Recommended MCP integrations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 primary:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MCPCatalogItem'
 *                 optional:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MCPCatalogItem'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         description: Internal server error
 */
router.get('/catalog/recommended', async (req, res) => {
  try {
    const query = recommendedQuerySchema.parse(req.query);
    const recs = INDUSTRY_RECOMMENDATIONS[query.industry];

    if (!recs) {
      return res.json({ primary: [], optional: [] });
    }

    const allIds = [...recs.primary, ...recs.optional];

    const where: any = {
      OR: allIds.map(name => ({ id: name })),
    };

    const items = await prisma.mcpCatalog.findMany({ where });
    const itemMap = new Map(items.map(i => [i.id, i]));

    const primary = recs.primary.map(id => itemMap.get(id)).filter(Boolean);
    const optional = recs.optional.map(id => itemMap.get(id)).filter(Boolean);

    res.json({ primary, optional });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters', details: error.errors });
    }
    logger.error('Failed to get MCP recommendations', { error });
    res.status(500).json({ error: 'Failed to get MCP recommendations' });
  }
});

/**
 * @openapi
 * /api/mcp/catalog/{id}:
 *   get:
 *     summary: Get a single MCP catalog entry
 *     description: Returns full details for a specific MCP integration from the catalog.
 *     tags: [MCP]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: MCP catalog entry ID
 *     responses:
 *       200:
 *         description: MCP catalog entry details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MCPCatalogItem'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.get('/catalog/:id', async (req, res) => {
  try {
    const item = await prisma.mcpCatalog.findUnique({
      where: { id: req.params.id },
    });

    if (!item) {
      return res.status(404).json({ error: 'MCP not found' });
    }

    res.json(item);
  } catch (error) {
    logger.error('Failed to get MCP catalog entry', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to get MCP catalog entry' });
  }
});

export default router;
