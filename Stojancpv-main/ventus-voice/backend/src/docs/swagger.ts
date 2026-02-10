/**
 * Swagger/OpenAPI Configuration
 * API Documentation Setup
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger('Swagger');

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vora Voice AI Platform API',
      version: '1.0.0',
      description: `
# Vora Voice AI Platform API

The Vora Voice AI Platform provides a comprehensive API for creating, deploying, and managing AI-powered voice agents.

## Key Features

- **Agent Management**: Create and configure AI voice agents with custom personalities and behaviors
- **Knowledge Base**: Upload and manage documents for RAG (Retrieval-Augmented Generation)
- **Custom Functions**: Extend agent capabilities with custom JavaScript functions
- **LiveKit Integration**: Real-time voice communication infrastructure
- **Analytics**: Comprehensive analytics and usage tracking
- **Multi-Provider Support**: Support for multiple LLM, STT, and TTS providers

## Authentication

The API uses two authentication methods:

1. **API Keys**: For server-to-server communication
   - Include in header: \`Authorization: Bearer YOUR_API_KEY\`

2. **Clerk JWT**: For client applications
   - Include in header: \`Authorization: Bearer YOUR_CLERK_JWT\`

## Rate Limiting

- Default: 100 requests per minute per API key
- Burst: Up to 200 requests per minute for short periods
- Exceeded limits return HTTP 429

## Error Responses

All error responses follow this format:

\`\`\`json
{
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
\`\`\`

Common error codes:
- \`UNAUTHORIZED\`: Missing or invalid authentication
- \`FORBIDDEN\`: Insufficient permissions
- \`NOT_FOUND\`: Resource not found
- \`VALIDATION_ERROR\`: Invalid request data
- \`RATE_LIMIT_EXCEEDED\`: Too many requests
      `,
      contact: {
        name: 'Vora Support',
        email: 'support@vora.ai',
        url: 'https://vora.ai/support',
      },
      license: {
        name: 'Proprietary',
        url: 'https://vora.ai/terms',
      },
    },
    servers: [
      {
        url: 'https://api.vora.ai',
        description: 'Production server',
      },
      {
        url: 'https://staging-api.vora.ai',
        description: 'Staging server',
      },
      {
        url: 'http://localhost:3001',
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Agents', description: 'Voice agent management' },
      { name: 'Knowledge Base', description: 'Document and knowledge management' },
      { name: 'Custom Functions', description: 'Custom JavaScript functions' },
      { name: 'Sessions', description: 'Agent session management' },
      { name: 'Analytics', description: 'Usage analytics and reporting' },
      { name: 'Providers', description: 'AI provider configuration' },
      { name: 'Deployment', description: 'Agent deployment and hosting' },
      { name: 'LiveKit', description: 'Real-time communication' },
      { name: 'CRM', description: 'CRM integrations' },
      { name: 'Admin', description: 'Administrative operations' },
      { name: 'Brands', description: 'Brand analysis and management' },
      { name: 'MCP', description: 'MCP catalog and connections' },
      { name: 'Functions', description: 'Custom JavaScript functions for agents' },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'API Key',
          description: 'API key for server-to-server authentication',
        },
        ClerkJWT: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Clerk JWT token for client authentication',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                message: { type: 'string' },
                code: { type: 'string' },
                details: { type: 'object' },
              },
            },
          },
        },
        Agent: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            organizationId: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            status: {
              type: 'string',
              enum: ['DRAFT', 'DEPLOYING', 'DEPLOYED', 'FAILED', 'DELETED'],
            },
            originalPrompt: { type: 'string' },
            config: { type: 'object' },
            deploymentUrl: { type: 'string', format: 'uri', nullable: true },
            deploymentId: { type: 'string', nullable: true },
            flyMachineId: { type: 'string', nullable: true },
            embedCode: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            lastDeployedAt: { type: 'string', format: 'date-time', nullable: true },
          },
        },
        AgentConfig: {
          type: 'object',
          required: ['name', 'system_prompt', 'language'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            system_prompt: { type: 'string' },
            personality: {
              type: 'object',
              properties: {
                tone: { type: 'string' },
                style: { type: 'string' },
                response_length: { type: 'string' },
                formality_level: { type: 'integer', minimum: 1, maximum: 5 },
              },
            },
            language: { type: 'string' },
            voice: {
              type: 'object',
              properties: {
                gender: { type: 'string', enum: ['male', 'female', 'neutral'] },
                age_range: { type: 'string', enum: ['child', 'young_adult', 'adult', 'elderly'] },
                accent: { type: 'string' },
              },
            },
            behavior_rules: { type: 'array', items: { type: 'string' } },
            livekit_config: {
              type: 'object',
              properties: {
                vad_mode: { type: 'string', enum: ['aggressive', 'moderate', 'passive'] },
                allow_interruptions: { type: 'boolean' },
                max_session_duration: { type: 'integer' },
              },
            },
            stt_provider: { type: 'string' },
            tts_provider: { type: 'string' },
            llm_config: {
              type: 'object',
              properties: {
                model: { type: 'string' },
                temperature: { type: 'number', minimum: 0, maximum: 2 },
                max_tokens: { type: 'integer' },
              },
            },
          },
        },
        KnowledgeBase: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            userId: { type: 'string' },
            organizationId: { type: 'string' },
            agentId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Document: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            content: { type: 'string' },
            knowledgeBaseId: { type: 'string' },
            userId: { type: 'string' },
            organizationId: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CustomFunction: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            description: { type: 'string' },
            code: { type: 'string' },
            userId: { type: 'string' },
            organizationId: { type: 'string' },
            agentId: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AgentSession: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            agentId: { type: 'string' },
            roomName: { type: 'string' },
            status: { type: 'string', enum: ['ACTIVE', 'ENDED', 'FAILED'] },
            startedAt: { type: 'string', format: 'date-time' },
            endedAt: { type: 'string', format: 'date-time', nullable: true },
            duration: { type: 'integer', nullable: true },
            participantCount: { type: 'integer' },
          },
        },
        BrandAnalysisResult: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            userId: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            name: { type: 'string' },
            status: { type: 'string', enum: ['PENDING', 'ANALYZING', 'COMPLETE', 'FAILED'] },
            audienceAnalysis: {
              type: 'object',
              nullable: true,
              properties: {
                demographics: { type: 'object' },
                interests: { type: 'array', items: { type: 'string' } },
                painPoints: { type: 'array', items: { type: 'string' } },
              },
            },
            competitorAnalysis: {
              type: 'object',
              nullable: true,
              properties: {
                competitors: { type: 'array', items: { type: 'string' } },
                differentiators: { type: 'array', items: { type: 'string' } },
              },
            },
            vocabulary: {
              type: 'object',
              nullable: true,
              properties: {
                terms: { type: 'array', items: { type: 'string' } },
                avoidTerms: { type: 'array', items: { type: 'string' } },
              },
            },
            useCaseScenarios: {
              type: 'array',
              nullable: true,
              items: {
                type: 'object',
                properties: {
                  scenario: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        MCPCatalogItem: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            serverUrl: { type: 'string', format: 'uri', nullable: true },
            icon: { type: 'string', nullable: true },
            regions: { type: 'array', items: { type: 'string' } },
            requiredPlan: { type: 'string' },
            priority: { type: 'string' },
            status: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        MCPConnection: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            orgId: { type: 'string' },
            userId: { type: 'string' },
            mcpCatalogId: { type: 'string' },
            serverUrl: { type: 'string', format: 'uri' },
            authType: { type: 'string', enum: ['none', 'api_key', 'oauth2'] },
            credentials: { type: 'object', nullable: true, description: 'Masked credentials' },
            status: { type: 'string' },
            healthStatus: { type: 'string', nullable: true },
            lastHealthCheck: { type: 'string', format: 'date-time', nullable: true },
            discoveredTools: { type: 'array', nullable: true, items: { type: 'object' } },
            catalog: { $ref: '#/components/schemas/MCPCatalogItem' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  message: 'Authentication required',
                  code: 'UNAUTHORIZED',
                },
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  message: 'Access denied',
                  code: 'FORBIDDEN',
                },
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  message: 'Resource not found',
                  code: 'NOT_FOUND',
                },
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' },
              example: {
                error: {
                  message: 'Validation failed',
                  code: 'VALIDATION_ERROR',
                  details: {
                    field: ['Error message'],
                  },
                },
              },
            },
          },
        },
      },
    },
    security: [
      { ApiKeyAuth: [] },
      { ClerkJWT: [] },
    ],
  },
  apis: [
    './src/routes/*.ts',
    './src/routes/**/*.ts',
    './src/api/*.ts',
  ],
};

const swaggerSpec = swaggerJsdoc(options);

/**
 * Setup Swagger UI
 */
export function setupSwagger(app: Express): void {
  // Swagger UI
  // @ts-ignore - Express middleware typing issue with swagger-ui-express
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Vora API Documentation',
  }));

  // OpenAPI JSON spec
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  logger.info('📚 Swagger documentation available at /api-docs');
  logger.info('📄 OpenAPI spec available at /api-docs.json');
}

export { swaggerSpec };
