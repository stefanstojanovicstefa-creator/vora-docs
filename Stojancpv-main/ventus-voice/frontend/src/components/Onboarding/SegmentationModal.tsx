import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Code } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useUserSegment, type UserSegment } from '@/hooks/useUserSegment';
import { useAnalytics } from '@/hooks/useAnalytics';

interface SegmentOption {
  id: UserSegment;
  icon: typeof Briefcase | typeof Code;
  title: string;
  description: string;
  defaultMode: 'mom' | 'god';
}

const SEGMENT_OPTIONS: SegmentOption[] = [
  {
    id: 'business',
    icon: Briefcase,
    title: 'Vlasnik biznisa / Marketing',
    description: 'Želim jednostavan interfejs bez tehničkih detalja',
    defaultMode: 'mom',
  },
  {
    id: 'developer',
    icon: Code,
    title: 'Developer / Inženjer',
    description: 'Trebam pristup svim podešavanjima i parametrima',
    defaultMode: 'god',
  },
];

interface SegmentationModalProps {
  open: boolean;
  onClose?: () => void;
}

export function SegmentationModal({ open, onClose }: SegmentationModalProps) {
  const [selectedSegment, setSelectedSegment] = useState<UserSegment>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const { setSegment } = useUserSegment();
  const navigate = useNavigate();
  const { trackEvent, setUserProperties } = useAnalytics();

  // Track onboarding started when modal opens
  useEffect(() => {
    if (open) {
      trackEvent({ name: 'onboarding_started' });
    }
  }, [open, trackEvent]);

  const handleSelectSegment = (option: SegmentOption) => {
    setSelectedSegment(option.id);
    setIsAnimatingOut(true);

    // Track segment selection
    trackEvent({
      name: 'onboarding_segment_selected',
      properties: { segment: option.id },
    });

    // Store segment preference
    setSegment(option.id);

    // Store default mode preference
    localStorage.setItem('vora_interface_mode', option.defaultMode);

    // Update user properties
    setUserProperties({ segment: option.id });

    // Track onboarding completion
    trackEvent({ name: 'onboarding_completed', properties: { segment: option.id } });

    // Wait for animation to complete, then navigate
    setTimeout(() => {
      navigate('/agents/create');
      onClose?.();
    }, 600);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-[hsl(var(--void))]/80 backdrop-blur-md"
            aria-hidden="true"
          />

          {/* Modal Content */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-4xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="segmentation-title"
            >
              {/* Glass Container */}
              <div className="bg-surface/90 backdrop-blur-xl border border-border/50 rounded-2xl p-8 md:p-12 shadow-2xl">
                {/* Header */}
                <div className="text-center mb-12">
                  <motion.h2
                    id="segmentation-title"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-3xl md:text-4xl font-semibold text-text-high mb-3 tracking-tight"
                  >
                    Šta vas najbolje opisuje?
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-text-muted text-base md:text-lg"
                  >
                    Odaberite profil kako bismo prilagodili vaše iskustvo
                  </motion.p>
                </div>

                {/* Options Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {SEGMENT_OPTIONS.map((option, index) => {
                    const Icon = option.icon;
                    const isSelected = selectedSegment === option.id;

                    return (
                      <motion.button
                        key={option.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + index * 0.1 }}
                        onClick={() => handleSelectSegment(option)}
                        disabled={isAnimatingOut}
                        className={cn(
                          'group relative p-8 rounded-xl border-2 transition-all duration-300',
                          'bg-surface/50 backdrop-blur-sm',
                          'hover:bg-surface/80 hover:scale-[1.02]',
                          'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-void',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          isSelected
                            ? 'border-primary shadow-[0_0_30px_rgba(153,205,255,0.4)]'
                            : 'border-border/50 hover:border-primary/50 hover:shadow-[0_0_20px_rgba(153,205,255,0.2)]'
                        )}
                        aria-label={`${option.title}: ${option.description}`}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            'mb-6 inline-flex items-center justify-center w-16 h-16 rounded-lg transition-all duration-300',
                            'bg-primary/10 group-hover:bg-primary/20',
                            isSelected && 'bg-primary/30 scale-110'
                          )}
                        >
                          <Icon
                            className={cn(
                              'w-8 h-8 transition-colors duration-300',
                              'text-primary group-hover:text-primary',
                              isSelected && 'text-primary'
                            )}
                            aria-hidden="true"
                          />
                        </div>

                        {/* Title */}
                        <h3 className="text-xl font-semibold text-text-high mb-3 text-start group-hover:text-primary transition-colors duration-300">
                          {option.title}
                        </h3>

                        {/* Description */}
                        <p className="text-text-muted text-start text-sm leading-relaxed">
                          {option.description}
                        </p>

                        {/* Selection Indicator */}
                        <AnimatePresence>
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="absolute top-4 end-4 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                            >
                              <svg
                                className="w-4 h-4 text-void"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Glow Effect on Hover */}
                        <div
                          className={cn(
                            'absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none',
                            'bg-gradient-to-br from-primary/5 via-transparent to-transparent'
                          )}
                          aria-hidden="true"
                        />
                      </motion.button>
                    );
                  })}
                </div>

                {/* Footer Note */}
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="text-center text-text-muted text-sm mt-8"
                >
                  Ovo možete promeniti kasnije u podešavanjima
                </motion.p>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
