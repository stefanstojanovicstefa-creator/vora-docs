/**
 * Custom Functions API Routes (Frontend Compatibility Layer)
 *
 * Provides a stable `/api/custom-functions` contract used by the frontend UI.
 * Wraps responses in `{ success, data, error }` to match ApiResponse<T>.
 *
 * Includes:
 * - CRUD for custom functions
 * - Execute + stats + logs
 * - Template library + compile-from-template
 * - Lightweight validation endpoint
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { strictRateLimiter } from '../middleware/rate-limit.middleware';
import { requireOwnership, verifyOwnership } from '../middleware/ownership.middleware';
import { createLogger } from '../utils/logger';
import { validateExternalUrl } from '../utils/url-validator';
import { HttpMethod } from '@prisma/client';
import { createId as cuid } from '@paralleldrive/cuid2';
import { customFunctionsService } from '../services/custom-functions.service';
import { functionExecutor } from '../services/function-executor.service';
import {
  customFunctionTemplatesService,
  type CustomFunctionTemplate,
} from '../services/custom-function-templates.service';

const logger = createLogger('custom-functions.routes');
const router = Router();

// ============================================================================
// Helpers
// ============================================================================

const templateVarRegex = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

function extractTemplateVars(text: string): Set<string> {
  const vars = new Set<string>();
  templateVarRegex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = templateVarRegex.exec(text)) !== null) {
    vars.add(match[1]);
  }
  return vars;
}

function interpolate(template: string, values: Record<string, unknown>): { value: string; used: Set<string> } {
  const used = extractTemplateVars(template);
  templateVarRegex.lastIndex = 0;
  const value = template.replace(templateVarRegex, (_m, key: string) => {
    const raw = values[key];
    return raw === undefined || raw === null ? '' : String(raw);
  });
  return { value, used };
}

function interpolateIfProvided(
  template: string,
  values: Record<string, unknown>,
): { value: string; used: Set<string> } {
  const used = new Set<string>();
  templateVarRegex.lastIndex = 0;
  const value = template.replace(templateVarRegex, (match, key: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) return match;
    used.add(key);
    const raw = values[key];
    return raw === undefined || raw === null ? '' : String(raw);
  });
  return { value, used };
}

function validateTemplateParametersOrThrow(
  template: CustomFunctionTemplate,
  provided: Record<string, unknown>,
): void {
  const missing: string[] = [];

  for (const param of template.parameters || []) {
    const raw = (provided as any)?.[param.name];
    const isMissing =
      raw === undefined ||
      raw === null ||
      (typeof raw === 'string' && raw.trim().length === 0);

    if (param.required && isMissing) {
      missing.push(param.name);
      continue;
    }

    if (isMissing) continue;

    if (param.validation?.pattern && typeof raw === 'string') {
      const re = new RegExp(param.validation.pattern);
      if (!re.test(raw)) {
        throw new Error(`Invalid value for '${param.name}': does not match required pattern`);
      }
    }

    if (param.validation?.enum && param.validation.enum.length > 0) {
      if (!param.validation.enum.includes(raw as any)) {
        throw new Error(`Invalid value for '${param.name}': must be one of ${param.validation.enum.join(', ')}`);
      }
    }

    if (typeof raw === 'number') {
      if (typeof param.validation?.min === 'number' && raw < param.validation.min) {
        throw new Error(`Invalid value for '${param.name}': must be >= ${param.validation.min}`);
      }
      if (typeof param.validation?.max === 'number' && raw > param.validation.max) {
        throw new Error(`Invalid value for '${param.name}': must be <= ${param.validation.max}`);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required template parameter(s): ${missing.join(', ')}`);
  }
}

function buildParametersSchemaFromTemplates(opts: {
  url?: string;
  headers?: Record<string, string>;
  bodyTemplate?: string;
}): Record<string, any> {
  const vars = new Set<string>();

  if (opts.url) extractTemplateVars(opts.url).forEach((v) => vars.add(v));
  if (opts.bodyTemplate) extractTemplateVars(opts.bodyTemplate).forEach((v) => vars.add(v));
  if (opts.headers) {
    Object.values(opts.headers).forEach((val) => extractTemplateVars(val).forEach((v) => vars.add(v)));
  }

  const properties: Record<string, any> = {};
  for (const v of vars) {
    properties[v] = { type: 'string', description: `Template variable: ${v}` };
  }

  return {
    type: 'object',
    properties,
    required: Array.from(vars),
    additionalProperties: true,
  };
}

function toSnakeCase(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_{2,}/g, '_');
}

async function validateUrlOrThrow(url: string): Promise<void> {
  // Reject placeholder-only URLs (e.g. {{webhook_url}})
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('URL must start with http:// or https://');
  }

  // Validate SSRF for concrete URL (placeholders in path are OK)
  const safeForParsing = url.replace(templateVarRegex, 'placeholder');
  const result = await validateExternalUrl(safeForParsing, { allowHttp: false });
  if (!result.valid) {
    throw new Error(result.error || 'URL failed external URL validation');
  }
}

function ok<T>(data: T, message?: string) {
  return { success: true, ...(message ? { message } : {}), data };
}

function fail(message: string, details?: unknown) {
  return { success: false, error: message, ...(details ? { details } : {}) };
}

// ============================================================================
// Schemas
// ============================================================================

const listFunctionsQuerySchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  page: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
  limit: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
  search: z.string().max(200).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
});

const functionIdParamSchema = z.object({
  functionId: z.string().min(1, 'functionId is required'),
});

const createFunctionBodySchema = z.object({
  agentId: z.string().min(1, 'agentId is required'),
  name: z
    .string()
    .min(1, 'name is required')
    .max(100)
    .regex(/^[a-z_][a-z0-9_]*$/, 'name must be snake_case'),
  description: z.string().min(10).max(1000),
  method: z.nativeEnum(HttpMethod),
  url: z.string().min(1),
  headers: z.record(z.string()).optional(),
  bodyTemplate: z.string().max(1048576).optional(),
  responseMapping: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

const updateFunctionBodySchema = z.object({
  name: z.string().max(100).regex(/^[a-z_][a-z0-9_]*$/, 'name must be snake_case').optional(),
  description: z.string().min(10).max(1000).optional(),
  method: z.nativeEnum(HttpMethod).optional(),
  url: z.string().min(1).optional(),
  headers: z.record(z.string()).optional(),
  bodyTemplate: z.string().max(1048576).nullable().optional(),
  responseMapping: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

const executeBodySchema = z.object({
  parameters: z.record(z.any()).optional(),
  timeout: z.number().min(1000).max(300000).optional(),
  sessionId: z.string().optional(),
});

const listLogsQuerySchema = z.object({
  page: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
  limit: z.string().regex(/^\d+$/).transform((v) => parseInt(v, 10)).optional(),
  status: z.string().max(50).optional(),
});

const duplicateBodySchema = z.object({
  name: z.string().max(100).regex(/^[a-z_][a-z0-9_]*$/, 'name must be snake_case').optional(),
});

const validateBodySchema = createFunctionBodySchema.partial().extend({
  agentId: z.string().optional(),
});

const listTemplatesQuerySchema = z.object({
  category: z.string().max(64).optional(),
});

const templateIdParamSchema = z.object({
  templateId: z.string().min(1),
});

const compileTemplateBodySchema = z.object({
  templateId: z.string().min(1),
  agentId: z.string().min(1),
  parameters: z.record(z.any()).default({}),
  name: z.string().max(100).regex(/^[a-z_][a-z0-9_]*$/, 'name must be snake_case').optional(),
  description: z.string().max(1000).optional(),
});

const generateWithAiBodySchema = z.object({
  prompt: z.string().min(10).max(2000),
  agentId: z.string().min(1),
});

// ============================================================================
// Routes
// ============================================================================

/**
 * @openapi
 * /api/custom-functions:
 *   get:
 *     summary: List custom functions
 *     description: Returns paginated custom functions for a specific agent. Supports search and active-status filtering.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: query
 *         name: agentId
 *         required: true
 *         schema:
 *           type: string
 *         description: Agent ID to list functions for
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by name or description
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *         description: Filter by active status
 *     responses:
 *       200:
 *         description: Paginated list of custom functions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CustomFunction'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/',
  strictRateLimiter,
  requireAuth,
  validateRequest({ query: listFunctionsQuerySchema }),
  async (req, res) => {
    try {
      const userId = req.auth?.userId;
      const { agentId, search, isActive } = req.query as any;
      const page = Math.max(1, Number((req.query as any).page) || 1);
      const limit = Math.min(100, Math.max(1, Number((req.query as any).limit) || 20));

      if (!userId) return res.status(401).json(fail('Authentication required'));

      const canAccess = await verifyOwnership('agent', agentId, userId);
      if (!canAccess) return res.status(404).json(fail('Agent not found or access denied'));

      const where: any = { agentId };
      if (typeof isActive === 'boolean') where.isActive = isActive;
      if (search) {
        where.OR = [
          { name: { contains: String(search), mode: 'insensitive' } },
          { description: { contains: String(search), mode: 'insensitive' } },
        ];
      }

      const [total, functions] = await Promise.all([
        prisma.custom_functions.count({ where }),
        prisma.custom_functions.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            agentId: true,
            name: true,
            description: true,
            method: true,
            url: true,
            headers: true,
            bodyTemplate: true,
            responseMapping: true,
            isActive: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { callLogs: true } },
            callLogs: {
              take: 1,
              orderBy: { timestamp: 'desc' },
              select: { timestamp: true },
            },
          } as any,
        }),
      ]);

      const functionsAny = functions as any[];
      const mapped = functionsAny.map((fn) => ({
        ...fn,
        executionCount: fn._count.callLogs,
        lastExecutedAt: fn.callLogs[0]?.timestamp,
      }));

      return res.json(
        ok({
          data: mapped,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        }),
      );
    } catch (error) {
      logger.error('List custom functions failed', error);
      return res.status(500).json(fail('Failed to list functions'));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/validate:
 *   post:
 *     summary: Validate a custom function definition
 *     description: Validates a function URL and name format without persisting. Returns any validation errors found.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *               name:
 *                 type: string
 *                 pattern: '^[a-z_][a-z0-9_]*$'
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/validate',
  strictRateLimiter,
  requireAuth,
  validateRequest({ body: validateBodySchema }),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof validateBodySchema>;

      const errors: string[] = [];
      if (body.url) {
        try {
          await validateUrlOrThrow(body.url);
        } catch (e) {
          errors.push(e instanceof Error ? e.message : 'Invalid URL');
        }
      }

      if (body.name && !/^[a-z_][a-z0-9_]*$/.test(body.name)) {
        errors.push('name must be snake_case');
      }

      return res.json(ok({ valid: errors.length === 0, errors: errors.length ? errors : undefined }));
    } catch (error) {
      logger.error('Validate function failed', error);
      return res.status(500).json(fail('Failed to validate function'));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/templates:
 *   get:
 *     summary: List function templates
 *     description: Returns available function templates, optionally filtered by category.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter templates by category
 *     responses:
 *       200:
 *         description: List of function templates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       category:
 *                         type: string
 *                       method:
 *                         type: string
 *                       tags:
 *                         type: array
 *                         items:
 *                           type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/templates',
  strictRateLimiter,
  requireAuth,
  validateRequest({ query: listTemplatesQuerySchema }),
  async (req, res) => {
    try {
      const category = (req.query as any).category as string | undefined;
      const templates = customFunctionTemplatesService.getAll(category);
      return res.json(ok(templates));
    } catch (error) {
      logger.error('List templates failed', error);
      return res.status(500).json(fail('Failed to list templates'));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/templates/{templateId}:
 *   get:
 *     summary: Get a function template
 *     description: Returns the full definition of a specific function template including URL template, headers, body template, and parameters.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: templateId
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Function template details
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/templates/:templateId',
  strictRateLimiter,
  requireAuth,
  validateRequest({ params: templateIdParamSchema }),
  async (req, res) => {
    try {
      const { templateId } = req.params as any;
      const template = customFunctionTemplatesService.getById(templateId);
      if (!template) return res.status(404).json(fail('Template not found'));
      return res.json(ok(template));
    } catch (error) {
      logger.error('Get template failed', error);
      return res.status(500).json(fail('Failed to get template'));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/compile-template:
 *   post:
 *     summary: Create function from template
 *     description: Instantiates a function template with the provided parameters and creates a persisted custom function.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [templateId, agentId]
 *             properties:
 *               templateId:
 *                 type: string
 *               agentId:
 *                 type: string
 *               parameters:
 *                 type: object
 *               name:
 *                 type: string
 *                 pattern: '^[a-z_][a-z0-9_]*$'
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Function created from template
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CustomFunction'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         description: Template or agent not found
 *       500:
 *         description: Internal server error
 */
