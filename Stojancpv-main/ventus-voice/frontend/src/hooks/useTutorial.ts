/**
 * Tutorial Hook
 *
 * Manages tutorial state with backend persistence and optimistic updates.
 * Part of Phase 1 - P0 Journey (P0J-01, P0J-02, P0J-03)
 *
 * Features:
 * - Syncs tutorial state to backend API
 * - Handles browser refresh (state persisted)
 * - Supports Mom/God mode variants
 * - PostHog event tracking
 *
 * @module useTutorial
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/clerk-react';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useViewMode } from '@/hooks/useViewMode';
import { apiClient } from '@/lib/api-client';

// ============================================================================
// Types
// ============================================================================

export interface TutorialStep {
  id: number;
  title: string;
  description: string;
  duration: number;
}

export interface TutorialState {
  currentStep: number;
  completedSteps: number[];
  totalSteps: number;
  steps: TutorialStep[];
  isComplete: boolean;
  isDismissed: boolean;
  mode: 'mom' | 'god';
  startedAt: string;
  completedAt: string | null;
  dismissedAt: string | null;
}

export type TutorialAction = 'advance' | 'complete' | 'dismiss' | 'reset';

interface UpdateTutorialParams {
  action: TutorialAction;
  step?: number;
  mode?: 'mom' | 'god';
  metadata?: Record<string, any>;
}

// ============================================================================
// API Functions
// ============================================================================

async function getTutorialState(): Promise<TutorialState> {
  const response = await apiClient.get<{ success: boolean; data: TutorialState }>('/api/tutorial/state');
  return response.data;
}

async function updateTutorialState(params: UpdateTutorialParams): Promise<TutorialState> {
  const response = await apiClient.post<{ success: boolean; data: TutorialState }>('/api/tutorial/state', params);
  return response.data;
}

// ============================================================================
// Query Keys
// ============================================================================

export const tutorialQueryKeys = {
  all: ['tutorial'] as const,
  state: () => [...tutorialQueryKeys.all, 'state'] as const,
};

// ============================================================================
// Hook
// ============================================================================

export function useTutorial() {
  const queryClient = useQueryClient();
  const { isSignedIn } = useAuth();
  const { trackEvent } = useAnalytics();
  const { isMomMode } = useViewMode();

  // Fetch tutorial state
  const {
    data: state,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: tutorialQueryKeys.state(),
    queryFn: getTutorialState,
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
    enabled: !!isSignedIn,
  });

  // Update tutorial state mutation
  const updateMutation = useMutation({
    mutationFn: updateTutorialState,
    onMutate: async (params) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: tutorialQueryKeys.state() });

      // Snapshot previous value
      const previousState = queryClient.getQueryData<TutorialState>(tutorialQueryKeys.state());

      // Optimistic update
      if (previousState) {
        const optimisticState = { ...previousState };

        switch (params.action) {
          case 'advance': {
            const step = params.step ?? previousState.currentStep;
            if (!optimisticState.completedSteps.includes(step)) {
              optimisticState.completedSteps = [...optimisticState.completedSteps, step];
            }
            optimisticState.currentStep = Math.min(step + 1, previousState.totalSteps);
            break;
          }
          case 'complete': {
            optimisticState.isComplete = true;
            optimisticState.completedSteps = previousState.steps.map((s) => s.id);
            optimisticState.currentStep = previousState.totalSteps;
            break;
          }
          case 'dismiss': {
            optimisticState.isDismissed = true;
            break;
          }
          case 'reset': {
            optimisticState.currentStep = 1;
            optimisticState.completedSteps = [];
            optimisticState.isComplete = false;
            optimisticState.isDismissed = false;
            break;
          }
        }

        queryClient.setQueryData(tutorialQueryKeys.state(), optimisticState);
      }

      return { previousState };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousState) {
        queryClient.setQueryData(tutorialQueryKeys.state(), context.previousState);
      }
    },
    onSettled: () => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: tutorialQueryKeys.state() });
    },
  });

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Advance to the next tutorial step
   */
  const advanceStep = async (stepId?: number) => {
    if (!state) return;

    const currentStepId = stepId ?? state.currentStep;

    trackEvent({
      name: 'tutorial_step_completed',
      properties: {
        step_id: currentStepId,
        step_title: state.steps.find((s) => s.id === currentStepId)?.title,
        mode: state.mode,
        total_steps: state.totalSteps,
      },
    });

    return updateMutation.mutateAsync({
      action: 'advance',
      step: currentStepId,
    });
  };

  /**
   * Complete the entire tutorial
   */
  const completeTutorial = async () => {
    if (!state) return;

    trackEvent({
      name: 'tutorial_completed',
      properties: {
        mode: state.mode,
        total_steps: state.totalSteps,
        duration_seconds: state.startedAt
          ? Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000)
          : null,
      },
    });

    return updateMutation.mutateAsync({ action: 'complete' });
  };

  /**
   * Dismiss the tutorial (user clicked skip)
   */
  const dismissTutorial = async () => {
    if (!state) return;

    trackEvent({
      name: 'tutorial_dismissed',
      properties: {
        mode: state.mode,
        current_step: state.currentStep,
        steps_completed: state.completedSteps.length,
      },
    });

    return updateMutation.mutateAsync({ action: 'dismiss' });
  };

  /**
   * Reset the tutorial to the beginning
   */
  const resetTutorial = async () => {
    trackEvent({
      name: 'tutorial_reset',
      properties: {
        mode: state?.mode,
      },
    });

    return updateMutation.mutateAsync({ action: 'reset' });
  };

  /**
   * Switch tutorial mode (mom/god)
   */
  const switchMode = async (mode: 'mom' | 'god') => {
    trackEvent({
      name: 'tutorial_mode_switched',
      properties: {
        from_mode: state?.mode,
        to_mode: mode,
      },
    });

    return updateMutation.mutateAsync({
      action: 'reset',
      mode,
    });
  };

  // ============================================================================
  // Computed Values
  // ============================================================================

  const shouldShowTutorial = state && !state.isComplete && !state.isDismissed;

  const currentStepData = state?.steps.find((s) => s.id === state.currentStep);

  const progressPercent = state
    ? Math.round((state.completedSteps.length / state.totalSteps) * 100)
    : 0;

  return {
    // State
    state,
    isLoading,
    error,
    isUpdating: updateMutation.isPending,

    // Computed
    shouldShowTutorial,
    currentStepData,
    progressPercent,
    currentStep: state?.currentStep ?? 1,
    totalSteps: state?.totalSteps ?? 0,
    completedSteps: state?.completedSteps ?? [],
    mode: state?.mode ?? (isMomMode ? 'mom' : 'god'),

    // Actions
    advanceStep,
    completeTutorial,
    dismissTutorial,
    resetTutorial,
    switchMode,
    refetch,
  };
}
