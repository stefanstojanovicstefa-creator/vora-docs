/**
 * MCP Connections API Routes
 * CRUD, health testing, and tool refresh for org MCP connections
 */

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { createLogger } from '../utils/logger';
import { validateMCPDomain } from '../security/mcp-allowlist';
import { mcpGatewayService } from '../services/mcp-gateway.service';
import { mcpToolDiscoveryService } from '../services/mcp-tool-discovery.service';

const logger = createLogger('MCPConnections.routes');
const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const createConnectionSchema = z.object({
  mcpCatalogId: z.string(),
  serverUrl: z.string().url().optional(),
  authType: z.enum(['none', 'api_key', 'oauth2']).default('none'),
  credentials: z.record(z.unknown()).optional(),
});

const updateConnectionSchema = z.object({
  serverUrl: z.string().url().optional(),
  credentials: z.record(z.unknown()).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.string().optional(),
});

// ============================================================================
// Helpers
// ============================================================================

function getOrgId(req: any): string | null {
  return req.auth?.orgId || req.auth?.organizationId || null;
}

function getUserId(req: any): string | null {
  return req.auth?.userId || req.auth?.sub || null;
}

function maskCredentials(creds: any): any {
  if (!creds || typeof creds !== 'object') return creds;
  const masked: any = {};
  for (const [key, value] of Object.entries(creds)) {
    if (
      typeof value === 'string' &&
      (key.toLowerCase().includes('key') ||
        key.toLowerCase().includes('token') ||
        key.toLowerCase().includes('secret'))
    ) {
      masked[key] = value.length > 4 ? value.slice(0, 4) + '****' : '****';
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * @openapi
 * /api/mcp-connections:
 *   get:
 *     summary: List organization MCP connections
 *     description: Returns all MCP connections for the authenticated user's organization. Credentials are masked in the response.
 *     tags: [MCP]
 *     security:
 *       - ClerkJWT: []
 *     responses:
 *       200:
 *         description: List of MCP connections
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/MCPConnection'
 *       400:
 *         description: Organization ID required
 *       500:
 *         description: Internal server error
 */
router.get('/', async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const connections = await prisma.mcpConnection.findMany({
      where: { orgId },
      include: { catalog: true },
      orderBy: { createdAt: 'desc' },
    });

    const safe = connections.map(c => ({
      ...c,
      credentials: c.credentials ? maskCredentials(c.credentials) : null,
    }));

    res.json(safe);
  } catch (error) {
    logger.error('Failed to list MCP connections', { error });
    res.status(500).json({ error: 'Failed to list MCP connections' });
  }
});

/**
 * @openapi
 * /api/mcp-connections:
 *   post:
 *     summary: Create a new MCP connection
 *     description: Establishes a new MCP connection for the organization. The server URL is validated against the domain allowlist to prevent SSRF.
 *     tags: [MCP]
 *     security:
 *       - ClerkJWT: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mcpCatalogId]
 *             properties:
 *               mcpCatalogId:
 *                 type: string
 *                 description: ID of the MCP catalog entry to connect
 *               serverUrl:
 *                 type: string
 *                 format: uri
 *                 description: Custom server URL (defaults to catalog URL)
 *               authType:
 *                 type: string
 *                 enum: [none, api_key, oauth2]
 *                 default: none
 *                 description: Authentication method
 *               credentials:
 *                 type: object
 *                 description: Authentication credentials (stored encrypted)
 *     responses:
 *       201:
 *         description: MCP connection created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MCPConnection'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: MCP catalog entry not found
 *       409:
 *         description: Connection already exists for this MCP
 *       500:
 *         description: Internal server error
 */
router.post('/', async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const userId = getUserId(req);
    if (!orgId || !userId) {
      return res.status(400).json({ error: 'Organization ID and User ID required' });
    }

    const body = createConnectionSchema.parse(req.body);

    if (body.serverUrl) {
      const validation = validateMCPDomain(body.serverUrl);
      if (!validation.valid) {
        return res.status(400).json({ error: `URL validation failed: ${validation.reason}` });
      }
    }

    const catalog = await prisma.mcpCatalog.findUnique({ where: { id: body.mcpCatalogId } });
    if (!catalog) {
      return res.status(404).json({ error: 'MCP catalog entry not found' });
    }

    const connection = await prisma.mcpConnection.create({
      data: {
        orgId,
        userId,
        mcpCatalogId: body.mcpCatalogId,
        serverUrl: body.serverUrl || catalog.serverUrl,
        authType: body.authType,
        credentials: (body.credentials ?? undefined) as any,
        status: 'pending',
      },
      include: { catalog: true },
    });

    res.status(201).json({
      ...connection,
      credentials: connection.credentials ? maskCredentials(connection.credentials) : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body', details: error.errors });
    }
    if ((error as any)?.code === 'P2002') {
      return res
        .status(409)
        .json({ error: 'Connection already exists for this MCP in your organization' });
    }
    logger.error('Failed to create MCP connection', { error });
    res.status(500).json({ error: 'Failed to create MCP connection' });
  }
});

