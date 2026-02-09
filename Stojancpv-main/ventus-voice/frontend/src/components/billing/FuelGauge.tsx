/**
 * Fuel Gauge Component
 *
 * Compact usage indicator showing remaining minutes.
 * Features:
 * - Progress bar visualization
 * - Color-coded status (green/yellow/red)
 * - Pulse animation when critical
 * - Mode-aware labels
 * - Tooltip with detailed stats
 * - Opens upgrade modal on click
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Fuel } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUsageData } from '@/hooks/useUsageData';
import { useViewMode } from '@/hooks/useViewMode';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { UpgradeModal } from './UpgradeModal';

interface FuelGaugeProps {
  className?: string;
}

export function FuelGauge({ className }: FuelGaugeProps) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const usage = useUsageData();
  const { isMomMode } = useViewMode();

  // Determine status color
  const getStatusColor = () => {
    if (usage.isCritical) return 'error';
    if (usage.isLow) return 'warning';
    return 'success';
  };

  const statusColor = getStatusColor();

  // Color classes based on status
  const colorClasses = {
    success: {
      bg: 'bg-[hsl(var(--success))]',
      text: 'text-[hsl(var(--success))]',
      border: 'border-[hsl(var(--success))]'
    },
    warning: {
      bg: 'bg-[hsl(var(--warning))]',
      text: 'text-[hsl(var(--warning))]',
      border: 'border-[hsl(var(--warning))]'
    },
    error: {
      bg: 'bg-[hsl(var(--error))]',
      text: 'text-[hsl(var(--error))]',
      border: 'border-[hsl(var(--error))]'
    }
  };

  const colors = colorClasses[statusColor];

  // Labels based on mode
  const label = isMomMode
    ? `Još ${usage.remainingMinutes} min`
    : `${usage.remainingMinutes} min remaining`;

  const tooltipText = isMomMode
    ? `Preostalo: ${usage.remainingMinutes}/${usage.totalMinutes} minuta ovog meseca`
    : `Remaining: ${usage.remainingMinutes}/${usage.totalMinutes} minutes this month`;

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg',
                'bg-[hsl(var(--surface))]/70 backdrop-blur-xl',
                'border border-[hsl(var(--border))]/50',
                'hover:bg-[hsl(var(--surface))]',
                'hover:border-[hsl(var(--primary))]/30',
                'transition-all duration-200',
                'focus-visible:outline-none focus-visible:ring-2',
                'focus-visible:ring-[hsl(var(--primary))]/50',
                'group',
                className
              )}
              aria-label={tooltipText}
            >
              {/* Icon with pulse animation when critical */}
              <div className="relative">
                <Fuel
                  className={cn(
                    'h-4 w-4',
                    colors.text,
                    'transition-colors duration-200'
                  )}
                />
                {usage.isCritical && (
                  <motion.span
                    className={cn(
                      'absolute inset-0 rounded-full',
                      colors.bg,
                      'opacity-75'
                    )}
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.75, 0, 0.75]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                  />
                )}
              </div>

              {/* Progress bar container */}
              <div className="fuel-gauge-details flex items-center gap-2 min-w-[120px]">
                {/* Bar */}
                <div className="relative w-full h-1.5 bg-[hsl(var(--border))] rounded-full overflow-hidden">
                  <motion.div
                    className={cn(colors.bg, 'h-full rounded-full')}
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - usage.percentUsed}%` }}
                    transition={{
                      duration: 0.8,
                      ease: 'easeOut',
                      delay: 0.2
                    }}
                  />
                </div>

                {/* Label */}
                <span
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    'text-[hsl(var(--text-muted))]',
                    'group-hover:text-[hsl(var(--text-high))]',
                    'transition-colors duration-200'
                  )}
                >
                  {label}
                </span>
              </div>
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className={cn(
              'bg-[hsl(var(--surface))] backdrop-blur-xl',
              'border border-[hsl(var(--border))]'
            )}
          >
            <p className="text-xs">{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Upgrade Modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </>
  );
}
