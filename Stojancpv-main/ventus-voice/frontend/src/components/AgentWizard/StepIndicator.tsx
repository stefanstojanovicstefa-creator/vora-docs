/**
 * Step Indicator Component
 * Progress indicator for wizard steps with glassmorphism and animations
 */

import { memo } from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface Step {
  id: string;
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStepId: string;
  completedStepIds: string[];
  className?: string;
}

export const StepIndicator = memo(function StepIndicator({
  steps,
  currentStepId,
  completedStepIds,
  className,
}: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStepId);

  return (
    <div className={cn('w-full', className)}>
      {/* Desktop: Horizontal Progress Bar */}
      <div className="hidden md:flex items-center justify-between gap-2">
        {steps.map((step, index) => {
          const isCompleted = completedStepIds.includes(step.id);
          const isCurrent = step.id === currentStepId;
          const isUpcoming = index > currentIndex;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Indicator */}
              <div className="flex flex-col items-center gap-2 flex-shrink-0">
                <div
                  className={cn(
                    'relative w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm',
                    'transition-all duration-300 ease-out',
                    isCompleted &&
                      'bg-gradient-to-br from-[#99CDFF] to-[#4A9EFF] text-[#050505] shadow-lg shadow-[#99CDFF]/30',
                    isCurrent &&
                      'bg-gradient-to-br from-[#99CDFF] to-[#4A9EFF] text-[#050505] shadow-lg shadow-[#99CDFF]/30 animate-pulse-glow',
                    isUpcoming &&
                      'bg-[#121212]/70 backdrop-blur-md border border-[#27272A] text-[#A1A1AA]'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 animate-scale-in" />
                  ) : (
                    <span className="transition-transform duration-200">
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <p
                    className={cn(
                      'text-xs font-medium transition-colors duration-200',
                      isCurrent && 'text-[#EDEDED]',
                      !isCurrent && 'text-[#A1A1AA]'
                    )}
                  >
                    {step.label}
                  </p>
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="flex-1 h-0.5 mx-4 relative overflow-hidden rounded-full bg-[#27272A]">
                  <div
                    className={cn(
                      'absolute inset-y-0 left-0 transition-all duration-500 ease-out',
                      'bg-gradient-to-r from-[#99CDFF] to-[#4A9EFF]',
                      index < currentIndex ? 'w-full' : 'w-0'
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: Vertical Progress Dots */}
      <div className="md:hidden flex flex-col gap-3">
        {steps.map((step, index) => {
          const isCompleted = completedStepIds.includes(step.id);
          const isCurrent = step.id === currentStepId;
          const isUpcoming = index > currentIndex;

          return (
            <div key={step.id} className="flex items-start gap-3">
              {/* Step Indicator */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={cn(
                    'relative w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm',
                    'transition-all duration-300 ease-out',
                    isCompleted &&
                      'bg-gradient-to-br from-[#99CDFF] to-[#4A9EFF] text-[#050505]',
                    isCurrent &&
                      'bg-gradient-to-br from-[#99CDFF] to-[#4A9EFF] text-[#050505] animate-pulse-glow',
                    isUpcoming &&
                      'bg-[#121212]/70 backdrop-blur-md border border-[#27272A] text-[#A1A1AA]'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      'w-0.5 h-8 mt-1 rounded-full transition-colors duration-300',
                      index < currentIndex
                        ? 'bg-gradient-to-b from-[#99CDFF] to-[#4A9EFF]'
                        : 'bg-[#27272A]'
                    )}
                  />
                )}
              </div>

              {/* Step Content */}
              <div className="flex-1 pt-1">
                <p
                  className={cn(
                    'text-sm font-medium transition-colors duration-200',
                    isCurrent && 'text-[#EDEDED]',
                    !isCurrent && 'text-[#A1A1AA]'
                  )}
                >
                  {step.label}
                </p>
                {step.description && isCurrent && (
                  <p className="text-xs text-[#A1A1AA] mt-1">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes pulse-glow {
          0%, 100% {
            box-shadow: 0 0 20px hsl(var(--primary) / 0.3);
          }
          50% {
            box-shadow: 0 0 30px hsl(var(--primary) / 0.5);
          }
        }

        @keyframes scale-in {
          0% {
            transform: scale(0);
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
          }
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
});
