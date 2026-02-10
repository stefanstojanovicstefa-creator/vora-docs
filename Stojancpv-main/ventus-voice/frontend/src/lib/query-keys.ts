/**
 * Centralized Query Key Factory for TanStack React Query
 *
 * This module provides type-safe, consistent query keys for all API queries.
 * Using a centralized factory ensures:
 * - Consistent key structure across the application
 * - Easy cache invalidation
 * - Type safety for query parameters
 * - Hierarchical cache management
 */

/** Base query key type */
type QueryKey = readonly unknown[];

/**
 * Query key factory functions
 *
 * Structure follows the pattern: [domain, scope, ...params]
 * This enables granular and bulk invalidation strategies
 */
export const queryKeys = {
  // ============================================
  // Knowledge Base Keys
  // ============================================
  knowledgeBase: {
    /** All knowledge base related queries */
    all: ["knowledge-base"] as const,

    /** List of knowledge bases for an agent */
    lists: () => [...queryKeys.knowledgeBase.all, "list"] as const,

    /** Filtered knowledge base list */
    list: (agentId: string, filters?: { search?: string; status?: string }) =>
      [...queryKeys.knowledgeBase.lists(), { agentId, ...filters }] as const,

    /** Single knowledge base details */
    details: () => [...queryKeys.knowledgeBase.all, "detail"] as const,

    /** Single knowledge base by ID */
    detail: (kbId: string) => [...queryKeys.knowledgeBase.details(), kbId] as const,

    /** Knowledge base documents */
    documents: (kbId: string) => [...queryKeys.knowledgeBase.detail(kbId), "documents"] as const,

    /** Knowledge base search results */
    search: (kbId: string, query: string) =>
      [...queryKeys.knowledgeBase.detail(kbId), "search", { query }] as const,

    /** Knowledge base stats */
    stats: (kbId: string) => [...queryKeys.knowledgeBase.detail(kbId), "stats"] as const,
  },

  // ============================================
  // Document Keys
  // ============================================
  documents: {
    /** All document related queries */
    all: ["documents"] as const,

    /** Document by ID */
    detail: (docId: string) => [...queryKeys.documents.all, docId] as const,

    /** Document chunks */
    chunks: (docId: string) => [...queryKeys.documents.detail(docId), "chunks"] as const,
  },

  // ============================================
  // Brand Keys
  // ============================================
  brands: {
    /** All brand related queries */
    all: ["brands"] as const,

    /** Brand lists */
    lists: () => [...queryKeys.brands.all, "list"] as const,

    /** Filtered brand list */
    list: (params?: { status?: string; search?: string; page?: number }) =>
      [...queryKeys.brands.lists(), params ?? {}] as const,

    /** Single brand details */
    details: () => [...queryKeys.brands.all, "detail"] as const,

    /** Single brand by ID */
    detail: (id: string) => [...queryKeys.brands.details(), id] as const,

    /** Brand costs */
    costs: (id: string) => [...queryKeys.brands.detail(id), "costs"] as const,

    /** Brand analysis */
    analysis: (id: string) => [...queryKeys.brands.detail(id), "analysis"] as const,

    /** Cost summary */
    costSummary: (userId?: string, customerId?: string) =>
      [...queryKeys.brands.all, "cost-summary", { userId, customerId }] as const,
  },

  // ============================================
  // Agent Keys
  // ============================================
  agents: {
    /** All agent related queries */
    all: ["agents"] as const,

    /** Agent lists */
    lists: () => [...queryKeys.agents.all, "list"] as const,

    /** Filtered agent list */
    list: (filters?: { status?: string; brandId?: string }) =>
      [...queryKeys.agents.lists(), filters ?? {}] as const,

    /** Single agent details */
    details: () => [...queryKeys.agents.all, "detail"] as const,

    /** Single agent by ID */
    detail: (id: string) => [...queryKeys.agents.details(), id] as const,

    /** Agent configuration */
    config: (id: string) => [...queryKeys.agents.detail(id), "config"] as const,

    /** Agent performance metrics */
    performance: (id: string, timeRange?: string) =>
      [...queryKeys.agents.detail(id), "performance", { timeRange }] as const,

    /** Agent sessions */
    sessions: (id: string, params?: { page?: number; limit?: number }) =>
      [...queryKeys.agents.detail(id), "sessions", params ?? {}] as const,

    // NOTE: prewarmStatus removed (PRD-001) - feature no longer in use
  },

  // ============================================
  // Memory Keys
  // ============================================
  memory: {
    /** All memory related queries */
    all: ["memory"] as const,

    /** Sessions for an agent */
    agentSessions: (agentId: string, params?: { page?: number; includeEnded?: boolean }) =>
      [...queryKeys.memory.all, "agent-sessions", agentId, params ?? {}] as const,

    /** Single session details */
    session: (sessionId: string) => [...queryKeys.memory.all, "session", sessionId] as const,

    /** Messages for a session */
    sessionMessages: (sessionId: string, params?: { limit?: number }) =>
      [...queryKeys.memory.all, "session-messages", sessionId, params ?? {}] as const,

    /** Context for a session (LLM injection) */
    sessionContext: (sessionId: string) =>
      [...queryKeys.memory.all, "session-context", sessionId] as const,

    /** Customer memory: list customers for an org */
    customers: (orgId: string, params?: { search?: string; page?: number }) =>
      [...queryKeys.memory.all, "customers", orgId, params ?? {}] as const,

    /** Customer memory: single customer profile */
    customerProfile: (orgId: string, customerId: string) =>
      [...queryKeys.memory.all, "customer-profile", orgId, customerId] as const,

    /** Customer memory: memories for a customer */
    customerMemories: (orgId: string, customerId: string) =>
      [...queryKeys.memory.all, "customer-memories", orgId, customerId] as const,
  },

  // ============================================
  // Flow Keys
  // ============================================
  flow: {
    /** All flow related queries */
    all: ["flow"] as const,

    /** Flow details by agent ID */
    detail: (agentId: string) => [...queryKeys.flow.all, agentId] as const,
  },

  // ============================================
  // Provider Keys
  // ============================================
  providers: {
    /** All provider related queries */
    all: ["providers"] as const,

    /** Provider lists */
    lists: () => [...queryKeys.providers.all, "list"] as const,

    /** Provider list by type */
    listByType: (type: "llm" | "stt" | "tts") => [...queryKeys.providers.lists(), type] as const,

    /** Provider health status */
    health: () => [...queryKeys.providers.all, "health"] as const,

    /** Single provider health */
    providerHealth: (providerId: string) => [...queryKeys.providers.health(), providerId] as const,

    /** Circuit breaker status */
    circuitBreakers: () => [...queryKeys.providers.all, "circuit-breakers"] as const,

    /** Fallback chains */
    fallbackChains: () => [...queryKeys.providers.all, "fallback-chains"] as const,

    /** Provider comparison */
    comparison: () => [...queryKeys.providers.all, "comparison"] as const,

    /** Provider pricing */
    pricing: () => [...queryKeys.providers.all, "pricing"] as const,
  },

  // ============================================
  // Credentials Keys
  // ============================================
  credentials: {
    /** All credentials related queries */
    all: ["credentials"] as const,

    /** Credentials list */
    lists: () => [...queryKeys.credentials.all, "list"] as const,

    /** Credentials by provider type */
    listByType: (type: "llm" | "stt" | "tts") => [...queryKeys.credentials.lists(), type] as const,

    /** Single credential */
    detail: (id: string) => [...queryKeys.credentials.all, id] as const,

    /** Credential validation */
    validation: (id: string) => [...queryKeys.credentials.detail(id), "validation"] as const,
  },

  // ============================================
  // Analytics Keys
  // ============================================
  analytics: {
    /** All analytics related queries */
    all: ["analytics"] as const,

    /** Cost analytics */
    costs: (params?: { startDate?: string; endDate?: string; agentId?: string }) =>
      [...queryKeys.analytics.all, "costs", params ?? {}] as const,

    /** Cost breakdown */
    costBreakdown: (params?: { groupBy?: string; period?: string }) =>
      [...queryKeys.analytics.all, "cost-breakdown", params ?? {}] as const,

    /** Cost trends */
    costTrends: (period: "day" | "week" | "month") =>
      [...queryKeys.analytics.all, "cost-trends", period] as const,

    /** Cost projection */
    costProjection: () => [...queryKeys.analytics.all, "cost-projection"] as const,

    /** Usage metrics */
    usage: (params?: { startDate?: string; endDate?: string }) =>
      [...queryKeys.analytics.all, "usage", params ?? {}] as const,

    /** Session metrics */
    sessions: (params?: { agentId?: string; period?: string }) =>
      [...queryKeys.analytics.all, "sessions", params ?? {}] as const,

    /** Agent performance */
    agentPerformance: (agentId?: string, timeRange?: string) =>
      [...queryKeys.analytics.all, "agent-performance", { agentId, timeRange }] as const,

    /** Error analysis */
    errors: (params?: { agentId?: string; period?: string }) =>
      [...queryKeys.analytics.all, "errors", params ?? {}] as const,
  },

  // ============================================
  // Monitoring Keys
  // ============================================
  monitoring: {
    /** All monitoring related queries */
    all: ["monitoring"] as const,

    /** System health */
    health: () => [...queryKeys.monitoring.all, "health"] as const,

    /** Service health */
    serviceHealth: (serviceName?: string) =>
      [...queryKeys.monitoring.health(), serviceName ?? "all"] as const,

    /** Metrics */
    metrics: (timeRange?: string) =>
      [...queryKeys.monitoring.all, "metrics", { timeRange }] as const,

    /** Alerts */
    alerts: (params?: { severity?: string; status?: string }) =>
      [...queryKeys.monitoring.all, "alerts", params ?? {}] as const,
  },

  // ============================================
  // MCP Keys
  // ============================================
  mcp: {
    all: ["mcp"] as const,
    catalog: (filters?: { category?: string; status?: string; search?: string }) =>
      [...queryKeys.mcp.all, "catalog", filters ?? {}] as const,
    catalogItem: (id: string) => [...queryKeys.mcp.all, "catalog", id] as const,
    recommendations: (industry: string, region?: string) =>
      [...queryKeys.mcp.all, "recommendations", { industry, region }] as const,
    connections: () => [...queryKeys.mcp.all, "connections"] as const,
    connection: (id: string) => [...queryKeys.mcp.all, "connections", id] as const,
    connectionTools: (connectionId: string) =>
      [...queryKeys.mcp.all, "connections", connectionId, "tools"] as const,
    agentBindings: (agentId: string) => [...queryKeys.mcp.all, "agent-bindings", agentId] as const,
    agentTools: (agentId: string) => [...queryKeys.mcp.all, "agent-tools", agentId] as const,
  },

  // ============================================
  // Component Keys
  // ============================================
  components: {
    /** All component related queries */
    all: ["components"] as const,

    /** Component lists */
    lists: () => [...queryKeys.components.all, "list"] as const,

    /** Filtered component list */
    list: (filters?: { search?: string; isPublic?: boolean }) =>
      [...queryKeys.components.lists(), filters ?? {}] as const,

    /** Single component details */
    details: () => [...queryKeys.components.all, "detail"] as const,

    /** Single component by ID */
    detail: (id: string) => [...queryKeys.components.details(), id] as const,
  },

  // ============================================
  // User Keys
  // ============================================
  user: {
    /** Current user */
    current: () => ["user", "current"] as const,

    /** User settings */
    settings: () => ["user", "settings"] as const,

    /** User usage quota */
    quota: () => ["user", "quota"] as const,

    /** User onboarding status */
    onboarding: () => ["user", "onboarding"] as const,
  },
} as const;

