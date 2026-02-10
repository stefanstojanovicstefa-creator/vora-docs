/**
 * Onboarding Survey Component
 *
 * Optional, skippable survey that collects user context to personalize
 * the product experience. NEVER blocks user flow.
 *
 * Part of Phase 1 - P0 Journey (P0J-04)
 *
 * Features:
 * - React Hook Form + Zod validation
 * - Always skippable (never required)
 * - Saves to backend for analytics
 * - Questions: Use case, team size, industry
 * - PostHog event tracking
 */

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Briefcase,
  Target,
  X,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { apiClient } from '@/lib/api-client';
import { useAnalytics } from '@/hooks/useAnalytics';
import { toast } from 'sonner';

// ============================================================================
// Schema
// ============================================================================

const onboardingSurveySchema = z.object({
  useCase: z.string().optional(),
  useCaseOther: z.string().optional(),
  teamSize: z.string().optional(),
  industry: z.string().optional(),
  industryOther: z.string().optional(),
  additionalNotes: z.string().optional(),
});

type OnboardingSurveyData = z.infer<typeof onboardingSurveySchema>;

// ============================================================================
// Constants
// ============================================================================

const USE_CASES = [
  { value: 'customer_support', label: 'Customer Support' },
  { value: 'lead_qualification', label: 'Lead Qualification' },
  { value: 'appointment_booking', label: 'Appointment Booking' },
  { value: 'surveys_feedback', label: 'Surveys & Feedback' },
  { value: 'order_taking', label: 'Order Taking' },
  { value: 'internal_tools', label: 'Internal Tools' },
  { value: 'education_training', label: 'Education & Training' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' },
];

const TEAM_SIZES = [
  { value: 'solo', label: 'Just me' },
  { value: '2-10', label: '2-10 people' },
  { value: '11-50', label: '11-50 people' },
  { value: '51-200', label: '51-200 people' },
  { value: '201-1000', label: '201-1,000 people' },
  { value: '1000+', label: '1,000+ people' },
];

const INDUSTRIES = [
  { value: 'technology', label: 'Technology & Software' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'finance', label: 'Finance & Banking' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'education', label: 'Education' },
  { value: 'hospitality', label: 'Hospitality & Travel' },
  { value: 'professional_services', label: 'Professional Services' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'other', label: 'Other' },
];

// ============================================================================
// API Functions
// ============================================================================

async function submitSurvey(data: OnboardingSurveyData): Promise<void> {
  await apiClient.post('/api/onboarding/survey', data);
}

// ============================================================================
// Component
// ============================================================================

interface OnboardingSurveyProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
  className?: string;
}

