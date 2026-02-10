/**
 * Configuration Step
 * Advanced settings with toggle switches and input fields
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ArrowRight, ArrowLeft, Settings, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { cn } from '../../lib/utils';
import type { AgentConfig } from '../../types/agent';

interface ConfigurationStepProps {
  config: Partial<AgentConfig>;
  onConfigChange: (config: Partial<AgentConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface FeatureToggle {
  id: keyof AgentConfig;
  labelKey: string;
  descriptionKey: string;
  defaultValue: boolean;
}

const FEATURE_TOGGLES: FeatureToggle[] = [
  {
    id: 'enableMemory' as keyof AgentConfig,
    labelKey: 'agent:wizard.configuration.features.memory.title',
    descriptionKey: 'agent:wizard.configuration.features.memory.description',
    defaultValue: true,
  },
  {
    id: 'enableTranscription' as keyof AgentConfig,
    labelKey: 'agent:wizard.configuration.features.transcription.title',
    descriptionKey: 'agent:wizard.configuration.features.transcription.description',
    defaultValue: true,
  },
  {
    id: 'enableAnalytics' as keyof AgentConfig,
    labelKey: 'agent:wizard.configuration.features.analytics.title',
    descriptionKey: 'agent:wizard.configuration.features.analytics.description',
    defaultValue: true,
  },
  {
    id: 'enableFallback' as keyof AgentConfig,
    labelKey: 'agent:wizard.configuration.features.fallback.title',
    descriptionKey: 'agent:wizard.configuration.features.fallback.description',
    defaultValue: false,
  },
];

export function ConfigurationStep({
  config,
  onConfigChange,
  onNext,
  onBack,
}: ConfigurationStepProps) {
  const { t } = useTranslation(['agent', 'common']);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleChange = (field: keyof AgentConfig, value: any) => {
    onConfigChange({ ...config, [field]: value });
  };

  const handleToggle = (field: keyof AgentConfig, value: boolean) => {
    onConfigChange({ ...config, [field]: value });
  };

  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens ?? 2048;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-[#99CDFF]" />
          <h2 className="text-2xl font-semibold text-[#EDEDED]">
            {t('agent:wizard.configuration.title')}
          </h2>
        </div>
        <p className="text-[#A1A1AA]">
          {t('agent:wizard.configuration.subtitle')}
        </p>
      </div>

      {/* LLM Provider Selection */}
      <div
        className={cn(
          'p-4 rounded-lg space-y-4',
          'bg-[#121212]/70 backdrop-blur-md border border-[#27272A]'
        )}
      >
        <h3 className="text-sm font-semibold text-[#EDEDED]">
          {t('agent:wizard.configuration.sections.languageModel')}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="llm-provider" className="text-[#EDEDED] text-sm">
              {t('common:terms.provider')}
            </Label>
            <Select
              value={config.llmProvider || 'openai'}
              onValueChange={(value) => handleChange('llmProvider', value)}
            >
                <SelectTrigger
                id="llm-provider"
                className="bg-[#050505]/50 border-[#27272A] text-[#EDEDED]"
              >
                <SelectValue placeholder={t('common:placeholders.selectProvider')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="groq">Groq</SelectItem>
                <SelectItem value="gemini">Google Gemini</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="llm-model" className="text-[#EDEDED] text-sm">
              {t('common:terms.model')}
            </Label>
            <Input
              id="llm-model"
              placeholder={t('agent:wizard.configuration.fields.modelPlaceholder')}
              value={config.llmModel || ''}
              onChange={(e) => handleChange('llmModel', e.target.value)}
              className={cn(
                'bg-[#050505]/50 border-[#27272A]',
                'focus:border-[#99CDFF] focus:ring-[#99CDFF]/20',
                'text-[#EDEDED] placeholder:text-[#A1A1AA]'
              )}
            />
          </div>
        </div>
      </div>

      {/* Feature Toggles */}
      <div
        className={cn(
          'p-4 rounded-lg space-y-4',
          'bg-[#121212]/70 backdrop-blur-md border border-[#27272A]'
        )}
      >
        <h3 className="text-sm font-semibold text-[#EDEDED]">
          {t('agent:wizard.configuration.sections.features')}
        </h3>

        <div className="space-y-3">
          {FEATURE_TOGGLES.map((feature) => (
            <div
              key={String(feature.id)}
              className={cn(
                'flex items-center justify-between p-3 rounded-lg',
                'bg-[#050505]/30 border border-[#27272A]/50',
                'transition-all duration-200',
                'hover:border-[#27272A]'
              )}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor={String(feature.id)}
                    className="text-sm font-medium text-[#EDEDED] cursor-pointer"
                  >
                    {t(feature.labelKey)}
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-[#A1A1AA]" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs max-w-xs">{t(feature.descriptionKey)}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-[#A1A1AA] mt-0.5">
                  {t(feature.descriptionKey)}
                </p>
              </div>
              <Switch
                id={String(feature.id)}
                checked={(config[feature.id] as boolean) ?? feature.defaultValue}
                onCheckedChange={(value) => handleToggle(feature.id, value)}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-[#99CDFF] data-[state=checked]:to-[#4A9EFF]"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Advanced Settings */}
      <div
        className={cn(
          'p-4 rounded-lg space-y-4',
          'bg-[#121212]/70 backdrop-blur-md border border-[#27272A]'
        )}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#EDEDED]">
            {t('agent:wizard.configuration.sections.advanced')}
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-[#99CDFF] hover:text-[#BDDCFF]"
          >
            {showAdvanced ? t('common:actions.hide') : t('common:actions.show')}
          </Button>
        </div>

        {showAdvanced && (
          <div className="space-y-4 animate-slide-down">
            {/* Temperature Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-[#EDEDED]">
                  {t('agent:settings.temperature')}
                </Label>
                <span className="text-sm font-medium text-[#99CDFF]">
                  {temperature.toFixed(2)}
                </span>
              </div>
              <Slider
                value={[temperature]}
                onValueChange={([value]) => handleChange('temperature', value)}
                min={0}
                max={2}
                step={0.1}
                className="[&_[role=slider]]:bg-gradient-to-r [&_[role=slider]]:from-[#99CDFF] [&_[role=slider]]:to-[#4A9EFF]"
              />
              <p className="text-xs text-[#A1A1AA]">
                {t('agent:settings.temperatureDesc')}
              </p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <Label htmlFor="max-tokens" className="text-sm text-[#EDEDED]">
                {t('agent:wizard.configuration.fields.maxTokens')}
              </Label>
              <Input
                id="max-tokens"
                type="number"
                min="256"
                max="8192"
                step="256"
                value={maxTokens}
                onChange={(e) =>
                  handleChange('maxTokens', parseInt(e.target.value) || 2048)
                }
                className={cn(
                  'bg-[#050505]/50 border-[#27272A]',
                  'focus:border-[#99CDFF] focus:ring-[#99CDFF]/20',
                  'text-[#EDEDED]'
                )}
              />
              <p className="text-xs text-[#A1A1AA]">
                {t('agent:wizard.configuration.fields.maxTokensHint')}
              </p>
            </div>

            {/* Timeout */}
            <div className="space-y-2">
              <Label htmlFor="timeout" className="text-sm text-[#EDEDED]">
                {t('agent:wizard.configuration.fields.timeout')}
              </Label>
              <Input
                id="timeout"
                type="number"
                min="5"
                max="60"
                value={(config.timeout as number) ?? 30}
                onChange={(e) =>
                  handleChange('timeout', parseInt(e.target.value) || 30)
                }
                className={cn(
                  'bg-[#050505]/50 border-[#27272A]',
                  'focus:border-[#99CDFF] focus:ring-[#99CDFF]/20',
                  'text-[#EDEDED]'
                )}
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button
          onClick={onBack}
          variant="outline"
          size="lg"
          className="border-[#27272A] text-[#A1A1AA] hover:border-[#99CDFF]/50 hover:text-[#EDEDED]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('common:actions.back')}
        </Button>

        <Button
          onClick={onNext}
          size="lg"
          className={cn(
            'bg-gradient-to-r from-[#99CDFF] to-[#4A9EFF] text-[#050505]',
            'hover:shadow-lg hover:shadow-[#99CDFF]/30',
            'transition-all duration-200',
            'font-medium'
          )}
        >
          {t('agent:wizard.actions.continueToPreview')}
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

        @keyframes slide-down {
          from {
            opacity: 0;
            max-height: 0;
          }
          to {
            opacity: 1;
            max-height: 500px;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