/**
 * @openapi
 * /api/mcp-connections/{id}:
 *   patch:
 *     summary: Update an MCP connection
 *     description: Updates server URL, credentials, config, or status for an existing MCP connection.
 *     tags: [MCP]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: MCP connection ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               serverUrl:
 *                 type: string
 *                 format: uri
 *               credentials:
 *                 type: object
 *               config:
 *                 type: object
 *               status:
 *                 type: string
 *     responses:
 *       200:
 *         description: Connection updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MCPConnection'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.patch('/:id', async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const body = updateConnectionSchema.parse(req.body);

    const existing = await prisma.mcpConnection.findFirst({
      where: { id: req.params.id, orgId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (body.serverUrl) {
      const validation = validateMCPDomain(body.serverUrl);
      if (!validation.valid) {
        return res.status(400).json({ error: `URL validation failed: ${validation.reason}` });
      }
    }

    const updated = await prisma.mcpConnection.update({
      where: { id: req.params.id },
      data: body as any,
      include: { catalog: true },
    });

    res.json({
      ...updated,
      credentials: updated.credentials ? maskCredentials(updated.credentials) : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request body', details: error.errors });
    }
    logger.error('Failed to update MCP connection', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to update MCP connection' });
  }
});

/**
 * @openapi
 * /api/mcp-connections/{id}:
 *   delete:
 *     summary: Delete an MCP connection
 *     description: Permanently removes an MCP connection from the organization.
 *     tags: [MCP]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: MCP connection ID
 *     responses:
 *       200:
 *         description: Connection deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const existing = await prisma.mcpConnection.findFirst({
      where: { id: req.params.id, orgId },
    });
    if (!existing) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    await prisma.mcpConnection.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete MCP connection', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to delete MCP connection' });
  }
});

/**
 * @openapi
 * /api/mcp-connections/{id}/test:
 *   post:
 *     summary: Test MCP connection health
 *     description: Connects to the MCP server, discovers tools, and updates health status. Returns latency and tool count.
 *     tags: [MCP]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: MCP connection ID
 *     responses:
 *       200:
 *         description: Connection health test results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [healthy, down]
 *                 latencyMs:
 *                   type: integer
 *                 toolCount:
 *                   type: integer
 *       400:
 *         description: No server URL configured
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.post('/:id/test', async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const connection = await prisma.mcpConnection.findFirst({
      where: { id: req.params.id, orgId },
    });
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (!connection.serverUrl) {
      return res.status(400).json({ error: 'No server URL configured for this connection' });
    }

    const start = Date.now();
    let testStatus = 'healthy';
    let toolCount = 0;

    try {
      const credHeaders: Record<string, string> = {};
      if (connection.credentials && typeof connection.credentials === 'object') {
        const creds = connection.credentials as Record<string, unknown>;
        if (creds.apiKey && typeof creds.apiKey === 'string') {
          credHeaders['x-api-key'] = creds.apiKey;
        }
        if (creds.token && typeof creds.token === 'string') {
          credHeaders['Authorization'] = `Bearer ${creds.token}`;
        }
      }

      await mcpGatewayService.connect(connection.serverUrl, credHeaders);
      const discovery = await mcpGatewayService.discoverTools(connection.serverUrl);
      toolCount = discovery.tools.length;
      await mcpGatewayService.disconnect(connection.serverUrl);
    } catch {
      testStatus = 'down';
      try {
        await mcpGatewayService.disconnect(connection.serverUrl!);
      } catch {
        // ignore cleanup errors
      }
    }

    await prisma.mcpConnection.update({
      where: { id: req.params.id },
      data: {
        lastHealthCheck: new Date(),
        healthStatus: testStatus,
        status: testStatus === 'healthy' ? 'active' : 'error',
      },
    });

    res.json({
      status: testStatus,
      latencyMs: Date.now() - start,
      toolCount,
    });
  } catch (error) {
    logger.error('Failed to test MCP connection', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to test connection' });
  }
});

/**
 * @openapi
 * /api/mcp-connections/{id}/refresh:
 *   post:
 *     summary: Force tool re-discovery
 *     description: Forces a refresh of the discovered tools for an MCP connection. Falls back to cached tools if live refresh fails.
 *     tags: [MCP]
 *     security:
 *       - ClerkJWT: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: MCP connection ID
 *     responses:
 *       200:
 *         description: Refreshed tool list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tools:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       500:
 *         description: Internal server error
 */
router.post('/:id/refresh', async (req, res) => {
  try {
    const orgId = getOrgId(req);
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID required' });
    }

    const connection = await prisma.mcpConnection.findFirst({
      where: { id: req.params.id, orgId },
    });
    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    try {
      const tools = await mcpToolDiscoveryService.forceRefresh(connection.id);
      res.json({ tools });
    } catch (refreshError) {
      logger.warn('Live refresh failed, returning cached tools', {
        connectionId: connection.id,
        error: refreshError instanceof Error ? refreshError.message : String(refreshError),
      });
      const cached = Array.isArray(connection.discoveredTools) ? connection.discoveredTools : [];
      res.json({ tools: cached });
    }
  } catch (error) {
    logger.error('Failed to refresh MCP tools', { error, id: req.params.id });
    res.status(500).json({ error: 'Failed to refresh tools' });
  }
});

export default router;
