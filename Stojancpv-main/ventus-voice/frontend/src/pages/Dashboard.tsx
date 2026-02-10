import { useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  TrendingUp,
  Phone,
  Clock,
  DollarSign,
  Zap,
  MessageSquare,
  ArrowRight,
  Bot,
  Database,
  BarChart3,
  Play,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/utils';
import { MetricCardGridSkeleton } from '@/components/skeletons';
import { StatCard } from '@/components/Dashboard/StatCard';
import { dashboardService, type DashboardStats, type RecentSession, type ChartDataPoint } from '@/services/dashboard.service';
import { ChartSkeleton } from '@/components/ui/chart-skeleton';
import { useViewMode } from '@/hooks/useViewMode';
import { useLabel } from '@/hooks/useLabel';
import { agentForgeService } from '@/services/agent-forge.service';
import { useTranslation } from 'react-i18next';

// Lazy load chart components
const CallTrendsChart = lazy(() => import('@/components/Dashboard/CallTrendsChart').then(m => ({ default: m.CallTrendsChart })));
const CostAnalyticsChart = lazy(() => import('@/components/Dashboard/CostAnalyticsChart').then(m => ({ default: m.CostAnalyticsChart })));

interface IncompleteSession {
  sessionId: string;
  currentQuestionIndex: number;
  totalQuestions: number;
  progress: number;
  createdAt: string;
  firstIncompleteStage?: string;
}

export default function Dashboard() {
  const { t } = useTranslation(['analytics', 'common', 'navigation', 'agent', 'billing']);
  const { user } = useUser();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [incompleteSession, setIncompleteSession] = useState<IncompleteSession | null>(null);
  const { isMomMode } = useViewMode();
  const dashboardLabel = useLabel('dashboard');
  const createAgentLabel = useLabel('createAgent');
  const totalCallsLabel = useLabel('totalCalls');
  const activeAgentsLabel = useLabel('activeAgents');
  const averageDurationLabel = useLabel('averageDuration');
  const successRateLabel = useLabel('successRate');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch all dashboard data from the real API
        const data = await dashboardService.getDashboardData();

        setStats(data.stats || null);
        setRecentSessions(data.recentSessions || []);
        setChartData(data.chartData || []);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

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

    fetchDashboardData();
    fetchIncompleteSession();
  }, [user]);

  const getStatusVariant = (status: RecentSession['status']) => {
    switch (status) {
      case 'active':
        return 'info';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'secondary';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="space-y-1">
          <div className="h-8 w-64 bg-[#27272A]/50 rounded animate-pulse mb-2" />
          <div className="h-5 w-96 bg-[#27272A]/50 rounded animate-pulse" />
        </div>
        <MetricCardGridSkeleton count={4} columns={4} showTrend={true} />
      </div>
    );
  }

  const welcomeText = {
    title: t('analytics:dashboard.welcomeTitle'),
    subtitle: t('analytics:dashboard.welcomeSubtitle'),
  };

  const getStatDescription = (type: 'calls' | 'duration') => {
    if (type === 'calls') {
      return t('analytics:dashboard.statDescription.calls', {
        count: stats?.totalCalls || 0,
      });
    }

    return t('analytics:dashboard.statDescription.duration', {
      duration: formatDuration(stats?.avgCallDuration || 0),
    });
  };

  return (
    <motion.div
      className="space-y-8"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
    >
      {/* Header */}
      <motion.div
        className="space-y-1"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <h1 className="text-2xl font-semibold text-[hsl(var(--text-high))]">
          {welcomeText.title}
        </h1>
        <p className="text-sm text-[hsl(var(--text-muted))]">
          {welcomeText.subtitle}
        </p>
      </motion.div>

      {/* Mode-aware friendly stats for Mom Mode */}
      <AnimatePresence>
        {isMomMode && stats && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 25 }}
          >
            <Card className="p-6 bg-[hsl(var(--primary)_/_0.05)] border-[hsl(var(--primary)_/_0.2)] relative overflow-hidden group">
              {/* Subtle breathing glow */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-[#99CDFF]/10 via-transparent to-transparent"
                animate={{
                  opacity: [0.3, 0.6, 0.3],
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              <div className="space-y-2 relative z-10">
                <p className="text-base text-[hsl(var(--text-high))]">
                  {t('analytics:dashboard.hero.callsHelpedTodayPrefix')}{' '}
                  <span className="font-semibold text-[hsl(var(--primary))]">{stats.totalCalls}</span>{' '}
                  {t('analytics:dashboard.hero.callsHelpedTodaySuffix')}
                </p>
                <p className="text-sm text-[hsl(var(--text-muted))]">
                  {t('analytics:dashboard.hero.avgCallDurationPrefix')}{' '}
                  <span className="font-medium">{formatDuration(stats.avgCallDuration)}</span>
                </p>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={totalCallsLabel}
          value={stats?.totalCalls.toLocaleString() || '0'}
          icon={Phone}
          trend={{ value: 12.5, label: t('analytics:dashboard.trend.fromLastWeek') }}
          href="/analytics?tab=overview"
        />
        <StatCard
          title={t('analytics:dashboard.activeSessions')}
          value={stats?.activeSessions || 0}
          icon={Activity}
          iconColor="text-[hsl(var(--success))]"
          href="/analytics?tab=activity"
        />
        <StatCard
          title={activeAgentsLabel}
          value={stats?.totalAgents || 0}
          icon={Bot}
          href="/analytics?tab=performance"
        />
        <StatCard
          title={successRateLabel}
          value={`${stats?.successRate || 0}%`}
          icon={TrendingUp}
          trend={{ value: 2.1, label: t('analytics:dashboard.trend.improvement') }}
          iconColor="text-[hsl(var(--success))]"
          href="/analytics?tab=overview"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton height={240} />}>
          <CallTrendsChart data={chartData} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={240} />}>
          <CostAnalyticsChart data={chartData} />
        </Suspense>
      </div>

      {/* Incomplete Agent Setup Card (US-007: 7 logical stages) */}
      {incompleteSession && (
        <Card className="p-6 bg-gradient-to-br from-[hsl(var(--primary)_/_0.1)] to-[hsl(var(--secondary)_/_0.05)] border-[hsl(var(--primary)_/_0.3)]">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-5 w-5 text-[hsl(var(--primary))]" />
                <h3 className="text-lg font-semibold text-[hsl(var(--text-high))]">
                  {t('agent:interview.incomplete.title')}
                </h3>
              </div>
              <p className="text-sm text-[hsl(var(--text-muted))] mb-1">
                {incompleteSession.progress >= 99
                  ? 'Almost done - test your agent'
                  : `${incompleteSession.currentQuestionIndex}/${incompleteSession.totalQuestions} stages (${incompleteSession.progress}%)`}
              </p>
              {incompleteSession.firstIncompleteStage && incompleteSession.progress < 99 && (
                <p className="text-xs text-[hsl(var(--text-muted))] mb-2">
                  {`Next: ${incompleteSession.firstIncompleteStage.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}`}
                </p>
              )}
              <div className="w-full bg-[hsl(var(--surface))] rounded-full h-2 mb-4">
                <div
                  className="bg-[hsl(var(--primary))] h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, incompleteSession.progress)}%` }}
                />
              </div>
            </div>
            <Link to={`/agents/create/interview${incompleteSession.firstIncompleteStage ? `?stage=${incompleteSession.firstIncompleteStage}` : ''}`}>
              <Button
                size="sm"
                className="gap-2 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)_/_0.9)]"
              >
                <Play className="h-4 w-4" />
                {t('common:actions.continue')}
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* Recent Sessions & Quick Actions */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Sessions */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-medium text-[hsl(var(--text-high))]">
                {t('analytics:dashboard.recentSessions.title')}
              </h3>
              <p className="text-sm text-[hsl(var(--text-muted))]">
                {t('analytics:dashboard.recentSessions.subtitle')}
              </p>
            </div>
            <div className="h-8 w-8 rounded-[var(--radius-md)] bg-[hsl(var(--surface-elevated))] flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-[hsl(var(--primary))]" />
            </div>
          </div>

          <div className="space-y-2">
            {recentSessions.map((session, index) => (
              <Link key={session.id} to={`/sessions/${session.id}`} className="block no-underline">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
                  whileHover={{ scale: 1.01, x: 4 }}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-[var(--radius-md)]',
                    'bg-[hsl(var(--surface-elevated))] border border-[hsl(var(--border))]',
                    'hover:border-[hsl(var(--primary)_/_0.3)] transition-all duration-200',
                    'cursor-pointer group relative overflow-hidden'
                  )}
                  style={{
                    boxShadow: '0 0 0 hsl(var(--primary) / 0)',
                  }}
                  whileHoverStyle={{
                    boxShadow: '0 0 15px hsl(var(--primary) / 0.1)',
                  }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-8 w-8 rounded-[var(--radius-md)] bg-[hsl(var(--surface))] flex items-center justify-center">
                      <Bot className="h-4 w-4 text-[hsl(var(--text-muted))]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[hsl(var(--text-high))] truncate">
                        {session.agentName}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-muted))]">
                        <Clock className="h-3 w-3" />
                        <span>{formatDuration(session.duration)}</span>
                        <span>·</span>
                        <span>{formatDateTime(session.timestamp)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(session.status)} className="capitalize">
                      {session.status}
                    </Badge>
                    <motion.div
                      animate={{ x: [0, 4, 0] }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        repeatDelay: 1
                      }}
                    >
                      <ArrowRight className="h-4 w-4 text-[hsl(var(--text-muted))] group-hover:text-[hsl(var(--primary))] transition-colors" />
                    </motion.div>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>

          <Link to="/sessions" className="block mt-4">
            <Button variant="ghost" className="w-full">
              {t('analytics:dashboard.recentSessions.viewAll')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-base font-medium text-[hsl(var(--text-high))]">
              {t('analytics:dashboard.quickActions.title')}
            </h3>
            <p className="text-sm text-[hsl(var(--text-muted))]">
              {t('analytics:dashboard.quickActions.subtitle')}
            </p>
          </div>

          <div className="space-y-2">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {/* P0J-05: Voice-first entry point - Mom Mode goes directly to Forge */}
              <Link to={isMomMode ? '/agents/create/interview' : '/agents/create'}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    data-tutorial-target="create-agent"
                    className="w-full justify-start gap-2 relative overflow-hidden group neon-glow-hover"
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-[#99CDFF]/20 to-transparent"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '100%' }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                    />
                    <motion.div
                      whileHover={{ rotate: [0, -10, 10, 0] }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <Bot className="h-4 w-4 relative z-10" />
                    </motion.div>
                    <span className="relative z-10">{createAgentLabel}</span>
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <Link to="/knowledge-base">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button variant="secondary" className="w-full justify-start gap-2">
                    <Database className="h-4 w-4" />
                    {t('navigation:sidebar.knowledgeBase')}
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Link to="/monitoring">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button variant="secondary" className="w-full justify-start gap-2">
                    <Activity className="h-4 w-4" />
                    {t('navigation:sidebar.monitoring')}
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <Link to="/cost-analytics">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button variant="secondary" className="w-full justify-start gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t('navigation:sidebar.usageAndCosts')}
                  </Button>
                </motion.div>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Link to="/credentials">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button variant="secondary" className="w-full justify-start gap-2">
                    <Zap className="h-4 w-4" />
                    {t('navigation:sidebar.credentials')}
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          </div>
        </Card>
      </div>

      {/* Additional Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/analytics?tab=overview" className="block no-underline">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ y: -4 }}
          >
            <Card className="p-6 relative overflow-hidden group cursor-pointer">
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'radial-gradient(circle at top right, hsl(var(--primary) / 0.05), transparent)',
                }}
              />
              <div className="flex items-center justify-between mb-2 relative z-10">
                <span className="text-sm text-[hsl(var(--text-muted))]">
                  {averageDurationLabel}
                </span>
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                >
                  <Clock className="h-4 w-4 text-[hsl(var(--primary))]" />
                </motion.div>
              </div>
              <p className="text-xl font-semibold text-[hsl(var(--text-high))] tabular-nums relative z-10">
                {formatDuration(stats?.avgCallDuration || 0)}
              </p>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-1 relative z-10">
                {t('analytics:dashboard.cost.perSessionAverage')}
              </p>
            </Card>
          </motion.div>
        </Link>

        <Link to="/analytics?tab=costs" className="block no-underline">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            whileHover={{ y: -4 }}
          >
            <Card className="p-6 relative overflow-hidden group cursor-pointer">
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'radial-gradient(circle at top right, rgba(74, 222, 128, 0.05), transparent)',
                }}
              />
              <div className="flex items-center justify-between mb-2 relative z-10">
                <span className="text-sm text-[hsl(var(--text-muted))]">
                  {t('analytics:dashboard.cost.totalSpend')}
                </span>
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <DollarSign className="h-4 w-4 text-[hsl(var(--success))]" />
                </motion.div>
              </div>
              <p className="text-xl font-semibold text-[hsl(var(--text-high))] tabular-nums relative z-10">
                ${stats?.totalCost.toFixed(2)}
              </p>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-1 relative z-10">
                {t('common:time.thisMonth')}
              </p>
            </Card>
          </motion.div>
        </Link>

        <Link to="/analytics?tab=usage" className="block no-underline">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ y: -4 }}
          >
            <Card className="p-6 relative overflow-hidden group cursor-pointer">
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'radial-gradient(circle at top right, rgba(251, 191, 36, 0.05), transparent)',
                }}
              />
              <div className="flex items-center justify-between mb-2 relative z-10">
                <span className="text-sm text-[hsl(var(--text-muted))]">
                  {t('analytics:dashboard.apiCalls.title')}
                </span>
                <motion.div
                  animate={{
                    rotate: [0, 15, -15, 0],
                    scale: [1, 1.1, 1.1, 1],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                    repeatDelay: 1
                  }}
                >
                  <Zap className="h-4 w-4 text-[hsl(var(--warning))]" />
                </motion.div>
              </div>
              <p className="text-xl font-semibold text-[hsl(var(--text-high))] tabular-nums relative z-10">
                {((stats?.totalCalls || 0) * 3).toLocaleString()}
              </p>
              <p className="text-xs text-[hsl(var(--text-muted))] mt-1 relative z-10">
                {t('analytics:dashboard.apiCalls.totalRequests')}
              </p>
            </Card>
          </motion.div>
        </Link>
      </div>
    </motion.div>
  );
}
