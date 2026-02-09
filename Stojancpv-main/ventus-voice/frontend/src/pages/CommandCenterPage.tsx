/**
 * CommandCenterPage
 * Dev-only agent builder with tabs for Brain, Voice, Ears, Behavior, Tools, Analysis, Flow, Advanced.
 * Integrates auto-save, undo/redo, keyboard shortcuts, command palette, and live preview.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, DollarSign, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { apiClient } from "@/lib/api-client";
import type { CommandCenterConfig } from "@/schemas/commandCenterConfig.schema";
import { DEFAULT_UI_CONFIG } from "@/lib/configMapper";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useUndoRedo } from "@/hooks/useUndoRedo";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { BrainTab } from "@/components/CommandCenter/tabs/BrainTab";
import { VoiceTab } from "@/components/CommandCenter/tabs/VoiceTab";
import { EarsTab } from "@/components/CommandCenter/tabs/EarsTab";
import { BehaviorTab } from "@/components/CommandCenter/tabs/BehaviorTab";
import { ToolsTab } from "@/components/CommandCenter/tabs/ToolsTab";
import { AnalysisTab } from "@/components/CommandCenter/tabs/AnalysisTab";
import { FlowTab } from "@/components/CommandCenter/tabs/FlowTab";
import { AdvancedTab } from "@/components/CommandCenter/tabs/AdvancedTab";
import { MemoryTab } from "@/components/AgentDetail/MemoryTab";
import { LivePreviewPanel } from "@/components/CommandCenter/LivePreviewPanel";
import { StatusBar } from "@/components/CommandCenter/StatusBar";
import { CommandCenterPalette } from "@/components/CommandCenter/CommandCenterPalette";
import { useBuilderSync } from "@/hooks/useBuilderSync";
import { ConflictResolutionModal } from "@/components/CommandCenter/ConflictResolutionModal";
import { BuilderSwitchButton } from "@/components/CommandCenter/BuilderSwitchButton";
import { SyncIndicator } from "@/components/CommandCenter/SyncIndicator";
import { UnifiedShortcutsPanel } from "@/components/CommandCenter/UnifiedShortcutsPanel";
import { AgentExportDialog } from "@/components/CommandCenter/AgentExportDialog";
import { AgentImportDialog } from "@/components/CommandCenter/AgentImportDialog";

// ============================================================================
// Constants
// ============================================================================

const ENABLED_TABS = [
  "brain",
  "voice",
  "ears",
  "behavior",
  "memory",
  "tools",
  "analysis",
  "flow",
  "advanced",
] as const;

type EnabledTab = (typeof ENABLED_TABS)[number];

const TAB_GROUPS: { label: string; tabs: EnabledTab[] }[] = [
  { label: "CORE", tabs: ["brain", "voice", "ears", "behavior", "memory"] },
  { label: "ADVANCED", tabs: ["tools", "analysis", "advanced"] },
  { label: "FLOW", tabs: ["flow"] },
];

// Default config is now imported from configMapper for single source of truth

// ============================================================================
// Types
// ============================================================================

interface BuilderResponse {
  agent: {
    id: string;
    name: string;
    config: Record<string, unknown>;
    llmProvider: string | null;
    sttProvider: string | null;
    ttsProvider: string | null;
  };
  costEstimate: {
    costPerMinute: number;
    latencyMs: number;
    breakdown: {
      stt: { cost: number; latency: number };
      llm: { cost: number; latency: number };
      tts: { cost: number; latency: number };
      platform: { cost: number };
    };
  };
}

// ============================================================================
// Helpers
// ============================================================================

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const result = structuredClone(obj);
  const keys = path.split(".");
  let current: Record<string, unknown> = result;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] == null || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]] = value;
  return result;
}

// ============================================================================
// Component
// ============================================================================

export default function CommandCenterPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [activeTab, setActiveTab] = useState<EnabledTab>("brain");
  const [config, setConfig] = useState<CommandCenterConfig>(DEFAULT_UI_CONFIG);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [previewCollapsed, setPreviewCollapsed] = useState(() => {
    try {
      return localStorage.getItem("cc-preview-collapsed") === "true";
    } catch {
      return false;
    }
  });
  const configInitialized = useRef(false);

  const togglePreview = useCallback(() => {
    setPreviewCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("cc-preview-collapsed", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // --------------- Builder Sync (US-W14) ---------------
  const {
    triggerSync,
    syncState,
    conflicts,
    isSyncing: isSyncingSyncHook,
    resolveConflict,
    resolveAll,
    clearConflicts,
  } = useBuilderSync(agentId || "");

  // --------------- Export/Import (US-W18) ---------------
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // --------------- Data Fetching ---------------
  const { data, isLoading, error } = useQuery<BuilderResponse>({
    queryKey: ["agent-builder", agentId],
    queryFn: () => apiClient.get<BuilderResponse>(`/api/agents/${agentId}/builder`),
    enabled: !!agentId,
  });

  // Initialize config from server response (backend returns UI-shaped config via configMapper)
  useEffect(() => {
    if (data?.agent?.config && !configInitialized.current) {
      const serverConfig = data.agent.config as CommandCenterConfig;
      setConfig(serverConfig);
      configInitialized.current = true;
    }
  }, [data]);

  // --------------- Auto-Save ---------------
  const { saveState, forceSave } = useAutoSave({
    agentId: agentId || "",
    config: config as unknown as Record<string, unknown>,
  });

  // --------------- Undo/Redo ---------------
  const { pushChange, undo, redo, canUndo, canRedo } = useUndoRedo();

  const handleChange = useCallback(
    (section: keyof CommandCenterConfig, field: string, value: unknown) => {
      const fullPath = `${section}.${field}`;
      const oldValue = getNestedValue(config as unknown as Record<string, unknown>, fullPath);

      setConfig(prev => {
        const sectionData = prev[section] as Record<string, unknown>;
        // Handle nested fields like "turnTaking.interruptionSensitivity"
        const updated = setNestedValue(sectionData, field, value);
        return { ...prev, [section]: updated };
      });

      pushChange(fullPath, oldValue, value);
    },
    [config, pushChange]
  );

  const handleUndo = useCallback(() => {
    const change = undo();
    if (!change) return;
    setConfig(prev => {
      const result = setNestedValue(
        prev as unknown as Record<string, unknown>,
        change.path,
        change.oldValue
      ) as unknown as CommandCenterConfig;
      return result;
    });
  }, [undo]);

  const handleRedo = useCallback(() => {
    const change = redo();
    if (!change) return;
    setConfig(prev => {
      const result = setNestedValue(
        prev as unknown as Record<string, unknown>,
        change.path,
        change.newValue
      ) as unknown as CommandCenterConfig;
      return result;
    });
  }, [redo]);

  // --------------- Cost Estimate Recalculation ---------------
  const [costEstimate, setCostEstimate] = useState(data?.costEstimate ?? null);
  const costTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const costMutation = useMutation({
    mutationFn: async () => {
      return apiClient.post<BuilderResponse["costEstimate"]>(`/api/agents/${agentId}/estimate`, {
        brain: { provider: config.brain.provider, model: config.brain.model },
        voice: { provider: config.voice.provider },
        ears: { provider: config.ears.provider },
      });
    },
    onSuccess: result => setCostEstimate(result),
  });

  // Update cost estimate when server data loads
  useEffect(() => {
    if (data?.costEstimate && !costEstimate) {
      setCostEstimate(data.costEstimate);
    }
  }, [data?.costEstimate, costEstimate]);

  // Debounced cost recalculation on provider/model changes
  useEffect(() => {
    if (!agentId || !configInitialized.current) return;
    if (costTimerRef.current) clearTimeout(costTimerRef.current);
    costTimerRef.current = setTimeout(() => {
      costMutation.mutate();
    }, 1000);
    return () => {
      if (costTimerRef.current) clearTimeout(costTimerRef.current);
    };
    // Only recalculate on provider/model changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.brain.provider,
    config.brain.model,
    config.voice.provider,
    config.ears.provider,
    agentId,
  ]);

  // --------------- Validation Warnings ---------------
  const validationWarnings = useMemo(() => {
    let count = 0;
    if (!config.brain.systemPrompt) count++;
    if (!config.voice.voiceId) count++;
    if (!config.ears.provider) count++;
    if (!config.behavior.guardrails.enabled) count++;
    return count;
  }, [config]);

  // --------------- Tab Helpers ---------------
  const tabIndex = ENABLED_TABS.indexOf(activeTab);

  const goToTab = useCallback((tab: EnabledTab) => setActiveTab(tab), []);
  const prevTab = useCallback(() => {
    const idx = ENABLED_TABS.indexOf(activeTab);
    if (idx > 0) setActiveTab(ENABLED_TABS[idx - 1]);
  }, [activeTab]);
  const nextTab = useCallback(() => {
    const idx = ENABLED_TABS.indexOf(activeTab);
    if (idx < ENABLED_TABS.length - 1) setActiveTab(ENABLED_TABS[idx + 1]);
  }, [activeTab]);

  // --------------- Keyboard Shortcuts ---------------
  useKeyboardShortcuts([
    { key: "1", metaKey: true, handler: () => goToTab("brain"), description: "Brain tab" },
    { key: "2", metaKey: true, handler: () => goToTab("voice"), description: "Voice tab" },
    { key: "3", metaKey: true, handler: () => goToTab("ears"), description: "Ears tab" },
    { key: "4", metaKey: true, handler: () => goToTab("behavior"), description: "Behavior tab" },
    { key: "5", metaKey: true, handler: () => goToTab("memory"), description: "Memory tab" },
    { key: "6", metaKey: true, handler: () => goToTab("tools"), description: "Tools tab" },
    { key: "7", metaKey: true, handler: () => goToTab("analysis"), description: "Analysis tab" },
    { key: "8", metaKey: true, handler: () => goToTab("flow"), description: "Flow tab" },
    { key: "9", metaKey: true, handler: () => goToTab("advanced"), description: "Advanced tab" },
    { key: "s", metaKey: true, handler: () => forceSave(), description: "Save now" },
    {
      key: "k",
      metaKey: true,
      handler: () => setPaletteOpen(true),
      description: "Command palette",
    },
    { key: "/", metaKey: true, handler: () => setShortcutsOpen(v => !v), description: "Shortcuts" },
    { key: "z", metaKey: true, handler: handleUndo, description: "Undo" },
    { key: "z", metaKey: true, shiftKey: true, handler: handleRedo, description: "Redo" },
    { key: "[", metaKey: true, handler: prevTab, description: "Previous tab" },
    { key: "]", metaKey: true, handler: nextTab, description: "Next tab" },
  ]);

  // --------------- Command Palette Items ---------------
  const paletteItems = useMemo(
    () => [
      {
        id: "tab-brain",
        label: "Brain",
        category: "tab" as const,
        shortcut: "⌘1",
        onSelect: () => goToTab("brain"),
      },
      {
        id: "tab-voice",
        label: "Voice",
        category: "tab" as const,
        shortcut: "⌘2",
        onSelect: () => goToTab("voice"),
      },
      {
        id: "tab-ears",
        label: "Ears",
        category: "tab" as const,
        shortcut: "⌘3",
        onSelect: () => goToTab("ears"),
      },
      {
        id: "tab-behavior",
        label: "Behavior",
        category: "tab" as const,
        shortcut: "⌘4",
        onSelect: () => goToTab("behavior"),
      },
      {
        id: "tab-memory",
        label: "Memory",
        category: "tab" as const,
        shortcut: "⌘5",
        onSelect: () => goToTab("memory"),
      },
      {
        id: "tab-tools",
        label: "Tools",
        category: "tab" as const,
        shortcut: "⌘6",
        onSelect: () => goToTab("tools"),
      },
      {
        id: "tab-analysis",
        label: "Analysis",
        category: "tab" as const,
        shortcut: "⌘7",
        onSelect: () => goToTab("analysis"),
      },
      {
        id: "tab-flow",
        label: "Flow",
        category: "tab" as const,
        shortcut: "⌘8",
        onSelect: () => goToTab("flow"),
      },
      {
        id: "tab-advanced",
        label: "Advanced",
        category: "tab" as const,
        shortcut: "⌘9",
        onSelect: () => goToTab("advanced"),
      },
      {
        id: "action-save",
        label: "Save Now",
        category: "action" as const,
        shortcut: "⌘S",
        onSelect: () => forceSave(),
      },
      {
        id: "action-undo",
        label: "Undo",
        category: "action" as const,
        shortcut: "⌘Z",
        onSelect: handleUndo,
      },
      {
        id: "action-redo",
        label: "Redo",
        category: "action" as const,
        shortcut: "⇧⌘Z",
        onSelect: handleRedo,
      },
      {
        id: "action-shortcuts",
        label: "Keyboard Shortcuts",
        category: "action" as const,
        shortcut: "⌘/",
        onSelect: () => setShortcutsOpen(true),
      },
      {
        id: "action-export",
        label: "Export Agent",
        category: "action" as const,
        onSelect: () => setExportOpen(true),
      },
      {
        id: "action-import",
        label: "Import Agent",
        category: "action" as const,
        onSelect: () => setImportOpen(true),
      },
    ],
    [goToTab, forceSave, handleUndo, handleRedo, setExportOpen, setImportOpen]
  );

  // --------------- Section-specific change handlers ---------------
  const handleBrainChange = useCallback(
    (field: string, value: unknown) => handleChange("brain", field, value),
    [handleChange]
  );
  const handleVoiceChange = useCallback(
    (field: string, value: unknown) => handleChange("voice", field, value),
    [handleChange]
  );
  const handleEarsChange = useCallback(
    (field: string, value: unknown) => handleChange("ears", field, value),
    [handleChange]
  );
  const handleBehaviorChange = useCallback(
    (field: string, value: unknown) => handleChange("behavior", field, value),
    [handleChange]
  );
  const handleToolsChange = useCallback(
    (field: string, value: unknown) => handleChange("tools", field, value),
    [handleChange]
  );
  const handleAnalysisChange = useCallback(
    (field: string, value: unknown) => handleChange("analysis", field, value),
    [handleChange]
  );
  const handleFlowChange = useCallback(
    (field: string, value: unknown) => handleChange("flow", field, value),
    [handleChange]
  );
  const handleAdvancedChange = useCallback(
    (field: string, value: unknown) => handleChange("advanced", field, value),
    [handleChange]
  );

  // --------------- Render: Loading ---------------
  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-4">
          <Skeleton className="h-[500px] w-48" />
          <Skeleton className="h-[500px] flex-1" />
          <Skeleton className="h-[500px] w-80" />
        </div>
      </div>
    );
  }

  // --------------- Render: Error ---------------
  if (error || !data) {
    const errorMessage = error instanceof Error ? error.message : "Agent not found";
    return (
      <div className="p-6 flex flex-col items-center justify-center h-[60vh] gap-4">
        <p className="text-muted-foreground">{errorMessage}</p>
        <Link to="/agents">
          <Button variant="outline">Back to Agents</Button>
        </Link>
      </div>
    );
  }

  const { agent } = data;
  const displayCost = costEstimate ?? data.costEstimate;

  // --------------- Render: Main ---------------
  return (
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b bg-glass">
          <div className="flex items-center gap-3">
            <Link to={`/agents/${agentId}`}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">{agent.name}</h1>
            <Badge variant="outline" className="gap-1 font-mono text-[hsl(var(--primary))]">
              <DollarSign className="h-3 w-3" />${displayCost.costPerMinute.toFixed(3)}/min
            </Badge>
            <Badge variant="outline" className="gap-1 font-mono text-[hsl(var(--primary))]">
              <Clock className="h-3 w-3" />
              {displayCost.latencyMs}ms
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <BuilderSwitchButton
              agentId={agentId || ""}
              currentBuilder="command-center"
              onSyncBeforeSwitch={async () => {
                forceSave();
                triggerSync("config-to-flow");
              }}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Vertical Tab Sidebar */}
          <nav className="w-48 shrink-0 border-r border-[hsl(var(--border))] overflow-y-auto bg-[hsl(var(--surface))]/30">
            {TAB_GROUPS.map(group => (
              <div key={group.label}>
                <div className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--text-subtle))] px-3 py-2 mt-2">
                  {group.label}
                </div>
                {group.tabs.map(tab => {
                  const tabIdx = ENABLED_TABS.indexOf(tab);
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`w-full flex items-center justify-between py-2 px-3 text-sm cursor-pointer transition-colors ${
                        activeTab === tab
                          ? "border-l-2 border-[hsl(var(--primary))] bg-[hsl(var(--surface-elevated))]/50 text-[hsl(var(--text-high))]"
                          : "border-l-2 border-transparent text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-high))] hover:bg-[hsl(var(--surface-elevated))]/30"
                      }`}
                    >
                      <span className="capitalize">{tab}</span>
                      <span className="key-cap text-xs hidden sm:inline">⌘{tabIdx + 1}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Center: Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as EnabledTab)}>
              {/* Constrain tab content width for readability and consistent vertical rhythm */}
              <TabsContent value="brain" className="mt-0 animate-fade-in max-w-2xl">
                <BrainTab config={config.brain} onChange={handleBrainChange} />
              </TabsContent>
              <TabsContent value="voice" className="mt-0 animate-fade-in max-w-2xl">
                <VoiceTab config={config.voice} onChange={handleVoiceChange} />
              </TabsContent>
              <TabsContent value="ears" className="mt-0 animate-fade-in max-w-2xl">
                <EarsTab config={config.ears} onChange={handleEarsChange} />
              </TabsContent>
              <TabsContent value="behavior" className="mt-0 animate-fade-in max-w-2xl">
                <BehaviorTab config={config.behavior} onChange={handleBehaviorChange} />
              </TabsContent>
              <TabsContent value="memory" className="mt-0 animate-fade-in max-w-2xl">
                {agentId && <MemoryTab agentId={agentId} />}
              </TabsContent>
              <TabsContent value="tools" className="mt-0 animate-fade-in max-w-2xl">
                <ToolsTab config={config.tools} onChange={handleToolsChange} agentId={agentId} />
              </TabsContent>
              <TabsContent value="analysis" className="mt-0 animate-fade-in max-w-2xl">
                <AnalysisTab
                  config={config.analysis}
                  onChange={handleAnalysisChange}
                  costEstimate={displayCost}
                />
              </TabsContent>
              <TabsContent value="flow" className="mt-0 animate-fade-in max-w-2xl">
                <FlowTab config={config.flow} onChange={handleFlowChange} />
              </TabsContent>
              <TabsContent value="advanced" className="mt-0 animate-fade-in max-w-2xl">
                <AdvancedTab
                  config={config.advanced}
                  onChange={handleAdvancedChange}
                  onExport={() => setExportOpen(true)}
                  onImport={() => setImportOpen(true)}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Collapse Toggle */}
          <button
            onClick={togglePreview}
            className="shrink-0 w-5 flex items-center justify-center border-l border-[hsl(var(--border))] bg-[hsl(var(--surface))]/50 hover:bg-[hsl(var(--surface-elevated))]/50 transition-colors cursor-pointer"
          >
            {previewCollapsed ? (
              <ChevronLeft className="h-3 w-3 text-[hsl(var(--text-muted))]" />
            ) : (
              <ChevronRight className="h-3 w-3 text-[hsl(var(--text-muted))]" />
            )}
          </button>

          {/* Right: Preview Panel (collapsible) */}
          <div
            className={`shrink-0 overflow-y-auto bg-[hsl(var(--surface)/0.3)] transition-all duration-200 ${
              previewCollapsed ? "w-0 overflow-hidden" : "w-80"
            }`}
          >
            <LivePreviewPanel
              costEstimate={costEstimate}
              config={config}
              isLoading={costMutation.isPending}
              systemPrompt={config.brain.systemPrompt}
            />
          </div>
        </div>

        {/* Status Bar */}
        <StatusBar
          saveState={saveState}
          validationWarnings={validationWarnings}
          onRetry={forceSave}
        />

        {/* Sync Indicator (US-W16) */}
        <div className="flex items-center justify-end px-4 py-1 border-t border-[hsl(var(--border))] bg-[hsl(var(--surface)/0.3)]">
          <SyncIndicator
            syncState={syncState}
            onSyncNow={() => triggerSync("bidirectional")}
            isSyncing={isSyncingSyncHook}
          />
        </div>

        {/* Command Palette */}
        <CommandCenterPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          items={paletteItems}
        />

        {/* Unified Shortcuts Panel (US-W17) */}
        <UnifiedShortcutsPanel
          open={shortcutsOpen}
          onOpenChange={setShortcutsOpen}
          currentBuilder="command-center"
        />

        {/* Conflict Resolution Modal (US-W14) */}
        <ConflictResolutionModal
          open={conflicts.length > 0}
          conflicts={conflicts}
          onResolve={resolveConflict}
          onResolveAll={resolveAll}
          onApply={() => triggerSync("bidirectional")}
          onCancel={clearConflicts}
        />

        {/* Agent Export Dialog (US-W18) */}
        <AgentExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          agentId={agentId || ""}
          agentName={agent.name}
        />

        {/* Agent Import Dialog (US-W18) */}
        <AgentImportDialog open={importOpen} onOpenChange={setImportOpen} agentId={agentId || ""} />
      </div>
    </TooltipProvider>
  );
}
