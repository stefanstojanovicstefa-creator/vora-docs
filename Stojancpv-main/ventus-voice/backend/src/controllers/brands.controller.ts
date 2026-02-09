/**
 * Brands Controller
 * Handles all brand analysis CRUD operations
 * Updated for Task 40: Brand Analysis Cost Tracking
 */

import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { enqueueBrandAnalysis } from '../jobs/brand-analysis.job';
import { Logger } from '../utils/simple-logger';
import { BrandAnalysisStatus } from '../types/brand-analysis.types';
import { createBrandAnalysisCostService } from '../services/brand-analysis-cost.service';
import { sendSuccess, sendError, sendPaginatedResponse, createPaginationMeta } from '../utils/api-response';

const logger = new Logger('BrandsController');
const brandCostService = createBrandAnalysisCostService(prisma);

/**
 * POST /api/brands/analyze
 * Trigger brand analysis for a website
 */
export async function analyzeBrand(req: Request, res: Response): Promise<void> {
  try {
    const { websiteUrl, customerId } = req.body;

    // SECURITY: requireAuth middleware guarantees req.auth.userId is present
    const userId = req.auth!.userId;

    logger.info(`User ${userId} requested brand analysis for ${websiteUrl}`);

    // Check if user exists, create if not (for demo mode)
    let user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) {
      user = await prisma.users.create({
        data: {
          id: userId,
          email: `${userId}@vora.ai`,
          name: 'New User',
          apiKey: `vora_${userId}_${Date.now()}`,
          updatedAt: new Date(),
        },
      });
    }

    // Check if brand already exists (cache check)
    const existingBrand = await prisma.brands.findFirst({
      where: {
        websiteUrl,
        userId,
        status: 'COMPLETED',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (existingBrand) {
      logger.info(`Using cached brand analysis for ${websiteUrl}`);

      res.json({
        brandId: existingBrand.id,
        status: existingBrand.status,
        cached: true,
        message: 'Using cached analysis',
        estimatedTime: 0,
      });
      return;
    }

    // Create new brand entry
    const brand = await prisma.brands.create({
      data: {
        id: `brand_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        websiteUrl,
        userId,
        status: 'PENDING',
        updatedAt: new Date(),
      },
    });

    logger.info(`Created brand record ${brand.id} for ${websiteUrl}`);

    // Enqueue analysis job
    await enqueueBrandAnalysis({
      brandId: brand.id,
      websiteUrl,
      userId,
      customerId,
    });

    // Estimate time: ~2-5 minutes for typical website
    const estimatedTime = 180; // 3 minutes in seconds

    res.status(202).json({
      brandId: brand.id,
      status: 'PENDING',
      cached: false,
      message: 'Brand analysis started',
      estimatedTime,
    });
  } catch (error) {
    logger.error('Failed to start brand analysis', error);
    res.status(500).json({
      error: 'Failed to start brand analysis',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/brands/:brandId
 * Get brand analysis results
 */
export async function getBrand(req: Request, res: Response): Promise<void> {
  try {
    const { brandId } = req.params;

    // SECURITY: requireAuth middleware guarantees req.auth.userId is present
    const userId = req.auth!.userId;

    const brand = await prisma.brands.findUnique({
      where: { id: brandId },
      include: {
        brand_analysis_costs: true,
      },
    });

    if (!brand) {
      sendError(res, 'BRAND_NOT_FOUND', 'Brand not found', 404);
      return;
    }

    // Check ownership - CRITICAL: Must match exactly
    if (brand.userId !== userId) {
      sendError(res, 'FORBIDDEN', 'You do not have access to this brand', 403);
      return;
    }

    // Calculate if stale
    const isStale = brand.expiresAt && brand.expiresAt < new Date();

    // Extract detectedLanguage from systemPrompt JSON (stored there to avoid schema migration)
    const systemPromptData = brand.systemPrompt as Record<string, unknown> | null;
    const detectedLanguage = systemPromptData?.detectedLanguage as string | undefined;

    sendSuccess(res, {
      id: brand.id,
      websiteUrl: brand.websiteUrl,
      status: brand.status,
      brandBook: brand.brandBook,
      systemPrompt: brand.systemPrompt,
      knowledgeBase: brand.knowledgeBase,
      recommendedIntegrations: brand.recommendedIntegrations,
      detectedLanguage: detectedLanguage || null,
      pagesScraped: brand.pagesScraped,
      analysisCost: brand.analysisCost ? parseFloat(brand.analysisCost.toString()) : null,
      tokensUsed: brand.tokensUsed,
      errorMessage: brand.errorMessage,
      isStale,
      expiresAt: brand.expiresAt,
      createdAt: brand.createdAt,
      analyzedAt: brand.analyzedAt,
      lastRefreshedAt: brand.lastRefreshedAt,
      costBreakdown: brand.brand_analysis_costs.map((log) => ({
        id: log.id,
        provider: log.provider,
        modelName: log.modelName,
        inputTokens: log.inputTokens,
        outputTokens: log.outputTokens,
        totalTokens: log.totalTokens,
        inputCost: parseFloat(log.inputCost.toString()),
        outputCost: parseFloat(log.outputCost.toString()),
        totalCost: parseFloat(log.totalCost.toString()),
        createdAt: log.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Failed to get brand', error);
    sendError(res, 'GET_BRAND_FAILED', error instanceof Error ? error.message : 'Failed to get brand', 500);
  }
}

/**
 * GET /api/brands
 * List all brands for authenticated user
 *
 * SECURITY: Pagination is bounded to prevent DoS attacks (limit: 1-100)
 */
export async function listBrands(req: Request, res: Response): Promise<void> {
  try {
    // SECURITY: requireAuth middleware guarantees req.auth.userId is present
    const userId = req.auth!.userId;

    // Pagination and filters are already validated by listBrandsSchema middleware
    const { status, page, limit, sortBy, sortOrder } = req.query as any;

    const where: any = {
      userId,
    };

    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    const [brands, total] = await Promise.all([
      prisma.brands.findMany({
        where,
        skip,
        take: limit,
        orderBy: sortBy ? { [sortBy]: sortOrder } : { createdAt: 'desc' },
        select: {
          id: true,
          websiteUrl: true,
          status: true,
          pagesScraped: true,
          analysisCost: true,
          createdAt: true,
          analyzedAt: true,
          expiresAt: true,
        },
      }),
      prisma.brands.count({ where }),
    ]);

    // Transform brands for response
    const brandsData = brands.map((brand) => ({
      ...brand,
      analysisCost: brand.analysisCost ? parseFloat(brand.analysisCost.toString()) : null,
      isStale: brand.expiresAt && brand.expiresAt < new Date(),
    }));

    // Use standardized paginated response
    sendPaginatedResponse(res, brandsData, page, limit, total);
  } catch (error) {
    logger.error('Failed to list brands', error);
    sendError(res, 'LIST_BRANDS_FAILED', error instanceof Error ? error.message : 'Failed to list brands', 500);
  }
}

/**
 * PUT /api/brands/:brandId/refresh
 * Refresh (re-analyze) a brand
 */
export async function refreshBrand(req: Request, res: Response): Promise<void> {
  try {
    const { brandId } = req.params;

    // SECURITY: requireAuth middleware guarantees req.auth.userId is present
    const userId = req.auth!.userId;

    const brand = await prisma.brands.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    // Check ownership
    if (brand.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    logger.info(`Refreshing brand analysis for ${brand.websiteUrl}`);

    // Reset brand status
    await prisma.brands.update({
      where: { id: brandId },
      data: {
        status: 'PENDING',
        errorMessage: null,
        retryCount: 0,
        lastRefreshedAt: new Date(),
      },
    });

    // Enqueue re-analysis
    await enqueueBrandAnalysis({
      brandId,
      websiteUrl: brand.websiteUrl,
      userId,
    });

    res.json({
      brandId,
      status: 'PENDING',
      message: 'Brand refresh started',
      estimatedTime: 180, // 3 minutes
    });
  } catch (error) {
    logger.error('Failed to refresh brand', error);
    res.status(500).json({
      error: 'Failed to refresh brand',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/brands/:brandId
 * Delete a brand analysis
 */
export async function deleteBrand(req: Request, res: Response): Promise<void> {
  try {
    const { brandId } = req.params;

    // SECURITY: requireAuth middleware guarantees req.auth.userId is present
    const userId = req.auth!.userId;

    const brand = await prisma.brands.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    // Check ownership - CRITICAL: Must match exactly
    if (brand.userId !== userId) {
      logger.warn(`Delete failed: User ${userId} attempted to delete brand ${brandId} owned by ${brand.userId}`);
      res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this brand.',
      });
      return;
    }

    logger.info(`Deleting brand ${brandId} (${brand.websiteUrl}) for user ${userId}`);

    // Delete brand and cascade delete cost logs
    await prisma.brands.delete({
      where: { id: brandId },
    });

    res.status(200).json({
      message: 'Brand deleted successfully',
      brandId,
    });
  } catch (error) {
    logger.error('Failed to delete brand', error);
    res.status(500).json({
      error: 'Failed to delete brand',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/brands/costs/summary
 * Get comprehensive cost summary for authenticated user
 * Task 40: Enhanced with BrandAnalysisCostService
 */
export async function getCostSummary(req: Request, res: Response): Promise<void> {
  try {
    // SECURITY: requireAuth middleware guarantees req.auth.userId is present
    const userId = req.auth!.userId;

    // Parse date range from query params if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    // Get comprehensive cost summary using new service
    const summary = await brandCostService.getCostsByUser(userId, { startDate, endDate });

    // Get cost trends for the period (last 30 days by default)
    const trends = await brandCostService.getCostTrends(userId, { startDate, endDate });

    res.json({
      summary,
      trends,
      period: {
        startDate: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate || new Date(),
      },
    });
  } catch (error) {
    logger.error('Failed to get cost summary', error);
    res.status(500).json({
      error: 'Failed to get cost summary',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/brands/:brandId/costs
 * Get detailed costs for a specific brand
 * Task 40: Enhanced with BrandAnalysisCostService
 */
export async function getBrandCosts(req: Request, res: Response): Promise<void> {
  try {
    const { brandId } = req.params;

    // SECURITY: requireAuth middleware guarantees req.auth.userId is present
    const userId = req.auth!.userId;

    // Verify brand ownership
    const brand = await prisma.brands.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      res.status(404).json({ error: 'Brand not found' });
      return;
    }

    if (brand.userId !== userId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Parse date range from query params if provided
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

    // Get detailed cost summary using new service
    const costSummary = await brandCostService.getCostsByBrand(brandId, { startDate, endDate });

    res.json({
      ...costSummary,
      websiteUrl: brand.websiteUrl,
    });
  } catch (error) {
    logger.error('Failed to get brand costs', error);
    res.status(500).json({
      error: 'Failed to get brand costs',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