export function OnboardingSurvey({
  open,
  onClose,
  onComplete,
  className,
}: OnboardingSurveyProps) {
  const { trackEvent } = useAnalytics();
  const [currentStep, setCurrentStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);

  const form = useForm<OnboardingSurveyData>({
    resolver: zodResolver(onboardingSurveySchema),
    defaultValues: {
      useCase: '',
      useCaseOther: '',
      teamSize: '',
      industry: '',
      industryOther: '',
      additionalNotes: '',
    },
  });

  const useCase = form.watch('useCase');
  const industry = form.watch('industry');

  const submitMutation = useMutation({
    mutationFn: submitSurvey,
    onSuccess: () => {
      trackEvent({
        name: 'onboarding_survey_completed',
        properties: {
          use_case: form.getValues('useCase'),
          team_size: form.getValues('teamSize'),
          industry: form.getValues('industry'),
        },
      });
      setShowSuccess(true);
      setTimeout(() => {
        onComplete?.();
        onClose();
      }, 2000);
    },
    onError: (error) => {
      console.error('Failed to submit survey:', error);
      toast.error('Failed to save survey. You can continue anyway.');
    },
  });

  const handleSkip = () => {
    trackEvent({
      name: 'onboarding_survey_skipped',
      properties: {
        current_step: currentStep,
      },
    });
    onClose();
  };

  const handleSubmit = form.handleSubmit((data) => {
    submitMutation.mutate(data);
  });

  if (!open) return null;

  if (showSuccess) {
    return (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--void))]/60 backdrop-blur-sm p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div
            className={cn(
              'inline-flex items-center justify-center',
              'w-20 h-20 rounded-full',
              'bg-[#4ADE80]/20 border-2 border-[#4ADE80]',
              'mb-4',
            )}
          >
            <CheckCircle2 className="w-10 h-10 text-[#4ADE80]" />
          </div>
          <h3 className="text-2xl font-semibold text-[#EDEDED] mb-2">
            Thank you!
          </h3>
          <p className="text-[#A1A1AA]">
            Your feedback helps us serve you better
          </p>
        </motion.div>
      </motion.div>
    );
  }

  return (
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
        >
          <Card
            className={cn(
              'relative w-full max-w-lg',
              'bg-[#121212]/90 backdrop-blur-xl',
              'border-[#27272A]/50',
              className,
            )}
          >
            {/* Close Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSkip}
              className="absolute top-4 end-4 text-[#A1A1AA] hover:text-[#EDEDED]"
            >
              <X className="w-4 h-4" />
            </Button>

            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              {/* Header */}
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-[#EDEDED]">
                  Help us personalize your experience
                </h2>
                <p className="text-[#A1A1AA]">
                  Optional - Skip anytime. Takes less than 2 minutes.
                </p>
              </div>

              {/* Questions */}
              <div className="space-y-6">
                {/* Use Case */}
                <div className="space-y-2">
                  <Label
                    htmlFor="useCase"
                    className="flex items-center gap-2 text-[#EDEDED]"
                  >
                    <Target className="w-4 h-4 text-[#99CDFF]" />
                    What will you use Vora for?
                  </Label>
                  <Select
                    value={form.watch('useCase')}
                    onValueChange={(value) => form.setValue('useCase', value)}
                  >
                    <SelectTrigger
                      id="useCase"
                      className="bg-[#121212] border-[#27272A] text-[#EDEDED]"
                    >
                      <SelectValue placeholder="Select a use case" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-[#27272A]">
                      {USE_CASES.map((uc) => (
                        <SelectItem key={uc.value} value={uc.value}>
                          {uc.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {useCase === 'other' && (
                    <Textarea
                      {...form.register('useCaseOther')}
                      placeholder="Tell us more..."
                      className="bg-[#121212] border-[#27272A] text-[#EDEDED] placeholder-[#A1A1AA] mt-2"
                      rows={2}
                    />
                  )}
                </div>

                {/* Team Size */}
                <div className="space-y-2">
                  <Label
                    htmlFor="teamSize"
                    className="flex items-center gap-2 text-[#EDEDED]"
                  >
                    <Users className="w-4 h-4 text-[#99CDFF]" />
                    How large is your team?
                  </Label>
                  <Select
                    value={form.watch('teamSize')}
                    onValueChange={(value) => form.setValue('teamSize', value)}
                  >
                    <SelectTrigger
                      id="teamSize"
                      className="bg-[#121212] border-[#27272A] text-[#EDEDED]"
                    >
                      <SelectValue placeholder="Select team size" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-[#27272A]">
                      {TEAM_SIZES.map((ts) => (
                        <SelectItem key={ts.value} value={ts.value}>
                          {ts.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Industry */}
                <div className="space-y-2">
                  <Label
                    htmlFor="industry"
                    className="flex items-center gap-2 text-[#EDEDED]"
                  >
                    <Briefcase className="w-4 h-4 text-[#99CDFF]" />
                    What industry are you in?
                  </Label>
                  <Select
                    value={form.watch('industry')}
                    onValueChange={(value) => form.setValue('industry', value)}
                  >
                    <SelectTrigger
                      id="industry"
                      className="bg-[#121212] border-[#27272A] text-[#EDEDED]"
                    >
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#121212] border-[#27272A]">
                      {INDUSTRIES.map((ind) => (
                        <SelectItem key={ind.value} value={ind.value}>
                          {ind.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {industry === 'other' && (
                    <Textarea
                      {...form.register('industryOther')}
                      placeholder="Tell us more..."
                      className="bg-[#121212] border-[#27272A] text-[#EDEDED] placeholder-[#A1A1AA] mt-2"
                      rows={2}
                    />
                  )}
                </div>

                {/* Additional Notes */}
                <div className="space-y-2">
                  <Label
                    htmlFor="additionalNotes"
                    className="text-[#EDEDED]"
                  >
                    Anything else we should know? (Optional)
                  </Label>
                  <Textarea
                    {...form.register('additionalNotes')}
                    id="additionalNotes"
                    placeholder="Tell us about your goals, challenges, or anything that would help us serve you better..."
                    className="bg-[#121212] border-[#27272A] text-[#EDEDED] placeholder-[#A1A1AA]"
                    rows={3}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-[#27272A]">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-[#A1A1AA] hover:text-[#EDEDED]"
                >
                  Skip for now
                </Button>
                <Button
                  type="submit"
                  disabled={submitMutation.isPending}
                  className={cn(
                    'bg-[#99CDFF] text-[#050505]',
                    'hover:bg-[#BDDCFF]',
                    'hover:shadow-[0_0_20px_rgba(153,205,255,0.3)]',
                    'transition-all duration-200',
                  )}
                >
                  {submitMutation.isPending ? (
                    'Saving...'
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="w-4 h-4 ms-2" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