router.post(
  '/compile-template',
  strictRateLimiter,
  requireAuth,
  validateRequest({ body: compileTemplateBodySchema }),
  async (req, res) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json(fail('Authentication required'));

      const body = req.body as z.infer<typeof compileTemplateBodySchema>;
      const canAccess = await verifyOwnership('agent', body.agentId, userId);
      if (!canAccess) return res.status(404).json(fail('Agent not found or access denied'));

      const template = customFunctionTemplatesService.getById(body.templateId);
      if (!template) return res.status(404).json(fail('Template not found'));

      validateTemplateParametersOrThrow(template, body.parameters);

      const { value: resolvedUrl } = interpolateIfProvided(template.urlTemplate, body.parameters);
      const resolvedHeaders: Record<string, string> = {};
      if (template.headerTemplate) {
        for (const [k, v] of Object.entries(template.headerTemplate)) {
          resolvedHeaders[k] = interpolateIfProvided(v, body.parameters).value;
        }
      }

      const resolvedBodyTemplate = template.bodyTemplate
        ? interpolateIfProvided(template.bodyTemplate, body.parameters).value
        : undefined;

      await validateUrlOrThrow(resolvedUrl);

      const parametersSchema = buildParametersSchemaFromTemplates({
        url: resolvedUrl,
        headers: resolvedHeaders,
        bodyTemplate: resolvedBodyTemplate,
      });

      const name = body.name || toSnakeCase(template.name);
      const created = await customFunctionsService.createFunction({
        agentId: body.agentId,
        name,
        description: body.description || template.description,
        method: template.method,
        url: resolvedUrl,
        headers: Object.keys(resolvedHeaders).length ? resolvedHeaders : undefined,
        bodyTemplate: resolvedBodyTemplate,
        parameters: parametersSchema,
        responseMapping: {},
      });

      return res.status(201).json(ok(created, 'Function created from template'));
    } catch (error) {
      logger.error('Compile template failed', error);
      const message = error instanceof Error ? error.message : 'Failed to compile template';
      return res.status(400).json(fail(message));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/generate-with-ai:
 *   post:
 *     summary: Generate function with AI
 *     description: Generates a draft function definition from a natural-language prompt by matching against available templates. Returns an unpersisted draft.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [prompt, agentId]
 *             properties:
 *               prompt:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *               agentId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Generated function draft
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CustomFunction'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/generate-with-ai',
  strictRateLimiter,
  requireAuth,
  validateRequest({ body: generateWithAiBodySchema }),
  async (req, res) => {
    try {
      const body = req.body as z.infer<typeof generateWithAiBodySchema>;

      // Simple heuristic: pick a template by keyword match
      const promptLower = body.prompt.toLowerCase();
      const templates = customFunctionTemplatesService.getAll();

      const ranked = templates
        .map((t) => {
          const tags = (t.tags || []).join(' ');
          const hay = `${t.name} ${t.description} ${tags}`.toLowerCase();
          let score = 0;
          if (promptLower.includes('slack') && hay.includes('slack')) score += 3;
          if (promptLower.includes('twilio') && hay.includes('twilio')) score += 3;
          if (promptLower.includes('sendgrid') && hay.includes('sendgrid')) score += 3;
          if (promptLower.includes('stripe') && hay.includes('stripe')) score += 3;
          if (promptLower.includes('airtable') && hay.includes('airtable')) score += 3;
          if (promptLower.includes('webhook') && hay.includes('webhook')) score += 2;
          if (promptLower.includes('email') && hay.includes('email')) score += 1;
          if (promptLower.includes('sms') && hay.includes('sms')) score += 1;
          return { t, score };
        })
        .sort((a, b) => b.score - a.score);

      const best = ranked[0]?.t || templates[0];

      // Return a draft function definition (not persisted)
      return res.json(
        ok({
          agentId: body.agentId,
          name: toSnakeCase(best.name),
          description: best.description,
          method: best.method,
          url: best.urlTemplate,
          headers: best.headerTemplate || {},
          bodyTemplate: best.bodyTemplate,
          isActive: true,
          parameters: buildParametersSchemaFromTemplates({
            url: best.urlTemplate,
            headers: best.headerTemplate,
            bodyTemplate: best.bodyTemplate,
          }),
        }),
      );
    } catch (error) {
      logger.error('Generate-with-ai failed', error);
      return res.status(500).json(fail('Failed to generate function'));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/{functionId}:
 *   get:
 *     summary: Get a custom function
 *     description: Returns full details for a specific custom function including execution count and last execution time.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: functionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Custom function ID
 *     responses:
 *       200:
 *         description: Custom function details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/CustomFunction'
 *                     - type: object
 *                       properties:
 *                         executionCount:
 *                           type: integer
 *                         lastExecutedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:functionId',
  strictRateLimiter,
  requireAuth,
  requireOwnership('function', 'functionId'),
  validateRequest({ params: functionIdParamSchema }),
  async (req, res) => {
    try {
      const { functionId } = req.params as any;
      const func = await prisma.custom_functions.findUnique({
        where: { id: functionId },
      });

      if (!func) return res.status(404).json(fail('Function not found'));

      const executionCount = await prisma.function_call_logs.count({ where: { functionId } });
      const lastLog = await prisma.function_call_logs.findFirst({
        where: { functionId },
        orderBy: { timestamp: 'desc' },
        select: { timestamp: true },
      });

      return res.json(
        ok({
          ...func,
          executionCount,
          lastExecutedAt: lastLog?.timestamp,
        }),
      );
    } catch (error) {
      logger.error('Get custom function failed', error);
      return res.status(500).json(fail('Failed to get function'));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions:
 *   post:
 *     summary: Create a custom function
 *     description: Creates a new custom function for an agent. The URL is validated for SSRF protection and a parameters schema is auto-generated from template variables.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [agentId, name, description, method, url]
 *             properties:
 *               agentId:
 *                 type: string
 *               name:
 *                 type: string
 *                 pattern: '^[a-z_][a-z0-9_]*$'
 *               description:
 *                 type: string
 *               method:
 *                 type: string
 *                 enum: [GET, POST, PUT, PATCH, DELETE]
 *               url:
 *                 type: string
 *                 format: uri
 *               headers:
 *                 type: object
 *               bodyTemplate:
 *                 type: string
 *               responseMapping:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Custom function created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CustomFunction'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/',
  strictRateLimiter,
  requireAuth,
  validateRequest({ body: createFunctionBodySchema }),
  async (req, res) => {
    try {
      const userId = req.auth?.userId;
      if (!userId) return res.status(401).json(fail('Authentication required'));

      const body = req.body as z.infer<typeof createFunctionBodySchema>;
      const canAccess = await verifyOwnership('agent', body.agentId, userId);
      if (!canAccess) return res.status(404).json(fail('Agent not found or access denied'));

      await validateUrlOrThrow(body.url);

      const parametersSchema = buildParametersSchemaFromTemplates({
        url: body.url,
        headers: body.headers,
        bodyTemplate: body.bodyTemplate,
      });

      const created = await customFunctionsService.createFunction({
        agentId: body.agentId,
        name: body.name,
        description: body.description,
        method: body.method,
        url: body.url,
        headers: body.headers,
        bodyTemplate: body.bodyTemplate,
        parameters: parametersSchema,
        responseMapping: body.responseMapping,
      });

      return res.status(201).json(ok(created, 'Function created successfully'));
    } catch (error) {
      logger.error('Create custom function failed', error);
      const message = error instanceof Error ? error.message : 'Failed to create function';
      return res.status(400).json(fail(message));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/{functionId}:
 *   patch:
 *     summary: Update a custom function
 *     description: Updates one or more fields of an existing custom function. Parameters schema is regenerated if URL, headers, or body template changes.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: functionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Custom function ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 pattern: '^[a-z_][a-z0-9_]*$'
 *               description:
 *                 type: string
 *               method:
 *                 type: string
 *                 enum: [GET, POST, PUT, PATCH, DELETE]
 *               url:
 *                 type: string
 *               headers:
 *                 type: object
 *               bodyTemplate:
 *                 type: string
 *                 nullable: true
 *               responseMapping:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Function updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CustomFunction'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.patch(
  '/:functionId',
  strictRateLimiter,
  requireAuth,
  requireOwnership('function', 'functionId'),
  validateRequest({ params: functionIdParamSchema, body: updateFunctionBodySchema }),
  async (req, res) => {
    try {
      const { functionId } = req.params as any;
      const updates = req.body as z.infer<typeof updateFunctionBodySchema>;

      if (updates.url) {
        await validateUrlOrThrow(updates.url);
      }

      const existing = await prisma.custom_functions.findUnique({ where: { id: functionId } });
      if (!existing) return res.status(404).json(fail('Function not found'));

      const updated = await customFunctionsService.updateFunction(functionId, existing.agentId, {
        ...updates,
        // Rebuild schema if any templates changed
        ...(updates.url || updates.headers || updates.bodyTemplate
          ? {
              parameters: buildParametersSchemaFromTemplates({
                url: updates.url ?? existing.url,
                headers: (updates.headers as any) ?? (existing.headers as any),
                bodyTemplate:
                  updates.bodyTemplate === undefined
                    ? (existing as any).bodyTemplate
                    : updates.bodyTemplate || undefined,
              }),
            }
          : {}),
      });

      return res.json(ok(updated, 'Function updated successfully'));
    } catch (error) {
      logger.error('Update custom function failed', error);
      const message = error instanceof Error ? error.message : 'Failed to update function';
      return res.status(400).json(fail(message));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/{functionId}:
 *   delete:
 *     summary: Delete a custom function
 *     description: Permanently deletes a custom function and removes it from the agent.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: functionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Custom function ID
 *     responses:
 *       200:
 *         description: Function deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: boolean
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.delete(
  '/:functionId',
  strictRateLimiter,
  requireAuth,
  requireOwnership('function', 'functionId'),
  validateRequest({ params: functionIdParamSchema }),
  async (req, res) => {
    try {
      const { functionId } = req.params as any;
      const existing = await prisma.custom_functions.findUnique({ where: { id: functionId } });
      if (!existing) return res.status(404).json(fail('Function not found'));

      await customFunctionsService.deleteFunction(functionId, existing.agentId);
      return res.json(ok({ deleted: true }, 'Function deleted successfully'));
    } catch (error) {
      logger.error('Delete custom function failed', error);
      return res.status(500).json(fail('Failed to delete function'));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/{functionId}/execute:
 *   post:
 *     summary: Execute a custom function
 *     description: Executes a custom function with the provided parameters and returns the result.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: functionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Custom function ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               parameters:
 *                 type: object
 *                 description: Function parameters to pass
 *               timeout:
 *                 type: integer
 *                 minimum: 1000
 *                 maximum: 300000
 *                 description: Execution timeout in milliseconds
 *               sessionId:
 *                 type: string
 *                 description: Optional session ID for context
 *     responses:
 *       200:
 *         description: Execution result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     status:
 *                       type: integer
 *                     data:
 *                       type: object
 *                     error:
 *                       type: string
 *                     executionTime:
 *                       type: integer
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:functionId/execute',
  strictRateLimiter,
  requireAuth,
  requireOwnership('function', 'functionId'),
  validateRequest({ params: functionIdParamSchema, body: executeBodySchema }),
  async (req, res) => {
    try {
      const { functionId } = req.params as any;
      const { parameters = {}, sessionId } = req.body as z.infer<typeof executeBodySchema>;

      const func = await prisma.custom_functions.findUnique({ where: { id: functionId } });
      if (!func) return res.status(404).json(fail('Function not found'));

      const result = await functionExecutor.executeFunction({
        functionId,
        agentId: func.agentId,
        parameters,
        sessionId,
      });

      if (result.success) {
        return res.json(
          ok({
            success: true,
            status: result.statusCode || 200,
            data: result.data,
            executionTime: result.executionTime,
          }),
        );
      }

      return res.json(
        ok({
          success: false,
          status: result.statusCode || 500,
          error: result.error,
          executionTime: result.executionTime,
        }),
      );
    } catch (error) {
      logger.error('Execute custom function failed', error);
      return res.status(500).json(fail('Failed to execute function'));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/{functionId}/stats:
 *   get:
 *     summary: Get function execution stats
 *     description: Returns execution statistics for a custom function including total executions, success/failure counts, and average execution time.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: functionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Custom function ID
 *     responses:
 *       200:
 *         description: Function execution statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     functionId:
 *                       type: string
 *                     totalExecutions:
 *                       type: integer
 *                     successCount:
 *                       type: integer
 *                     failureCount:
 *                       type: integer
 *                     averageExecutionTime:
 *                       type: number
 *                     successRate:
 *                       type: number
 *                     lastExecutedAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:functionId/stats',
  strictRateLimiter,
  requireAuth,
  requireOwnership('function', 'functionId'),
  validateRequest({ params: functionIdParamSchema }),
  async (req, res) => {
    try {
      const { functionId } = req.params as any;

      const stats = await customFunctionsService.getFunctionStats(functionId);

      return res.json(
        ok({
          functionId,
          totalExecutions: stats.totalCalls,
          successCount: stats.successfulCalls,
          failureCount: stats.failedCalls,
          averageExecutionTime: stats.avgExecutionTime,
          lastExecutedAt: stats.recentLogs?.[0]?.timestamp,
          successRate: stats.successRate,
          executionHistory: [],
        }),
      );
    } catch (error) {
      logger.error('Get function stats failed', error);
      return res.status(500).json(fail('Failed to get function stats'));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/{functionId}/logs:
 *   get:
 *     summary: Get function execution logs
 *     description: Returns paginated execution logs for a custom function with optional status filtering.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: functionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Custom function ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by execution status
 *     responses:
 *       200:
 *         description: Paginated execution logs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           status:
 *                             type: string
 *                           responseStatus:
 *                             type: integer
 *                           executionTime:
 *                             type: integer
 *                           errorMessage:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:functionId/logs',
  strictRateLimiter,
  requireAuth,
  requireOwnership('function', 'functionId'),
  validateRequest({ params: functionIdParamSchema, query: listLogsQuerySchema }),
  async (req, res) => {
    try {
      const { functionId } = req.params as any;
      const page = Math.max(1, Number((req.query as any).page) || 1);
      const limit = Math.min(100, Math.max(1, Number((req.query as any).limit) || 20));
      const status = (req.query as any).status as string | undefined;

      const func = await prisma.custom_functions.findUnique({ where: { id: functionId } });
      if (!func) return res.status(404).json(fail('Function not found'));

      const where: any = { functionId };
      if (status) where.status = status;

      const [total, logs] = await Promise.all([
        prisma.function_call_logs.count({ where }),
        prisma.function_call_logs.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]);

      const mapped = logs.map((log) => ({
        id: log.id,
        functionId: log.functionId,
        status: log.status,
        requestUrl: (log as any).requestUrl || func.url,
        requestMethod: (log as any).requestMethod || func.method,
        requestHeaders: log.requestHeaders as any,
        requestBody: log.requestBody as any,
        responseStatus: log.statusCode || 0,
        responseHeaders: undefined,
        responseBody: log.responseBody as any,
        executionTime: log.executionTime,
        errorMessage: log.errorMessage || undefined,
        createdAt: log.timestamp,
      }));

      return res.json(
        ok({
          data: mapped,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        }),
      );
    } catch (error) {
      logger.error('Get execution logs failed', error);
      return res.status(500).json(fail('Failed to get execution logs'));
    }
  },
);

/**
 * @openapi
 * /api/custom-functions/{functionId}/duplicate:
 *   post:
 *     summary: Duplicate a custom function
 *     description: Creates a copy of an existing custom function. The duplicate is created in an inactive state.
 *     tags: [Functions]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: functionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Custom function ID to duplicate
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 pattern: '^[a-z_][a-z0-9_]*$'
 *                 description: Optional custom name for the duplicate
 *     responses:
 *       201:
 *         description: Function duplicated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/CustomFunction'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.post(
  '/:functionId/duplicate',
  strictRateLimiter,
  requireAuth,
  requireOwnership('function', 'functionId'),
  validateRequest({ params: functionIdParamSchema, body: duplicateBodySchema }),
  async (req, res) => {
    try {
      const { functionId } = req.params as any;
      const { name } = req.body as z.infer<typeof duplicateBodySchema>;

      const original = await prisma.custom_functions.findUnique({ where: { id: functionId } });
      if (!original) return res.status(404).json(fail('Function not found'));

      const baseName = name || `${original.name}_copy`;
      const newName = toSnakeCase(baseName);

      const created = await prisma.custom_functions.create({
        data: {
          id: cuid(),
          agentId: original.agentId,
          name: newName,
          description: original.description,
          method: original.method,
          url: original.url,
          headers: original.headers,
          bodyTemplate: (original as any).bodyTemplate,
          parameters: original.parameters,
          authType: original.authType,
          authConfig: original.authConfig,
          responseMapping: original.responseMapping,
          isActive: false,
          updatedAt: new Date(),
        } as any,
      });

      return res.status(201).json(ok(created, 'Function duplicated successfully'));
    } catch (error) {
      logger.error('Duplicate function failed', error);
      const message = error instanceof Error ? error.message : 'Failed to duplicate function';
      return res.status(400).json(fail(message));
    }
  },
);

export default router;
