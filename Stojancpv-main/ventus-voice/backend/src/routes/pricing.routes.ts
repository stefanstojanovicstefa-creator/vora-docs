/**
 * Provider Pricing API Routes
 * RESTful endpoints for managing and querying provider pricing
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ProviderType } from '@prisma/client';
import { providerPricingService } from '../services/provider-pricing.service';
import { requireAuth } from '../middleware/auth.middleware';
import { isAdminUser } from '../middleware/admin-rate-limit.middleware';
import { createLogger } from '../utils/logger';

const logger = createLogger('Pricing.routes');

const router = Router();

// ============================================================================
// Admin Guard Middleware
// ============================================================================

/**
 * Requires the authenticated user to be a platform admin.
 * Uses RATE_LIMIT_ADMIN_USERS env var list (same source as admin-tools).
 * Must be chained AFTER requireAuth.
 */
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = req.auth?.userId;
  if (!userId || !isAdminUser(userId)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required to modify pricing data',
      code: 'ADMIN_REQUIRED',
      timestamp: new Date().toISOString(),
    });
  }
  next();
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

const ProviderTypeEnum = z.enum(['LLM', 'STT', 'TTS']);

const CreatePricingSchema = z.object({
  provider: z.string().min(1),
  providerType: ProviderTypeEnum,
  model: z.string().optional(),

  inputTokensPerMillion: z.number().positive().optional(),
  outputTokensPerMillion: z.number().positive().optional(),
  perMinute: z.number().positive().optional(),
  perSecond: z.number().positive().optional(),
  perCharacter: z.number().positive().optional(),
  per1kCharacters: z.number().positive().optional(),
  perRequest: z.number().positive().optional(),

  currency: z.string().default('USD'),
  tier: z.string().optional(),
  region: z.string().optional(),
  notes: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  metadata: z.any().optional(),

  effectiveFrom: z.string().datetime().optional(),
  effectiveUntil: z.string().datetime().optional(),
  createdBy: z.string().optional(),
});

const UpdatePricingSchema = CreatePricingSchema.partial();

const CalculateCostSchema = z.object({
  provider: z.string().min(1),
  providerType: ProviderTypeEnum,
  model: z.string().optional(),
  usage: z.object({
    inputTokens: z.number().nonnegative().optional(),
    outputTokens: z.number().nonnegative().optional(),
    durationSeconds: z.number().positive().optional(),
    durationMinutes: z.number().positive().optional(),
    characterCount: z.number().nonnegative().optional(),
    requestCount: z.number().positive().optional(),
  }),
});

// ============================================================================
// Validation Middleware
// ============================================================================

function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: Function) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors,
        });
      }
      next(error);
    }
  };
}

// ============================================================================
// Route Handlers
// ============================================================================

/**
 * GET /api/pricing
 * List all current pricing
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const pricing = await providerPricingService.listAllPricing();

    res.json({
      success: true,
      count: pricing.length,
      data: pricing,
    });
  } catch (error) {
    logger.error('Error fetching all pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/pricing/:type
 * List pricing by provider type (llm/stt/tts)
 */
