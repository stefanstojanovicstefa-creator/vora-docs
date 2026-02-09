/**
 * Agent Creation Hub Page
 *
 * Main page where users choose one of 3 methods to create an AI agent:
 * 1. URL Method (Imam Websajt) - Analyze website and create agent
 * 2. Forge Method (Popričaj sa nama) - Freeform AI-guided setup - RECOMMENDED
 * 3. Prompt Method (Imam Instrukcije) - Direct prompt input - GOD MODE ONLY
 */

import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import { Globe, MessageCircle, FileText, Sparkles, Play, Code2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { useViewMode } from '@/hooks/useViewMode';
import { Badge } from '@/components/ui/badge';
import { agentForgeService } from '@/services/agent-forge.service';
import { useAnalytics } from '@/hooks/useAnalytics';

interface CreationMethod {
  id: string;
  title: string;
  description: string;
  subtext: string;
  icon: typeof Globe;
  route: string;
  recommended?: boolean;
  godModeOnly?: boolean;
}

interface IncompleteSession {
  sessionId: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  progress: number;
  createdAt: string;
  firstIncompleteStage?: string;
}

export default function AgentCreationHub() {
  const { user } = useUser();
  const navigate = useNavigate();
  const { t } = useTranslation(['agent', 'common']);
  const { isGodMode } = useViewMode();
  const [incompleteSession, setIncompleteSession] = useState<IncompleteSession | null>(null);
  const { trackEvent } = useAnalytics();

  useEffect(() => {
    const fetchIncompleteSession = async () => {
      if (!user) return;

      try {
        const response = await agentForgeService.getIncompleteSession();
        if (response.hasIncompleteSession && response.session) {
          setIncompleteSession(response.session);
        }
      } catch (error) {
        console.error('Failed to fetch incomplete session:', error);
      }
    };

    fetchIncompleteSession();
  }, [user]);

  const creationMethods: CreationMethod[] = [
    {
      id: 'url',
      title: t('agent:creation.methods.url.title'),
      description: t('agent:creation.methods.url.description'),
      subtext: t('agent:creation.methods.url.subtext'),
      icon: Globe,
      route: '/agents/create/url',
    },
    {
      id: 'interview',
      title: t('agent:creation.methods.interview.title'),
      description: t('agent:creation.methods.interview.description'),
      subtext: t('agent:creation.methods.interview.subtext'),
      icon: MessageCircle,
      route: '/agents/create/interview',
      recommended: true,
    },
    {
      id: 'prompt',
      title: t('agent:creation.methods.prompt.title'),
      description: t('agent:creation.methods.prompt.description'),
      subtext: t('agent:creation.methods.prompt.subtext'),
      icon: FileText,
      route: '/agents/wizard',
      godModeOnly: true,
    },
    {
      id: 'command-center',
      title: 'Command Center',
      description: 'Full control over every parameter',
      subtext: 'Build your agent from scratch with the advanced builder. Configure brain, voice, ears, behavior, tools, analysis, flow, and more.',
      icon: Code2,
      route: '/agents/create/builder',
      godModeOnly: true,
    },
  ];

  // Filter methods based on view mode
  const visibleMethods = creationMethods.filter((method) => {
    if (method.godModeOnly && !isGodMode) return false;
    return true;
  });

  const handleMethodSelect = (route: string, methodId: string) => {
    // Map route to method type
    const methodMap: Record<string, 'url' | 'interview' | 'prompt'> = {
      '/agents/create/url': 'url',
      '/agents/create/interview': 'interview',
      '/agents/wizard': 'prompt',
    };

    const method = methodMap[route];
    if (method) {
      trackEvent({
        name: 'agent_creation_method_selected',
        properties: { method },
      });
    }

    navigate(route);
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut',
      },
    },
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center space-y-3"
      >
        <h1 className="text-4xl font-semibold tracking-tight text-[hsl(var(--text-high))]">
          {t('agent:creation.title')}
        </h1>
        <p className="text-lg text-[hsl(var(--text-muted))]">
          {t('agent:creation.methods.title')}
        </p>
      </motion.div>

      {/* Continue Incomplete Session Card */}
      {incompleteSession && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-6"
        >
          <div className="relative bg-gradient-to-br from-[hsl(var(--primary)_/_0.15)] to-[hsl(var(--secondary)_/_0.1)] border-2 border-[hsl(var(--primary)_/_0.4)] rounded-2xl p-6 shadow-[0_0_30px_rgba(153,205,255,0.2)]">
            {/* Badge */}
            <div className="absolute -top-3 start-1/2 -translate-x-1/2">
              <Badge className="bg-[hsl(var(--primary))] text-[hsl(var(--void))] px-4 py-1.5 shadow-lg">
                <Play className="h-3 w-3 me-1 inline-block" />
                {t('agent:interview.incomplete.badge')}
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-6 mt-2">
              {/* Left side - Info */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <MessageCircle className="h-6 w-6 text-[hsl(var(--primary))]" />
                  <div>
                    <h3 className="text-xl font-semibold text-[hsl(var(--text-high))]">
                      {t('agent:interview.incomplete.title')}
                    </h3>
                    <p className="text-sm text-[hsl(var(--text-muted))]">
                      {t('agent:interview.incomplete.progress', {
                        current: incompleteSession.currentQuestionIndex,
                        total: incompleteSession.totalQuestions,
                        percent: incompleteSession.progress,
                      })}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-[hsl(var(--surface))] rounded-full h-3 mb-2">
                  <div
                    className="bg-[hsl(var(--primary))] h-3 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(153,205,255,0.5)]"
                    style={{ width: `${incompleteSession.progress}%` }}
                  />
                </div>
                <p className="text-xs text-[hsl(var(--text-muted))]">
                  {t('agent:interview.incomplete.percentLabel', { percent: incompleteSession.progress })}
                </p>
              </div>

              {/* Right side - Button */}
              <button
                onClick={() => navigate('/agents/create/interview')}
                className={cn(
                  'bg-[hsl(var(--primary))] text-[hsl(var(--void))]',
                  'px-8 py-4 rounded-xl font-semibold',
                  'hover:bg-[hsl(var(--primary)_/_0.9)]',
                  'hover:shadow-[0_0_25px_rgba(153,205,255,0.4)]',
                  'transition-all duration-200',
                  'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50',
                  'flex items-center gap-2',
                  'transform hover:scale-105'
                )}
              >
                <Play className="h-5 w-5" />
                {t('common:actions.continue')}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Creation Method Cards */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className={cn(
          'grid gap-6',
          visibleMethods.length === 2
            ? 'md:grid-cols-2'
            : visibleMethods.length === 4
              ? 'md:grid-cols-2 lg:grid-cols-4'
              : 'md:grid-cols-2 lg:grid-cols-3'
        )}
      >
        {visibleMethods.map((method) => {
          const Icon = method.icon;

          return (
            <motion.button
              key={method.id}
              variants={cardVariants}
              onClick={() => handleMethodSelect(method.route, method.id)}
              className={cn(
                'relative group',
                'bg-[hsl(var(--surface))]/70 backdrop-blur-xl',
                'border border-[hsl(var(--border))]/50',
                'rounded-2xl p-8',
                'hover:border-[hsl(var(--primary))]/50',
                'hover:shadow-[0_0_20px_rgba(153,205,255,0.3)]',
                'transition-all duration-200',
                'focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]/50',
                'text-start',
                'transform hover:scale-[1.02]'
              )}
            >
              {/* Recommended Badge */}
              {method.recommended && (
                <div className="absolute -top-3 start-1/2 -translate-x-1/2">
                  <Badge
                    variant="default"
                    className="bg-[hsl(var(--primary))] text-[hsl(var(--void))] px-3 py-1 shadow-lg"
                  >
                    <Sparkles className="h-3 w-3 me-1 inline-block" />
                    {t('agent:creation.recommendedBadge')}
                  </Badge>
                </div>
              )}

              {/* Icon */}
              <div
                className={cn(
                  'mb-6 inline-flex',
                  'p-4 rounded-xl',
                  'bg-[hsl(var(--primary))]/10',
                  'text-[hsl(var(--primary))]',
                  'group-hover:bg-[hsl(var(--primary))]/20',
                  'transition-colors duration-200'
                )}
              >
                <Icon className="h-12 w-12" />
              </div>

              {/* Content */}
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-[hsl(var(--text-high))] group-hover:text-[hsl(var(--primary))] transition-colors">
                  {method.title}
                </h3>
                <p className="text-base text-[hsl(var(--text-high))]">
                  {method.description}
                </p>
                <p className="text-sm text-[hsl(var(--text-muted))] leading-relaxed">
                  {method.subtext}
                </p>
              </div>

              {/* Hover indicator */}
              <div className="absolute bottom-8 end-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="h-8 w-8 rounded-full bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                  <svg
                    className="h-4 w-4 text-[hsl(var(--primary))]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </div>
              </div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Helper Text */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="text-center"
      >
        <p className="text-sm text-[hsl(var(--text-muted))]">
          {t('agent:creation.helperText')}
        </p>
      </motion.div>
    </div>
  );
}
