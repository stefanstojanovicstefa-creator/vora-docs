import { useQuery, UseQueryResult } from '@tanstack/react-query';
import {
  dashboardService,
  DashboardData,
  DashboardStats,
  RecentSession,
  ChartDataPoint,
} from '@/services/dashboard.service';

/**
 * Hook to fetch complete dashboard data
 */
export function useDashboard(): UseQueryResult<DashboardData> {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardService.getDashboardData(),
    staleTime: 30000, // 30 seconds - analytics change frequently
    refetchInterval: 30000, // Refetch every 30 seconds for real-time updates
  });
}

/**
 * Hook to fetch just dashboard statistics
 */
export function useDashboardStats(): UseQueryResult<DashboardStats> {
  return useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardService.getStats(),
    staleTime: 30000, // 30 seconds - analytics change frequently
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to fetch recent sessions
 */
export function useRecentSessions(
  limit: number = 10
): UseQueryResult<RecentSession[]> {
  return useQuery({
    queryKey: ['dashboard', 'recent-sessions', limit],
    queryFn: () => dashboardService.getRecentSessions(limit),
    staleTime: 30000, // 30 seconds - analytics change frequently
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to fetch chart data
 */
export function useDashboardChartData(
  days: number = 7
): UseQueryResult<ChartDataPoint[]> {
  return useQuery({
    queryKey: ['dashboard', 'chart-data', days],
    queryFn: () => dashboardService.getChartData(days),
    staleTime: 30000, // 30 seconds - analytics change frequently
  });
}