/**
 * Helper function to create a mutation key
 * Mutation keys follow the pattern: [domain, 'mutation', action]
 */
export const mutationKeys = {
  knowledgeBase: {
    create: ["knowledge-base", "mutation", "create"] as const,
    update: (kbId: string) => ["knowledge-base", "mutation", "update", kbId] as const,
    delete: (kbId: string) => ["knowledge-base", "mutation", "delete", kbId] as const,
    uploadDocument: (kbId: string) => ["knowledge-base", "mutation", "upload", kbId] as const,
    addUrl: (kbId: string) => ["knowledge-base", "mutation", "add-url", kbId] as const,
    deleteDocument: (docId: string) => ["documents", "mutation", "delete", docId] as const,
  },
  brands: {
    analyze: ["brands", "mutation", "analyze"] as const,
    refresh: (id: string) => ["brands", "mutation", "refresh", id] as const,
    delete: (id: string) => ["brands", "mutation", "delete", id] as const,
  },
  agents: {
    create: ["agents", "mutation", "create"] as const,
    update: (id: string) => ["agents", "mutation", "update", id] as const,
    delete: (id: string) => ["agents", "mutation", "delete", id] as const,
    deploy: (id: string) => ["agents", "mutation", "deploy", id] as const,
    // NOTE: prewarm removed (PRD-001) - feature no longer in use
  },
  credentials: {
    create: ["credentials", "mutation", "create"] as const,
    update: (id: string) => ["credentials", "mutation", "update", id] as const,
    delete: (id: string) => ["credentials", "mutation", "delete", id] as const,
    test: (id: string) => ["credentials", "mutation", "test", id] as const,
  },
  providers: {
    forceHealthCheck: ["providers", "mutation", "health-check"] as const,
    resetCircuitBreaker: (providerId: string) =>
      ["providers", "mutation", "reset-circuit-breaker", providerId] as const,
  },
  mcp: {
    createConnection: ["mcp", "mutation", "create-connection"] as const,
    updateConnection: (id: string) => ["mcp", "mutation", "update-connection", id] as const,
    deleteConnection: (id: string) => ["mcp", "mutation", "delete-connection", id] as const,
    testConnection: (id: string) => ["mcp", "mutation", "test-connection", id] as const,
    refreshTools: (id: string) => ["mcp", "mutation", "refresh-tools", id] as const,
    executeTool: ["mcp", "mutation", "execute-tool"] as const,
    createBinding: (agentId: string) => ["mcp", "mutation", "create-binding", agentId] as const,
    deleteBinding: (agentId: string) => ["mcp", "mutation", "delete-binding", agentId] as const,
  },
} as const;

/**
 * Type helper to extract the return type of a query key function
 */
export type QueryKeyOf<T extends (...args: unknown[]) => QueryKey> = ReturnType<T>;

export default queryKeys;
