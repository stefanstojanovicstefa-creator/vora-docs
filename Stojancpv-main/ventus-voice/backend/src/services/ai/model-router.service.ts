/**
 * Model Router Service
 *
 * Intelligently routes LLM calls to appropriate models based on task complexity.
 * Reduces LLM costs ~40% for simple tasks (summarization, extraction) by routing
 * them to free-tier models while reserving premium models for complex tasks.
 *
 * Task Categories:
 * - brand-analysis: Complex multi-field extraction → premium model
 * - summarization: Simple text summarization → free model
 * - embedding: Vector generation → dedicated embedding model (passthrough)
 * - extraction: Entity/fact extraction → mid-tier model
 * - compilation: Agent config generation → premium model
 * - context-summary: Session context summary → free model
 *
 * Features:
 * - Per-organization overrides (premium orgs can force premium models)
 * - Automatic fallback on model failure
 * - Cost estimate logging per routed call
 */

import { createLogger } from '../../utils/logger';
import { getModelCapabilities, type ModelCapabilities } from '../../config/model-capabilities';

const logger = createLogger('ModelRouter.service');

// ============================================================================
// TYPES
// ============================================================================

export type TaskType =
  | 'brand-analysis'
  | 'summarization'
  | 'embedding'
  | 'extraction'
  | 'compilation'
  | 'context-summary';

export interface ModelRoute {
  /** Model identifier (e.g., 'gemini-2.5-flash', 'minimax-m2:free') */
  model: string;
  /** API provider endpoint */
  provider: 'routeway' | 'openrouter' | 'gemini' | 'openai';
  /** Base URL for the provider */
  baseUrl: string;
  /** Pricing tier label */
  tier: 'free' | 'budget' | 'mid' | 'premium';
  /** Estimated cost per 1M input tokens (USD) */
  costPerMillionInput: number;
  /** Estimated cost per 1M output tokens (USD) */
  costPerMillionOutput: number;
}

export interface RoutedModel {
  /** Primary model route */
  route: ModelRoute;
  /** Fallback model route (used if primary fails) */
  fallback: ModelRoute;
  /** Task type that was routed */
  taskType: TaskType;
  /** Whether an org override was applied */
  overrideApplied: boolean;
  /** Model capabilities from the registry */
  capabilities: ModelCapabilities;
}

export interface OrgOverride {
  /** Organization ID */
  orgId: string;
  /** Force all tasks to use this tier minimum */
  minTier?: 'budget' | 'mid' | 'premium';
  /** Force specific task types to specific models */
  taskOverrides?: Partial<Record<TaskType, string>>;
}

// ============================================================================
// MODEL ROUTE DEFINITIONS
// ============================================================================

/** Free tier models — zero cost, good for simple tasks */
const FREE_ROUTE: ModelRoute = {
  model: 'minimax-m2:free',
  provider: 'routeway',
  baseUrl: 'https://api.routeway.ai/v1',
  tier: 'free',
  costPerMillionInput: 0,
  costPerMillionOutput: 0,
};

const FREE_OPENROUTER_ROUTE: ModelRoute = {
  model: 'openai/gpt-oss-120b:free',
  provider: 'openrouter',
  baseUrl: 'https://openrouter.ai/api/v1',
  tier: 'free',
  costPerMillionInput: 0,
  costPerMillionOutput: 0,
};

/** Budget tier — very low cost, capable */
const BUDGET_ROUTE: ModelRoute = {
  model: 'gemini-2.5-flash',
  provider: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  tier: 'budget',
  costPerMillionInput: 0.15,
  costPerMillionOutput: 0.60,
};

/** Mid tier — balanced cost and capability */
const MID_ROUTE: ModelRoute = {
  model: 'gemini-2.5-flash',
  provider: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  tier: 'mid',
  costPerMillionInput: 0.15,
  costPerMillionOutput: 0.60,
};

/** Premium tier — highest quality */
const PREMIUM_ROUTE: ModelRoute = {
  model: 'gemini-2.5-pro',
  provider: 'gemini',
  baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  tier: 'premium',
  costPerMillionInput: 1.25,
  costPerMillionOutput: 10.0,
};

// ============================================================================
// DEFAULT TASK → MODEL MAPPING
// ============================================================================

const DEFAULT_TASK_ROUTES: Record<TaskType, ModelRoute> = {
  'brand-analysis': BUDGET_ROUTE,       // Complex extraction — Gemini 2.5 Flash (fast + capable)
  'summarization': FREE_ROUTE,          // Simple summarization → free model via Routeway
  'embedding': FREE_ROUTE,              // Passthrough — embeddings use dedicated service
  'extraction': FREE_OPENROUTER_ROUTE,  // Entity extraction → free OpenRouter model
  'compilation': FREE_ROUTE,            // Agent config generation → free Routeway (MiniMax M2)
  'context-summary': FREE_OPENROUTER_ROUTE, // Session context → free OpenRouter model
};

const DEFAULT_FALLBACK_ROUTES: Record<TaskType, ModelRoute> = {
  'brand-analysis': PREMIUM_ROUTE,      // Fallback to Gemini 2.5 Pro for complex tasks
  'summarization': FREE_OPENROUTER_ROUTE, // Fallback to OpenRouter free
  'embedding': BUDGET_ROUTE,            // Fallback to Gemini Flash
  'extraction': FREE_ROUTE,             // Fallback to Routeway free
  'compilation': BUDGET_ROUTE,          // Fallback to Gemini Flash
  'context-summary': FREE_ROUTE,        // Fallback to Routeway free
};

