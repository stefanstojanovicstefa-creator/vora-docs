/**
 * VoiceVisualizer Component
 *
 * Real-time audio level visualization with Vora brand styling.
 * Shows animated bars or waveform based on audio input levels.
 *
 * Usage:
 * ```tsx
 * <VoiceVisualizer
 *   audioLevel={0.5}
 *   isSpeaking={true}
 *   variant="bars"
 * />
 * ```
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

interface VoiceVisualizerProps {
  /** Audio level from 0 to 1 */
  audioLevel: number;
  /** Whether currently speaking */
  isSpeaking: boolean;
  /** Visual variant */
  variant?: 'bars' | 'wave' | 'circle' | 'minimal';
  /** Number of bars (for bars variant) */
  barCount?: number;
  /** Color theme */
  theme?: 'primary' | 'agent' | 'user';
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
}

const sizeConfig = {
  sm: { height: 24, barWidth: 2, gap: 2 },
  md: { height: 40, barWidth: 3, gap: 3 },
  lg: { height: 56, barWidth: 4, gap: 4 },
};

const themeConfig = {
  primary: {
    active: 'bg-[hsl(var(--primary))]',
    inactive: 'bg-zinc-700',
    glow: 'hsl(var(--primary) / 0.5)',
  },
  agent: {
    active: 'bg-[hsl(var(--primary))]',
    inactive: 'bg-zinc-700',
    glow: 'hsl(var(--primary) / 0.5)',
  },
  user: {
    active: 'bg-green-400',
    inactive: 'bg-zinc-700',
    glow: 'rgba(74, 222, 128, 0.5)',
  },
};

/**
 * Generate random bar heights based on audio level
 */
function generateBarHeights(count: number, audioLevel: number, isSpeaking: boolean): number[] {
  return Array.from({ length: count }, (_, i) => {
    if (!isSpeaking || audioLevel < 0.05) {
      // Idle animation - subtle wave
      return 0.15 + Math.sin((Date.now() / 500) + i * 0.5) * 0.1;
    }
    // Active speaking - random heights based on audio level
    const base = audioLevel * 0.6;
    const variance = audioLevel * 0.4;
    const centerBias = 1 - Math.abs((i / count) - 0.5) * 0.5; // Higher in center
    return Math.min(1, base + Math.random() * variance * centerBias);
  });
}