router.get('/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    // Validate provider type
    const validTypes = ['llm', 'stt', 'tts', 'LLM', 'STT', 'TTS'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider type',
        message: 'Type must be one of: llm, stt, tts',
      });
    }

    const providerType = type.toUpperCase() as ProviderType;
    const pricing = await providerPricingService.listPricingByType(providerType);

    res.json({
      success: true,
      providerType,
      count: pricing.length,
      data: pricing,
    });
  } catch (error) {
    logger.error('Error fetching pricing by type:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/pricing/:type/:provider
 * Get specific provider pricing (optionally with model query param)
 */
router.get('/:type/:provider', async (req: Request, res: Response) => {
  try {
    const { type, provider } = req.params;
    const { model } = req.query;

    // Validate provider type
    const validTypes = ['llm', 'stt', 'tts', 'LLM', 'STT', 'TTS'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider type',
        message: 'Type must be one of: llm, stt, tts',
      });
    }

    const providerType = type.toUpperCase() as ProviderType;
    const pricing = await providerPricingService.getPricing(
      provider,
      providerType,
      model as string | undefined,
    );

    if (!pricing) {
      return res.status(404).json({
        success: false,
        error: 'Pricing not found',
        message: `No pricing found for ${provider} (${providerType}${model ? `: ${model}` : ''})`,
      });
    }

    res.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    logger.error('Error fetching provider pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/pricing/:type/:provider/history
 * Get pricing history for a provider
 */
router.get('/:type/:provider/history', async (req: Request, res: Response) => {
  try {
    const { type, provider } = req.params;
    const { model } = req.query;

    // Validate provider type
    const validTypes = ['llm', 'stt', 'tts', 'LLM', 'STT', 'TTS'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid provider type',
        message: 'Type must be one of: llm, stt, tts',
      });
    }

    const providerType = type.toUpperCase() as ProviderType;
    const history = await providerPricingService.getPricingHistory(
      provider,
      providerType,
      model as string | undefined,
    );

    res.json({
      success: true,
      provider,
      providerType,
      model: model || null,
      count: history.length,
      data: history,
    });
  } catch (error) {
    logger.error('Error fetching pricing history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing history',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/pricing/calculate
 * Calculate cost for given usage
 */
router.post(
  '/calculate',
  validateBody(CalculateCostSchema),
  async (req: Request, res: Response) => {
    try {
      const { provider, providerType, model, usage } = req.body;

      const costBreakdown = await providerPricingService.calculateCost(
        provider,
        providerType as ProviderType,
        usage,
        model,
      );

      res.json({
        success: true,
        data: costBreakdown,
      });
    } catch (error) {
      logger.error('Error calculating cost:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate cost',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * POST /api/pricing
 * Create new pricing entry (admin only)
 */
router.post(
  '/',
  requireAuth,
  requireAdmin,
  validateBody(CreatePricingSchema),
  async (req: Request, res: Response) => {
    try {
      const pricingData = req.body;

      // Convert date strings to Date objects
      if (pricingData.effectiveFrom) {
        pricingData.effectiveFrom = new Date(pricingData.effectiveFrom);
      }
      if (pricingData.effectiveUntil) {
        pricingData.effectiveUntil = new Date(pricingData.effectiveUntil);
      }

      const pricing = await providerPricingService.createPricing(pricingData);

      res.status(201).json({
        success: true,
        message: 'Pricing created successfully',
        data: pricing,
      });
    } catch (error) {
      logger.error('Error creating pricing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create pricing',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * PUT /api/pricing/:id
 * Update pricing entry (admin only)
 */
router.put(
  '/:id',
  requireAuth,
  requireAdmin,
  validateBody(UpdatePricingSchema),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Convert date strings to Date objects
      if (updates.effectiveFrom) {
        updates.effectiveFrom = new Date(updates.effectiveFrom);
      }
      if (updates.effectiveUntil) {
        updates.effectiveUntil = new Date(updates.effectiveUntil);
      }

      const pricing = await providerPricingService.updatePricing(id, updates);

      res.json({
        success: true,
        message: 'Pricing updated successfully',
        data: pricing,
      });
    } catch (error) {
      logger.error('Error updating pricing:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update pricing',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  },
);

/**
 * DELETE /api/pricing/:id
 * Delete (soft delete) pricing entry (admin only)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pricing = await providerPricingService.deletePricing(id);

    res.json({
      success: true,
      message: 'Pricing deleted successfully',
      data: pricing,
    });
  } catch (error) {
    logger.error('Error deleting pricing:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete pricing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/pricing/id/:id
 * Get pricing by ID
 */
router.get('/id/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const pricing = await providerPricingService.getPricingById(id);

    if (!pricing) {
      return res.status(404).json({
        success: false,
        error: 'Pricing not found',
        message: `No pricing found with ID: ${id}`,
      });
    }

    res.json({
      success: true,
      data: pricing,
    });
  } catch (error) {
    logger.error('Error fetching pricing by ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch pricing',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
