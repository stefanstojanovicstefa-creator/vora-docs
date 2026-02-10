// AgentsPage — Agent Card UX Overhaul (US-600 to US-605)

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Loader2,
  Rocket,
  Edit,
  Trash2,
  Bot,
  Circle,
  CheckCircle2,
  XCircle,
  Grid3X3,
  List,
  RefreshCw,
  AlertTriangle,
  MoreVertical,
  Copy,
  Phone,
} from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import { VirtualGrid } from "../components/ui/virtual-list";
import { AgentsEmptyState, SearchEmptyState } from "../components/ui/empty-state";
import { ErrorState } from "../components/ui/error-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "../components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { cn, formatDateTime } from "../lib/utils";
import type { Agent } from "../types/agent";
import { apiClient } from "../lib/api-client";
import { deploymentService } from "../services/deployment.service";
import { AgentListSkeleton } from "../components/skeletons";
import { useViewMode } from "../hooks/useViewMode";
import { useLabel } from "../hooks/useLabel";
import { queryKeys } from "../lib/query-keys";
import { useDuplicateAgent, useToggleAgentStatus } from "../hooks/useAgentMutations";

// ============================================================================
// Types
// ============================================================================

interface AgentsListItem {
  id: string;
  name: string;
  description?: string | null;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "FAILED" | "DEPLOYING";
  createdAt: string;
  updatedAt: string;
  lastDeployedAt?: string | null;
}

interface AgentsListResponse {
  success: boolean;
  agents: AgentsListItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// Helpers
// ============================================================================

/** Can the agent status be toggled between ACTIVE/INACTIVE? */
function isToggleable(status: AgentsListItem["status"]): boolean {
  return status === "ACTIVE" || status === "INACTIVE";
}

/** Can the agent be tested? */
function isTestable(status: AgentsListItem["status"]): boolean {
  return status !== "DRAFT" && status !== "FAILED";
}

// ============================================================================
// Shared Menu Items — used by both kebab DropdownMenu and right-click ContextMenu
// ============================================================================

interface AgentMenuItemsProps {
  agent: AgentsListItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onTestCall: () => void;
  onDeploy: () => void;
  onDelete: () => void;
  isDeploying: boolean;
  Separator: React.ComponentType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Item: React.ComponentType<any>;
}

function AgentMenuItems({
  agent,
  onEdit,
  onDuplicate,
  onTestCall,
  onDeploy,
  onDelete,
  isDeploying,
  Separator,
  Item,
}: AgentMenuItemsProps) {
  return (
    <>
      <Item onClick={onEdit}>
        <Edit className="h-4 w-4 mr-2" />
        Edit
      </Item>
      <Item onClick={onDuplicate}>
        <Copy className="h-4 w-4 mr-2" />
        Duplicate
      </Item>
      <Item disabled={!isTestable(agent.status)} onClick={onTestCall}>
        <Phone className="h-4 w-4 mr-2" />
        Test Call
      </Item>
      <Separator />
      <Item disabled={isDeploying} onClick={onDeploy}>
        {isDeploying ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Rocket className="h-4 w-4 mr-2" />
        )}
        Deploy
      </Item>
      <Separator />
      <Item className="text-destructive focus:text-destructive" onClick={onDelete}>
        <Trash2 className="h-4 w-4 mr-2" />
        Delete
      </Item>
    </>
  );
}

// ============================================================================
// Page Component
// ============================================================================

