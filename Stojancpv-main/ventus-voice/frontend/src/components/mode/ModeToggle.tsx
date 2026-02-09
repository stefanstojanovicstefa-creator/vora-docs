/**
 * Mode Toggle Component
 *
 * Animated toggle switch for Mom Mode (Simple) ↔ God Mode (Advanced).
 * Features smooth spring animations, tooltips, and accessibility support.
 */

import { motion } from 'framer-motion';
import { Sparkles, Settings2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useViewMode } from '@/hooks/useViewMode';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ModeToggleProps {
  className?: string;
}

export function ModeToggle({ className }: ModeToggleProps) {
  const { mode, toggleMode, isMomMode } = useViewMode();
  const { t } = useTranslation(['common']);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={toggleMode}
            className={cn(
              'relative flex items-center gap-2 px-1 py-1',
              'h-10 w-[180px] rounded-full',
              'bg-[hsl(var(--surface))] border border-[hsl(var(--border))]',
              'transition-all duration-200',
              'hover:border-[hsl(var(--primary)_/_0.5)]',
              'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary)_/_0.3)]',
              className
            )}
            aria-label={
              isMomMode
                ? t('common:mode.switchToAdvancedAria')
                : t('common:mode.switchToSimpleAria')
            }
            aria-pressed={!isMomMode}
          >
            {/* Animated Sliding Background */}
            <motion.div
              className={cn(
                'absolute inset-y-1 w-[calc(50%-4px)] rounded-full',
                'bg-[hsl(var(--primary))] shadow-lg',
                'shadow-[hsl(var(--primary)_/_0.3)]'
              )}
              initial={false}
              animate={{
                x: isMomMode ? 2 : 'calc(100% + 4px)',
              }}
              transition={{
                type: 'spring',
                stiffness: 500,
                damping: 30,
              }}
            />

            {/* Mom Mode Label */}
            <div
              className={cn(
                'relative z-10 flex items-center justify-center gap-1.5',
                'flex-1 px-3 py-1.5 rounded-full',
                'text-sm font-medium',
                'transition-colors duration-200',
                isMomMode
                  ? 'text-[hsl(var(--void))]'
                  : 'text-[hsl(var(--text-muted))]'
              )}
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>{t('common:mode.simple')}</span>
            </div>

            {/* God Mode Label */}
            <div
              className={cn(
                'relative z-10 flex items-center justify-center gap-1.5',
                'flex-1 px-3 py-1.5 rounded-full',
                'text-sm font-medium',
                'transition-colors duration-200',
                !isMomMode
                  ? 'text-[hsl(var(--void))]'
                  : 'text-[hsl(var(--text-muted))]'
              )}
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              <span>{t('common:mode.advanced')}</span>
            </div>
          </button>
        </TooltipTrigger>

        <TooltipContent
          side="bottom"
          className={cn(
            'max-w-xs',
            'bg-[hsl(var(--surface))]/95 backdrop-blur-xl',
            'border border-[hsl(var(--border))]',
            'text-[hsl(var(--text-high))]'
          )}
        >
          <div className="space-y-2">
            <p className="font-medium">
              {isMomMode ? t('common:mode.simpleTitle') : t('common:mode.advancedTitle')}
            </p>
            <p className="text-sm text-[hsl(var(--text-muted))]">
              {isMomMode ? t('common:mode.simpleDescription') : t('common:mode.advancedDescription')}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
