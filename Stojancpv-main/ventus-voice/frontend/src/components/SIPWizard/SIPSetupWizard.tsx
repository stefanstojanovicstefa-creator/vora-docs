/**
 * SIPSetupWizard Component
 * Multi-step wizard for SIP trunk creation with validation and progress tracking
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Loader2, X } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from '@/lib/toast';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '../../lib/error-message';
import { sipService } from '../../services/sip.service';
import { useSIPWizard, type WizardStep } from '../../hooks/useSIPWizard';
import { WizardStepper, type StepConfig } from './WizardStepper';
import { ProviderSelectStep } from './ProviderSelectStep';
import { CredentialsStep } from './CredentialsStep';
import { ConfigurationStep } from './ConfigurationStep';
import { PhoneNumberStep } from './PhoneNumberStep';
import { TestAndConfirmStep } from './TestAndConfirmStep';
import type { CreateSIPTrunkRequest } from '../../types/sip.types';

interface SIPSetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function SIPSetupWizard({ isOpen, onClose, onSuccess }: SIPSetupWizardProps) {
  const { t } = useTranslation(['common']);
  const queryClient = useQueryClient();

  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    progress,
    formData,
    validationErrors,
    completedSteps,
    goToStep,
    nextStep,
    previousStep,
    updateFormData,
    resetWizard,
    validateCurrentStep,
    canGoNext,
    canGoBack,
    isFirstStep,
    isLastStep,
  } = useSIPWizard();

  // Step configurations
  const STEP_CONFIGS: StepConfig[] = [
    {
      id: 'provider',
      label: t('common:pages.phoneNumbers.wizard.steps.provider', 'Provider'),
      description: t(
        'common:pages.phoneNumbers.wizard.steps.providerDesc',
        'Choose carrier'
      ),
    },
    {
      id: 'credentials',
      label: t('common:pages.phoneNumbers.wizard.steps.credentials', 'Credentials'),
      description: t(
        'common:pages.phoneNumbers.wizard.steps.credentialsDesc',
        'Enter details'
      ),
    },
    {
      id: 'configuration',
      label: t('common:pages.phoneNumbers.wizard.steps.configuration', 'Configuration'),
      description: t(
        'common:pages.phoneNumbers.wizard.steps.configurationDesc',
        'Setup trunk'
      ),
    },
    {
      id: 'phoneNumbers',
      label: t('common:pages.phoneNumbers.wizard.steps.phoneNumbers', 'Phone Numbers'),
      description: t(
        'common:pages.phoneNumbers.wizard.steps.phoneNumbersDesc',
        'Add numbers'
      ),
    },
    {
      id: 'testConfirm',
      label: t('common:pages.phoneNumbers.wizard.steps.testConfirm', 'Review'),
      description: t(
        'common:pages.phoneNumbers.wizard.steps.testConfirmDesc',
        'Test & confirm'
      ),
    },
  ];

  // Create trunk mutation
  const createTrunkMutation = useMutation({
    mutationFn: (request: CreateSIPTrunkRequest) => sipService.createTrunk(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sip-trunks'] });
      toast.success(t('common:pages.phoneNumbers.toasts.trunkCreated'));
      window.dispatchEvent(new CustomEvent('tutorial:validation', { detail: { key: 'phone_connected' } }));
      resetWizard();
      onSuccess?.();
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(
        getErrorMessage(error, t('common:pages.phoneNumbers.toasts.trunkCreateFailed'))
      );
    },
  });

  // Handle navigation
  const handleNext = () => {
    if (!validateCurrentStep()) {
      return;
    }
    nextStep();
  };

  const handleBack = () => {
    previousStep();
  };

  const handleClose = () => {
    if (window.confirm(t('common:pages.phoneNumbers.wizard.confirmClose', 'Are you sure you want to close? Your progress will be saved.'))) {
      onClose();
    }
  };

  const handleCreate = () => {
    if (!validateCurrentStep()) {
      return;
    }
    createTrunkMutation.mutate(formData);
  };

  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'provider':
        return (
          <ProviderSelectStep
            selectedProvider={formData.provider}
            onSelectProvider={(provider) => updateFormData({ provider })}
          />
        );
      case 'credentials':
        return (
          <CredentialsStep
            formData={formData}
            validationErrors={validationErrors}
            onUpdateFormData={updateFormData}
          />
        );
      case 'configuration':
        return (
          <ConfigurationStep
            formData={formData}
            validationErrors={validationErrors}
            onUpdateFormData={updateFormData}
          />
        );
      case 'phoneNumbers':
        return (
          <PhoneNumberStep
            formData={formData}
            validationErrors={validationErrors}
            onUpdateFormData={updateFormData}
          />
        );
      case 'testConfirm':
        return <TestAndConfirmStep formData={formData} />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto bg-[#121212]/95 backdrop-blur-xl border-[#27272A]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-2xl font-bold text-[#EDEDED]">
                {t('common:pages.phoneNumbers.wizard.title', 'Create SIP Trunk')}
              </DialogTitle>
              <DialogDescription className="text-[#A1A1AA]">
                {t(
                  'common:pages.phoneNumbers.wizard.subtitle',
                  'Follow the steps below to set up your SIP trunk configuration'
                )}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0 text-[#A1A1AA] hover:text-[#EDEDED] hover:bg-[#050505]"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* Progress Stepper */}
        <div className="my-6">
          <WizardStepper
            steps={STEP_CONFIGS}
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={(step) => {
              if (completedSteps.has(step)) {
                goToStep(step);
              }
            }}
          />
        </div>

        {/* Step Content */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation Footer */}
        <div className="flex items-center justify-between pt-6 border-t border-[#27272A]">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={!canGoBack}
              className="border-[#27272A] text-[#A1A1AA] hover:bg-[#050505] hover:text-[#EDEDED]"
            >
              <ArrowLeft className="h-4 w-4 me-2" />
              {t('common:actions.back', 'Back')}
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-[#A1A1AA]">
              {t('common:pages.phoneNumbers.wizard.stepProgress', 'Step {{current}} of {{total}}', {
                current: currentStepIndex + 1,
                total: totalSteps,
              })}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {!isLastStep ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canGoNext}
                className="bg-[#99CDFF] text-[#050505] hover:bg-[#BDDCFF] hover:shadow-[0_0_20px_rgba(153,205,255,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common:actions.next', 'Next')}
                <ArrowRight className="h-4 w-4 ms-2" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleCreate}
                disabled={!canGoNext || createTrunkMutation.isPending}
                className="bg-[#99CDFF] text-[#050505] hover:bg-[#BDDCFF] hover:shadow-[0_0_20px_rgba(153,205,255,0.3)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createTrunkMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                    {t('common:pages.phoneNumbers.wizard.creating', 'Creating...')}
                  </>
                ) : (
                  t('common:pages.phoneNumbers.wizard.createTrunk', 'Create Trunk')
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
