/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * FlowStudioPage
 * Visual workflow builder for designing conversation flows using React Flow.
 * Wraps everything in FlowStudioProvider so child components share state via context.
 *
 * Layout:
 *   TOP BAR (back link, agent name, badge, save status)
 *   LEFT SIDEBAR (4 tabs) + CANVAS + RIGHT DRAWER (NodeConfigPanel)
 *   FOOTER (FlowCostLatencyBar)
 *   STATUS BAR (node/edge counts, save status)
 *
 * Overlays: NodeContextMenu, EdgeConditionBuilder, NodeSearchDialog
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useReactFlow } from "@xyflow/react";
import {
  ArrowLeft,
  Save,
  CheckCircle,
  Play,
  Upload,
  Loader2,
  LayoutGrid,
  Variable,
  FileText,
  Component,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  FlowCanvas,
  FlowStudioProvider,
  useFlowStudio,
  NodeLibrary,
  NodeConfigPanel,
  NodeContextMenu,
  EdgeConditionBuilder,
  NodeSearchDialog,
  FlowExportImport,
  VariablesPanel,
  GlobalPromptPanel,
  FlowCostLatencyBar,
  GlobalHandlersPanel,
} from "@/components/FlowStudio";
import type { SidebarTab } from "@/components/FlowStudio";
import { BuilderSwitchButton } from "@/components/CommandCenter/BuilderSwitchButton";
import { SyncIndicator } from "@/components/CommandCenter/SyncIndicator";
import { UnifiedShortcutsPanel } from "@/components/CommandCenter/UnifiedShortcutsPanel";
import { useBuilderSync } from "@/hooks/useBuilderSync";
import "@xyflow/react/dist/style.css";

// ============================================================================
// Types
// ============================================================================

interface AgentData {
  agent: {
    id: string;
    name: string;
    config: Record<string, unknown>;
  };
}

interface FlowData {
  flow?: {
    nodes: unknown[];
    edges: unknown[];
    variables?: Record<string, string>;
    globalPrompt?: string;
    name?: string;
    description?: string;
    version?: string;
  };
}

// ============================================================================
// Inner component (uses context + useReactFlow)
// ============================================================================

interface FlowStudioInnerProps {
  agentName: string;
  initialFlow?: FlowData["flow"];
}

