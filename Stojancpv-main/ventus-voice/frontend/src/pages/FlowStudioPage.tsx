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
  ChevronRight,
  Circle,
  XCircle,
  Clock,
  RotateCcw,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { ComponentLibrarySidebar } from "@/components/FlowStudio/ComponentLibrarySidebar";
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

  const [isPublishing, setIsPublishing] = useState(false);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const handlePublish = useCallback(async () => {
    const errors = validateFlow();
    if (errors.length > 0) {
      toast.error("Cannot publish — fix validation errors first", {
        description: `${errors.length} issue${errors.length !== 1 ? "s" : ""} found. Click Validate for details.`,
      });
      return;
    }

    setIsPublishing(true);
    try {
      // Save first to ensure latest changes are persisted
      ctx.saveNow();

      const result = await apiClient.post<{ success: boolean; publishedAt: string }>(
        `/api/agents/${ctx.agentId}/flow/publish`
      );

      setPublishedAt(result.publishedAt);
      toast.success("Flow published successfully", {
        description: `Published at ${new Date(result.publishedAt).toLocaleTimeString()}`,
        icon: <CheckCircle className="h-4 w-4 text-emerald-400" />,
      });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to publish flow";
      toast.error("Publish failed", { description: errorMessage });
    } finally {
      setIsPublishing(false);
    }
  }, [validateFlow, ctx]);

  // --------------- Flow Test Simulation (US-402) ---------------
  const [testPanelOpen, setTestPanelOpen] = useState(false);
  const [testInput, setTestInput] = useState("");
  const [testRunning, setTestRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestStepResult[]>([]);
  const [testError, setTestError] = useState<string | null>(null);
  const [testVariables, setTestVariables] = useState<Record<string, string>>({});
  const testAbortRef = useRef(false);

  interface TestStepResult {
    nodeId: string;
    nodeLabel: string;
    nodeType: string;
    action: string;
    variables?: Record<string, string>;
    branch?: string;
    output?: string;
    status: "visited" | "skipped" | "error";
  }

  const evaluateCondition = useCallback(
    (field: string | undefined, operator: string, value: string | undefined, vars: Record<string, string>): boolean => {
      const fieldValue = field ? (vars[field] ?? "") : "";
      const cmpValue = value ?? "";
      switch (operator) {
        case "equals": return fieldValue === cmpValue;
        case "notEquals": return fieldValue !== cmpValue;
        case "contains": return fieldValue.includes(cmpValue);
        case "notContains": return !fieldValue.includes(cmpValue);
        case "greaterThan": return Number(fieldValue) > Number(cmpValue);
        case "lessThan": return Number(fieldValue) < Number(cmpValue);
        case "isEmpty": return fieldValue.trim() === "";
        case "isNotEmpty": return fieldValue.trim() !== "";
        case "matches": try { return new RegExp(cmpValue).test(fieldValue); } catch { return false; }
        default: return false;
      }
    },
    []
  );

  const resolveNextNode = useCallback(
    (currentNodeId: string, nodes: any[], edges: any[], vars: Record<string, string>): string | null => {
      const outEdges = edges
        .filter((e: any) => e.source === currentNodeId)
        .sort((a: any, b: any) => (b.priority ?? 0) - (a.priority ?? 0));

      for (const edge of outEdges) {
        const conditions: any[] = edge.conditions ?? edge.data?.conditions ?? [];
        if (conditions.length === 0) return edge.target;
        const allMatch = conditions.every((c: any) =>
          evaluateCondition(c.field, c.operator, c.value, vars)
        );
        if (allMatch) return edge.target;
      }

      // Fallback: pick first unconditional edge
      const fallback = outEdges.find((e: any) => {
        const conds: any[] = e.conditions ?? e.data?.conditions ?? [];
        return conds.length === 0;
      });
      return fallback?.target ?? null;
    },
    [evaluateCondition]
  );

  const simulateFlow = useCallback(
    async (userInput: string) => {
      const { nodes, edges, variables: flowVars } = ctx.flowState;
      const vars: Record<string, string> = { ...flowVars, __user_input__: userInput };
      const steps: TestStepResult[] = [];
      const visitCount = new Map<string, number>();

      const startNode = nodes.find(n => n.type === "start");
      if (!startNode) {
        setTestError("No Start node found in flow");
        return;
      }

      let currentNodeId: string | null = startNode.id;
      const startTime = Date.now();
      const TIMEOUT_MS = 30_000;
      const MAX_VISITS_PER_NODE = 50;

      while (currentNodeId && !testAbortRef.current) {
        // Timeout check
        if (Date.now() - startTime > TIMEOUT_MS) {
          setTestError(`Execution timed out after 30 seconds. Possible infinite loop.`);
          break;
        }

        const node = nodes.find(n => n.id === currentNodeId);
        if (!node) {
          setTestError(`Node ${currentNodeId} not found`);
          break;
        }

        // Loop detection
        const visits = (visitCount.get(node.id) ?? 0) + 1;
        visitCount.set(node.id, visits);
        if (visits > MAX_VISITS_PER_NODE) {
          steps.push({
            nodeId: node.id,
            nodeLabel: String((node.data as any)?.label || node.type || node.id),
            nodeType: node.type || "unknown",
            action: `Infinite loop detected (visited ${visits} times)`,
            variables: { ...vars },
            status: "error",
          });
          setTestError(`Infinite loop detected at node "${(node.data as any)?.label || node.id}" (visited ${visits} times)`);
          break;
        }

        const data = (node.data ?? {}) as Record<string, any>;
        const label = String(data.label || node.type || node.id);
        let action = "";
        let branch: string | undefined;
        let output: string | undefined;
        let status: TestStepResult["status"] = "visited";

        try {
          switch (node.type) {
            case "start":
              action = "Flow started";
              break;

            case "endCall":
              action = `Flow ended${data.reason ? `: ${data.reason}` : ""}`;
              steps.push({ nodeId: node.id, nodeLabel: label, nodeType: node.type, action, variables: { ...vars }, status: "visited" });
              setTestResults([...steps]);
              setTestVariables({ ...vars });
              return; // Execution complete

            case "message":
              action = `Speak: "${data.message || "(empty)"}"`;
              output = data.message;
              break;

            case "question":
              action = `Ask: "${data.questionText || "(empty)"}"`;
              if (data.targetVariable) {
                vars[data.targetVariable] = userInput;
                action += ` → stored "${userInput}" in $${data.targetVariable}`;
              }
              break;

            case "capture":
              if (data.variableName) {
                vars[data.variableName] = userInput;
                action = `Captured input into $${data.variableName} = "${userInput}"`;
              } else {
                action = "Capture node (no variable set)";
              }
              break;

            case "setVariable":
              if (Array.isArray(data.assignments)) {
                for (const assignment of data.assignments) {
                  if (assignment.variable) {
                    const val = assignment.source === "variable"
                      ? (vars[assignment.value] ?? "")
                      : (assignment.value ?? "");
                    vars[assignment.variable] = val;
                  }
                }
                action = `Set ${data.assignments.length} variable(s)`;
              } else {
                action = "Set variable (no assignments)";
              }
              break;

            case "condition": {
              const rules: any[] = data.conditions ?? [];
              const matchedRule = rules.find((r: any) =>
                evaluateCondition(r.variable, r.operator, r.value, vars)
              );
              if (matchedRule) {
                branch = `Matched: ${matchedRule.label || matchedRule.variable}`;
                action = `Condition evaluated → ${branch}`;
              } else {
                branch = "No match (default path)";
                action = `Condition evaluated → ${branch}`;
              }
              break;
            }

            case "router": {
              const outEdges = edges.filter(e => e.source === node.id);
              let matchedEdge: any = null;
              for (const edge of outEdges) {
                const conds: any[] = edge.conditions ?? (edge.data as any)?.conditions ?? [];
                if (conds.length > 0 && conds.every((c: any) => evaluateCondition(c.field, c.operator, c.value, vars))) {
                  matchedEdge = edge;
                  break;
                }
              }
              branch = matchedEdge
                ? `Routed via edge ${matchedEdge.label || matchedEdge.id}`
                : "Default route";
              action = `Router → ${branch}`;
              break;
            }

            case "menu":
              action = `Menu: "${data.introMessage || "(no intro)"}" with ${(data.options ?? []).length} options`;
              break;

            case "confirm":
              action = `Confirm: "${data.confirmPrompt || "(empty)"}"`;
              break;

            case "wait":
              action = `Wait ${data.timeout ?? 10}s`;
              if (data.storeUtteranceIn) {
                vars[data.storeUtteranceIn] = userInput;
                action += ` → stored input in $${data.storeUtteranceIn}`;
              }
              break;

            case "delay":
              action = `Delay ${data.duration ?? 1000}ms`;
              break;

            case "apiCall":
              action = `API ${data.method || "GET"} ${data.url || "(no URL)"}`;
              if (Array.isArray(data.responseMapping)) {
                for (const mapping of data.responseMapping) {
                  if (mapping.variable) vars[mapping.variable] = "(simulated API response)";
                }
              }
              output = "(simulated response)";
              break;

            case "function":
              action = `Function: ${data.functionName || "(unnamed)"}`;
              if (data.outputVariable) vars[data.outputVariable] = "(simulated result)";
              output = "(simulated result)";
              break;

            case "transfer":
              action = `Transfer (${data.transferType || "cold"}) to ${data.destination || "(no destination)"}`;
              break;

            case "hold":
              action = `Hold — music: ${data.holdMusic || "default"}, max ${data.maxDuration ?? 300}s`;
              break;

            case "voicemail":
              action = `Voicemail — max ${data.maxDuration ?? 120}s`;
              break;

            case "dtmf":
              action = `DTMF — max ${data.maxDigits ?? 1} digits`;
              break;

            case "log":
              action = `Log [${data.level || "info"}]: ${data.message || "(empty)"}`;
              break;

            case "goTo":
              if (data.targetNodeId) {
                action = `Go To → ${data.targetNodeLabel || data.targetNodeId}`;
                steps.push({ nodeId: node.id, nodeLabel: label, nodeType: node.type || "unknown", action, variables: { ...vars }, branch, status: "visited" });
                currentNodeId = data.targetNodeId;
                setTestResults([...steps]);
                continue;
              }
              action = "Go To (no target set)";
              status = "error";
              break;

            case "knowledgeSearch":
              action = `KB Search: "${data.querySource || userInput}" → top ${data.resultCount ?? 3} results`;
              if (data.resultVariable) vars[data.resultVariable] = "(simulated KB result)";
              break;

            case "tool":
            case "mcpTool":
              action = `Tool: ${data.toolName || data.serverName || "(unnamed)"}`;
              break;

            case "asyncTask":
              action = `Async Task: ${data.taskType || "apiCall"}`;
              if (data.callbackVariable) vars[data.callbackVariable] = "(pending)";
              break;

            case "agent":
              action = `Sub-agent: ${data.agentName || data.agentId || "(unnamed)"}`;
              break;

            case "choice": {
              const intents: any[] = data.intents ?? [];
              action = `Choice: ${intents.length} intents (threshold ${data.confidenceThreshold ?? 70}%)`;
              branch = intents.length > 0 ? `Simulated: ${intents[0].name}` : "No intents defined";
              break;
            }

            case "abTest": {
              const variants: any[] = data.variants ?? [];
              if (variants.length > 0) {
                const picked = variants[0];
                action = `A/B Test "${data.testName || ""}" → Variant: ${picked.name}`;
                branch = picked.name;
                if (picked.targetNodeId) {
                  steps.push({ nodeId: node.id, nodeLabel: label, nodeType: node.type || "unknown", action, variables: { ...vars }, branch, status: "visited" });
                  currentNodeId = picked.targetNodeId;
                  setTestResults([...steps]);
                  continue;
                }
              } else {
                action = `A/B Test (no variants)`;
              }
              break;
            }

            case "loop":
              action = `Loop (${data.loopType || "fixed"}) — max ${data.maxIterations ?? 10} iterations`;
              break;

            case "component":
              action = `Component: ${data.componentId || "(unnamed)"} v${data.version || "latest"}`;
              break;

            case "note":
              // Notes are decorative, skip
              action = "Note (decorative — skipped)";
              status = "skipped";
              break;

            default:
              action = `Unknown node type: ${node.type}`;
              break;
          }
        } catch (err) {
          action = `Error executing node: ${err instanceof Error ? err.message : String(err)}`;
          status = "error";
        }

        steps.push({
          nodeId: node.id,
          nodeLabel: label,
          nodeType: node.type || "unknown",
          action,
          variables: { ...vars },
          branch,
          output,
          status,
        });
        setTestResults([...steps]);

        // Resolve next node
        if (node.type === "note") {
          // Notes have no outgoing connections in the flow path
          currentNodeId = resolveNextNode(node.id, nodes, edges, vars);
          if (!currentNodeId) {
            // If note is orphan, break
            break;
          }
        } else {
          currentNodeId = resolveNextNode(node.id, nodes, edges, vars);
        }

        if (!currentNodeId) {
          steps.push({
            nodeId: "flow-end",
            nodeLabel: "Flow",
            nodeType: "end",
            action: "Flow ended — no more connected nodes",
            variables: { ...vars },
            status: "visited",
          });
          setTestResults([...steps]);
          break;
        }

        // Yield to UI for rendering
        await new Promise(r => setTimeout(r, 50));
      }

      setTestVariables({ ...vars });
    },
    [ctx.flowState, evaluateCondition, resolveNextNode]
  );

  const handleTest = useCallback(() => {
    // Run validation first (US-401 pre-check)
    const errors = validateFlow();
    if (errors.length > 0) {
      toast.error("Cannot test — fix validation errors first", {
        description: `${errors.length} issue${errors.length !== 1 ? "s" : ""} found. Click Validate for details.`,
      });
      return;
    }
    setTestPanelOpen(true);
  }, [validateFlow]);

  const handleRunTest = useCallback(async () => {
    testAbortRef.current = false;
    setTestRunning(true);
    setTestResults([]);
    setTestError(null);
    setTestVariables({});

    try {
      await simulateFlow(testInput);
    } catch (err) {
      setTestError(err instanceof Error ? err.message : String(err));
    } finally {
      setTestRunning(false);
    }
  }, [testInput, simulateFlow]);

  const handleStopTest = useCallback(() => {
    testAbortRef.current = true;
  }, []);

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
            {publishedAt ? (
              <Badge
                variant="outline"
                className="text-xs text-emerald-400 border-emerald-400/30 bg-emerald-400/10 ml-2"
              >
                Published
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-xs text-amber-400 border-amber-400/30 bg-amber-400/10 ml-2"
              >
                Draft
              </Badge>
            )}
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
            <Button variant="ghost" size="sm" className="text-xs" onClick={handleTest}>
              <Play className="h-3.5 w-3.5 me-1" />
              Test
            </Button>
            <Button
              size="sm"
              className="text-xs bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
              onClick={handlePublish}
              disabled={isPublishing}
            >
              {isPublishing ? (
                <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5 me-1" />
              )}
              {isPublishing ? "Publishing..." : "Publish"}
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
                <ComponentLibrarySidebar />
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

        {/* ================================================================== */}
        {/* FLOW TEST PANEL (US-402)                                            */}
        {/* ================================================================== */}
        {testPanelOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-[hsl(var(--surface))] border border-[hsl(var(--border))] rounded-xl shadow-2xl flex flex-col w-[680px] max-h-[80vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
                <div className="flex items-center gap-2">
                  <Play className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <span className="text-sm font-semibold text-[hsl(var(--text-high))]">Flow Test Runner</span>
                  {testRunning && (
                    <Badge variant="outline" className="text-xs animate-pulse">
                      Running...
                    </Badge>
                  )}
                </div>
                <button
                  onClick={() => {
                    testAbortRef.current = true;
                    setTestPanelOpen(false);
                  }}
                  className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-high))]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Input area */}
              <div className="px-4 py-3 border-b border-[hsl(var(--border))] shrink-0">
                <label className="text-xs font-medium text-[hsl(var(--text-muted))] mb-1.5 block">
                  Test User Message
                </label>
                <div className="flex gap-2">
                  <Input
                    value={testInput}
                    onChange={e => setTestInput(e.target.value)}
                    placeholder="Enter a sample user message..."
                    className="flex-1 text-sm"
                    onKeyDown={e => {
                      if (e.key === "Enter" && !testRunning) handleRunTest();
                    }}
                    disabled={testRunning}
                  />
                  {testRunning ? (
                    <Button size="sm" variant="destructive" onClick={handleStopTest} className="text-xs">
                      <XCircle className="h-3.5 w-3.5 me-1" />
                      Stop
                    </Button>
                  ) : (
                    <Button size="sm" onClick={handleRunTest} className="text-xs bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]">
                      <Play className="h-3.5 w-3.5 me-1" />
                      Run Test
                    </Button>
                  )}
                  {testResults.length > 0 && !testRunning && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => { setTestResults([]); setTestError(null); setTestVariables({}); }}
                      className="text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5 me-1" />
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Results area */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {testResults.length === 0 && !testError && (
                  <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--text-subtle))]">
                    <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
                    <p className="text-sm">Enter a test message and click Run Test</p>
                    <p className="text-xs mt-1">The flow will be simulated step by step</p>
                  </div>
                )}

                {testResults.length > 0 && (
                  <div className="px-4 py-3 space-y-1">
                    {testResults.map((step, i) => (
                      <div
                        key={`${step.nodeId}-${i}`}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-lg text-xs transition-colors",
                          step.status === "error"
                            ? "bg-red-500/10 border border-red-500/20"
                            : step.status === "skipped"
                              ? "bg-[hsl(var(--surface-2))]/50 opacity-60"
                              : "bg-[hsl(var(--surface-2))]/50"
                        )}
                      >
                        {/* Step number */}
                        <span className="shrink-0 w-5 h-5 rounded-full bg-[hsl(var(--primary))]/20 text-[hsl(var(--primary))] flex items-center justify-center text-[10px] font-medium mt-0.5">
                          {i + 1}
                        </span>

                        <div className="flex-1 min-w-0">
                          {/* Node info */}
                          <div className="flex items-center gap-1.5">
                            {step.status === "error" ? (
                              <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                            ) : step.status === "skipped" ? (
                              <Circle className="h-3 w-3 text-[hsl(var(--text-subtle))] shrink-0" />
                            ) : (
                              <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0" />
                            )}
                            <span className="font-medium text-[hsl(var(--text-high))]">{step.nodeLabel}</span>
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              {step.nodeType}
                            </Badge>
                            {step.branch && (
                              <span className="flex items-center gap-0.5 text-[hsl(var(--primary))]">
                                <ChevronRight className="h-2.5 w-2.5" />
                                {step.branch}
                              </span>
                            )}
                          </div>

                          {/* Action description */}
                          <p className="mt-0.5 text-[hsl(var(--text-muted))]">{step.action}</p>

                          {/* Output */}
                          {step.output && (
                            <div className="mt-1 px-2 py-1 rounded bg-[hsl(var(--void))] text-[hsl(var(--text-high))] font-mono text-[11px] border border-[hsl(var(--border))]">
                              {step.output}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Error display */}
                {testError && (
                  <div className="mx-4 mb-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                      <span className="text-xs font-medium text-red-400">Execution Error</span>
                    </div>
                    <p className="text-xs text-red-300 mt-1">{testError}</p>
                  </div>
                )}
              </div>

              {/* Footer: variable state */}
              {Object.keys(testVariables).length > 0 && (
                <div className="border-t border-[hsl(var(--border))] px-4 py-2 shrink-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Variable className="h-3 w-3 text-[hsl(var(--text-subtle))]" />
                    <span className="text-[10px] font-medium text-[hsl(var(--text-muted))] uppercase tracking-wider">
                      Variables at end
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(testVariables)
                      .filter(([key]) => key !== "__user_input__")
                      .map(([key, val]) => (
                        <span
                          key={key}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[hsl(var(--primary))]/10 text-[10px] font-mono"
                        >
                          <span className="text-[hsl(var(--primary))]">${key}</span>
                          <span className="text-[hsl(var(--text-muted))]">=</span>
                          <span className="text-[hsl(var(--text-high))] max-w-[120px] truncate">{val}</span>
                        </span>
                      ))}
                  </div>
                </div>
              )}

              {/* Summary footer */}
              {testResults.length > 0 && !testRunning && (
                <div className="border-t border-[hsl(var(--border))] px-4 py-2 flex items-center justify-between text-xs text-[hsl(var(--text-subtle))] shrink-0">
                  <div className="flex items-center gap-3">
                    <span>{testResults.filter(s => s.status === "visited").length} nodes visited</span>
                    <span>{testResults.filter(s => s.status === "error").length} errors</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{testResults.length} steps total</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
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