// ============================================================================
// TIER ORDERING (for org override minimum tier enforcement)
// ============================================================================

const TIER_ORDER: Record<string, number> = {
  'free': 0,
  'budget': 1,
  'mid': 2,
  'premium': 3,
};

function tierMeetsMinimum(routeTier: string, minTier: string): boolean {
  return (TIER_ORDER[routeTier] ?? 0) >= (TIER_ORDER[minTier] ?? 0);
}

/** Upgrade a route to meet minimum tier requirement */
function upgradeRoute(route: ModelRoute, minTier: string): ModelRoute {
  if (tierMeetsMinimum(route.tier, minTier)) {
    return route;
  }
  // Upgrade to the minimum required tier
  switch (minTier) {
    case 'budget': return BUDGET_ROUTE;
    case 'mid': return MID_ROUTE;
    case 'premium': return PREMIUM_ROUTE;
    default: return route;
  }
}

// ============================================================================
// MODEL ROUTER SERVICE
// ============================================================================

class ModelRouterService {
  private orgOverrides: Map<string, OrgOverride> = new Map();

  /**
   * Get the appropriate model for a given task type.
   *
   * @param taskType - The category of AI task
   * @param orgId - Optional organization ID for premium overrides
   * @returns RoutedModel with primary route, fallback, and metadata
   */
  getModel(taskType: TaskType, orgId?: string): RoutedModel {
    let route = DEFAULT_TASK_ROUTES[taskType];
    let fallback = DEFAULT_FALLBACK_ROUTES[taskType];
    let overrideApplied = false;

    // Apply per-organization overrides
    if (orgId) {
      const override = this.orgOverrides.get(orgId);
      if (override) {
        // Check for task-specific model override
        if (override.taskOverrides?.[taskType]) {
          const overrideModel = override.taskOverrides[taskType]!;
          route = {
            ...route,
            model: overrideModel,
            tier: 'premium', // Explicit overrides are treated as premium
          };
          overrideApplied = true;
        }
        // Check for minimum tier override
        else if (override.minTier) {
          route = upgradeRoute(route, override.minTier);
          fallback = upgradeRoute(fallback, override.minTier);
          overrideApplied = route !== DEFAULT_TASK_ROUTES[taskType];
        }
      }
    }

    const capabilities = getModelCapabilities(route.model);

    // Log the routing decision
    logger.info('Model routed', {
      event: 'model_routed',
      taskType,
      model: route.model,
      provider: route.provider,
      tier: route.tier,
      fallbackModel: fallback.model,
      overrideApplied,
      orgId: orgId || 'none',
      estimatedCostPerMInput: route.costPerMillionInput,
      estimatedCostPerMOutput: route.costPerMillionOutput,
    });

    return {
      route,
      fallback,
      taskType,
      overrideApplied,
      capabilities,
    };
  }

  /**
   * Register a per-organization model override.
   * Premium orgs can force premium models for all or specific task types.
   */
  setOrgOverride(override: OrgOverride): void {
    this.orgOverrides.set(override.orgId, override);
    logger.info('Org override registered', {
      event: 'org_override_set',
      orgId: override.orgId,
      minTier: override.minTier,
      taskOverrides: override.taskOverrides ? Object.keys(override.taskOverrides) : [],
    });
  }

  /**
   * Remove a per-organization override.
   */
  removeOrgOverride(orgId: string): void {
    this.orgOverrides.delete(orgId);
    logger.info('Org override removed', {
      event: 'org_override_removed',
      orgId,
    });
  }

  /**
   * Get all registered org overrides (for admin inspection).
   */
  getOrgOverrides(): OrgOverride[] {
    return Array.from(this.orgOverrides.values());
  }

  /**
   * Log cost estimate for a completed routed call.
   */
  logRoutedCall(
    taskType: TaskType,
    model: string,
    inputTokens: number,
    outputTokens: number,
    durationMs: number,
    usedFallback: boolean = false,
  ): void {
    const route = this.findRouteByModel(model);
    const inputCost = (inputTokens / 1_000_000) * (route?.costPerMillionInput ?? 0);
    const outputCost = (outputTokens / 1_000_000) * (route?.costPerMillionOutput ?? 0);
    const totalCost = inputCost + outputCost;

    logger.info('Routed call completed', {
      event: 'routed_call_completed',
      taskType,
      model,
      tier: route?.tier ?? 'unknown',
      inputTokens,
      outputTokens,
      estimatedCostUsd: totalCost.toFixed(6),
      durationMs,
      usedFallback,
    });
  }

  /**
   * Get all available routes for inspection/debugging.
   */
  getDefaultRoutes(): Record<TaskType, { primary: ModelRoute; fallback: ModelRoute }> {
    const result: Record<string, { primary: ModelRoute; fallback: ModelRoute }> = {};
    for (const taskType of Object.keys(DEFAULT_TASK_ROUTES) as TaskType[]) {
      result[taskType] = {
        primary: DEFAULT_TASK_ROUTES[taskType],
        fallback: DEFAULT_FALLBACK_ROUTES[taskType],
      };
    }
    return result as Record<TaskType, { primary: ModelRoute; fallback: ModelRoute }>;
  }

  /** Find a route definition by model name */
  private findRouteByModel(model: string): ModelRoute | undefined {
    const allRoutes = [FREE_ROUTE, FREE_OPENROUTER_ROUTE, BUDGET_ROUTE, MID_ROUTE, PREMIUM_ROUTE];
    return allRoutes.find(r => r.model === model);
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const modelRouter = new ModelRouterService();

export default modelRouter;
