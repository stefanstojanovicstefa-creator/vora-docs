/**
 * Flow API Routes
 * Phase 3: Flow Studio - Visual conversation flow builder endpoints
 * Provides CRUD operations for agent conversation flows with validation and import/export
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth.middleware';
import { createLogger } from '../utils/logger';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

const logger = createLogger('Flow.routes');
const router = Router();

// ============================================================================
// Zod Schemas
// ============================================================================

const NodeSchema = z.object({
  id: z.string(),
  type: z.enum(['start', 'message', 'question', 'condition', 'action', 'end']),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.record(z.unknown()),
});

const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  type: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});

const SaveFlowSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).optional().nullable(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  variables: z.record(z.unknown()).optional().nullable(),
  globalPrompt: z.string().max(5000).optional().nullable(),
});

const ImportFlowSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional().nullable(),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
  variables: z.record(z.unknown()).optional().nullable(),
  globalPrompt: z.string().max(5000).optional().nullable(),
});

// Enhanced validation schema for the new validation endpoint
const ValidateFlowSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      data: z.record(z.unknown()),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
    })
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      data: z.record(z.unknown()).optional(),
    })
  ),
  variables: z.record(z.unknown()).optional(),
  globalPrompt: z.string().optional(),
});

type ValidationError = {
  nodeId?: string;
  edgeId?: string;
  type: 'error' | 'warning';
  message: string;
};

interface ValidationIssue {
  nodeId?: string;
  edgeId?: string;
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'suggestion';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Verify that the agent exists and belongs to the authenticated user
 */
async function verifyAgentOwnership(
  agentId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const agent = await prisma.agents.findUnique({
    where: { id: agentId },
    select: { userId: true, deletedAt: true },
  });

  if (!agent) {
    return { success: false, error: 'Agent not found' };
  }

  if (agent.deletedAt) {
    return { success: false, error: 'Agent has been deleted' };
  }

  if (agent.userId !== userId) {
    return { success: false, error: 'Unauthorized access to agent' };
  }

  return { success: true };
}

/**
 * Validate a flow structure
 */
function validateFlow(
  nodes: z.infer<typeof NodeSchema>[],
  edges: z.infer<typeof EdgeSchema>[]
): { valid: boolean; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(nodes.map(n => n.id));

  // Rule 1: Must have exactly one start node
  const startNodes = nodes.filter(n => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push({
      type: 'error',
      message: 'Flow must have exactly one start node',
    });
  } else if (startNodes.length > 1) {
    errors.push({
      type: 'error',
      message: `Flow has ${startNodes.length} start nodes, must have exactly one`,
    });
  }

  // Rule 2: All edges must connect to existing nodes
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push({
        edgeId: edge.id,
        type: 'error',
        message: `Edge ${edge.id} source node "${edge.source}" does not exist`,
      });
    }
    if (!nodeIds.has(edge.target)) {
      errors.push({
        edgeId: edge.id,
        type: 'error',
        message: `Edge ${edge.id} target node "${edge.target}" does not exist`,
      });
    }
  }

  // Rule 3: No orphan nodes (except start node can have no incoming edges)
  const nodesWithIncomingEdges = new Set(edges.map(e => e.target));
  const nodesWithOutgoingEdges = new Set(edges.map(e => e.source));

  for (const node of nodes) {
    // Start node doesn't need incoming edges
    if (node.type === 'start') {
      if (!nodesWithOutgoingEdges.has(node.id)) {
        errors.push({
          nodeId: node.id,
          type: 'warning',
          message: `Start node has no outgoing connections`,
        });
      }
      continue;
    }

    // End nodes don't need outgoing edges
    if (node.type === 'end') {
      if (!nodesWithIncomingEdges.has(node.id)) {
        errors.push({
          nodeId: node.id,
          type: 'warning',
          message: `End node "${node.id}" has no incoming connections`,
        });
      }
      continue;
    }

    // All other nodes need both incoming and outgoing edges
    if (!nodesWithIncomingEdges.has(node.id)) {
      errors.push({
        nodeId: node.id,
        type: 'warning',
        message: `Node "${node.id}" has no incoming connections (orphan node)`,
      });
    }
    if (!nodesWithOutgoingEdges.has(node.id)) {
      errors.push({
        nodeId: node.id,
        type: 'warning',
        message: `Node "${node.id}" has no outgoing connections (dead end)`,
      });
    }
  }

  // Rule 4: Required node data validation
  for (const node of nodes) {
    switch (node.type) {
      case 'message':
        if (!node.data.content || typeof node.data.content !== 'string') {
          errors.push({
            nodeId: node.id,
            type: 'error',
            message: `Message node "${node.id}" missing required "content" field`,
          });
        }
        break;
      case 'question':
        if (!node.data.question || typeof node.data.question !== 'string') {
          errors.push({
            nodeId: node.id,
            type: 'error',
            message: `Question node "${node.id}" missing required "question" field`,
          });
        }
        break;
      case 'condition':
        if (!node.data.condition || typeof node.data.condition !== 'string') {
          errors.push({
            nodeId: node.id,
            type: 'error',
            message: `Condition node "${node.id}" missing required "condition" field`,
          });
        }
        break;
      case 'action':
        if (!node.data.actionType || typeof node.data.actionType !== 'string') {
          errors.push({
            nodeId: node.id,
            type: 'error',
            message: `Action node "${node.id}" missing required "actionType" field`,
          });
        }
        break;
    }
  }

  const valid = errors.filter(e => e.type === 'error').length === 0;
  return { valid, errors };
}

