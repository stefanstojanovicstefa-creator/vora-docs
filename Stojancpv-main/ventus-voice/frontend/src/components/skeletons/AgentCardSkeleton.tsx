/**
 * AgentCardSkeleton Component
 * Skeleton loading state for agent card layouts
 * Generic design suitable for agent lists and dashboards
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/utils';

interface AgentCardSkeletonProps {
  /** Additional CSS classes */
  className?: string;
  /** Show performance metrics */
  showMetrics?: boolean;
}

export function AgentCardSkeleton({ className, showMetrics = true }: AgentCardSkeletonProps) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* Agent icon/avatar */}
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 min-w-0">
              {/* Agent name */}
              <Skeleton className="h-5 w-36 mb-1" />
              {/* Agent status or version */}
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          {/* Status badge */}
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Description or prompt preview */}
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>

          {showMetrics && (
            <>
              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div>
                  <Skeleton className="h-3 w-12 mb-1" />
                  <Skeleton className="h-5 w-10" />
                </div>
                <div>
                  <Skeleton className="h-3 w-12 mb-1" />
                  <Skeleton className="h-5 w-10" />
                </div>
                <div>
                  <Skeleton className="h-3 w-16 mb-1" />
                  <Skeleton className="h-5 w-12" />
                </div>
              </div>
            </>
          )}

          {/* Footer - Last updated or action buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Skeleton className="h-3 w-28" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * AgentListSkeleton Component
 * Grid of agent card skeletons
 */
export function AgentListSkeleton({
  count = 6,
  columns = 3,
  showMetrics = true,
  className,
}: {
  count?: number;
  columns?: 1 | 2 | 3 | 4;
  showMetrics?: boolean;
  className?: string;
}) {
  const gridClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  };

  return (
    <div className={cn('grid gap-6', gridClasses[columns], className)}>
      {Array.from({ length: count }).map((_, index) => (
        <AgentCardSkeleton key={index} showMetrics={showMetrics} />
      ))}
    </div>
  );
}

export default AgentCardSkeleton;
