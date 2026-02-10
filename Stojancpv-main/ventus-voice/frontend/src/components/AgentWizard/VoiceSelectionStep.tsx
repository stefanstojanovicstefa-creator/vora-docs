/**
 * Voice Selection Step
 * Voice cards with play button preview and selected state with glow
 *
 * Notes:
 * - UI is provider-agnostic (no provider names shown).
 * - Previews only play when the provider exposes a safe preview URL (no TTS generation here).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Check, Volume2, ArrowRight, ArrowLeft, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { cn } from '../../lib/utils';
import { useVoiceProviders } from '../../hooks/useVoices';
import type { AgentConfig } from '../../types/agent';
import type { VoiceGender, VoicesByProvider, ProviderVoice } from '../../types/voice.types';

interface VoiceSelectionStepProps {
  config: Partial<AgentConfig>;
  onConfigChange: (config: Partial<AgentConfig>) => void;
  onNext: () => void;
  onBack: () => void;
}

interface VoiceOption {
  id: string;
  name: string;
  providerId: string;
  description: string;
  gender: VoiceGender;
  language?: string;
  tags: string[];
  previewUrl?: string;
  recommended?: boolean;
}

const ALLOWED_PROVIDER_IDS = new Set(['elevenlabs', 'openai', 'google']);

function titleCase(value: string): string {
  return value
    .split(/[\s_-]+/g)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

function inferVibeTags(description: string): string[] {
  const d = description.toLowerCase();
  const tags = new Set<string>();

  const add = (needle: string, tag: string) => {
    if (d.includes(needle)) tags.add(tag);
  };

  add('professional', 'Professional');
  add('friendly', 'Friendly');
  add('warm', 'Warm');
  add('energetic', 'Energetic');
  add('enthusiastic', 'Energetic');
  add('upbeat', 'Upbeat');
  add('calm', 'Calm');
  add('soothing', 'Soothing');
  add('deep', 'Deep');
  add('authoritative', 'Authoritative');
  add('confident', 'Confident');
  add('clear', 'Clear');
  add('conversational', 'Conversational');
  add('storytelling', 'Storytelling');

  return Array.from(tags);
}

function normalizeProviderResponse(
  providers: VoicesByProvider[] | undefined
): Array<{ providerId: string; providerName: string; voices: ProviderVoice[] }> {
  if (!providers) return [];

  return providers
    .map((p) => ({
      providerId: (p.providerId || p.provider || '').toString(),
      providerName: (p.providerName || p.provider || p.providerId || '').toString(),
      voices: p.voices || [],
    }))
    .filter((p) => !!p.providerId);
}

export function VoiceSelectionStep({
  config,
  onConfigChange,
  onNext,
  onBack,
}: VoiceSelectionStepProps) {
  const { t } = useTranslation(['agent', 'common']);
  const { data: providersData, isLoading, error } = useVoiceProviders();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<VoiceGender | 'all'>('all');
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedVoiceId = config.voiceId;

  const stopPreview = () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    audioRef.current = null;
  };

  const voiceOptions: VoiceOption[] = useMemo(() => {
    const normalizedProviders = normalizeProviderResponse(providersData?.providers);

    const options: VoiceOption[] = [];
    for (const provider of normalizedProviders) {
      if (!ALLOWED_PROVIDER_IDS.has(provider.providerId)) continue;

      for (const rawVoice of provider.voices) {
        const id = (rawVoice.id || rawVoice.voiceId || '').toString();
        if (!id) continue;

        const name = rawVoice.name?.toString() || id;
        const gender = (rawVoice.gender || 'neutral') as VoiceGender;
        const language = rawVoice.language?.toString();

        const description =
          (rawVoice.metadata && typeof rawVoice.metadata === 'object' && 'description' in rawVoice.metadata)
            ? String((rawVoice.metadata as Record<string, unknown>).description || name)
            : (rawVoice.description?.toString() || name);

        const vibes = inferVibeTags(description);

        const tags = [
          ...vibes,
          gender ? titleCase(gender) : null,
          language ? titleCase(language) : null,
        ].filter((t): t is string => !!t);

        options.push({
          id,
          name,
          providerId: provider.providerId,
          description,
          gender,
          language,
          tags,
          previewUrl: rawVoice.previewUrl?.toString(),
          recommended: provider.providerId === 'elevenlabs' && vibes.includes('Professional'),
        });
      }
    }

    // Stable ordering: recommended first, then name
    options.sort((a, b) => {
      if (!!a.recommended !== !!b.recommended) return a.recommended ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    return options;
  }, [providersData?.providers]);

  const availableVibes = useMemo(() => {
    const vibes = new Set<string>();
    for (const voice of voiceOptions) {
      for (const tag of voice.tags) {
        if (tag === 'Male' || tag === 'Female' || tag === 'Neutral') continue;
        // skip languages like en / en-US
        if (/^[a-z]{2}(-[A-Z]{2})?$/.test(tag)) continue;
        vibes.add(tag);
      }
    }
    return Array.from(vibes).sort();
  }, [voiceOptions]);

  const filteredVoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return voiceOptions.filter((voice) => {
      if (selectedGender !== 'all' && voice.gender !== selectedGender) return false;

      if (selectedVibes.length > 0) {
        const set = new Set(voice.tags);
        for (const required of selectedVibes) {
          if (!set.has(required)) return false;
        }
      }

      if (!q) return true;

      const haystack = `${voice.name} ${voice.description} ${voice.tags.join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [searchQuery, selectedGender, selectedVibes, voiceOptions]);

  const handleVoiceSelect = (voice: VoiceOption) => {
    onConfigChange({
      ...config,
      voiceId: voice.id,
      voiceProvider: voice.providerId,
    });
  };

  const handlePlayPreview = async (voice: VoiceOption) => {
    if (!voice.previewUrl) return;

    if (playingVoiceId === voice.id) {
      stopPreview();
      setPlayingVoiceId(null);
      return;
    }

    stopPreview();
    setPlayingVoiceId(voice.id);

    const audio = new Audio(voice.previewUrl);
    audioRef.current = audio;

    audio.onended = () => {
      if (audioRef.current === audio) audioRef.current = null;
      setPlayingVoiceId(null);
    };

    audio.oncanplaythrough = () => {
      setPreviewError(null);
    };

    audio.onerror = () => {
      if (audioRef.current === audio) audioRef.current = null;
      setPlayingVoiceId(null);
      setPreviewError(voice.id);
      toast.error(`Could not preview "${voice.name}". Try another voice.`, {
        duration: 3000,
        icon: <AlertCircle className="h-4 w-4" />,
      });
    };

    try {
      await audio.play();
    } catch {
      setPlayingVoiceId(null);
      setPreviewError(voice.id);
      toast.error(`Could not preview "${voice.name}". Try another voice.`, {
        duration: 3000,
      });
    }
  };

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Volume2 className="h-6 w-6 text-[#99CDFF]" />
          <h2 className="text-2xl font-semibold text-[#EDEDED]">{t('agent:wizard.voice.title')}</h2>
        </div>
        <p className="text-[#A1A1AA]">{t('agent:wizard.voice.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSelectedGender('all')}
            className={cn(
              'transition-all duration-200',
              selectedGender === 'all'
                ? 'bg-[#99CDFF]/10 border-[#99CDFF] text-[#99CDFF]'
                : 'border-[#27272A] text-[#A1A1AA] hover:border-[#99CDFF]/50'
            )}
          >
            {t('common:terms.all')}
          </Button>
          {(['female', 'male', 'neutral'] as const).map((gender) => (
            <Button
              key={gender}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedGender(gender)}
              className={cn(
                'transition-all duration-200',
                selectedGender === gender
                  ? 'bg-[#99CDFF]/10 border-[#99CDFF] text-[#99CDFF]'
                  : 'border-[#27272A] text-[#A1A1AA] hover:border-[#99CDFF]/50'
              )}
            >
              {titleCase(gender)}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('agent:wizard.voice.searchPlaceholder')}
            className={cn(
              'h-9 w-full md:w-80 px-3 rounded-md',
              'bg-[#121212] border border-[#27272A]',
              'text-[#EDEDED] placeholder-[#A1A1AA]',
              'focus:outline-none focus:ring-2 focus:ring-[#99CDFF]/20 focus:border-[#99CDFF]'
            )}
          />

          {availableVibes.slice(0, 10).map((vibe) => {
            const active = selectedVibes.includes(vibe);
            return (
              <Button
                key={vibe}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedVibes((prev) =>
                    active ? prev.filter((v) => v !== vibe) : [...prev, vibe]
                  );
                }}
                className={cn(
                  'transition-all duration-200',
                  active
                    ? 'bg-[#99CDFF]/10 border-[#99CDFF] text-[#99CDFF]'
                    : 'border-[#27272A] text-[#A1A1AA] hover:border-[#99CDFF]/50'
                )}
              >
                {vibe}
              </Button>
            );
          })}

          {(selectedVibes.length > 0 || searchQuery) && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedVibes([]);
                setSearchQuery('');
              }}
              className="border-[#27272A] text-[#A1A1AA] hover:border-[#99CDFF]/50"
            >
              {t('common:actions.clear')}
            </Button>
          )}
        </div>
      </div>

      {/* Voice Cards Grid */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        role="listbox"
        aria-label="Available voices"
        aria-busy={isLoading}
      >
        {/* Loading Skeletons */}
        {isLoading && (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={`skeleton-${i}`}
                className="p-4 rounded-lg bg-[#121212]/70 border border-[#27272A]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-32 bg-[#27272A]" />
                    <Skeleton className="h-4 w-full bg-[#27272A]" />
                    <Skeleton className="h-4 w-3/4 bg-[#27272A]" />
                    <div className="flex gap-1.5 pt-1">
                      <Skeleton className="h-5 w-16 rounded-full bg-[#27272A]" />
                      <Skeleton className="h-5 w-20 rounded-full bg-[#27272A]" />
                      <Skeleton className="h-5 w-14 rounded-full bg-[#27272A]" />
                    </div>
                  </div>
                  <Skeleton className="w-12 h-12 rounded-full bg-[#27272A]" />
                </div>
              </div>
            ))}
          </>
        )}

        {!isLoading && error && (
          <div className="col-span-full text-sm text-[#F87171] flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t('agent:wizard.voice.loadError')}
          </div>
        )}

        {!isLoading && !error && filteredVoices.length === 0 && (
          <div className="col-span-full text-sm text-[#A1A1AA]">
            {t('agent:wizard.voice.emptyFiltered')}
          </div>
        )}

        {filteredVoices.map((voice) => {
          const isSelected = selectedVoiceId === voice.id;
          const isPlaying = playingVoiceId === voice.id;
          const hasPreviewError = previewError === voice.id;

          return (
            <button
              type="button"
              key={`${voice.providerId}:${voice.id}`}
              onClick={() => handleVoiceSelect(voice)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleVoiceSelect(voice);
                }
              }}
              role="option"
              aria-selected={isSelected}
              aria-label={`${voice.name} voice${isSelected ? ', selected' : ''}${voice.recommended ? ', recommended' : ''}`}
              className={cn(
                'group relative p-4 rounded-lg cursor-pointer text-left w-full',
                'bg-[#121212]/70 backdrop-blur-md border',
                'transition-all duration-300 ease-out',
                'hover:bg-[#121212]/90',
                'focus:outline-none focus:ring-2 focus:ring-[#99CDFF]/50 focus:ring-offset-2 focus:ring-offset-[#050505]',
                isSelected
                  ? 'border-[#99CDFF] shadow-lg shadow-[#99CDFF]/20 bg-[#121212]/90'
                  : 'border-[#27272A] hover:border-[#99CDFF]/50',
                hasPreviewError && 'ring-1 ring-[#F87171]/50'
              )}
            >
              {/* Recommended Badge */}
              {voice.recommended && (
                <div className="absolute -top-2 -right-2">
                  <Badge className="bg-gradient-to-r from-[#99CDFF] to-[#4A9EFF] text-[#050505] border-0">
                    {t('agent:wizard.voice.recommendedBadge')}
                  </Badge>
                </div>
              )}

              {/* Selected Indicator */}
              {isSelected && (
                <div className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-gradient-to-br from-[#99CDFF] to-[#4A9EFF] flex items-center justify-center shadow-lg animate-scale-in">
                  <Check className="h-4 w-4 text-[#050505]" />
                </div>
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 space-y-2">
                  <div>
                    <h3 className="text-base font-semibold text-[#EDEDED]">{voice.name}</h3>
                    {voice.language && (
                      <p className="text-xs text-[#A1A1AA]">{titleCase(voice.language)}</p>
                    )}
                  </div>

                  <p className="text-sm text-[#A1A1AA] leading-relaxed">{voice.description}</p>

                  <div className="flex flex-wrap gap-1.5">
                    {voice.tags.slice(0, 6).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="text-xs bg-[#050505]/50 text-[#A1A1AA] border-[#27272A]"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayPreview(voice);
                  }}
                  disabled={!voice.previewUrl}
                  aria-label={
                    isPlaying
                      ? `Stop preview of ${voice.name}`
                      : voice.previewUrl
                        ? `Preview ${voice.name} voice`
                        : `Preview unavailable for ${voice.name}`
                  }
                  aria-pressed={isPlaying}
                  title={
                    voice.previewUrl ? 'Preview voice sample' : 'Preview unavailable (no sample URL)'
                  }
                  className={cn(
                    'flex-shrink-0 w-12 h-12 rounded-full',
                    'flex items-center justify-center',
                    'transition-all duration-200',
                    'bg-[#050505]/80 border border-[#27272A]',
                    'hover:bg-[#99CDFF] hover:border-[#99CDFF]',
                    'hover:shadow-lg hover:shadow-[#99CDFF]/30',
                    'group-hover:border-[#99CDFF]/50',
                    isPlaying && 'bg-[#99CDFF] border-[#99CDFF]',
                    !voice.previewUrl &&
                      'opacity-40 cursor-not-allowed hover:bg-[#050505]/80 hover:border-[#27272A] hover:shadow-none'
                  )}
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5 text-[#050505]" />
                  ) : (
                    <Play className="h-5 w-5 text-[#A1A1AA] group-hover:text-[#EDEDED]" />
                  )}
                </button>
              </div>

              {isSelected && (
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-[#99CDFF]/5 to-[#4A9EFF]/5 pointer-events-none animate-pulse-glow" />
              )}
            </button>
          );
        })}
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
          disabled={!selectedVoiceId}
          size="lg"
          className={cn(
            'bg-gradient-to-r from-[#99CDFF] to-[#4A9EFF] text-[#050505]',
            'hover:shadow-lg hover:shadow-[#99CDFF]/30',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200',
            'font-medium'
          )}
        >
          {t('agent:wizard.voice.continueToConfig')}
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

        @keyframes pulse-glow {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.6;
          }
        }

        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }

        .animate-scale-in {
          animation: scale-in 0.3s ease-out;
        }

        .animate-pulse-glow {
          animation: pulse-glow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
