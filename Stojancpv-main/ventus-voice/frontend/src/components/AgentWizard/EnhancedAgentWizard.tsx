/**
 * Enhanced Agent Creation Wizard
 * Complete redesign following Vora brand guidelines with smooth animations
 *
 * REMOVED: Pre-warm functionality (PRD-001) - feature was not in use
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { StepIndicator, type Step } from './StepIndicator';
import { PromptInputStep } from './PromptInputStep';
import { VoiceSelectionStep } from './VoiceSelectionStep';
import { ConfigurationStep } from './ConfigurationStep';
import { EnhancedPreviewStep } from './EnhancedPreviewStep';
import { AgentDeploymentSuccess } from './AgentDeploymentSuccess';
import { WizardErrorBoundary } from './WizardErrorBoundary';
import { useAgentApi } from '../../hooks/useAgentApi';
import type { AgentConfig, Agent } from '../../types/agent';
import { cn } from '../../lib/utils';

interface EnhancedAgentWizardProps {
  userId: string;
}

type WizardStepId = 'prompt' | 'voice' | 'config' | 'preview' | 'success';

export function EnhancedAgentWizard({ userId }: EnhancedAgentWizardProps) {
  const navigate = useNavigate();
  const { t } = useTranslation(['agent', 'common']);
  const agentApi = useAgentApi();
  const [currentStep, setCurrentStep] = useState<WizardStepId>('prompt');
  const [completedSteps, setCompletedSteps] = useState<WizardStepId[]>([]);
  const [config, setConfig] = useState<Partial<AgentConfig>>({
    voiceProvider: 'elevenlabs',
    llmProvider: 'openai',
    temperature: 0.7,
    maxTokens: 2048,
    enableMemory: true,
    enableTranscription: true,
    enableAnalytics: true,
    enableFallback: false,
  });
  const [createdAgent, setCreatedAgent] = useState<Agent | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployStatus, setDeployStatus] = useState('');

  // Focus management - focus step container when step changes (PRD-003 R4)
  const stepContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus the step container when step changes for screen readers
    stepContainerRef.current?.focus();
  }, [currentStep]);

  const wizardSteps: Step[] = useMemo(
    () => [
      {
        id: 'prompt',
        label: t('agent:wizard.steps.prompt.label'),
        description: t('agent:wizard.steps.prompt.description'),
      },
      {
        id: 'voice',
        label: t('agent:wizard.steps.voice.label'),
        description: t('agent:wizard.steps.voice.description'),
      },
      {
        id: 'config',
        label: t('agent:wizard.steps.config.label'),
        description: t('agent:wizard.steps.config.description'),
      },
      {
        id: 'preview',
        label: t('agent:wizard.steps.preview.label'),
        description: t('agent:wizard.steps.preview.description'),
      },
    ],
    [t]
  );

  // Navigate to next step
  const handleNext = (fromStep: WizardStepId) => {
    // Mark current step as completed
    if (!completedSteps.includes(fromStep)) {
      setCompletedSteps([...completedSteps, fromStep]);
    }

    // Move to next step
    const stepOrder: WizardStepId[] = ['prompt', 'voice', 'config', 'preview'];
    const currentIndex = stepOrder.indexOf(fromStep);
    if (currentIndex < stepOrder.length - 1) {
      setCurrentStep(stepOrder[currentIndex + 1]);
    }
  };

  // Go back to previous step
  const handleBack = (fromStep: WizardStepId) => {
    const stepOrder: WizardStepId[] = ['prompt', 'voice', 'config', 'preview'];
    const currentIndex = stepOrder.indexOf(fromStep);
    if (currentIndex > 0) {
      setCurrentStep(stepOrder[currentIndex - 1]);
    }
  };

  // Deploy agent (standard deployment only - prewarm removed in PRD-001)
  const handleDeploy = async () => {
    setIsDeploying(true);
    setDeployProgress(0);
    setDeployStatus('Starting...');

    try {
      // Create agent if not exists (now uses async polling with progress)
      let agent = createdAgent;
      if (!agent) {
        // Progress callback shows real-time compilation progress
        const onProgress = (progress: number, status: string) => {
          // Scale 0-100 to 0-80 (leave 20% for deployment step)
          setDeployProgress(Math.round(progress * 0.8));
          setDeployStatus(status);
        };

        agent = await agentApi.createDraftAgent(userId, config as AgentConfig, undefined, onProgress);
        setCreatedAgent(agent);
      } else {
        // Update existing agent with final config
        setDeployProgress(40);
        setDeployStatus('Updating agent configuration...');
        agent = await agentApi.updateAgent(agent.id, config as AgentConfig);
      }

      // Standard deployment flow
      setDeployProgress(85);
      setDeployStatus('Finalizing deployment...');
      toast.info(t('agent:wizard.deploy.startingStandard'));
      const deploymentResult = await agentApi.deployAgent(agent.id, config as AgentConfig);
      setDeploymentUrl(deploymentResult.deploymentUrl);

      setDeployProgress(100);
      setDeployStatus('Complete!');
      toast.success(t('agent:wizard.deploy.successStandard'));
      window.dispatchEvent(new CustomEvent('tutorial:validation', { detail: { key: 'agent_created' } }));

      // Redirect directly to test page instead of showing success step
      navigate(`/agents/${agent.id}/test`);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Deployment failed:', error);
      }
      toast.error(
        error instanceof Error ? error.message : t('agent:wizard.deploy.failed')
      );
    } finally {
      setIsDeploying(false);
      setDeployProgress(0);
      setDeployStatus('');
    }
  };

  // Handle completion
  const handleComplete = () => {
    navigate('/agents');
  };

  // Reset handler for error boundary
  const handleErrorReset = () => {
    setCurrentStep('prompt');
    setCompletedSteps([]);
    setCreatedAgent(null);
    setIsDeploying(false);
    setDeploymentUrl(null);
  };

  return (
    <WizardErrorBoundary onReset={handleErrorReset}>
      <div className="min-h-screen bg-[#050505] py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Step Indicator with accessibility */}
          {currentStep !== 'success' && (
            <div className="mb-8">
              <div
                role="progressbar"
                aria-valuenow={wizardSteps.findIndex(s => s.id === currentStep) + 1}
                aria-valuemin={1}
                aria-valuemax={wizardSteps.length}
                aria-label={`Step ${wizardSteps.findIndex(s => s.id === currentStep) + 1} of ${wizardSteps.length}: ${wizardSteps.find(s => s.id === currentStep)?.label}`}
              >
                <StepIndicator
                  steps={wizardSteps}
                  currentStepId={currentStep}
                  completedStepIds={completedSteps}
                />
              </div>
            </div>
          )}

          {/* Step Content - Glass Card Container with focus management */}
          <div
            ref={stepContainerRef}
            tabIndex={-1}
            aria-live="polite"
            className={cn(
              'p-6 md:p-8 rounded-xl outline-none',
              'bg-[#121212]/70 backdrop-blur-md border border-[#27272A]',
              'shadow-2xl',
              'transition-all duration-300 ease-out'
            )}
          >
          {/* Step 1: Prompt Input */}
          {currentStep === 'prompt' && (
            <PromptInputStep
              config={config}
              onConfigChange={setConfig}
              onNext={() => handleNext('prompt')}
            />
          )}

          {/* Step 2: Voice Selection */}
          {currentStep === 'voice' && (
            <VoiceSelectionStep
              config={config}
              onConfigChange={setConfig}
              onNext={() => handleNext('voice')}
              onBack={() => handleBack('voice')}
            />
          )}

          {/* Step 3: Configuration */}
          {currentStep === 'config' && (
            <ConfigurationStep
              config={config}
              onConfigChange={setConfig}
              onNext={() => handleNext('config')}
              onBack={() => handleBack('config')}
            />
          )}

          {/* Step 4: Preview & Deploy */}
          {currentStep === 'preview' && (
            <EnhancedPreviewStep
              config={config}
              onBack={() => handleBack('preview')}
              onDeploy={handleDeploy}
              isDeploying={isDeploying}
            />
          )}

          {/* Step 5: Success */}
          {currentStep === 'success' && (
            <AgentDeploymentSuccess
              agent={createdAgent!}
              deploymentUrl={deploymentUrl!}
              onComplete={handleComplete}
            />
          )}
        </div>
      </div>
    </div>
    </WizardErrorBoundary>
  );
}
