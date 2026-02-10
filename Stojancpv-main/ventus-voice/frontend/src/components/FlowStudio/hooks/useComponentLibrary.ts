import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export interface FlowComponent {
  id: string;
  name: string;
  description: string;
  version: string;
  isPublic: boolean;
  tags: string[];
  inputCount: number;
  outputCount: number;
  exitPathCount: number;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ComponentListResponse {
  components: Array<{
    id: string;
    name: string;
    description: string | null;
    version: string;
    tags: string[];
    isPublic: boolean;
    usageCount: number;
    userId: string;
    createdAt: string;
    updatedAt: string;
  }>;
  total: number;
  page: number;
}

function mapToFlowComponent(raw: ComponentListResponse["components"][number]): FlowComponent {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? "",
    version: raw.version,
    isPublic: raw.isPublic,
    tags: raw.tags,
    inputCount: 0,
    outputCount: 0,
    exitPathCount: 0,
    usageCount: raw.usageCount,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export function useComponentLibrary() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading } = useQuery<ComponentListResponse>({
    queryKey: queryKeys.components.lists(),
    queryFn: () => apiClient.get<ComponentListResponse>("/api/components"),
  });

  const allComponents = useMemo(
    () => (data?.components ?? []).map(mapToFlowComponent),
    [data],
  );

  const filteredComponents = useMemo(() => {
    if (!searchQuery) return allComponents;
    const q = searchQuery.toLowerCase();
    return allComponents.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [allComponents, searchQuery]);

  const myComponents = useMemo(
    () => filteredComponents.filter((c) => !c.isPublic),
    [filteredComponents],
  );

  const publicComponents = useMemo(
    () => filteredComponents.filter((c) => c.isPublic),
    [filteredComponents],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/components/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.components.all });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const original = allComponents.find((c) => c.id === id);
      if (!original) throw new Error("Component not found");
      return apiClient.post("/api/components", {
        name: `${original.name} (Copy)`,
        description: original.description,
        flow: {},
        inputs: [],
        outputs: [],
        exitPaths: [],
        isPublic: false,
        tags: original.tags,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.components.all });
    },
  });

  const deleteComponent = (id: string) => deleteMutation.mutate(id);
  const duplicateComponent = (id: string) => duplicateMutation.mutate(id);

  return {
    components: filteredComponents,
    myComponents,
    publicComponents,
    isLoading,
    searchQuery,
    setSearchQuery,
    deleteComponent,
    duplicateComponent,
  };
}