function FlowStudioInner({ agentName, initialFlow }: FlowStudioInnerProps) {
  const ctx = useFlowStudio();
  const { fitView } = useReactFlow();
  const loadedRef = useRef(false);

  // --------------- Load initial flow into context ---------------
  useEffect(() => {
    if (initialFlow && !loadedRef.current) {
      loadedRef.current = true;
      ctx.flowState.loadFlow({
        nodes: (initialFlow.nodes ?? []) as any,
        edges: (initialFlow.edges ?? []) as any,
        variables: initialFlow.variables ?? {},
        globalPrompt: initialFlow.globalPrompt ?? "",
        name: initialFlow.name ?? "",
        description: initialFlow.description ?? "",
      });
    }
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --------------- Sidebar tab (from context) ---------------
  const { sidebarTab, setSidebarTab } = ctx;

  // --------------- Global handlers from context (US-W12) ---------------
  const { globalHandlers, setGlobalHandlers } = ctx;

  // --------------- Builder Sync (US-W15/W16) ---------------
  const { triggerSync, syncState, isSyncing: isSyncingSyncHook } = useBuilderSync(ctx.agentId);

  // --------------- Unified Shortcuts Panel (US-W17) ---------------
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Cmd+/ to toggle shortcuts panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setShortcutsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // --------------- Node context menu handlers ---------------
  const handleConfigure = (nodeId: string) => {
    const node = ctx.flowState.nodes.find(n => n.id === nodeId);
    if (node) ctx.setSelectedNode(node);
    ctx.closeContextMenu();
  };

  const handleDuplicate = (nodeId: string) => {
    ctx.pushSnapshot();
    ctx.flowState.duplicateNode(nodeId);
    ctx.closeContextMenu();
  };

  const handleDeleteNode = (nodeId: string) => {
    ctx.pushSnapshot();
    ctx.flowState.removeNode(nodeId);
    ctx.closeContextMenu();
  };

  const handleCopyNode = (nodeId: string) => {
    const node = ctx.flowState.nodes.find(n => n.id === nodeId);
    if (node) {
      navigator.clipboard.writeText(JSON.stringify(node, null, 2));
    }
    ctx.closeContextMenu();
  };

  // --------------- Search select handler ---------------
  const handleSearchSelect = (nodeId: string) => {
    fitView({ nodes: [{ id: nodeId }] as any, padding: 0.5, duration: 300 });
    const node = ctx.flowState.nodes.find(n => n.id === nodeId);
    if (node) ctx.setSelectedNode(node);
    ctx.setSearchOpen(false);
  };

  // --------------- Flow export / import ---------------
  const handleExport = () => {
    return {
      nodes: ctx.flowState.nodes,
      edges: ctx.flowState.edges,
      variables: ctx.flowState.variables,
      globalPrompt: ctx.flowState.globalPrompt,
    };
  };

  const handleImport = (flow: any) => {
    ctx.pushSnapshot();
    if (flow.nodes) ctx.flowState.setNodes(flow.nodes);
    if (flow.edges) ctx.flowState.setEdges(flow.edges);
    if (flow.variables) ctx.flowState.setVariables(flow.variables);
    if (flow.globalPrompt) ctx.flowState.setGlobalPrompt(flow.globalPrompt);
  };

  // --------------- Flow validation (US-401) ---------------
  interface ValidationError {
    nodeId?: string;
    nodeName: string;
    issue: string;
  }

  const validateFlow = useCallback((): ValidationError[] => {
    const { nodes, edges } = ctx.flowState;
    const errors: ValidationError[] = [];

    if (nodes.length === 0) {
      errors.push({ nodeName: "Flow", issue: "Flow has no nodes" });
      return errors;
    }

    // 1. Orphan nodes: no incoming OR outgoing edges (excluding start node)
    for (const node of nodes) {
      if (node.type === "start") continue;
      // note nodes are decorative — skip them
      if (node.type === "note") continue;
      const hasIncoming = edges.some(e => e.target === node.id);
      const hasOutgoing = edges.some(e => e.source === node.id);
      if (!hasIncoming && !hasOutgoing) {
        const label = (node.data as Record<string, any>)?.label || node.type || node.id;
        errors.push({
          nodeId: node.id,
          nodeName: String(label),
          issue: "Orphan node — no incoming or outgoing connections",
        });
      }
    }

    // 2. Missing end condition: no terminal node (endCall) reachable
    const hasEndNode = nodes.some(n => n.type === "endCall");
    if (!hasEndNode) {
      errors.push({ nodeName: "Flow", issue: "No End Call node found — flow has no terminal state" });
    }

    // 3. Circular dependency detection (DFS cycle detection)
    const adjacency = new Map<string, string[]>();
    for (const edge of edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source)!.push(edge.target);
    }

    const visited = new Set<string>();
    const inStack = new Set<string>();
    let cycleFound = false;

    function dfs(nodeId: string): void {
      if (cycleFound) return;
      visited.add(nodeId);
      inStack.add(nodeId);
      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (inStack.has(neighbor)) {
          cycleFound = true;
          const neighborNode = nodes.find(n => n.id === neighbor);
          const label = (neighborNode?.data as Record<string, any>)?.label || neighbor;
          errors.push({
            nodeId: neighbor,
            nodeName: String(label),
            issue: "Circular dependency detected — flow may loop infinitely",
          });
          return;
        }
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        }
      }
      inStack.delete(nodeId);
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) dfs(node.id);
    }

    // 4. Required field checks per node type
    for (const node of nodes) {
      const data = (node.data ?? {}) as Record<string, any>;
      const label = data.label || node.type || node.id;

      switch (node.type) {
        case "message":
          if (!data.message?.trim()) {
            errors.push({ nodeId: node.id, nodeName: String(label), issue: "Message text is empty" });
          }
          break;
        case "question":
          if (!data.questionText?.trim()) {
            errors.push({ nodeId: node.id, nodeName: String(label), issue: "Question text is empty" });
          }
          if (!data.targetVariable?.trim()) {
            errors.push({ nodeId: node.id, nodeName: String(label), issue: "Target variable not set" });
          }
          break;
        case "capture":
          if (!data.variableName?.trim()) {
            errors.push({ nodeId: node.id, nodeName: String(label), issue: "Variable name is empty" });
          }
          break;
        case "apiCall":
          if (!data.url?.trim()) {
            errors.push({ nodeId: node.id, nodeName: String(label), issue: "API URL is empty" });
          }
          break;
        case "transfer":
          if (!data.destination?.trim()) {
            errors.push({ nodeId: node.id, nodeName: String(label), issue: "Transfer destination is empty" });
          }
          break;
        case "function":
          if (!data.functionName?.trim()) {
            errors.push({ nodeId: node.id, nodeName: String(label), issue: "Function name is empty" });
          }
          break;
        case "goTo":
          if (!data.targetNodeId?.trim()) {
            errors.push({ nodeId: node.id, nodeName: String(label), issue: "Go To target node not set" });
          }
          break;
      }
    }

    // 5. Start node must have at least one outgoing edge
    const startNode = nodes.find(n => n.type === "start");
    if (startNode) {
      const hasOutgoing = edges.some(e => e.source === startNode.id);
      if (!hasOutgoing) {
        errors.push({ nodeId: startNode.id, nodeName: "Start", issue: "Start node has no outgoing connection" });
      }
    } else {
      errors.push({ nodeName: "Flow", issue: "No Start node found" });
    }

    return errors;
  }, [ctx.flowState]);

  const handleValidate = useCallback(() => {
    const errors = validateFlow();
    if (errors.length === 0) {
      toast.success("Flow is valid", {
        description: `${ctx.flowState.nodes.length} nodes, ${ctx.flowState.edges.length} edges — no issues found.`,
        icon: <CheckCircle className="h-4 w-4 text-emerald-400" />,
      });
    } else {
      toast.error(`Validation failed — ${errors.length} issue${errors.length !== 1 ? "s" : ""} found`, {
        description: (
          <ul className="mt-1 space-y-0.5 text-xs">
            {errors.slice(0, 5).map((err, i) => (
              <li key={i} className="flex items-start gap-1">
                <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-red-400" />
                <span><strong>{err.nodeName}:</strong> {err.issue}</span>
              </li>
            ))}
            {errors.length > 5 && (
              <li className="text-[hsl(var(--text-muted))]">...and {errors.length - 5} more</li>
            )}
          </ul>
        ),
        duration: 8000,
      });
    }
    return errors;
  }, [validateFlow, ctx.flowState.nodes.length, ctx.flowState.edges.length]);

  const handlePublish = useCallback(() => {
    const errors = validateFlow();
    if (errors.length > 0) {
      toast.error("Cannot publish — fix validation errors first", {
        description: `${errors.length} issue${errors.length !== 1 ? "s" : ""} found. Click Validate for details.`,
      });
      return;
    }
    // TODO: implement actual publish logic
    toast.success("Flow published successfully");
  }, [validateFlow]);

  // --------------- Save status label + icon ---------------
  const saveLabel =
    ctx.saveStatus === "saving"
      ? "Saving..."
      : ctx.saveStatus === "saved"
        ? "Saved"
        : ctx.saveStatus === "error"
          ? "Save failed"
          : ctx.flowState.isDirty
            ? "Unsaved"
            : "Saved";

  const saveIcon =
    ctx.saveStatus === "saving" ? (
      <Loader2 className="h-3 w-3 animate-spin" />
    ) : ctx.saveStatus === "saved" ? (
      <CheckCircle className="h-3 w-3 text-emerald-400" />
    ) : ctx.saveStatus === "error" ? (
      <X className="h-3 w-3 text-red-400" />
    ) : ctx.flowState.isDirty ? (
      <Save className="h-3 w-3 text-amber-400" />
    ) : (
      <CheckCircle className="h-3 w-3 text-emerald-400" />
    );

  // --------------- Edge condition builder data ---------------
  const selectedEdgeData = ctx.selectedEdge
    ? ctx.flowState.edges.find(e => e.id === ctx.selectedEdge?.id)
    : null;

  // --------------- Sidebar tab definitions ---------------
  const sidebarTabs: { key: SidebarTab; icon: typeof LayoutGrid; label: string }[] = [
    { key: "nodes", icon: LayoutGrid, label: "Nodes" },
    { key: "variables", icon: Variable, label: "Vars" },
    { key: "prompt", icon: FileText, label: "Prompt" },
    { key: "components", icon: Component, label: "Comps" },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <TooltipProvider>
      <div className="h-screen bg-[hsl(var(--void))] flex flex-col overflow-hidden">
        {/* ================================================================== */}
        {/* TOP BAR                                                            */}
        {/* ================================================================== */}
        <div className="h-12 border-b border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-3">
            <BuilderSwitchButton
              agentId={ctx.agentId}
              currentBuilder="flow-studio"
              onSyncBeforeSwitch={async () => {
                ctx.saveNow();
                triggerSync("flow-to-config");
              }}
              className="text-xs"
            />
            <div className="h-4 w-px bg-[hsl(var(--border))]" />
            <span className="text-sm font-medium text-[hsl(var(--text-high))]">{agentName}</span>
            <Badge
              variant="outline"
              className="text-xs text-[hsl(var(--primary))] border-[hsl(var(--primary))]/30"
            >
              Flow Studio
            </Badge>
            <div className="flex items-center gap-1.5 ml-2">
              {saveIcon}
              <span className="text-xs text-[hsl(var(--text-subtle))]">{saveLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <FlowExportImport onExport={handleExport} onImport={handleImport} />
            <div className="h-4 w-px bg-[hsl(var(--border))]" />
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => ctx.saveNow()}>
              <Save className="h-3.5 w-3.5 me-1" />
              Save
            </Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleValidate}>
              <CheckCircle className="h-3.5 w-3.5 me-1" />
              Validate
            </Button>
            <Button variant="ghost" size="sm" className="text-xs">
              <Play className="h-3.5 w-3.5 me-1" />
              Test
            </Button>
            <Button
              size="sm"
              className="text-xs bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
              onClick={handlePublish}
            >
              <Upload className="h-3.5 w-3.5 me-1" />
              Publish
            </Button>
          </div>
        </div>

        {/* ================================================================== */}
        {/* MAIN CONTENT: sidebar + canvas + right panel                       */}
        {/* ================================================================== */}
        <div className="flex-1 flex overflow-hidden">
          {/* ============================================================== */}
          {/* LEFT SIDEBAR                                                    */}
          {/* ============================================================== */}
          <div className="w-60 border-e border-[hsl(var(--border))] bg-[hsl(var(--surface))] shrink-0 flex flex-col overflow-hidden">
            {/* Tab selector */}
            <div className="flex border-b border-[hsl(var(--border))] shrink-0">
              {sidebarTabs.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => setSidebarTab(key)}
                  className={cn(
                    "flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors",
                    sidebarTab === key
                      ? "text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]"
                      : "text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-high))]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {sidebarTab === "nodes" && <NodeLibrary />}
              {sidebarTab === "variables" && (
                <VariablesPanel
                  variables={ctx.flowState.variables}
                  onChange={ctx.flowState.setVariables}
                />
              )}
              {sidebarTab === "prompt" && (
                <GlobalPromptPanel
                  prompt={ctx.flowState.globalPrompt}
                  onChange={ctx.flowState.setGlobalPrompt}
                />
              )}
              {sidebarTab === "components" && (
                <div className="p-4 text-center text-xs text-[hsl(var(--text-subtle))]">
                  <Component className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p>Reusable components</p>
                  <p className="mt-1 text-xs">
                    Save node groups as components to reuse across flows.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ============================================================== */}
          {/* CANVAS AREA                                                     */}
          {/* ============================================================== */}
          <div className="flex-1 relative flex flex-col">
            <div className="flex-1 relative">
              <FlowCanvas
                onNodeClick={(_event, node) => {
                  ctx.setSelectedNode(node as any);
                  ctx.setSelectedEdge(null);
                }}
                onNodeContextMenu={(event, node) => {
                  event.preventDefault();
                  ctx.setContextMenu({
                    type: "node",
                    x: event.clientX,
                    y: event.clientY,
                    nodeId: node.id,
                  });
                }}
                onEdgeClick={(_event, edge) => {
                  ctx.setSelectedEdge(edge as any);
                  ctx.setSelectedNode(null);
                }}
                onPaneClick={() => {
                  ctx.setSelectedNode(null);
                  ctx.setSelectedEdge(null);
                  ctx.closeContextMenu();
                }}
              />

              {/* -------------------------------------------------------- */}
              {/* Right drawer: NodeConfigPanel                             */}
              {/* -------------------------------------------------------- */}
              {ctx.selectedNode && (
                <div className="absolute top-0 right-0 bottom-0 w-80 border-s border-[hsl(var(--border))] bg-[hsl(var(--surface))] overflow-y-auto z-10">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-[hsl(var(--border))]">
                    <span className="text-xs font-medium text-[hsl(var(--text-high))]">
                      Configure Node
                    </span>
                    <button
                      onClick={() => ctx.setSelectedNode(null)}
                      className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-high))]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <NodeConfigPanel
                    node={ctx.selectedNode as any}
                    onUpdate={(nodeId: string, data: Record<string, any>) => {
                      ctx.pushSnapshot();
                      ctx.flowState.updateNodeData(nodeId, data);
                    }}
                    onClose={() => ctx.setSelectedNode(null)}
                  />
                </div>
              )}
            </div>

            {/* ---------------------------------------------------------- */}
            {/* FOOTER: FlowCostLatencyBar                                  */}
            {/* ---------------------------------------------------------- */}
            <div className="shrink-0 border-t border-[hsl(var(--border))]">
              <FlowCostLatencyBar
                nodes={ctx.flowState.nodes.map(n => ({
                  id: n.id,
                  type: n.type || "unknown",
                  data: (n.data || {}) as Record<string, any>,
                }))}
              />
            </div>
          </div>
        </div>

        {/* ================================================================== */}
        {/* STATUS BAR                                                         */}
        {/* ================================================================== */}
        <div className="h-6 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface))] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-xs text-[hsl(var(--text-subtle))]">
              {ctx.flowState.nodes.length} node{ctx.flowState.nodes.length !== 1 ? "s" : ""}
            </span>
            <span className="text-xs text-[hsl(var(--text-subtle))]">
              {ctx.flowState.edges.length} edge{ctx.flowState.edges.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SyncIndicator
              syncState={syncState}
              onSyncNow={() => triggerSync("bidirectional")}
              isSyncing={isSyncingSyncHook}
            />
            <div className="h-3 w-px bg-[hsl(var(--border))]" />
            {saveIcon}
            <span className="text-xs text-[hsl(var(--text-subtle))]">{saveLabel}</span>
          </div>
        </div>

        {/* ================================================================== */}
        {/* OVERLAYS                                                           */}
        {/* ================================================================== */}

        {/* Node context menu */}
        {ctx.contextMenu.type === "node" && ctx.contextMenu.nodeId && (
          <NodeContextMenu
            nodeId={ctx.contextMenu.nodeId}
            position={{ x: ctx.contextMenu.x, y: ctx.contextMenu.y }}
            onDuplicate={handleDuplicate}
            onDelete={handleDeleteNode}
            onCopy={handleCopyNode}
            onConfigure={handleConfigure}
            onClose={ctx.closeContextMenu}
          />
        )}

        {/* Edge condition builder (centered when edge is selected) */}
        {selectedEdgeData && ctx.selectedEdge && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl shadow-2xl p-4 min-w-[400px] max-w-[600px]">
              <EdgeConditionBuilder
                conditions={(selectedEdgeData.data as any)?.conditions ?? []}
                onChange={(conditions: any[]) => {
                  ctx.pushSnapshot();
                  ctx.flowState.updateEdge(ctx.selectedEdge!.id, {
                    data: { ...(selectedEdgeData.data as any), conditions },
                  } as any);
                }}
                onClose={() => {
                  ctx.setSelectedEdge(null);
                }}
              />
            </div>
          </div>
        )}

        {/* Node search dialog (Cmd+F) */}
        <NodeSearchDialog
          open={ctx.searchOpen}
          onOpenChange={ctx.setSearchOpen}
          nodes={ctx.flowState.nodes.map(n => ({
            id: n.id,
            type: n.type || "unknown",
            data: (n.data || {}) as Record<string, any>,
          }))}
          onSelect={handleSearchSelect}
        />

        {/* Global handlers panel (US-W12) */}
        <GlobalHandlersPanel
          open={ctx.globalHandlersOpen}
          onClose={() => ctx.setGlobalHandlersOpen(false)}
          handlers={globalHandlers}
          onHandlersChange={setGlobalHandlers}
        />

        {/* Unified Shortcuts Panel (US-W17) */}
        <UnifiedShortcutsPanel
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
          currentBuilder="flow-studio"
        />
      </div>
    </TooltipProvider>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function FlowStudioPage() {
  const { agentId } = useParams<{ agentId: string }>();

  // Fetch agent data
  const {
    data: agentData,
    isLoading: agentLoading,
    error: agentError,
  } = useQuery<AgentData>({
    queryKey: queryKeys.agents.config(agentId!),
    queryFn: () => apiClient.get(`/api/agents/${agentId}/builder`),
    enabled: !!agentId,
  });

  // Fetch flow data
  const { data: flowData, isLoading: flowLoading } = useQuery<FlowData>({
    queryKey: queryKeys.flow.detail(agentId!),
    queryFn: () => apiClient.get(`/api/agents/${agentId}/flow`),
    enabled: !!agentId,
  });

  const isLoading = agentLoading || flowLoading;

  // --------------- Loading ---------------
  if (isLoading) {
    return (
      <div className="h-screen bg-[hsl(var(--void))] flex items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex items-center gap-2 mt-8">
            <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--primary))]" />
            <span className="text-sm text-[hsl(var(--text-muted))]">Loading Flow Studio...</span>
          </div>
        </div>
      </div>
    );
  }

  // --------------- Error ---------------
  if (agentError || !agentData) {
    return (
      <div className="h-screen bg-[hsl(var(--void))] flex items-center justify-center">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-[hsl(var(--text-high))]">Agent Not Found</h2>
          <p className="text-[hsl(var(--text-muted))]">
            The agent you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
          </p>
          <Link to="/agents">
            <Button variant="outline">
              <ArrowLeft className="h-3.5 w-3.5 me-1" />
              Back to Agents
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // --------------- Main ---------------
  return (
    <FlowStudioProvider agentId={agentId!} initialFlow={flowData?.flow as any}>
      <FlowStudioInner
        agentName={agentData?.agent?.name || "Untitled Agent"}
        initialFlow={flowData?.flow as any}
      />
    </FlowStudioProvider>
  );
}
