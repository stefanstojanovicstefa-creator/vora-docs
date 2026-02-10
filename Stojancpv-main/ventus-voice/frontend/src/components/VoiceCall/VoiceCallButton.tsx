/**
 * VoiceCallButton Component
 *
 * A floating action button to start voice calls with Vora agents.
 * Features signature glow animation when active.
 *
 * Usage:
 * ```tsx
 * <VoiceCallButton agentId="agent_123" />
 * ```
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, PhoneOff, Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useVoiceCall } from '../../hooks/useVoiceCall';
import { Button } from '../ui/button';
import { getVoraCustomerId, getCustomerPhoneNumber } from '../../lib/customer-identity';

interface VoiceCallButtonProps {
  /** Agent ID to call */
  agentId: string;
  /** Participant name for the call */
  participantName?: string;
  /** Additional metadata to pass to the agent */
  metadata?: Record<string, unknown>;
  /**
   * Enable customer memory - agent will remember this customer across calls.
   * If true, auto-generates customer ID from localStorage.
   * If string, uses that as the customer ID.
   * @default true
   */
  enableMemory?: boolean | string;
  /**
   * Customer phone number for memory identification.
   * Used for cross-device memory lookup when phone is known.
   */
  phoneNumber?: string;
  /**
   * Business's customer ID for CRM integration.
   */
  customerId?: string;
  /** Button size */
  size?: 'sm' | 'md' | 'lg';
  /** Position when floating */
  position?: 'bottom-right' | 'bottom-left' | 'bottom-center';
  /** Whether to show as floating button */
  floating?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback on call start */
  onCallStart?: () => void;
  /** Callback on call end */
  onCallEnd?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

const positionClasses = {
  'bottom-right': 'fixed bottom-6 right-6',
  'bottom-left': 'fixed bottom-6 left-6',
  'bottom-center': 'fixed bottom-6 left-1/2 -translate-x-1/2',
};

const sizeClasses = {
  sm: 'h-10 w-10',
  md: 'h-14 w-14',
  lg: 'h-16 w-16',
};

const iconSizes = {
  sm: 16,
  md: 20,
  lg: 24,
};

export function VoiceCallButton({
  agentId,
  participantName,
  metadata,
  enableMemory = true,
  phoneNumber,
  customerId,
  size = 'md',
  position = 'bottom-right',
  floating = true,
  className,
  onCallStart,
  onCallEnd,
  onError,
}: VoiceCallButtonProps) {
  const {
    status,
    isConnecting,
    isConnected,
    isMuted,
    startCall,
    endCall,
    toggleMute,
    canPlaybackAudio,
    enableAudioPlayback,
  } = useVoiceCall({
    onConnect: () => onCallStart?.(),
    onDisconnect: () => onCallEnd?.(),
    onError: (error) => onError?.(error),
  });

  const isActive = status === 'ACTIVE' || status === 'CONNECTED';
  const isLoading = isConnecting;

  const handleClick = async () => {
    if (isActive) {
      await endCall();
    } else if (!isLoading) {
      // Resolve customer identity for memory system
      let voraCustomerId: string | undefined;
      if (enableMemory === true) {
        // Auto-generate from localStorage
        voraCustomerId = getVoraCustomerId();
      } else if (typeof enableMemory === 'string') {
        // Use provided customer ID
        voraCustomerId = enableMemory;
      }
      // Memory disabled if enableMemory === false

      await startCall({
        agentId,
        participantName,
        voraCustomerId,
        phoneNumber: phoneNumber || getCustomerPhoneNumber(),
        customerId,
        metadata,
      });
    }
  };

  const buttonVariants = {
    idle: { scale: 1 },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 },
    active: {
      scale: [1, 1.02, 1],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  const glowVariants = {
    idle: {
      boxShadow: '0 0 0px hsl(var(--primary) / 0)',
    },
    active: {
      boxShadow: [
        '0 0 20px hsl(var(--primary) / 0.3)',
        '0 0 40px hsl(var(--primary) / 0.5)',
        '0 0 20px hsl(var(--primary) / 0.3)',
      ],
      transition: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    },
  };

  return (
    <div className={cn(floating && positionClasses[position], 'z-50', className)}>
      <div className="flex items-center gap-2">
        {/* Enable Audio button - show when browser blocks audio playback */}
        <AnimatePresence>
          {isActive && !canPlaybackAudio && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  'rounded-full border-yellow-500/50 bg-[rgba(18,18,18,0.9)] backdrop-blur-xl',
                  'hover:bg-yellow-500/20 hover:border-yellow-400',
                  'transition-all duration-200 animate-pulse',
                  sizeClasses[size]
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  enableAudioPlayback();
                }}
                title="Enable Audio (browser blocked autoplay)"
              >
                <Volume2 size={iconSizes[size]} className="text-yellow-400" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mute button - only show when active */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Button
                variant="outline"
                size="icon"
                className={cn(
                  'rounded-full border-[#27272A] bg-[rgba(18,18,18,0.9)] backdrop-blur-xl',
                  'hover:bg-[rgba(30,30,30,0.9)] hover:border-[#99CDFF]',
                  'transition-all duration-200',
                  sizeClasses[size]
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
              >
                {isMuted ? (
                  <MicOff size={iconSizes[size]} className="text-red-400" />
                ) : (
                  <Mic size={iconSizes[size]} className="text-[#99CDFF]" />
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main call button */}
        <motion.button
          className={cn(
            'rounded-full flex items-center justify-center',
            'transition-colors duration-200',
            sizeClasses[size],
            isActive
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-[#99CDFF] hover:bg-[#7AB8FF] text-[#050505]',
            isLoading && 'opacity-80 cursor-wait'
          )}
          variants={buttonVariants}
          initial="idle"
          whileHover={!isLoading ? 'hover' : undefined}
          whileTap={!isLoading ? 'tap' : undefined}
          animate={isActive ? 'active' : 'idle'}
          onClick={handleClick}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={iconSizes[size]} className="animate-spin" />
          ) : isActive ? (
            <PhoneOff size={iconSizes[size]} />
          ) : (
            <Phone size={iconSizes[size]} />
          )}
        </motion.button>

        {/* Glow effect overlay */}
        {isActive && (
          <motion.div
            className={cn(
              'absolute rounded-full pointer-events-none',
              sizeClasses[size]
            )}
            style={{
              right: floating ? 0 : 'auto',
            }}
            variants={glowVariants}
            initial="idle"
            animate="active"
          />
        )}
      </div>
    </div>
  );
}

export default VoiceCallButton;
