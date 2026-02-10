/**
 * FlowCanvas
 * Main React Flow canvas component with node/edge handling, mini-map, and toolbar.
 * Reads flow state from FlowStudioContext (no internal state).
 * Accepts callback props from FlowStudioPage for node/edge/pane interactions.
 */

import { useCallback, useRef, useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  MiniMap,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Node,
  type Edge,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge as rfAddEdge,
  useReactFlow,
  useViewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Package } from "lucide-react";

import { nodeTypes } from "./nodes";
import { edgeTypes } from "./edges";
import { CanvasToolbar } from "./CanvasToolbar";
import {
  ComponentCreateModal,
  type ExitPath,
  type ComponentCreateData,
} from "./ComponentCreateModal";
import { useFlowStudio } from "./FlowStudioContext";
import { GlobalHandlerBadge } from "./GlobalHandlerBadge";

// ============================================================================
// Types
// ============================================================================

interface FlowCanvasProps {
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onNodeContextMenu?: (event: React.MouseEvent, node: Node) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  onEdgeContextMenu?: (event: React.MouseEvent, edge: Edge) => void;
  onPaneClick?: (event: React.MouseEvent) => void;
}

// ============================================================================
// Canvas Component (reads state from FlowStudioContext)
// ============================================================================

export function FlowCanvas({
  onNodeClick,
  onNodeContextMenu,
  onEdgeClick,
  onEdgeContextMenu,
  onPaneClick,
}: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const {
    flowState,
    canUndo,
    canRedo,
    undo,
    redo,
    globalHandlersOpen,
    setGlobalHandlersOpen,
    globalHandlers,
    handleDeleteSelected,
  } = useFlowStudio();
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const viewport = useViewport();

  // --------------------------------------------------------------------------
  // Global handler badge targets — compute which nodes are handler targets
  // --------------------------------------------------------------------------
  const handlerTargetMap = useMemo(() => {
    const map = new Map<string, Array<{ name: string; triggerPhrases: string[] }>>();
    for (const handler of globalHandlers) {
      if (!handler.enabled || !handler.targetNodeId) continue;
      const existing = map.get(handler.targetNodeId) || [];
      existing.push({ name: handler.name, triggerPhrases: handler.triggerPhrases });
      map.set(handler.targetNodeId, existing);
    }
    return map;
  }, [globalHandlers]);

  // --------------------------------------------------------------------------
  // Selection context menu + Component modal state (US-425a)
  // --------------------------------------------------------------------------

  const [locked, setLocked] = useState(false);
  const [selectionContextMenu, setSelectionContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [showComponentModal, setShowComponentModal] = useState(false);

  // ============================================================================
  // React Flow Event Handlers
  // ============================================================================

  const onNodesChange: OnNodesChange = useCallback(
    changes => {
      flowState.setNodes(nds => applyNodeChanges(changes, nds as Node[]) as any);
    },
    [flowState]
  );

  const onEdgesChange: OnEdgesChange = useCallback(
    changes => {
      flowState.setEdges(eds => applyEdgeChanges(changes, eds as Edge[]) as any);
    },
    [flowState]
  );

  const onConnect: OnConnect = useCallback(
    connection => {
      flowState.setEdges(
        eds =>
          rfAddEdge(
            {
              ...connection,
              type: "default",
              data: { type: "default", priority: 0 },
            },
            eds as Edge[]
          ) as any
      );
    },
    [flowState]
  );

  // ============================================================================
  // Drag & Drop from Node Library
  // ============================================================================

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData("application/reactflow");
      if (!type) return;

      // Convert screen coordinates to flow coordinates
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      flowState.addNode(type as any, position);
    },
    [flowState, screenToFlowPosition]
  );

  // ============================================================================
  // Selection Context Menu - "Save as Component" (US-425a)
  // ============================================================================

  /** Nodes currently selected */
  const selectedNodes = useMemo(
    () => flowState.nodes.filter(node => node.selected),
    [flowState.nodes]
  );

  /** Right-click handler on the canvas pane */
  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent | MouseEvent) => {
      // Only show the selection context menu when 2+ nodes are selected
      if (selectedNodes.length < 2) return;
      event.preventDefault();
      setSelectionContextMenu({ x: event.clientX, y: event.clientY });
    },
    [selectedNodes.length]
  );

  /** Close the selection context menu */
  const closeSelectionContextMenu = useCallback(() => {
    setSelectionContextMenu(null);
  }, []);

  /** Open the "Save as Component" modal */
  const handleSaveAsComponent = useCallback(() => {
    setSelectionContextMenu(null);
    setShowComponentModal(true);
  }, []);

  /**
   * Detect exit paths: edges that originate from a selected node
   * but target a node outside the selection.
   */
  const detectedExitPaths: ExitPath[] = useMemo(() => {
    const selectedIds = new Set(selectedNodes.map(n => n.id));
    return flowState.edges
      .filter(edge => selectedIds.has(edge.source) && !selectedIds.has(edge.target))
      .map(edge => ({
        id: edge.id,
        sourceNodeId: edge.source,
        label: (edge.data as any)?.label ?? "",
      }));
  }, [selectedNodes, flowState.edges]);

  /** Save selected nodes as a reusable component via POST /api/components */
  const queryClient = useQueryClient();
  const createComponentMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      description: string;
      flow: Record<string, unknown>;
      inputs: Array<{ name: string; type: string; description?: string }>;
      outputs: Array<{ name: string; type: string; description?: string }>;
      exitPaths: Array<{ name: string; condition?: string; description?: string }>;
      isPublic: boolean;
      tags: string[];
    }) => apiClient.post("/api/components", payload),
    onSuccess: () => {
      toast.success("Component saved successfully");
      queryClient.invalidateQueries({ queryKey: queryKeys.components.all });
      setShowComponentModal(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save component");
    },
  });

  const handleComponentSave = useCallback(
    (data: ComponentCreateData) => {
      const selectedIds = new Set(selectedNodes.map(n => n.id));
      const selectedEdges = flowState.edges.filter(
        e => selectedIds.has(e.source) && selectedIds.has(e.target)
      );

      createComponentMutation.mutate({
        name: data.name,
        description: data.description,
        flow: { nodes: selectedNodes, edges: selectedEdges },
        inputs: data.inputVariables.map(v => ({ name: v.name, type: "string", description: v.description })),
        outputs: data.outputVariables.map(v => ({ name: v.name, type: "string", description: v.description })),
        exitPaths: data.exitPaths.map(ep => ({ name: ep.label, condition: "", description: "" })),
        isPublic: data.isPublic,
        tags: data.tags,
      });
    },
    [selectedNodes, flowState.edges, createComponentMutation]
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={flowState.nodes as Node[]}
        edges={flowState.edges as Edge[]}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onPaneContextMenu={onPaneContextMenu}
        onNodeClick={onNodeClick as any}
        onNodeContextMenu={onNodeContextMenu as any}
        onEdgeClick={onEdgeClick as any}
        onEdgeContextMenu={onEdgeContextMenu as any}
        onPaneClick={onPaneClick as any}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={!locked}
        nodesConnectable={!locked}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode="Delete"
        defaultEdgeOptions={{
          type: "default",
          animated: false,
        }}
        className="bg-[hsl(var(--void))]"
      >
        {/* Dot grid background */}
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(240, 3%, 16%)" />

        {/* Mini-map (bottom-right) */}
        <MiniMap
          style={{
            position: "absolute",
            bottom: 16,
            right: 16,
            width: 200,
            height: 150,
            backgroundColor: "hsl(0, 0%, 7%)",
            border: "1px solid hsl(240, 3%, 16%)",
            borderRadius: "8px",
          }}
          maskColor="rgba(0, 0, 0, 0.7)"
          nodeColor={node => {
            const colorMap: Record<string, string> = {
              start: "#4ade80",
              endCall: "#f87171",
              agent: "#60a5fa",
              message: "#c084fc",
              capture: "#fbbf24",
              router: "#22d3ee",
              question: "#f97316",
              menu: "#ec4899",
              wait: "#14b8a6",
              confirm: "#84cc16",
              condition: "#eab308",
              choice: "#8b5cf6",
              setVariable: "#6366f1",
              goTo: "#38bdf8",
              loop: "#f43f5e",
              tool: "#64748b",
              apiCall: "#22c55e",
              mcpTool: "#d946ef",
              asyncTask: "#ea580c",
              function: "#71717a",
              knowledgeSearch: "#d97706",
              hold: "#7c3aed",
              transfer: "#10b981",
              voicemail: "#f43f5e",
              dtmf: "#0891b2",
              note: "#eab308",
              delay: "#0ea5e9",
              log: "#059669",
              abTest: "#f97316",
              component: "#6366f1",
            };
            return colorMap[node.type || ""] || "#a1a1aa";
          }}
          pannable
          zoomable
        />

        {/* Canvas toolbar (centered bottom) */}
        <CanvasToolbar
          onDeleteSelected={handleDeleteSelected}
          onUndo={undo}
          onRedo={redo}
          canUndo={canUndo}
          canRedo={canRedo}
          onToggleGlobalHandlers={() => setGlobalHandlersOpen((p: boolean) => !p)}
          showGlobalHandlers={globalHandlersOpen}
          locked={locked}
          onToggleLock={() => setLocked(l => !l)}
        />
      </ReactFlow>

      {/* ------------------------------------------------------------------ */}
      {/* Global Handler Badges (US-W12) — always visible on target nodes    */}
      {/* ------------------------------------------------------------------ */}
      {handlerTargetMap.size > 0 && (
        <div className="absolute inset-0 pointer-events-none z-[5]">
          {flowState.nodes.map(node => {
            const handlers = handlerTargetMap.get(node.id);
            if (!handlers) return null;
            // Convert flow coordinates to screen-relative coordinates
            const x = (node.position?.x ?? 0) * viewport.zoom + viewport.x;
            const y = (node.position?.y ?? 0) * viewport.zoom + viewport.y;
            // Position badge at top-right of node (node width ~200px)
            const nodeWidth = 200 * viewport.zoom;
            return (
              <div
                key={`badge-${node.id}`}
                className="absolute pointer-events-auto"
                style={{
                  left: x + nodeWidth - 8,
                  top: y - 8,
                }}
              >
                <GlobalHandlerBadge handlerNames={handlers} />
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Selection context menu (right-click with 2+ nodes selected)        */}
      {/* ------------------------------------------------------------------ */}
      {selectionContextMenu && (
        <>
          {/* Backdrop to close the menu */}
          <div
            className="fixed inset-0 z-40"
            onClick={closeSelectionContextMenu}
            data-testid="selection-context-backdrop"
          />
          <div
            style={{ left: selectionContextMenu.x, top: selectionContextMenu.y }}
            className="fixed z-50 w-52 py-1 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface))]/95 backdrop-blur-md shadow-xl"
            data-testid="selection-context-menu"
          >
            <button
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[hsl(var(--text-high))] hover:bg-[hsl(var(--surface-elevated))] transition-colors"
              onClick={handleSaveAsComponent}
              data-testid="save-as-component-btn"
            >
              <Package className="h-3.5 w-3.5" />
              <span className="flex-1 text-start">Save as Component</span>
              <span className="text-xs text-[hsl(var(--text-subtle))]">
                {selectedNodes.length} nodes
              </span>
            </button>
          </div>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Component Create Modal (US-425a)                                   */}
      {/* ------------------------------------------------------------------ */}
      <ComponentCreateModal
        open={showComponentModal}
        onClose={() => setShowComponentModal(false)}
        onSave={handleComponentSave}
        detectedExitPaths={detectedExitPaths}
        selectedNodeCount={selectedNodes.length}
        selectedNodes={selectedNodes as Array<{ id: string; data: Record<string, any> }>}
        allNodes={flowState.nodes as Array<{ id: string; data: Record<string, any> }>}
      />
    </div>
  );
}
