/**
 * Enhanced Preview Step
 * Live preview of agent configuration with test functionality
 *
 * REMOVED: Pre-warm functionality (PRD-001) - feature was not in use
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Card } from '../ui/card';
import {
  ArrowLeft,
  Rocket,
  TestTube,
  Volume2,
  Brain,
  Settings as SettingsIcon,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { AgentConfig } from '../../types/agent';

interface EnhancedPreviewStepProps {
  config: Partial<AgentConfig>;
  onBack: () => void;
  onDeploy: () => void;
  isDeploying: boolean;
}

export function EnhancedPreviewStep({
  config,
  onBack,
  onDeploy,
  isDeploying,
}: EnhancedPreviewStepProps) {
  const { t } = useTranslation(['agent', 'common']);
  const [isTestingVoice, setIsTestingVoice] = useState(false);

  const handleTestVoice = () => {
    setIsTestingVoice(true);
    // Simulate voice test
    setTimeout(() => setIsTestingVoice(false), 2000);
  };

  const canDeploy = !isDeploying;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-[#4ADE80]" />
          <h2 className="text-2xl font-semibold text-[#EDEDED]">
            {t('agent:wizard.steps.preview.label')}
          </h2>
        </div>
        <p className="text-[#A1A1AA]">
          {t('agent:wizard.preview.subtitle')}
        </p>
      </div>

      {/* Preview Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Basic Info Card */}
        <Card
          className={cn(
            'p-5 space-y-4',
            'bg-[#121212]/70 backdrop-blur-md border-[#27272A]',
            'hover:border-[#99CDFF]/30 transition-all duration-200'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#99CDFF] to-[#4A9EFF] flex items-center justify-center">
              <SettingsIcon className="h-4 w-4 text-[#050505]" />
            </div>
            <h3 className="font-semibold text-[#EDEDED]">{t('agent:wizard.preview.sections.basicInfo')}</h3>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#A1A1AA] mb-1">{t('agent:wizard.preview.fields.agentName')}</p>
              <p className="text-sm font-medium text-[#EDEDED]">{config.name}</p>
            </div>

            {config.description && (
              <div>
                <p className="text-xs text-[#A1A1AA] mb-1">{t('common:terms.description')}</p>
                <p className="text-sm text-[#EDEDED]">{config.description}</p>
              </div>
            )}

            <div>
              <p className="text-xs text-[#A1A1AA] mb-1">{t('agent:settings.systemPrompt')}</p>
              <div className="p-3 rounded-lg bg-[#050505]/50 border border-[#27272A]">
                <p className="text-xs text-[#A1A1AA] line-clamp-4 leading-relaxed">
                  {config.systemPrompt || t('agent:wizard.preview.values.noSystemPrompt')}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Voice Configuration Card */}
        <Card
          className={cn(
            'p-5 space-y-4',
            'bg-[#121212]/70 backdrop-blur-md border-[#27272A]',
            'hover:border-[#99CDFF]/30 transition-all duration-200'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#99CDFF] to-[#4A9EFF] flex items-center justify-center">
              <Volume2 className="h-4 w-4 text-[#050505]" />
            </div>
            <h3 className="font-semibold text-[#EDEDED]">{t('agent:wizard.preview.sections.voice')}</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#A1A1AA] mb-1">{t('agent:list.voiceProviderLabel')}</p>
                <Badge
                  variant="secondary"
                  className="bg-[#050505]/50 text-[#EDEDED] border-[#27272A]"
                >
                  {config.voiceProvider || t('agent:wizard.preview.values.notSet')}
                </Badge>
              </div>
              <Button
                onClick={handleTestVoice}
                disabled={isTestingVoice || !config.voiceId}
                size="sm"
                variant="outline"
                className={cn(
                  'border-[#27272A] hover:border-[#99CDFF]',
                  'hover:bg-[#99CDFF]/10'
                )}
              >
                {isTestingVoice ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    {t('agent:wizard.preview.actions.testingVoice')}
                  </>
                ) : (
                  <>
                    <TestTube className="mr-2 h-3.5 w-3.5" />
                    {t('agent:wizard.preview.actions.testVoice')}
                  </>
                )}
              </Button>
            </div>

            <div>
              <p className="text-xs text-[#A1A1AA] mb-1">{t('agent:wizard.preview.fields.voiceId')}</p>
              <p className="text-sm font-mono text-[#EDEDED]">
                {config.voiceId || t('agent:wizard.preview.values.notSet')}
              </p>
            </div>
          </div>
        </Card>

        {/* LLM Configuration Card */}
        <Card
          className={cn(
            'p-5 space-y-4',
            'bg-[#121212]/70 backdrop-blur-md border-[#27272A]',
            'hover:border-[#99CDFF]/30 transition-all duration-200'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#99CDFF] to-[#4A9EFF] flex items-center justify-center">
              <Brain className="h-4 w-4 text-[#050505]" />
            </div>
            <h3 className="font-semibold text-[#EDEDED]">{t('agent:wizard.configuration.sections.languageModel')}</h3>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[#A1A1AA] mb-1">{t('common:terms.provider')}</p>
                <Badge
                  variant="secondary"
                  className="bg-[#050505]/50 text-[#EDEDED] border-[#27272A]"
                >
                  {config.llmProvider || t('agent:wizard.preview.values.notSet')}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-[#A1A1AA] mb-1">{t('common:terms.model')}</p>
                <p className="text-sm font-mono text-[#EDEDED]">
                  {config.llmModel || t('agent:wizard.preview.values.defaultModel')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-[#A1A1AA] mb-1">{t('agent:settings.temperature')}</p>
                <p className="text-sm font-medium text-[#EDEDED]">
                  {config.temperature?.toFixed(2) ?? '0.70'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#A1A1AA] mb-1">{t('agent:wizard.configuration.fields.maxTokens')}</p>
                <p className="text-sm font-medium text-[#EDEDED]">
                  {config.maxTokens ?? 2048}
                </p>
              </div>
            </div>
          </div>
        </Card>

        {/* Features Card */}
        <Card
          className={cn(
            'p-5 space-y-4',
            'bg-[#121212]/70 backdrop-blur-md border-[#27272A]',
            'hover:border-[#99CDFF]/30 transition-all duration-200'
          )}
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#99CDFF] to-[#4A9EFF] flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 text-[#050505]" />
            </div>
            <h3 className="font-semibold text-[#EDEDED]">{t('agent:wizard.preview.sections.features')}</h3>
          </div>

          <div className="space-y-2">
            {[
              { key: 'enableMemory', labelKey: 'agent:wizard.configuration.features.memory.title' },
              { key: 'enableTranscription', labelKey: 'agent:wizard.configuration.features.transcription.title' },
              { key: 'enableAnalytics', labelKey: 'agent:wizard.configuration.features.analytics.title' },
              { key: 'enableFallback', labelKey: 'agent:wizard.configuration.features.fallback.title' },
            ].map((feature) => {
              const isEnabled = config[feature.key as keyof AgentConfig] ?? true;
              return (
                <div
                  key={feature.key}
                  className="flex items-center gap-2 text-sm"
                >
                  <div
                    className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      isEnabled ? 'bg-[#4ADE80]' : 'bg-[#A1A1AA]'
                    )}
                  />
                  <span
                    className={cn(
                      isEnabled ? 'text-[#EDEDED]' : 'text-[#A1A1AA] line-through'
                    )}
                  >
                    {t(feature.labelKey)}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Deployment Info Banner */}
      <div
        className={cn(
          'p-4 rounded-lg flex items-start gap-3',
          'bg-[#60A5FA]/10 border border-[#60A5FA]/30'
        )}
      >
        <Rocket className="h-5 w-5 mt-0.5 flex-shrink-0 text-[#60A5FA]" />
        <div className="text-sm">
          <p className="font-medium text-[#60A5FA]">
            {t('agent:wizard.preview.deploymentInfo.title')}
          </p>
          <p className="text-[#A1A1AA] mt-1">
            {t('agent:wizard.preview.deploymentInfo.standardDescription')}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between pt-4">
        <Button
          onClick={onBack}
          disabled={isDeploying}
          variant="outline"
          size="lg"
          className="border-[#27272A] text-[#A1A1AA] hover:border-[#99CDFF]/50 hover:text-[#EDEDED]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t('agent:wizard.preview.actions.backToConfiguration')}
        </Button>

        <Button
          onClick={onDeploy}
          disabled={!canDeploy}
          size="lg"
          className={cn(
            'bg-gradient-to-r from-[#99CDFF] to-[#4A9EFF]',
            'text-[#050505] font-medium',
            'hover:shadow-lg hover:shadow-[#99CDFF]/30',
            'transition-all duration-200'
          )}
        >
          {isDeploying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('agent:wizard.preview.actions.deploying')}
            </>
          ) : (
            <>
              <Rocket className="mr-2 h-4 w-4" />
              {t('agent:actions.deployAgent')}
            </>
          )}
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
