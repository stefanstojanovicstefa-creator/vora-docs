/**
 * Brands API Routes
 * Brand analysis endpoints with WebSocket support
 *
 * SECURITY: All routes require authentication and ownership verification
 * Rate limiting applied to expensive operations (analyze, refresh)
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { rateLimitMiddleware, RateLimitTier } from '../middleware/rate-limit.middleware';
import { ssrfProtection } from '../middleware/security.middleware';
import {
  analyzeBrandSchema,
  getBrandSchema,
  listBrandsSchema,
  refreshBrandSchema,
  deleteBrandSchema,
  getCostSummarySchema,
  getBrandCostsSchema,
} from '../schemas/request-validation.schema';
import {
  analyzeBrand,
  getBrand,
  listBrands,
  refreshBrand,
  deleteBrand,
  getCostSummary,
  getBrandCosts,
} from '../controllers/brands.controller';

const router = Router();

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

/**
 * Strict rate limit for brand analysis operations
 * These are expensive operations that involve:
 * - Web scraping (CPU intensive)
 * - AI analysis (API costs)
 * - Knowledge base generation (storage)
 *
 * Limit: 5 requests per hour per authenticated user
 * This prevents DoS attacks and controls costs
 */
const brandAnalysisRateLimit = rateLimitMiddleware(RateLimitTier.BASIC, {
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
});

// ============================================================================
// Route Definitions
// ============================================================================
// MIDDLEWARE ORDER (CRITICAL):
// 1. requireAuth - Verify Clerk authentication token
// 2. Rate limiting - Prevent abuse (expensive operations only)
// 3. Validation - Ensure request data is valid
// 4. Controller - Business logic with ownership verification

/**
 * @openapi
 * /api/brands/analyze:
 *   post:
 *     summary: Trigger brand analysis
 *     description: Analyzes a brand website URL to extract audience insights, competitor analysis, vocabulary, and use-case scenarios. Rate limited to 5 requests per hour.
 *     tags: [Brands]
 *     security:
 *       - ClerkJWT: []
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
 *                 description: The brand website URL to analyze
 *               agentId:
 *                 type: string
 *                 description: Optional agent to link the brand analysis to
 *     responses:
 *       200:
 *         description: Brand analysis initiated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrandAnalysisResult'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       429:
 *         description: Rate limit exceeded (max 5 requests/hour)
 *       500:
 *         description: Internal server error
 */
router.post(
  '/analyze',
  requireAuth,
  brandAnalysisRateLimit,
  ssrfProtection, // SECURITY: Validate URLs before any processing
  validateRequest({ body: analyzeBrandSchema.shape.body }),
  analyzeBrand,
);

/**
 * @openapi
 * /api/brands:
 *   get:
 *     summary: List all brands
 *     description: Returns all brand analyses for the authenticated user, optionally filtered by query parameters.
 *     tags: [Brands]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, ANALYZING, COMPLETE, FAILED]
 *         description: Filter by analysis status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of brand analyses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BrandAnalysisResult'
 *                 total:
 *                   type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  requireAuth,
  validateRequest({ query: listBrandsSchema.shape.query }),
  listBrands,
);

/**
 * @openapi
 * /api/brands/{brandId}:
 *   get:
 *     summary: Get brand analysis results
 *     description: Returns the full brand analysis including audience analysis, competitor analysis, vocabulary, and use-case scenarios.
 *     tags: [Brands]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The brand analysis ID
 *     responses:
 *       200:
 *         description: Brand analysis details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrandAnalysisResult'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:brandId',
  requireAuth,
  validateRequest({
    params: getBrandSchema.shape.params,
    query: getBrandSchema.shape.query,
  }),
  getBrand,
);

/**
 * @openapi
 * /api/brands/{brandId}/refresh:
 *   put:
 *     summary: Refresh brand analysis
 *     description: Re-analyzes a brand to update audience insights, competitor data, and vocabulary. Rate limited to 5 requests per hour.
 *     tags: [Brands]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The brand analysis ID to refresh
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: Optional updated URL to re-analyze
 *     responses:
 *       200:
 *         description: Brand analysis refresh initiated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/BrandAnalysisResult'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       429:
 *         description: Rate limit exceeded (max 5 requests/hour)
 *       500:
 *         description: Internal server error
 */
router.put(
  '/:brandId/refresh',
  requireAuth,
  brandAnalysisRateLimit,
  ssrfProtection, // SECURITY: Validate URLs before any processing
  validateRequest({
    params: refreshBrandSchema.shape.params,
    body: refreshBrandSchema.shape.body,
  }),
  refreshBrand,
);

/**
 * @openapi
 * /api/brands/{brandId}:
 *   delete:
 *     summary: Delete a brand analysis
 *     description: Permanently deletes a brand analysis and all associated data.
 *     tags: [Brands]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The brand analysis ID to delete
 *     responses:
 *       200:
 *         description: Brand analysis deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:brandId',
  requireAuth,
  validateRequest({
    params: deleteBrandSchema.shape.params,
    body: deleteBrandSchema.shape.body,
  }),
  deleteBrand,
);

/**
 * @openapi
 * /api/brands/costs/summary:
 *   get:
 *     summary: Get brand analysis cost summary
 *     description: Returns aggregated cost data for all brand analyses performed by the authenticated user.
 *     tags: [Brands]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date filter
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date filter
 *     responses:
 *       200:
 *         description: Cost summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalCost:
 *                   type: number
 *                 analysisCount:
 *                   type: integer
 *                 breakdown:
 *                   type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/costs/summary',
  requireAuth,
  validateRequest({ query: getCostSummarySchema.shape.query }),
  getCostSummary,
);

/**
 * @openapi
 * /api/brands/{brandId}/costs:
 *   get:
 *     summary: Get brand analysis costs
 *     description: Returns detailed cost breakdown for a specific brand analysis including scraping, AI processing, and storage costs.
 *     tags: [Brands]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: brandId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The brand analysis ID
 *     responses:
 *       200:
 *         description: Brand analysis cost details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 brandId:
 *                   type: string
 *                 costs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       amount:
 *                         type: number
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:brandId/costs',
  requireAuth,
  validateRequest({
    params: getBrandCostsSchema.shape.params,
    query: getBrandCostsSchema.shape.query,
  }),
  getBrandCosts,
);

export default router;
