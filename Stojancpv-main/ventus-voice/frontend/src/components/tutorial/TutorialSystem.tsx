/**
 * Tutorial System Component
 *
 * Interactive step-by-step tutorial system that guides users through their
 * first voice agent creation journey.
 *
 * Part of Phase 1 - P0 Journey (P0J-01, P0J-03)
 *
 * Features:
 * - 4 core steps: Welcome → Create Agent → Test Agent → Connect Number
 * - Blocks progression until each step is validated
 * - Mom Mode: Simpler language, more hand-holding
 * - God Mode: Technical details, advanced options
 * - Keyboard navigation (Enter = Next, Escape = Skip)
 * - PostHog analytics tracking
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Phone,
  Rocket,
  ArrowRight,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useTutorial } from '@/hooks/useTutorial';
import { useAnalytics } from '@/hooks/useAnalytics';

// ============================================================================
// Step Definitions
// ============================================================================

interface StepDefinition {
  id: number;
  icon: typeof Sparkles;
  title: string;
  titleMom: string;
  description: string;
  descriptionMom: string;
  action: string;
  actionMom: string;
  route?: string;
  validationKey?: string;
  tips: string[];
  tipsMom: string[];
}

const TUTORIAL_STEPS: StepDefinition[] = [
  {
    id: 1,
    icon: Sparkles,
    title: 'Welcome to Vora',
    titleMom: 'Welcome! Let\'s Get Started',
    description:
      'Build production-grade voice AI agents in minutes. This tutorial will guide you through creating your first agent, testing it, and connecting a phone number.',
    descriptionMom:
      'We\'ll help you create your first voice AI agent step-by-step. Don\'t worry, we\'ll guide you through everything!',
    action: 'Start Tutorial',
    actionMom: 'Let\'s Begin',
    tips: [
      'Tutorial takes ~10 minutes',
      'Progress is auto-saved',
      'Press Escape to skip anytime',
    ],
    tipsMom: [
      'This will take about 10 minutes',
      'You can pause and come back later',
      'Press Escape if you want to skip',
    ],
  },
  {
    id: 2,
    icon: Rocket,
    title: 'Create Your First Agent',
    titleMom: 'Let\'s Create Your Agent',
    description:
      'Navigate to the agent creation hub and build your first voice AI agent. Choose a template or start from scratch with custom prompts and voice settings.',
    descriptionMom:
      'Click the "Create Agent" button and follow the steps. Pick a template if you\'re not sure where to start.',
    action: 'Go to Agent Creation',
    actionMom: 'Create My Agent',
    route: '/agents/create',
    validationKey: 'agent_created',
    tips: [
      'Templates accelerate setup',
      'Customize voice, prompt, and functions',
      'God Mode: Advanced provider selection',
    ],
    tipsMom: [
      'Templates make it easier',
      'You can customize everything later',
      'Just pick one to get started',
    ],
  },
  {
    id: 3,
    icon: Zap,
    title: 'Test Your Agent',
    titleMom: 'Try Talking to Your Agent',
    description:
      'Launch the Forge interface to test your agent with real voice interactions. Verify latency, response quality, and function calling behavior.',
    descriptionMom:
      'Click the "Test" button to talk to your agent. Just click the microphone and start speaking!',
    action: 'Test Agent',
    actionMom: 'Start Testing',
    route: '/agents/:agentId/test',
    validationKey: 'agent_tested',
    tips: [
      'Test with real conversations',
      'Check latency and interruption handling',
      'God Mode: Monitor token usage and provider health',
    ],
    tipsMom: [
      'Speak naturally like a phone call',
      'The agent will respond with voice',
      'Don\'t worry about mistakes',
    ],
  },
  {
    id: 4,
    icon: Phone,
    title: 'Connect a Phone Number',
    titleMom: 'Get Your Phone Number',
    description:
      'Purchase a phone number from our provider network and connect it to your agent. Configure caller ID, recording, and voicemail settings.',
    descriptionMom:
      'Get a phone number so people can call your agent. We\'ll help you pick a number and set it up.',
    action: 'Get Phone Number',
    actionMom: 'Connect Number',
    route: '/phone-numbers',
    validationKey: 'phone_connected',
    tips: [
      'Numbers available in 60+ countries',
      'Instant provisioning (~30 seconds)',
      'God Mode: Advanced SIP trunk configuration',
    ],
    tipsMom: [
      'Pick any available number',
      'It connects instantly',
      'You can change it later',
    ],
  },
];

// ============================================================================
// Component
// ============================================================================

export function TutorialSystem() {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const {
    state,
    shouldShowTutorial,
    currentStep,
    totalSteps,
    completedSteps,
    mode,
    advanceStep,
    dismissTutorial,
    completeTutorial,
    isUpdating,
  } = useTutorial();

  const [showSkipDialog, setShowSkipDialog] = useState(false);
  const [stepValidated, setStepValidated] = useState(false);

  const isMomMode = mode === 'mom';
  const currentStepDef = TUTORIAL_STEPS.find((s) => s.id === currentStep);
  const progressPercent = (completedSteps.length / totalSteps) * 100;

  // Listen for validation events from other components
  useEffect(() => {
    const handleValidation = (event: CustomEvent) => {
      const { key } = event.detail;
      if (currentStepDef?.validationKey === key) {
        setStepValidated(true);
        trackEvent({
          name: 'tutorial_step_validated',
          properties: {
            step: currentStep,
            validation_key: key,
            mode,
          },
        });
      }
    };

    window.addEventListener('tutorial:validation' as any, handleValidation);
    return () =>
      window.removeEventListener('tutorial:validation' as any, handleValidation);
  }, [currentStep, currentStepDef, mode, trackEvent]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!shouldShowTutorial) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSkipDialog(true);
      } else if (e.key === 'Enter' && canProceed) {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldShowTutorial]);

  const canProceed =
    currentStep === 1 || // Welcome step always allows proceeding
    stepValidated || // Step has been validated
    completedSteps.includes(currentStep); // Already completed this step

  const handleNext = async () => {
    if (!canProceed) return;

    // Last step - complete tutorial
    if (currentStep === totalSteps) {
      await completeTutorial();
      navigate('/dashboard');
      return;
    }

    // Advance to next step
    await advanceStep();
    setStepValidated(false);

    // Navigate if next step has a route
    const nextStepDef = TUTORIAL_STEPS.find((s) => s.id === currentStep + 1);
    if (nextStepDef?.route) {
      // Replace :agentId with actual agent ID if available
      let route = nextStepDef.route;
      if (route.includes(':agentId') && state?.metadata?.agentId) {
        route = route.replace(':agentId', state.metadata.agentId);
      }
      navigate(route);
    }
  };

  const handleSkip = () => {
    setShowSkipDialog(true);
  };

  const handleSkipConfirm = async () => {
    await dismissTutorial();
    setShowSkipDialog(false);
    navigate('/dashboard');
  };

  if (!shouldShowTutorial || !currentStepDef) {
    return null;
  }

  const Icon = currentStepDef.icon;
  const title = isMomMode ? currentStepDef.titleMom : currentStepDef.title;
  const description = isMomMode
    ? currentStepDef.descriptionMom
    : currentStepDef.description;
  const actionLabel = isMomMode
    ? currentStepDef.actionMom
    : currentStepDef.action;
  const tips = isMomMode ? currentStepDef.tipsMom : currentStepDef.tips;

  return (
    <>
      {/* Tutorial Modal */}
      <AnimatePresence>
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--void))]/60 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25 }}
          >
            <Card
              className={cn(
                'relative w-full max-w-2xl',
                'bg-[#121212]/90 backdrop-blur-xl',
                'border-[#27272A]/50',
                'shadow-[0_0_40px_rgba(153,205,255,0.15)]',
              )}
            >
              {/* Progress Bar */}
              <div className="absolute top-0 inset-x-0 h-1 bg-[#27272A] rounded-t-2xl overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#99CDFF] to-[#4A9EFF]"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>

              <div className="p-8 space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'flex items-center justify-center',
                        'w-16 h-16 rounded-2xl',
                        'bg-gradient-to-br from-[#99CDFF]/20 to-[#4A9EFF]/20',
                        'border border-[#99CDFF]/30',
                      )}
                    >
                      <Icon className="w-8 h-8 text-[#99CDFF]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-2xl font-semibold text-[#EDEDED]">
                          {title}
                        </h2>
                        <Badge
                          variant="outline"
                          className="border-[#99CDFF]/30 text-[#99CDFF] text-xs"
                        >
                          Step {currentStep} of {totalSteps}
                        </Badge>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          isMomMode
                            ? 'border-pink-500/30 text-pink-400'
                            : 'border-purple-500/30 text-purple-400',
                        )}
                      >
                        <Settings className="w-3 h-3 me-1" />
                        {isMomMode ? 'Mom Mode' : 'God Mode'}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[#A1A1AA] text-lg leading-relaxed">
                  {description}
                </p>

                {/* Tips */}
                <div className="space-y-2">
                  {tips.map((tip, idx) => (
                    <motion.div
                      key={idx}
                      className="flex items-start gap-2 text-sm text-[#A1A1AA]"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-[#4ADE80] mt-0.5 flex-shrink-0" />
                      <span>{tip}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Validation Status */}
                {currentStepDef.validationKey && (
                  <AnimatePresence>
                    {!stepValidated && currentStep !== 1 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-[#FBBF24]/10 border border-[#FBBF24]/30"
                      >
                        <AlertTriangle className="w-4 h-4 text-[#FBBF24]" />
                        <span className="text-sm text-[#FBBF24]">
                          Complete this step to continue
                        </span>
                      </motion.div>
                    )}
                    {stepValidated && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2 p-3 rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/30"
                      >
                        <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
                        <span className="text-sm text-[#4ADE80]">
                          Step completed! Click next to continue
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-[#27272A]">
                  <Button
                    variant="ghost"
                    onClick={handleSkip}
                    className="text-[#A1A1AA] hover:text-[#EDEDED]"
                    disabled={isUpdating}
                  >
                    Skip Tutorial
                  </Button>

                  <div className="flex items-center gap-2">
                    {currentStep > 1 && (
                      <Button
                        variant="outline"
                        onClick={() => advanceStep(currentStep - 1)}
                        disabled={isUpdating}
                        className="border-[#27272A] hover:border-[#99CDFF]/50"
                      >
                        Previous
                      </Button>
                    )}
                    <Button
                      onClick={handleNext}
                      disabled={!canProceed || isUpdating}
                      className={cn(
                        'bg-[#99CDFF] text-[#050505]',
                        'hover:bg-[#BDDCFF]',
                        'hover:shadow-[0_0_20px_rgba(153,205,255,0.3)]',
                        'transition-all duration-200',
                        'disabled:opacity-50 disabled:cursor-not-allowed',
                      )}
                    >
                      {currentStep === totalSteps ? (
                        <>
                          Complete Tutorial
                          <CheckCircle2 className="w-4 h-4 ms-2" />
                        </>
                      ) : (
                        <>
                          {actionLabel}
                          <ArrowRight className="w-4 h-4 ms-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Step Indicators */}
                <div className="flex items-center justify-center gap-2">
                  {TUTORIAL_STEPS.map((step) => (
                    <div
                      key={step.id}
                      className={cn(
                        'h-2 rounded-full transition-all duration-300',
                        step.id === currentStep
                          ? 'w-8 bg-[#99CDFF]'
                          : completedSteps.includes(step.id)
                            ? 'w-2 bg-[#4ADE80]'
                            : 'w-2 bg-[#27272A]',
                      )}
                    />
                  ))}
                </div>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      </AnimatePresence>

      {/* Skip Confirmation Dialog */}
      <AlertDialog open={showSkipDialog} onOpenChange={setShowSkipDialog}>
        <AlertDialogContent className="bg-[#121212] border-[#27272A]">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-[#EDEDED]">
              <AlertTriangle className="h-5 w-5 text-[#FBBF24]" />
              Skip Tutorial?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[#A1A1AA]">
              {isMomMode
                ? 'Are you sure? This tutorial helps you get started quickly. You can always come back to it later from Settings.'
                : 'The tutorial guides you through creating your first production-ready agent in ~10 minutes. You can restart from Settings anytime.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setShowSkipDialog(false)}
              className="border-[#27272A] hover:bg-[#27272A]/50"
            >
              Continue Tutorial
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSkipConfirm}
              className="bg-[#F87171] hover:bg-[#F87171]/90 text-white"
            >
              Skip Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
