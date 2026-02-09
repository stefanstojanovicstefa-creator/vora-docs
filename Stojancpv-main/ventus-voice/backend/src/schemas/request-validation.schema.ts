import { z } from 'zod';
import { paginationSchema } from './pagination.schema';
import { validateExternalUrlSync } from '../utils/url-validator';

/**
 * Validation schemas for API requests
 */

/**
 * SECURITY: Sanitize and validate user prompts
 * - Remove dangerous HTML/script tags
 * - Block common injection patterns
 * - Normalize whitespace
 */
const sanitizePromptTransform = (val: string): string => {
  // Trim whitespace
  let sanitized = val.trim();

  // Remove HTML tags (more robust than regex)
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Remove common injection patterns
  sanitized = sanitized
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:text\/html/gi, '')
    .replace(/<script/gi, '')
    .replace(/<iframe/gi, '');

  // Normalize multiple spaces/newlines
  sanitized = sanitized.replace(/\s+/g, ' ');

  // Block if prompt is now empty or too short after sanitization
  if (sanitized.length < 10) {
    throw new Error('Prompt contains invalid content or is too short after sanitization');
  }

  return sanitized;
};

// Agent creation
export const createAgentSchema = z.object({
  body: z.object({
    prompt: z.string()
      .min(10, 'Prompt must be at least 10 characters')
      .max(5000, 'Prompt too long (max 5000 characters)')
      .transform(sanitizePromptTransform)
      .refine(
        (val) => {
          // Additional validation: block prompts that are just special characters
          const alphanumericCount = (val.match(/[a-zA-Z0-9]/g) || []).length;
          return alphanumericCount >= 5;
        },
        { message: 'Prompt must contain meaningful text' }
      ),
    userId: z.string().optional(), // Optional since we get it from Clerk auth
    brandId: z.string().optional(), // Brand analysis ID for KB creation from URL wizard
  }),
});

// Agent update
export const updateAgentSchema = z.object({
  params: z.object({
    agentId: z.string().cuid2(),
  }),
  body: z.object({
    updates: z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      config: z.any().optional(),
      status: z.enum(['DRAFT', 'DEPLOYING', 'ACTIVE', 'PAUSED', 'FAILED', 'DELETED']).optional(),
      maxMessages: z.number().int().positive().optional(),
      sessionTimeout: z.number().int().positive().optional(),
      farewellMessage: z.string().max(500).optional(),
      summaryEnabled: z.boolean().optional(),
    }),
    userId: z.string().optional(),
  }),
});

// Token generation
export const generateTokenSchema = z.object({
  body: z.object({
    agentId: z.string().cuid2('Invalid agent ID'),
    participantName: z.string()
      .min(1)
      .max(100)
      .optional()
      .default('Guest'),
    participantMetadata: z.record(z.any()).optional(),
  }),
});

// Call start
export const startCallSchema = z.object({
  body: z.object({
    agentId: z.string().cuid2('Invalid agent ID'),
    participantName: z.string()
      .min(1, 'Participant name is required')
      .max(100, 'Participant name too long')
      .optional()
      .default('User'),
    // Customer identification for memory system
    voraCustomerId: z.string().max(100).optional(),
    phoneNumber: z.string().max(20).optional(),
    customerId: z.string().max(100).optional(), // Business's own customer ID
    metadata: z.record(z.any()).optional(),
  }),
});

// Call end
export const endCallSchema = z.object({
  params: z.object({
    callId: z.string().cuid2('Invalid call ID'),
  }),
  body: z.object({
    reason: z.string().max(255).optional(),
  }).optional(),
});

// Get call status
export const getCallSchema = z.object({
  params: z.object({
    callId: z.string().cuid2('Invalid call ID'),
  }),
});

// Knowledge base document upload
export const uploadDocumentSchema = z.object({
  params: z.object({
    knowledgeBaseId: z.string().cuid2(),
  }),
  body: z.object({
    filename: z.string().min(1).max(255),
    content: z.string().min(1).max(10_000_000), // 10MB text
    fileType: z.enum(['pdf', 'txt', 'docx', 'md']),
  }),
});

// Custom function creation
export const createFunctionSchema = z.object({
  params: z.object({
    agentId: z.string().cuid2(),
  }),
  body: z.object({
    name: z.string()
      .min(1)
      .max(100)
      .regex(/^[a-z_][a-z0-9_]*$/, 'Function name must be snake_case'),
    description: z.string().min(10).max(1000),
    method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
    url: z.string().url('Invalid URL'),
    headers: z.record(z.string()).optional(),
    parameters: z.record(z.any()),
    authType: z.enum(['NONE', 'API_KEY', 'BEARER_TOKEN', 'BASIC_AUTH', 'OAUTH2']).optional(),
    authConfig: z.record(z.any()).optional(),
  }),
});

// ============================================
// Brand Schemas
// ============================================

/**
 * SECURITY: Validate URL for SSRF protection at schema level
 * This provides fail-fast validation before the request reaches any controller
 */
const ssrfSafeUrl = z.string()
  .url('Invalid URL format')
  .refine((url) => {
    const result = validateExternalUrlSync(url, {
      allowHttp: true, // Allow HTTP for web scraping
      blockLocalhost: true,
    });
    return result.valid;
  }, {
    message: 'URL points to a blocked or internal address',
  });

