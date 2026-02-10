/**
 * Prompt Input Step
 * Large textarea with glassmorphism, character count, and real-time validation
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AgentConfig } from '../../types/agent';

interface PromptInputStepProps {
  config: Partial<AgentConfig>;
  onConfigChange: (config: Partial<AgentConfig>) => void;
  onNext: () => void;
}

const MIN_PROMPT_LENGTH = 20;
const MAX_PROMPT_LENGTH = 2000;
const RECOMMENDED_PROMPT_LENGTH = 150;

export function PromptInputStep({
  config,
  onConfigChange,
  onNext,
}: PromptInputStepProps) {
  const { t } = useTranslation(['agent', 'common']);
  const [isFocused, setIsFocused] = useState(false);

  const promptLength = config.systemPrompt?.length || 0;
  const nameLength = config.name?.length || 0;

  const isNameValid = nameLength >= 3;
  const isPromptValid = promptLength >= MIN_PROMPT_LENGTH && promptLength <= MAX_PROMPT_LENGTH;
  const isFormValid = isNameValid && isPromptValid;

  const handleChange = (field: keyof AgentConfig, value: string) => {
    onConfigChange({ ...config, [field]: value });
  };

  const getPromptLengthColor = () => {
    if (promptLength === 0) return 'text-[#A1A1AA]';
    if (promptLength < MIN_PROMPT_LENGTH) return 'text-[#FBBF24]';
    if (promptLength > MAX_PROMPT_LENGTH) return 'text-[#F87171]';
    if (promptLength < RECOMMENDED_PROMPT_LENGTH) return 'text-[#60A5FA]';
    return 'text-[#4ADE80]';
  };

  const getPromptHelperText = () => {
    if (promptLength === 0) return t('agent:wizard.prompt.validation.helper.startTyping');
    if (promptLength < MIN_PROMPT_LENGTH) {
      return t('agent:wizard.prompt.validation.helper.minChars', { min: MIN_PROMPT_LENGTH });
    }
    if (promptLength > MAX_PROMPT_LENGTH) return t('agent:wizard.prompt.validation.helper.maxExceeded');
    if (promptLength < RECOMMENDED_PROMPT_LENGTH) return t('agent:wizard.prompt.validation.helper.lookingGood');
    return t('agent:wizard.prompt.validation.helper.excellent');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[#99CDFF]" />
          <h2 className="text-2xl font-semibold text-[#EDEDED]">
            {t('agent:wizard.prompt.title')}
          </h2>
        </div>
        <p className="text-[#A1A1AA]">
          {t('agent:wizard.prompt.subtitle')}
        </p>
      </div>

      {/* Agent Name */}
      <div className="space-y-2">
        <Label htmlFor="agent-name" className="text-[#EDEDED] font-medium">
          {t('agent:wizard.prompt.fields.agentName')}
        </Label>
        <Input
          id="agent-name"
          placeholder={t('agent:wizard.prompt.fields.agentNamePlaceholder')}
          value={config.name || ''}
          onChange={(e) => handleChange('name', e.target.value)}
          onFocus={() => {}}
          className={cn(
            'bg-[#121212]/70 backdrop-blur-md border-[#27272A]',
            'focus:border-[#99CDFF] focus:ring-[#99CDFF]/20',
            'text-[#EDEDED] placeholder:text-[#A1A1AA]',
            'transition-all duration-200'
          )}
        />
        <div className="flex items-center justify-between text-xs">
          <span className={cn('transition-colors', nameLength >= 3 ? 'text-[#4ADE80]' : 'text-[#A1A1AA]')}>
            {nameLength >= 3
              ? t('agent:wizard.prompt.validation.nameOk')
              : t('agent:wizard.prompt.validation.nameMin')}
          </span>
          <span className="text-[#A1A1AA]">{t('agent:wizard.prompt.validation.charsCount', { count: nameLength })}</span>
        </div>
      </div>

      {/* System Prompt - Large Glass Textarea */}
      <div className="space-y-2">
        <Label htmlFor="system-prompt" className="text-[#EDEDED] font-medium">
          {t('agent:wizard.prompt.fields.systemPrompt')}
        </Label>
        <div className="relative">
          <textarea
            id="system-prompt"
            placeholder={t('agent:wizard.prompt.fields.systemPromptPlaceholder')}
            value={config.systemPrompt || ''}
            onChange={(e) => handleChange('systemPrompt', e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className={cn(
              'w-full min-h-[280px] px-4 py-3 text-sm',
              'bg-[#121212]/70 backdrop-blur-md',
              'border rounded-lg transition-all duration-200',
              'text-[#EDEDED] placeholder:text-[#A1A1AA]/60',
              'focus:outline-none focus:ring-2',
              'resize-none',
              isFocused
                ? 'border-[#99CDFF] ring-[#99CDFF]/20 shadow-lg shadow-[#99CDFF]/10'
                : 'border-[#27272A]',
              promptLength > MAX_PROMPT_LENGTH && 'border-[#F87171] ring-[#F87171]/20'
            )}
          />

          {/* Floating Character Count */}
          <div
            className={cn(
              'absolute bottom-3 right-3 px-3 py-1.5 rounded-md',
              'bg-[#050505]/80 backdrop-blur-sm border',
              'transition-all duration-200',
              isFocused ? 'border-[#99CDFF]/30' : 'border-[#27272A]'
            )}
          >
            <span className={cn('text-xs font-medium', getPromptLengthColor())}>
              {promptLength} / {MAX_PROMPT_LENGTH}
            </span>
          </div>
        </div>

        {/* Helper Text with Icon */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[#121212]/50 border border-[#27272A]">
          <AlertCircle className={cn('h-4 w-4 mt-0.5 flex-shrink-0', getPromptLengthColor())} />
          <p className={cn('text-xs', getPromptLengthColor())}>
            {getPromptHelperText()}
          </p>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="p-4 rounded-lg bg-gradient-to-br from-[#121212]/80 to-[#050505]/80 backdrop-blur-md border border-[#27272A]/50">
        <h3 className="text-sm font-medium text-[#EDEDED] mb-2">{t('agent:wizard.prompt.quickTips.title')}</h3>
        <ul className="space-y-1 text-xs text-[#A1A1AA]">
          <li className="flex items-start gap-2">
            <span className="text-[#99CDFF] mt-0.5">•</span>
            <span>{t('agent:wizard.prompt.quickTips.items.role')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#99CDFF] mt-0.5">•</span>
            <span>{t('agent:wizard.prompt.quickTips.items.tone')}</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-[#99CDFF] mt-0.5">•</span>
            <span>{t('agent:wizard.prompt.quickTips.items.boundaries')}</span>
          </li>
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={onNext}
          disabled={!isFormValid}
          size="lg"
          className={cn(
            'bg-gradient-to-r from-[#99CDFF] to-[#4A9EFF] text-[#050505]',
            'hover:shadow-lg hover:shadow-[#99CDFF]/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200',
            'font-medium'
          )}
        >
          {t('agent:wizard.prompt.actions.continueToVoice')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