export default function AgentsPage() {
  const { t } = useTranslation(["agent", "common"]);
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "DRAFT">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<AgentsListItem | null>(null);
  const { isMomMode } = useViewMode();
  const agentsLabel = useLabel("agents");
  const createAgentLabel = useLabel("createAgent");

  // Mutation hooks (US-603, US-604)
  const duplicateAgent = useDuplicateAgent();
  const toggleStatus = useToggleAgentStatus();

  const getStatusFilterLabel = (status: typeof statusFilter): string => {
    switch (status) {
      case "ALL":
        return t("agent:list.allAgents");
      case "ACTIVE":
        return t("common:status.active");
      case "INACTIVE":
        return t("common:status.inactive");
      case "DRAFT":
        return t("agent:status.draft");
      default:
        return status;
    }
  };

  // Fetch agents (US-606: uses queryKeys factory)
  const { data, isLoading, error, refetch } = useQuery<AgentsListResponse>({
    queryKey: queryKeys.agents.lists(),
    queryFn: async () => {
      if (!userId) throw new Error(t("agent:messages.notAuthenticated"));
      return apiClient.get<AgentsListResponse>("/api/agents?limit=100");
    },
    enabled: !!userId && isLoaded,
  });

  const agents = data?.agents || [];

  // Filter agents based on search and status
  const filteredAgents = agents.filter(agent => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "ALL" || agent.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // --------------- Actions ---------------

  // US-600: Card-level click → opens Command Center builder
  const handleCardClick = (agentId: string) => {
    navigate(`/agents/${agentId}/builder`);
  };

  // Handle deploy action
  const handleDeploy = async (agentId: string) => {
    try {
      setDeployingId(agentId);
      await deploymentService.deployAgent({ agentId });
      toast.success(t("agent:messages.deploySuccess"));
      refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("agent:messages.deployError");
      toast.error(message);
    } finally {
      setDeployingId(null);
    }
  };

  // US-603: Duplicate agent
  const handleDuplicate = (agentId: string) => {
    duplicateAgent.mutate(agentId);
  };

  // US-604: Toggle agent status
  const handleToggleStatus = (agentId: string, currentStatus: AgentsListItem["status"]) => {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    toggleStatus.mutate({ agentId, status: newStatus });
  };

  // US-605: Test call shortcut
  const handleTestCall = (agentId: string) => {
    navigate(`/agents/${agentId}?tab=test`);
  };

  // Open delete confirmation dialog
  const handleDeleteClick = (agent: AgentsListItem) => {
    setAgentToDelete(agent);
    setDeleteDialogOpen(true);
  };

  // Handle delete action (called from dialog)
  const handleDeleteConfirm = async () => {
    if (!agentToDelete) return;
    try {
      setDeletingId(agentToDelete.id);
      setDeleteDialogOpen(false);
      await apiClient.delete(`/api/agents/${agentToDelete.id}`);
      toast.success(t("agent:messages.deleteSuccess"));
      refetch();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("agent:messages.deleteError");
      toast.error(message);
    } finally {
      setDeletingId(null);
      setAgentToDelete(null);
    }
  };

  // --------------- Status Indicator ---------------

  const StatusIndicator = ({ status }: { status: AgentsListItem["status"] }) => {
    const statusConfig = {
      ACTIVE: {
        icon: CheckCircle2,
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        glowColor: "shadow-[0_0_10px_rgba(16,185,129,0.4)]",
        label: t("common:status.active"),
        pulse: true,
      },
      INACTIVE: {
        icon: Circle,
        color: "text-muted-foreground",
        bgColor: "bg-muted",
        glowColor: "",
        label: t("common:status.inactive"),
        pulse: false,
      },
      DRAFT: {
        icon: Circle,
        color: "text-amber-400",
        bgColor: "bg-amber-500/10",
        glowColor: "",
        label: t("agent:status.draft"),
        pulse: false,
      },
      FAILED: {
        icon: XCircle,
        color: "text-destructive",
        bgColor: "bg-destructive/10",
        glowColor: "shadow-[0_0_10px_rgba(239,68,68,0.3)]",
        label: t("common:status.failed"),
        pulse: false,
      },
      DEPLOYING: {
        icon: Loader2,
        color: "text-primary",
        bgColor: "bg-primary/10",
        glowColor: "shadow-[0_0_10px_rgba(153,205,255,0.4)]",
        label: t("agent:status.deploying"),
        pulse: true,
      },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.INACTIVE;
    const Icon = config.icon;

    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all",
          config.bgColor,
          config.glowColor
        )}
      >
        <Icon
          className={cn(
            "h-3.5 w-3.5",
            config.color,
            config.pulse && status === "DEPLOYING" && "animate-spin"
          )}
        />
        {config.pulse && status === "ACTIVE" && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        )}
        <span className={cn("text-xs font-medium", config.color)}>{config.label}</span>
      </div>
    );
  };

  // --------------- Render: Agent Card (Grid mode) ---------------

  const renderAgentCard = (agent: AgentsListItem) => {
    const isDeploying = deployingId === agent.id;
    const isDeleting = deletingId === agent.id;

    const menuActions = {
      onEdit: () => navigate(`/agents/${agent.id}/builder`),
      onDuplicate: () => handleDuplicate(agent.id),
      onTestCall: () => handleTestCall(agent.id),
      onDeploy: () => handleDeploy(agent.id),
      onDelete: () => handleDeleteClick(agent),
    };

    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Card
            className="glass-card card-hover group hover:border-primary/50 transition-all duration-200 hover:shadow-[0_0_20px_rgba(153,205,255,0.2)] cursor-pointer h-full flex flex-col"
            onClick={() => handleCardClick(agent.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                    {agent.name}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 mt-1">
                    {agent.description || "\u00A0"}
                  </CardDescription>
                </div>

                {/* US-604: Status toggle + Status indicator */}
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {isToggleable(agent.status) && (
                    <Switch
                      checked={agent.status === "ACTIVE"}
                      onCheckedChange={() => handleToggleStatus(agent.id, agent.status)}
                      disabled={toggleStatus.isPending}
                      aria-label={`Toggle ${agent.name} status`}
                    />
                  )}
                  <StatusIndicator status={agent.status} />

                  {/* US-601: Kebab DropdownMenu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="glass-card"
                      onClick={e => e.stopPropagation()}
                    >
                      <AgentMenuItems
                        agent={agent}
                        {...menuActions}
                        isDeploying={isDeploying}
                        Separator={DropdownMenuSeparator}
                        Item={DropdownMenuItem}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4 mt-auto">
              {/* Agent Details */}
              <div className="space-y-2 text-sm">
                {agent.lastDeployedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("agent:status.deployed")}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatDateTime(agent.lastDeployedAt)}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Timestamp */}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                {t("agent:list.updatedLabel")} {formatDateTime(agent.updatedAt)}
              </div>
            </CardContent>
          </Card>
        </ContextMenuTrigger>

        {/* US-602: Right-click ContextMenu */}
        <ContextMenuContent className="glass-card">
          <AgentMenuItems
            agent={agent}
            {...menuActions}
            isDeploying={isDeploying}
            Separator={ContextMenuSeparator}
            Item={ContextMenuItem}
          />
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // --------------- Render: Agent Card (List mode) ---------------

  const renderAgentListItem = (agent: AgentsListItem) => {
    const isDeploying = deployingId === agent.id;

    const menuActions = {
      onEdit: () => navigate(`/agents/${agent.id}/builder`),
      onDuplicate: () => handleDuplicate(agent.id),
      onTestCall: () => handleTestCall(agent.id),
      onDeploy: () => handleDeploy(agent.id),
      onDelete: () => handleDeleteClick(agent),
    };

    return (
      <ContextMenu key={agent.id}>
        <ContextMenuTrigger asChild>
          <Card
            className="glass-card card-hover group hover:border-primary/50 transition-all duration-200 hover:shadow-[0_0_20px_rgba(153,205,255,0.2)] cursor-pointer"
            onClick={() => handleCardClick(agent.id)}
          >
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg truncate group-hover:text-primary transition-colors">
                      {agent.name}
                    </CardTitle>
                  </div>
                  <CardDescription className="line-clamp-2 mt-1">
                    {agent.description || "\u00A0"}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                  {isToggleable(agent.status) && (
                    <Switch
                      checked={agent.status === "ACTIVE"}
                      onCheckedChange={() => handleToggleStatus(agent.id, agent.status)}
                      disabled={toggleStatus.isPending}
                      aria-label={`Toggle ${agent.name} status`}
                    />
                  )}
                  <StatusIndicator status={agent.status} />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => e.stopPropagation()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="glass-card"
                      onClick={e => e.stopPropagation()}
                    >
                      <AgentMenuItems
                        agent={agent}
                        {...menuActions}
                        isDeploying={isDeploying}
                        Separator={DropdownMenuSeparator}
                        Item={DropdownMenuItem}
                      />
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="space-y-2 text-sm">
                {agent.lastDeployedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">{t("agent:status.deployed")}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatDateTime(agent.lastDeployedAt)}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="text-xs text-muted-foreground pt-2 border-t">
                {t("agent:list.updatedLabel")} {formatDateTime(agent.updatedAt)}
              </div>
            </CardContent>
          </Card>
        </ContextMenuTrigger>

        <ContextMenuContent className="glass-card">
          <AgentMenuItems
            agent={agent}
            {...menuActions}
            isDeploying={isDeploying}
            Separator={ContextMenuSeparator}
            Item={ContextMenuItem}
          />
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  // --------------- Loading state ---------------
  if (!isLoaded || isLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[#EDEDED]">{agentsLabel}</h1>
            <div className="h-5 w-48 bg-[#27272A]/50 rounded animate-pulse mt-1" />
          </div>
        </div>
        <AgentListSkeleton count={6} columns={3} showMetrics={true} />
      </div>
    );
  }

  // --------------- Error state ---------------
  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{agentsLabel}</h1>
          </div>
        </div>
        <Card className="glass-card border-destructive/50">
          <CardContent className="py-4">
            <ErrorState
              error={error as Error}
              title={t("agent:list.loadErrorTitle")}
              onRetry={() => refetch()}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  // --------------- Empty state ---------------
  if (!agents || agents.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <AgentsEmptyState
          title={t("agent:list.emptyTitle")}
          description={t("agent:list.emptyDescription")}
          actionLabel={t("agent:list.createFirst")}
          actionHref="/agents/create"
          size="lg"
        />
      </div>
    );
  }

  // --------------- Main render ---------------
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{agentsLabel}</h1>
          <p className="text-muted-foreground mt-1">
            {filteredAgents.length} {t("agent:list.countLabel", { count: filteredAgents.length })}
            {statusFilter !== "ALL" && ` · ${getStatusFilterLabel(statusFilter)}`}
          </p>
        </div>
        <Link to="/agents/create">
          <Button className="glow-button neon-glow-hover">
            <Plus className="h-4 w-4 mr-2" />
            {createAgentLabel}
          </Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("agent:list.searchPlaceholderLong")}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 focus-glow"
          />
        </div>
        <div className="flex gap-2">
          {/* View Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none px-3"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="rounded-none px-3"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                {t("common:terms.status")}: {getStatusFilterLabel(statusFilter)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="glass-card">
              <DropdownMenuItem onClick={() => setStatusFilter("ALL")}>
                {t("agent:list.allAgents")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("ACTIVE")}>
                {t("common:status.active")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("INACTIVE")}>
                {t("common:status.inactive")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("DRAFT")}>
                {t("agent:status.draft")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Refresh Button */}
          <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Agents Grid/List */}
      {viewMode === "grid" ? (
        <VirtualGrid
          items={filteredAgents}
          columns={3}
          estimateRowHeight={320}
          height="calc(100vh - 400px)"
          gap={24}
          getItemKey={agent => agent.id}
          renderItem={renderAgentCard}
        />
      ) : (
        <div className="flex flex-col gap-4">{filteredAgents.map(renderAgentListItem)}</div>
      )}

      {/* No results state */}
      {filteredAgents.length === 0 && agents.length > 0 && (
        <Card className="glass-card">
          <CardContent className="py-4">
            <SearchEmptyState
              title={t("agent:list.noResultsTitle")}
              description={t("agent:list.noResultsDescription")}
              actionLabel={t("common:actions.clearFilters")}
              onAction={() => {
                setSearchQuery("");
                setStatusFilter("ALL");
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="glass-card">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle>
                {t("agent:messages.deleteTitle", { name: agentToDelete?.name || "" })}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="pt-2">
              {t("agent:messages.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAgentToDelete(null)}>
              {t("common:actions.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common:actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