export function VoiceVisualizer({
  audioLevel,
  isSpeaking,
  variant = 'bars',
  barCount = 5,
  theme = 'primary',
  size = 'md',
  className,
}: VoiceVisualizerProps) {
  const sizeSettings = sizeConfig[size];
  const themeSettings = themeConfig[theme];

  // Memoize bar heights with some randomness for visual interest
  const barHeights = useMemo(
    () => generateBarHeights(barCount, audioLevel, isSpeaking),
    [barCount, audioLevel, isSpeaking, Math.floor(Date.now() / 100)] // Update every 100ms
  );

  const waveTick = Math.floor(Date.now() / 50);
  const wavePath = useMemo(() => {
    if (variant !== 'wave') return '';

    const width = barCount * 20;
    const height = sizeSettings.height;
    const amplitude = isSpeaking ? audioLevel * height * 0.4 : height * 0.1;
    const frequency = 0.1;
    const phase = Date.now() / 200;

    const pathPoints = Array.from({ length: width }, (_, x) => {
      const y = height / 2 + Math.sin(x * frequency + phase) * amplitude;
      return `${x},${y}`;
    });

    return `M ${pathPoints.join(' L ')}`;
  }, [variant, barCount, sizeSettings.height, audioLevel, isSpeaking, waveTick]);

  // Bars variant - vertical bars that animate with audio
  if (variant === 'bars') {
    return (
      <div
        className={cn('flex items-center justify-center', className)}
        style={{ height: sizeSettings.height, gap: sizeSettings.gap }}
      >
        {barHeights.map((height, index) => (
          <motion.div
            key={index}
            className={cn(
              'rounded-full transition-colors',
              isSpeaking ? themeSettings.active : themeSettings.inactive
            )}
            style={{
              width: sizeSettings.barWidth,
              boxShadow: isSpeaking ? `0 0 8px ${themeSettings.glow}` : 'none',
            }}
            animate={{
              height: height * sizeSettings.height,
              opacity: isSpeaking ? 0.8 + height * 0.2 : 0.4,
            }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 20,
            }}
          />
        ))}
      </div>
    );
  }

  // Wave variant - sine wave visualization
  if (variant === 'wave') {
    return (
      <div className={cn('overflow-hidden', className)} style={{ height: sizeSettings.height }}>
        <svg
          width={barCount * 20}
          height={sizeSettings.height}
          className="overflow-visible"
        >
          <motion.path
            d={wavePath}
            fill="none"
            stroke={isSpeaking ? '#99CDFF' : '#52525b'}
            strokeWidth={2}
            strokeLinecap="round"
            style={{
              filter: isSpeaking ? `drop-shadow(0 0 4px ${themeSettings.glow})` : 'none',
            }}
            animate={{ opacity: isSpeaking ? 1 : 0.5 }}
          />
        </svg>
      </div>
    );
  }

  // Circle variant - pulsing circle
  if (variant === 'circle') {
    const baseSize = sizeSettings.height;
    const maxScale = 1 + audioLevel * 0.3;

    return (
      <div
        className={cn('relative flex items-center justify-center', className)}
        style={{ width: baseSize, height: baseSize }}
      >
        {/* Outer glow ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(circle, ${themeSettings.glow} 0%, transparent 70%)`,
          }}
          animate={{
            scale: isSpeaking ? [1, maxScale, 1] : 1,
            opacity: isSpeaking ? [0.3, 0.6, 0.3] : 0.1,
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        {/* Inner circle */}
        <motion.div
          className={cn(
            'w-3/4 h-3/4 rounded-full',
            isSpeaking ? themeSettings.active : themeSettings.inactive
          )}
          animate={{
            scale: isSpeaking ? [1, 1 + audioLevel * 0.15, 1] : 1,
          }}
          transition={{
            duration: 0.3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          style={{
            boxShadow: isSpeaking ? `0 0 20px ${themeSettings.glow}` : 'none',
          }}
        />
      </div>
    );
  }

  // Minimal variant - single bar or dot
  if (variant === 'minimal') {
    return (
      <motion.div
        className={cn(
          'rounded-full',
          isSpeaking ? themeSettings.active : themeSettings.inactive,
          className
        )}
        style={{
          width: sizeSettings.barWidth * 2,
          boxShadow: isSpeaking ? `0 0 8px ${themeSettings.glow}` : 'none',
        }}
        animate={{
          height: (0.3 + audioLevel * 0.7) * sizeSettings.height,
          opacity: isSpeaking ? 1 : 0.5,
        }}
        transition={{
          type: 'spring',
          stiffness: 400,
          damping: 20,
        }}
      />
    );
  }

  return null;
}

/**
 * VoiceVisualizerDual - Shows both user and agent visualizers side by side
 */
interface VoiceVisualizerDualProps {
  /** User's audio level (0-1) */
  userAudioLevel: number;
  /** Agent's audio level (0-1) */
  agentAudioLevel: number;
  /** Whether user is speaking */
  userIsSpeaking: boolean;
  /** Whether agent is speaking */
  agentIsSpeaking: boolean;
  /** Size */
  size?: 'sm' | 'md' | 'lg';
  /** Custom class name */
  className?: string;
}

export function VoiceVisualizerDual({
  userAudioLevel,
  agentAudioLevel,
  userIsSpeaking,
  agentIsSpeaking,
  size = 'md',
  className,
}: VoiceVisualizerDualProps) {
  const { t } = useTranslation(['common']);

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">{t('common:terms.you')}</span>
        <VoiceVisualizer
          audioLevel={userAudioLevel}
          isSpeaking={userIsSpeaking}
          theme="user"
          size={size}
          barCount={3}
        />
      </div>

      <div className="w-px h-6 bg-zinc-700" />

      <div className="flex items-center gap-2">
        <VoiceVisualizer
          audioLevel={agentAudioLevel}
          isSpeaking={agentIsSpeaking}
          theme="agent"
          size={size}
          barCount={3}
        />
        <span className="text-xs text-zinc-500">{t('common:terms.agent')}</span>
      </div>
    </div>
  );
}

export default VoiceVisualizer;