// ============================================================================
// GET /:agentId/flow
// Get the active flow for an agent
// ============================================================================

router.get('/:agentId/flow', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = req.params;

    // Verify agent ownership
    const ownership = await verifyAgentOwnership(agentId, userId);
    if (!ownership.success) {
      return res.status(ownership.error === 'Agent not found' ? 404 : 403).json({
        error: ownership.error,
      });
    }

    // Get active flow
    const flow = await prisma.flow.findFirst({
      where: {
        agentId,
        isActive: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    if (!flow) {
      return res.json({ flow: null });
    }

    return res.json({
      flow: {
        id: flow.id,
        name: flow.name,
        description: flow.description,
        nodes: flow.nodes,
        edges: flow.edges,
        variables: flow.variables,
        globalPrompt: flow.globalPrompt,
        version: flow.version,
        isActive: flow.isActive,
        createdAt: flow.createdAt,
        updatedAt: flow.updatedAt,
      },
    });
  } catch (err) {
    logger.error('GET /:agentId/flow failed', { error: err, agentId: req.params.agentId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// PUT /:agentId/flow
// Save/update the flow (creates if not exists, updates if exists)
// ============================================================================

router.put('/:agentId/flow', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = req.params;

    // Verify agent ownership
    const ownership = await verifyAgentOwnership(agentId, userId);
    if (!ownership.success) {
      return res.status(ownership.error === 'Agent not found' ? 404 : 403).json({
        error: ownership.error,
      });
    }

    // Validate request body
    const parseResult = SaveFlowSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid flow data',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const flowData = parseResult.data;

    // Find existing active flow
    const existingFlow = await prisma.flow.findFirst({
      where: {
        agentId,
        isActive: true,
      },
    });

    let savedFlow;

    if (existingFlow) {
      // Update existing flow and increment version
      savedFlow = await prisma.flow.update({
        where: { id: existingFlow.id },
        data: {
          name: flowData.name ?? existingFlow.name,
          description:
            flowData.description !== undefined ? flowData.description : existingFlow.description,
          nodes: flowData.nodes as Prisma.InputJsonValue,
          edges: flowData.edges as Prisma.InputJsonValue,
          variables:
            flowData.variables !== undefined
              ? (flowData.variables as Prisma.InputJsonValue)
              : existingFlow.variables,
          globalPrompt:
            flowData.globalPrompt !== undefined ? flowData.globalPrompt : existingFlow.globalPrompt,
          version: existingFlow.version + 1,
          updatedAt: new Date(),
        },
      });
    } else {
      // Create new flow
      savedFlow = await prisma.flow.create({
        data: {
          agentId,
          name: flowData.name ?? 'Main Flow',
          description: flowData.description,
          nodes: flowData.nodes as Prisma.InputJsonValue,
          edges: flowData.edges as Prisma.InputJsonValue,
          variables: flowData.variables as Prisma.InputJsonValue | undefined,
          globalPrompt: flowData.globalPrompt,
          version: 1,
          isActive: true,
        },
      });
    }

    logger.info('Flow saved', {
      flowId: savedFlow.id,
      agentId,
      userId,
      version: savedFlow.version,
    });

    return res.json({
      flow: {
        id: savedFlow.id,
        name: savedFlow.name,
        description: savedFlow.description,
        nodes: savedFlow.nodes,
        edges: savedFlow.edges,
        variables: savedFlow.variables,
        globalPrompt: savedFlow.globalPrompt,
        version: savedFlow.version,
        isActive: savedFlow.isActive,
        createdAt: savedFlow.createdAt,
        updatedAt: savedFlow.updatedAt,
      },
    });
  } catch (err) {
    logger.error('PUT /:agentId/flow failed', { error: err, agentId: req.params.agentId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /:agentId/flow/validate
// Enhanced validation endpoint with errors, warnings, and suggestions
// ============================================================================

router.post('/:agentId/flow/validate', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = req.params;

    // Verify agent ownership
    const ownership = await verifyAgentOwnership(agentId, userId);
    if (!ownership.success) {
      return res.status(ownership.error === 'Agent not found' ? 404 : 403).json({
        error: ownership.error,
      });
    }

    // Validate request body
    const parseResult = ValidateFlowSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid validation request',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const { nodes, edges, variables, globalPrompt } = parseResult.data;

    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const suggestions: ValidationIssue[] = [];

    const nodeIds = new Set(nodes.map(n => n.id));
    const nodeIdArray = Array.from(nodeIds);

    // ========== ERROR CHECKS (Block Publishing) ==========

    // 1. Check for Start node
    const startNodes = nodes.filter(n => n.type === 'start');
    if (startNodes.length === 0) {
      errors.push({
        code: 'NO_START',
        message: 'Flow must have a Start node',
        severity: 'error',
      });
    } else if (startNodes.length > 1) {
      startNodes.forEach(node => {
        errors.push({
          nodeId: node.id,
          code: 'DUPLICATE_START',
          message: `Multiple Start nodes found - only one Start node is allowed`,
          severity: 'error',
        });
      });
    }

    // 2. Check for duplicate node IDs
    const seenIds = new Set<string>();
    nodes.forEach(node => {
      if (seenIds.has(node.id)) {
        errors.push({
          nodeId: node.id,
          code: 'DUPLICATE_ID',
          message: `Duplicate node ID "${node.id}" found`,
          severity: 'error',
        });
      }
      seenIds.add(node.id);
    });

    // 3. Check edges to non-existent nodes (target)
    edges.forEach(edge => {
      if (!nodeIds.has(edge.target)) {
        errors.push({
          edgeId: edge.id,
          code: 'INVALID_EDGE_TARGET',
          message: `Edge "${edge.id}" points to non-existent target node "${edge.target}"`,
          severity: 'error',
        });
      }
    });

    // 4. Check edges from non-existent nodes (source)
    edges.forEach(edge => {
      if (!nodeIds.has(edge.source)) {
        errors.push({
          edgeId: edge.id,
          code: 'INVALID_EDGE_SOURCE',
          message: `Edge "${edge.id}" originates from non-existent source node "${edge.source}"`,
          severity: 'error',
        });
      }
    });

    // 5. Check for unreachable nodes (no path from start)
    if (startNodes.length === 1) {
      const reachable = new Set<string>();
      const queue = [startNodes[0].id];
      const adjacencyList = new Map<string, string[]>();

      // Build adjacency list
      edges.forEach(edge => {
        if (!adjacencyList.has(edge.source)) {
          adjacencyList.set(edge.source, []);
        }
        adjacencyList.get(edge.source)!.push(edge.target);
      });

      // BFS from start node
      while (queue.length > 0) {
        const current = queue.shift()!;
        if (reachable.has(current)) continue;
        reachable.add(current);

        const neighbors = adjacencyList.get(current) || [];
        neighbors.forEach(neighbor => {
          if (!reachable.has(neighbor)) {
            queue.push(neighbor);
          }
        });
      }

      // Find unreachable nodes
      nodes.forEach(node => {
        if (!reachable.has(node.id)) {
          errors.push({
            nodeId: node.id,
            code: 'UNREACHABLE',
            message: `Node "${node.id}" is unreachable - no path from Start node`,
            severity: 'error',
          });
        }
      });
    }

    // ========== NODE-TYPE VALIDATION (US-019, US-020, US-021) ==========

    // Build edge lookup maps for orphan/dead-end detection
    const nodesWithIncomingEdges = new Set(edges.map(e => e.target));
    const nodesWithOutgoingEdges = new Set(edges.map(e => e.source));

    nodes.forEach(node => {
      const d = node.data;

      switch (node.type) {
        // ── US-019: Conversation Nodes ─────────────────────────────────

        case 'message': {
          // message field required non-empty (check both "message" and legacy "content" field)
          const msg = (d.message ?? d.content) as string | undefined;
          if (!msg || typeof msg !== 'string' || msg.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'MESSAGE_REQUIRED',
              message: `Message node "${node.id}" requires a non-empty message`,
              severity: 'error',
            });
          }
          break;
        }

        case 'question': {
          // question field required
          const q = (d.question ?? d.questionText) as string | undefined;
          if (!q || typeof q !== 'string' || q.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'QUESTION_REQUIRED',
              message: `Question node "${node.id}" requires a non-empty question`,
              severity: 'error',
            });
          }
          // expectedAnswers array non-empty (if provided, must have entries)
          const answers = d.expectedAnswers as unknown[] | undefined;
          if (answers !== undefined && (!Array.isArray(answers) || answers.length === 0)) {
            errors.push({
              nodeId: node.id,
              code: 'EXPECTED_ANSWERS_EMPTY',
              message: `Question node "${node.id}" has an empty expectedAnswers array`,
              severity: 'error',
            });
          }
          break;
        }

        case 'capture': {
          // variableName required
          const varName = d.variableName as string | undefined;
          if (!varName || typeof varName !== 'string' || varName.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'CAPTURE_VARIABLE_REQUIRED',
              message: `Capture node "${node.id}" requires a variableName`,
              severity: 'error',
            });
          }
          break;
        }

        case 'menu': {
          // options array required with dtmfKey per option
          const options = d.options as Array<{ dtmfKey?: string }> | undefined;
          if (!options || !Array.isArray(options) || options.length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'MENU_OPTIONS_REQUIRED',
              message: `Menu node "${node.id}" requires at least one option`,
              severity: 'error',
            });
          } else {
            options.forEach((opt, idx) => {
              if (
                !opt.dtmfKey ||
                typeof opt.dtmfKey !== 'string' ||
                opt.dtmfKey.trim().length === 0
              ) {
                errors.push({
                  nodeId: node.id,
                  code: 'MENU_OPTION_DTMF_REQUIRED',
                  message: `Menu node "${node.id}" option ${idx + 1} requires a dtmfKey`,
                  severity: 'error',
                });
              }
            });
          }
          break;
        }

        case 'choice': {
          // options (or intents) array required min 2
          const opts = (d.options ?? d.intents) as unknown[] | undefined;
          if (!opts || !Array.isArray(opts) || opts.length < 2) {
            errors.push({
              nodeId: node.id,
              code: 'CHOICE_MIN_OPTIONS',
              message: `Choice node "${node.id}" requires at least 2 options`,
              severity: 'error',
            });
          }
          break;
        }

        case 'confirm': {
          // message required (check confirmPrompt as well for schema compat)
          const confirmMsg = (d.message ?? d.confirmPrompt) as string | undefined;
          if (!confirmMsg || typeof confirmMsg !== 'string' || confirmMsg.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'CONFIRM_MESSAGE_REQUIRED',
              message: `Confirm node "${node.id}" requires a message`,
              severity: 'error',
            });
          }
          // confirmWord / denyWord required (check positivePhrases/negativePhrases as aliases)
          const confirmWord = (d.confirmWord ?? d.positivePhrases) as string | undefined;
          if (!confirmWord || typeof confirmWord !== 'string' || confirmWord.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'CONFIRM_WORD_REQUIRED',
              message: `Confirm node "${node.id}" requires a confirmWord (or positivePhrases)`,
              severity: 'error',
            });
          }
          const denyWord = (d.denyWord ?? d.negativePhrases) as string | undefined;
          if (!denyWord || typeof denyWord !== 'string' || denyWord.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'DENY_WORD_REQUIRED',
              message: `Confirm node "${node.id}" requires a denyWord (or negativePhrases)`,
              severity: 'error',
            });
          }
          break;
        }

        case 'wait': {
          // duration required positive number (check "duration" and "timeout" alias)
          const dur = (d.duration ?? d.timeout) as number | undefined;
          if (dur === undefined || dur === null || typeof dur !== 'number' || dur <= 0) {
            errors.push({
              nodeId: node.id,
              code: 'WAIT_DURATION_REQUIRED',
              message: `Wait node "${node.id}" requires a positive duration`,
              severity: 'error',
            });
          }
          break;
        }

        // ── US-020: Logic/Data Nodes ───────────────────────────────────

        case 'router': {
          // routes array required, each route needs conditions
          const routes = (d.routes ?? d.conditions) as
            | Array<{ conditions?: unknown[] }>
            | undefined;
          if (!routes || !Array.isArray(routes) || routes.length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'ROUTER_ROUTES_REQUIRED',
              message: `Router node "${node.id}" requires at least one route`,
              severity: 'error',
            });
          } else {
            routes.forEach((route, idx) => {
              const conds = route.conditions;
              if (!conds || !Array.isArray(conds) || conds.length === 0) {
                errors.push({
                  nodeId: node.id,
                  code: 'ROUTER_ROUTE_CONDITIONS_REQUIRED',
                  message: `Router node "${node.id}" route ${idx + 1} needs at least one condition`,
                  severity: 'error',
                });
              }
            });
          }
          break;
        }

        case 'setVariable': {
          // variableName and expression required (also check assignments array pattern)
          const assignments = d.assignments as
            | Array<{ variable?: string; value?: string }>
            | undefined;
          if (assignments && Array.isArray(assignments)) {
            // Schema uses assignments array
            if (assignments.length === 0) {
              errors.push({
                nodeId: node.id,
                code: 'SET_VARIABLE_EMPTY',
                message: `SetVariable node "${node.id}" requires at least one variable assignment`,
                severity: 'error',
              });
            }
            assignments.forEach((a, idx) => {
              if (!a.variable || typeof a.variable !== 'string' || a.variable.trim().length === 0) {
                errors.push({
                  nodeId: node.id,
                  code: 'SET_VARIABLE_NAME_REQUIRED',
                  message: `SetVariable node "${node.id}" assignment ${idx + 1} requires a variableName`,
                  severity: 'error',
                });
              }
            });
          } else {
            // Flat field pattern: variableName + expression
            const varName = d.variableName as string | undefined;
            const expr = d.expression as string | undefined;
            if (!varName || typeof varName !== 'string' || varName.trim().length === 0) {
              errors.push({
                nodeId: node.id,
                code: 'SET_VARIABLE_NAME_REQUIRED',
                message: `SetVariable node "${node.id}" requires a variableName`,
                severity: 'error',
              });
            }
            if (!expr || typeof expr !== 'string' || expr.trim().length === 0) {
              errors.push({
                nodeId: node.id,
                code: 'SET_VARIABLE_EXPRESSION_REQUIRED',
                message: `SetVariable node "${node.id}" requires an expression`,
                severity: 'error',
              });
            }
          }
          break;
        }

        case 'goTo': {
          // targetNodeId required AND must exist as a node in the flow
          const target = d.targetNodeId as string | undefined;
          if (!target || typeof target !== 'string' || target.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'GOTO_TARGET_REQUIRED',
              message: `GoTo node "${node.id}" requires a targetNodeId`,
              severity: 'error',
            });
          } else if (!nodeIds.has(target)) {
            errors.push({
              nodeId: node.id,
              code: 'GOTO_TARGET_NOT_FOUND',
              message: `GoTo node "${node.id}" references non-existent target node "${target}"`,
              severity: 'error',
            });
          }
          break;
        }

        case 'loop': {
          // maxIterations required positive number
          const maxIter = d.maxIterations as number | undefined;
          if (
            maxIter === undefined ||
            maxIter === null ||
            typeof maxIter !== 'number' ||
            maxIter <= 0
          ) {
            errors.push({
              nodeId: node.id,
              code: 'LOOP_MAX_ITERATIONS_REQUIRED',
              message: `Loop node "${node.id}" requires a positive maxIterations value`,
              severity: 'error',
            });
          }
          break;
        }

        case 'function': {
          // functionBody required non-empty string (check "functionBody" and "code" alias)
          const body = (d.functionBody ?? d.code) as string | undefined;
          if (!body || typeof body !== 'string' || body.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'FUNCTION_BODY_REQUIRED',
              message: `Function node "${node.id}" requires a non-empty functionBody`,
              severity: 'error',
            });
          }
          break;
        }

        // ── US-021: Integration/Telephony Nodes ────────────────────────

        case 'tool': {
          // toolName required
          const toolName = d.toolName as string | undefined;
          if (!toolName || typeof toolName !== 'string' || toolName.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'TOOL_NAME_REQUIRED',
              message: `Tool node "${node.id}" requires a toolName`,
              severity: 'error',
            });
          }
          break;
        }

        case 'apiCall': {
          // endpoint required, method required
          const endpoint = (d.endpoint ?? d.url) as string | undefined;
          if (!endpoint || typeof endpoint !== 'string' || endpoint.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'API_ENDPOINT_REQUIRED',
              message: `API Call node "${node.id}" requires an endpoint`,
              severity: 'error',
            });
          }
          const method = d.method as string | undefined;
          if (!method || typeof method !== 'string' || method.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'API_METHOD_REQUIRED',
              message: `API Call node "${node.id}" requires a method`,
              severity: 'error',
            });
          }
          break;
        }

        case 'mcpTool': {
          // serverName and toolName required
          const serverName = d.serverName as string | undefined;
          if (!serverName || typeof serverName !== 'string' || serverName.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'MCP_SERVER_NAME_REQUIRED',
              message: `MCP Tool node "${node.id}" requires a serverName`,
              severity: 'error',
            });
          }
          const mcpToolName = d.toolName as string | undefined;
          if (!mcpToolName || typeof mcpToolName !== 'string' || mcpToolName.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'MCP_TOOL_NAME_REQUIRED',
              message: `MCP Tool node "${node.id}" requires a toolName`,
              severity: 'error',
            });
          }
          break;
        }

        case 'asyncTask': {
          // taskType required
          const taskType = d.taskType as string | undefined;
          if (!taskType || typeof taskType !== 'string' || taskType.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'ASYNC_TASK_TYPE_REQUIRED',
              message: `AsyncTask node "${node.id}" requires a taskType`,
              severity: 'error',
            });
          }
          break;
        }

        case 'knowledgeSearch': {
          // query required (check "query" and "querySource" alias)
          const query = (d.query ?? d.querySource) as string | undefined;
          if (!query || typeof query !== 'string' || query.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'KNOWLEDGE_QUERY_REQUIRED',
              message: `KnowledgeSearch node "${node.id}" requires a query`,
              severity: 'error',
            });
          }
          break;
        }

        case 'transfer': {
          // destination required
          const dest = d.destination as string | undefined;
          if (!dest || typeof dest !== 'string' || dest.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'TRANSFER_DESTINATION_REQUIRED',
              message: `Transfer node "${node.id}" requires a destination`,
              severity: 'error',
            });
          }
          break;
        }

        case 'hold': {
          // maxDuration required positive
          const holdDur = d.maxDuration as number | undefined;
          if (
            holdDur === undefined ||
            holdDur === null ||
            typeof holdDur !== 'number' ||
            holdDur <= 0
          ) {
            errors.push({
              nodeId: node.id,
              code: 'HOLD_MAX_DURATION_REQUIRED',
              message: `Hold node "${node.id}" requires a positive maxDuration`,
              severity: 'error',
            });
          }
          break;
        }

        case 'voicemail': {
          // maxDuration required positive
          const vmDur = d.maxDuration as number | undefined;
          if (vmDur === undefined || vmDur === null || typeof vmDur !== 'number' || vmDur <= 0) {
            errors.push({
              nodeId: node.id,
              code: 'VOICEMAIL_MAX_DURATION_REQUIRED',
              message: `Voicemail node "${node.id}" requires a positive maxDuration`,
              severity: 'error',
            });
          }
          break;
        }

        case 'dtmf': {
          // expectedDigits or maxDigits required
          const expectedDigits = d.expectedDigits as string | undefined;
          const maxDigits = d.maxDigits as number | undefined;
          const hasExpected =
            expectedDigits &&
            typeof expectedDigits === 'string' &&
            expectedDigits.trim().length > 0;
          const hasMax = maxDigits !== undefined && typeof maxDigits === 'number' && maxDigits > 0;
          if (!hasExpected && !hasMax) {
            errors.push({
              nodeId: node.id,
              code: 'DTMF_DIGITS_REQUIRED',
              message: `DTMF node "${node.id}" requires either expectedDigits or a positive maxDigits`,
              severity: 'error',
            });
          }
          break;
        }

        case 'abTest': {
          // variants array min 2, weights sum approximately 1.0 within 0.01 tolerance
          const variants = d.variants as Array<{ weight?: number }> | undefined;
          if (!variants || !Array.isArray(variants) || variants.length < 2) {
            errors.push({
              nodeId: node.id,
              code: 'ABTEST_MIN_VARIANTS',
              message: `A/B Test node "${node.id}" requires at least 2 variants`,
              severity: 'error',
            });
          } else {
            // Check weight sum (weights may be 0-1 or 0-100 scale)
            const weightSum = variants.reduce(
              (sum, v) => sum + (typeof v.weight === 'number' ? v.weight : 0),
              0
            );
            // Support both 0-1 scale (sum ~1.0) and 0-100 scale (sum ~100)
            const isNormalizedScale = Math.abs(weightSum - 1.0) <= 0.01;
            const isPercentScale = Math.abs(weightSum - 100) <= 1;
            if (!isNormalizedScale && !isPercentScale) {
              errors.push({
                nodeId: node.id,
                code: 'ABTEST_WEIGHT_SUM',
                message: `A/B Test node "${node.id}" variant weights sum to ${weightSum.toFixed(4)}, expected approximately 1.0 (or 100)`,
                severity: 'error',
              });
            }
          }
          break;
        }

        case 'component': {
          // componentId required
          const compId = d.componentId as string | undefined;
          if (!compId || typeof compId !== 'string' || compId.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'COMPONENT_ID_REQUIRED',
              message: `Component node "${node.id}" requires a componentId`,
              severity: 'error',
            });
          }
          break;
        }

        case 'agent': {
          // agentId required
          const agId = d.agentId as string | undefined;
          if (!agId || typeof agId !== 'string' || agId.trim().length === 0) {
            errors.push({
              nodeId: node.id,
              code: 'AGENT_ID_REQUIRED',
              message: `Agent node "${node.id}" requires an agentId`,
              severity: 'error',
            });
          }
          break;
        }

        // note and log: skip (informational only)
        case 'note':
        case 'log':
          break;

        // start and endCall handled in structural checks above
        case 'start':
        case 'endCall':
        case 'end':
          break;

        // condition and delay - basic checks
        case 'condition': {
          const cond = d.condition as string | undefined;
          if (!cond || typeof cond !== 'string' || cond.trim().length === 0) {
            // Also check "conditions" array pattern
            const condArr = d.conditions as unknown[] | undefined;
            if (!condArr || !Array.isArray(condArr) || condArr.length === 0) {
              errors.push({
                nodeId: node.id,
                code: 'CONDITION_REQUIRED',
                message: `Condition node "${node.id}" requires a condition expression or conditions array`,
                severity: 'error',
              });
            }
          }
          break;
        }

        default:
          // Unknown node type - not an error, just skip
          break;
      }
    });

    // ========== WARNING CHECKS (Allow Publishing) ==========

    // Orphan detection: warn on non-start node with zero incoming edges
    // Dead-end detection: warn on non-endCall node with zero outgoing edges
    const noOutgoingExceptions = new Set(['endCall', 'end', 'goTo', 'note', 'log']);
    const noIncomingExceptions = new Set(['start', 'note', 'log']);

    nodes.forEach(node => {
      // Orphan detection
      if (!noIncomingExceptions.has(node.type) && !nodesWithIncomingEdges.has(node.id)) {
        warnings.push({
          nodeId: node.id,
          code: 'ORPHAN_NODE',
          message: `Node "${node.id}" (${node.type}) has no incoming edges - it may be unreachable`,
          severity: 'warning',
        });
      }

      // Dead-end detection
      if (!noOutgoingExceptions.has(node.type) && !nodesWithOutgoingEdges.has(node.id)) {
        warnings.push({
          nodeId: node.id,
          code: 'DEAD_END_NODE',
          message: `Node "${node.id}" (${node.type}) has no outgoing edges - conversation will end here`,
          severity: 'warning',
        });
      }

      // Start node with no outgoing edges
      if (node.type === 'start' && !nodesWithOutgoingEdges.has(node.id)) {
        warnings.push({
          nodeId: node.id,
          code: 'START_NO_OUTGOING',
          message: `Start node has no outgoing connections`,
          severity: 'warning',
        });
      }
    });

    // ========== SUGGESTION CHECKS ==========

    // 1. Very long prompts (>2000 chars)
    nodes.forEach(node => {
      const systemPrompt = node.data.systemPrompt as string | undefined;
      const prompt = node.data.prompt as string | undefined;

      if (systemPrompt && systemPrompt.length > 2000) {
        suggestions.push({
          nodeId: node.id,
          code: 'LONG_PROMPT',
          message: `Node "${node.id}" has a very long system prompt (${systemPrompt.length} characters) - consider splitting or summarizing`,
          severity: 'suggestion',
        });
      }

      if (prompt && prompt.length > 2000) {
        suggestions.push({
          nodeId: node.id,
          code: 'LONG_PROMPT',
          message: `Node "${node.id}" has a very long prompt (${prompt.length} characters) - consider splitting or summarizing`,
          severity: 'suggestion',
        });
      }
    });

    // 2. API/MCP nodes without timeout
    nodes.forEach(node => {
      if (
        node.type === 'api' ||
        node.type === 'apiCall' ||
        node.type === 'mcp' ||
        node.type === 'mcpTool' ||
        node.type === 'tool' ||
        node.type === 'asyncTask'
      ) {
        if (!node.data.timeout || typeof node.data.timeout !== 'number') {
          suggestions.push({
            nodeId: node.id,
            code: 'NO_TIMEOUT',
            message: `${node.type.toUpperCase()} node "${node.id}" has no timeout configured - may hang if external service is slow`,
            severity: 'suggestion',
          });
        }
      }
    });

    const valid = errors.length === 0;

    logger.info('Flow validated', {
      agentId,
      userId,
      valid,
      errorCount: errors.length,
      warningCount: warnings.length,
      suggestionCount: suggestions.length,
    });

    return res.json({
      valid,
      errors,
      warnings,
      suggestions,
    });
  } catch (err) {
    logger.error('POST /:agentId/flow/validate failed', {
      error: err,
      agentId: req.params.agentId,
    });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /:agentId/flow/publish
// Validate and publish the active flow
// ============================================================================

router.post('/:agentId/flow/publish', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = req.params;

    // Verify agent ownership
    const ownership = await verifyAgentOwnership(agentId, userId);
    if (!ownership.success) {
      return res.status(ownership.error === 'Agent not found' ? 404 : 403).json({
        error: ownership.error,
      });
    }

    // Get active flow
    const flow = await prisma.flow.findFirst({
      where: {
        agentId,
        isActive: true,
      },
    });

    if (!flow) {
      return res.status(404).json({ error: 'No active flow found for this agent' });
    }

    // Run validation on the flow
    const nodes = (flow.nodes as z.infer<typeof NodeSchema>[]) ?? [];
    const edges = (flow.edges as z.infer<typeof EdgeSchema>[]) ?? [];
    const validation = validateFlow(nodes, edges);

    if (!validation.valid) {
      return res.status(400).json({
        error: 'Flow has validation errors and cannot be published',
        validation,
      });
    }

    // Mark as published by updating the timestamp (isActive already true)
    const publishedAt = new Date();
    const updatedFlow = await prisma.flow.update({
      where: { id: flow.id },
      data: {
        isActive: true,
        updatedAt: publishedAt,
      },
    });

    logger.info('Flow published', {
      flowId: updatedFlow.id,
      agentId,
      userId,
      version: updatedFlow.version,
      publishedAt: publishedAt.toISOString(),
    });

    return res.json({
      success: true,
      publishedAt: publishedAt.toISOString(),
      flow: {
        id: updatedFlow.id,
        name: updatedFlow.name,
        version: updatedFlow.version,
        isActive: updatedFlow.isActive,
        updatedAt: updatedFlow.updatedAt,
      },
    });
  } catch (err) {
    logger.error('POST /:agentId/flow/publish failed', { error: err, agentId: req.params.agentId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /:agentId/flow/export
// Export flow as JSON
// ============================================================================

router.post('/:agentId/flow/export', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = req.params;

    // Verify agent ownership
    const ownership = await verifyAgentOwnership(agentId, userId);
    if (!ownership.success) {
      return res.status(ownership.error === 'Agent not found' ? 404 : 403).json({
        error: ownership.error,
      });
    }

    // Get active flow
    const flow = await prisma.flow.findFirst({
      where: {
        agentId,
        isActive: true,
      },
    });

    if (!flow) {
      return res.status(404).json({ error: 'No active flow found for this agent' });
    }

    // Return exportable flow definition
    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      flow: {
        name: flow.name,
        description: flow.description,
        nodes: flow.nodes,
        edges: flow.edges,
        variables: flow.variables,
        globalPrompt: flow.globalPrompt,
      },
    };

    logger.info('Flow exported', {
      flowId: flow.id,
      agentId,
      userId,
    });

    return res.json(exportData);
  } catch (err) {
    logger.error('POST /:agentId/flow/export failed', { error: err, agentId: req.params.agentId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// POST /:agentId/flow/import
// Import a flow from JSON
// ============================================================================

router.post('/:agentId/flow/import', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { agentId } = req.params;

    // Verify agent ownership
    const ownership = await verifyAgentOwnership(agentId, userId);
    if (!ownership.success) {
      return res.status(ownership.error === 'Agent not found' ? 404 : 403).json({
        error: ownership.error,
      });
    }

    // Accept both wrapped (with version/exportedAt) and unwrapped formats
    let flowData = req.body;
    if (flowData.flow && flowData.version) {
      // Wrapped format from export
      flowData = flowData.flow;
    }

    // Validate import data
    const parseResult = ImportFlowSchema.safeParse(flowData);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid import data',
        details: parseResult.error.flatten().fieldErrors,
      });
    }

    const importedFlow = parseResult.data;

    // Validate the flow structure
    const validation = validateFlow(importedFlow.nodes, importedFlow.edges);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Imported flow is invalid',
        validation,
      });
    }

    // Deactivate existing active flow
    await prisma.flow.updateMany({
      where: {
        agentId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create new flow from import
    const newFlow = await prisma.flow.create({
      data: {
        agentId,
        name: importedFlow.name,
        description: importedFlow.description,
        nodes: importedFlow.nodes as Prisma.InputJsonValue,
        edges: importedFlow.edges as Prisma.InputJsonValue,
        variables: importedFlow.variables as Prisma.InputJsonValue | undefined,
        globalPrompt: importedFlow.globalPrompt,
        version: 1,
        isActive: true,
      },
    });

    logger.info('Flow imported', {
      flowId: newFlow.id,
      agentId,
      userId,
    });

    return res.json({
      flow: {
        id: newFlow.id,
        name: newFlow.name,
        description: newFlow.description,
        nodes: newFlow.nodes,
        edges: newFlow.edges,
        variables: newFlow.variables,
        globalPrompt: newFlow.globalPrompt,
        version: newFlow.version,
        isActive: newFlow.isActive,
        createdAt: newFlow.createdAt,
        updatedAt: newFlow.updatedAt,
      },
      validation,
    });
  } catch (err) {
    logger.error('POST /:agentId/flow/import failed', { error: err, agentId: req.params.agentId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// DELETE /api/agents/:agentId/flow
// Deletes the active flow for the agent
// ============================================================================

router.delete('/:agentId/flow', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.auth?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const agent = await prisma.agents.findUnique({
      where: { id: req.params.agentId },
    });

    if (!agent || agent.userId !== userId) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    // Soft-delete: set isActive to false on the active flow
    const activeFlow = await prisma.flow.findFirst({
      where: { agentId: agent.id, isActive: true },
    });

    if (!activeFlow) {
      return res.status(404).json({ error: 'No active flow found for this agent' });
    }

    await prisma.flow.update({
      where: { id: activeFlow.id },
      data: { isActive: false },
    });

    logger.info('Flow deleted (deactivated)', { agentId: agent.id, flowId: activeFlow.id });

    return res.json({ success: true, message: 'Flow deleted' });
  } catch (err) {
    logger.error('DELETE /:agentId/flow failed', { error: err, agentId: req.params.agentId });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