export const analyzeBrandSchema = z.object({
  body: z.object({
    // Support both legacy `url` and current `websiteUrl` keys.
    // SECURITY: Both fields use SSRF-safe URL validation
    websiteUrl: ssrfSafeUrl.optional(),
    url: ssrfSafeUrl.optional(),
    name: z.string().min(1).max(200).optional(),
    includeCompetitors: z.boolean().optional().default(false),
    customerId: z.string().optional(),
  }).refine((val) => !!(val.websiteUrl || val.url), {
    message: 'websiteUrl is required',
    path: ['websiteUrl'],
  }).transform((val) => ({
    ...val,
    websiteUrl: val.websiteUrl ?? val.url!,
  })),
});

export const getBrandSchema = z.object({
  params: z.object({
    // Brand IDs are generated server-side and are not necessarily CUIDs.
    brandId: z.string().min(1).max(200),
  }),
  query: z.object({
    includeContent: z.string().optional().transform((val) => val === 'true'),
  }).optional(),
});

export const listBrandsSchema = z.object({
  query: paginationSchema.extend({
    status: z.string().optional(),
    search: z.string().optional(),
  }),
});

export const refreshBrandSchema = z.object({
  params: z.object({
    brandId: z.string().min(1).max(200),
  }),
  body: z.object({
    forceRefresh: z.boolean().optional().default(false),
  }).optional(),
});

export const deleteBrandSchema = z.object({
  params: z.object({
    brandId: z.string().min(1).max(200),
  }),
  body: z.object({
    confirm: z.boolean().optional().default(true),
  }).optional(),
});

export const getCostSummarySchema = z.object({
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const getBrandCostsSchema = z.object({
  params: z.object({
    brandId: z.string().min(1).max(200),
  }),
  query: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

// ============================================
// Function Schema Generator Schemas
// ============================================

export const generateFunctionSchemaSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    description: z.string().min(10).max(2000),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
      description: z.string().optional(),
      required: z.boolean().optional().default(true),
    })).optional(),
  }),
});

export const listGeneratedFunctionsSchema = z.object({
  query: z.object({
    page: z.string().optional().default('1').transform(Number),
    limit: z.string().optional().default('10').transform(Number),
    search: z.string().optional(),
  }),
});

export const updateGeneratedFunctionSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().min(10).max(2000).optional(),
    schema: z.any().optional(),
  }),
});

export const deleteGeneratedFunctionSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
  }),
});

export const validateGeneratedSchemaSchema = z.object({
  body: z.object({
    schema: z.any(),
  }),
});

export const testGeneratedFunctionSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
  }),
  body: z.object({
    input: z.any(),
  }),
});

// ============================================
// Function Versioning Schemas
// ============================================

export const createVersionSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
  }),
  body: z.object({
    description: z.string().optional(),
    schema: z.any(),
  }),
});

export const getVersionSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
    versionId: z.string().cuid2(),
  }),
});

export const listVersionsSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
  }),
  query: z.object({
    page: z.string().optional().default('1').transform(Number),
    limit: z.string().optional().default('10').transform(Number),
  }),
});

export const activateVersionSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
    versionId: z.string().cuid2(),
  }),
});

export const rollbackVersionSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
    versionId: z.string().cuid2(),
  }),
});

export const compareVersionsSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
  }),
  query: z.object({
    versionA: z.string().cuid2(),
    versionB: z.string().cuid2(),
  }),
});

export const markVersionStableSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
    versionId: z.string().cuid2(),
  }),
});

export const deleteVersionSchema = z.object({
  params: z.object({
    functionId: z.string().cuid2(),
    versionId: z.string().cuid2(),
  }),
});

// ============================================
// API Keys Schemas
// ============================================

export const createApiKeySchema = z.object({
  body: z.object({
    name: z.string()
      .min(1, 'API key name is required')
      .max(100, 'API key name too long (max 100 characters)')
      .trim(),
    expiresInDays: z.number()
      .int()
      .min(1, 'Expiration must be at least 1 day')
      .max(365, 'Expiration cannot exceed 365 days')
      .optional(),
  }),
});

export const listApiKeysSchema = z.object({
  query: paginationSchema,
});

export const revokeApiKeySchema = z.object({
  params: z.object({
    keyId: z.string().cuid2('Invalid API key ID'),
  }),
});

export const deleteApiKeySchema = z.object({
  params: z.object({
    keyId: z.string().cuid2('Invalid API key ID'),
  }),
});

// ============================================
// Calls/Tokens Schemas
// ============================================

export const listCallsSchema = z.object({
  query: z.object({
    status: z.enum(['CONNECTING', 'CONNECTED', 'ENDED', 'FAILED']).optional(),
    limit: z.string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(z.number().int().min(1).max(100).default(20)),
    offset: z.string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 0))
      .pipe(z.number().int().min(0).default(0)),
  }),
});

export const generateAgentTokenSchema = z.object({
  body: z.object({
    agentId: z.string().cuid2('Invalid agent ID'),
    roomName: z.string()
      .min(1, 'Room name is required')
      .max(200, 'Room name too long')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Room name must contain only alphanumeric characters, underscores, and hyphens'),
  }),
});

// ============================================
// Usage Analytics Schemas
// ============================================

export const usageQuerySchema = z.object({
  organizationId: z.string().cuid2().optional(),
  userId: z.string().optional(),
  agentId: z.string().cuid2().optional(),
  startDate: z.string()
    .optional()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      { message: 'Invalid start date format' }
    ),
  endDate: z.string()
    .optional()
    .refine(
      (val) => !val || !isNaN(Date.parse(val)),
      { message: 'Invalid end date format' }
    ),
  granularity: z.enum(['day', 'week', 'month']).optional().default('day'),
});
