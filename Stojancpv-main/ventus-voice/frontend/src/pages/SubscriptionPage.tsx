/**
 * Subscription Management Page
 *
 * Complete subscription management interface with:
 * - Current plan overview with status indicators
 * - Usage metrics (minutes, agents)
 * - Payment method management
 * - Invoice history
 * - Upgrade/cancellation flows
 * - Mode-aware labels (Serbian Mom Mode / English God Mode)
 * - Vora glassmorphism design system
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Crown, Calendar, CreditCard, AlertTriangle, Zap, Users, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useViewMode } from '@/hooks/useViewMode';
import { useLabel } from '@/hooks/useLabel';
import { fetchSubscription, getPlanLimits } from '@/services/subscription.service';
import { UsageDisplay } from '@/components/billing/UsageDisplay';
import { CustomerPortalButton } from '@/components/billing/CustomerPortalButton';
import { InvoiceHistory } from '@/components/billing/InvoiceHistory';
import { UpgradeModal } from '@/components/billing/UpgradeModal';
import { CancellationFlowModal } from '@/components/billing/CancellationFlowModal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function SubscriptionPage() {
  const { isMomMode } = useViewMode();
  const label = useLabel;

  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showCancel, setShowCancel] = useState(false);

  // Fetch subscription data
  const { data: subscription, isLoading, error } = useQuery({
    queryKey: ['subscription'],
    queryFn: fetchSubscription,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: true,
  });

  // Plan badge styling
  const planBadgeStyles = {
    free: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    pro: 'bg-[#99CDFF]/20 text-[#99CDFF] border-[#99CDFF]/30',
    enterprise: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  };

  // Status indicator styling
  const statusStyles = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    trialing: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    past_due: 'bg-red-500/20 text-red-400 border-red-500/30',
    cancelled: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    expired: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  // Status labels
  const getStatusLabel = (status: string) => {
    const labels = {
      active: isMomMode ? 'Aktivna' : 'Active',
      trialing: isMomMode ? 'Probni Period' : 'Trial',
      past_due: isMomMode ? 'Dug Prekoračen' : 'Past Due',
      cancelled: isMomMode ? 'Otkazana' : 'Cancelled',
      expired: isMomMode ? 'Istekla' : 'Expired',
    };
    return labels[status as keyof typeof labels] || status;
  };

  // Plan name labels
  const getPlanLabel = (tier: string) => {
    const labels = {
      free: isMomMode ? 'Besplatan' : 'Free',
      pro: isMomMode ? 'Profesionalni' : 'Pro',
      enterprise: isMomMode ? 'Preduzeće' : 'Enterprise',
    };
    return labels[tier as keyof typeof labels] || tier;
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return isMomMode ? 'N/A' : 'N/A';
    const date = new Date(dateString);
    return isMomMode
      ? date.toLocaleDateString('sr-RS', { year: 'numeric', month: 'long', day: 'numeric' })
      : date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
        <Skeleton className="h-10 w-64 bg-[hsl(var(--surface))]" />
        <Skeleton className="h-[200px] w-full bg-[hsl(var(--surface))]/70" />
        <Skeleton className="h-[300px] w-full bg-[hsl(var(--surface))]/70" />
      </div>
    );
  }

  // Error state
  if (error || !subscription) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="bg-[hsl(var(--surface))]/70 backdrop-blur-xl border border-[hsl(var(--border))]/50 rounded-2xl p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-[hsl(var(--error))] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[hsl(var(--text-high))] mb-2">
            {label('error')}
          </h2>
          <p className="text-[hsl(var(--text-muted))]">
            {isMomMode ? 'Greška pri učitavanju pretplate' : 'Failed to load subscription'}
          </p>
        </div>
      </div>
    );
  }

  const planLimits = getPlanLimits(subscription.tier);
  const isUnlimited = planLimits.minutes === -1;
  const isPaid = subscription.tier !== 'free';

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 max-w-6xl">
      {/* Page Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-[hsl(var(--text-high))] tracking-tight">
          {label('subscription')}
        </h1>
        <p className="text-[hsl(var(--text-muted))] mt-2">
          {isMomMode
            ? 'Upravljajte svojom pretplatom i pregledajte upotrebu'
            : 'Manage your subscription and view usage'}
        </p>
      </motion.div>

      {/* Current Plan Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="bg-[hsl(var(--surface))]/70 backdrop-blur-xl border border-[hsl(var(--border))]/50 rounded-2xl p-6 relative overflow-hidden"
      >
        {/* Background gradient for paid plans */}
        {isPaid && (
          <div className="absolute inset-0 bg-gradient-to-br from-[hsl(var(--primary))]/5 to-transparent pointer-events-none" />
        )}

        <div className="relative z-10">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-[hsl(var(--primary))]/10 rounded-xl">
                <Crown className="w-6 h-6 text-[hsl(var(--primary))]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-semibold text-[hsl(var(--text-high))]">
                    {getPlanLabel(subscription.tier)}
                  </h2>
                  <span
                    className={cn(
                      'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border',
                      planBadgeStyles[subscription.tier]
                    )}
                  >
                    {getPlanLabel(subscription.tier)}
                  </span>
                </div>
                <p className="text-sm text-[hsl(var(--text-muted))]">
                  {label('currentPlan')}
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border',
                statusStyles[subscription.status]
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
              {getStatusLabel(subscription.status)}
            </span>
          </div>

          {/* Plan Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Next Billing Date */}
            <div className="flex items-start gap-3 p-4 bg-[hsl(var(--void))]/30 rounded-xl border border-[hsl(var(--border))]/30">
              <Calendar className="w-5 h-5 text-[hsl(var(--text-muted))] mt-0.5" />
              <div>
                <p className="text-xs text-[hsl(var(--text-muted))] mb-1">
                  {label('nextBillingDate')}
                </p>
                <p className="text-sm font-medium text-[hsl(var(--text-high))]">
                  {subscription.currentPeriodEnd
                    ? formatDate(subscription.currentPeriodEnd)
                    : isMomMode
                    ? 'N/A'
                    : 'N/A'}
                </p>
              </div>
            </div>

            {/* Minutes Limit */}
            <div className="flex items-start gap-3 p-4 bg-[hsl(var(--void))]/30 rounded-xl border border-[hsl(var(--border))]/30">
              <Zap className="w-5 h-5 text-[hsl(var(--text-muted))] mt-0.5" />
              <div>
                <p className="text-xs text-[hsl(var(--text-muted))] mb-1">
                  {isMomMode ? 'Limit Minuta' : 'Minutes Limit'}
                </p>
                <p className="text-sm font-medium text-[hsl(var(--text-high))]">
                  {isUnlimited
                    ? isMomMode
                      ? 'Neograničeno'
                      : 'Unlimited'
                    : `${planLimits.minutes} ${isMomMode ? 'minuta' : 'minutes'}`}
                </p>
              </div>
            </div>

            {/* Agents Limit */}
            <div className="flex items-start gap-3 p-4 bg-[hsl(var(--void))]/30 rounded-xl border border-[hsl(var(--border))]/30">
              <Users className="w-5 h-5 text-[hsl(var(--text-muted))] mt-0.5" />
              <div>
                <p className="text-xs text-[hsl(var(--text-muted))] mb-1">
                  {isMomMode ? 'Limit Agenata' : 'Agent Limit'}
                </p>
                <p className="text-sm font-medium text-[hsl(var(--text-high))]">
                  {planLimits.agents === -1
                    ? isMomMode
                      ? 'Neograničeno'
                      : 'Unlimited'
                    : `${planLimits.agents} ${isMomMode ? 'agenata' : 'agents'}`}
                </p>
              </div>
            </div>
          </div>

          {/* Cancellation Warning */}
          {subscription.cancelAtPeriodEnd && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 p-4 bg-[hsl(var(--warning))]/10 border border-[hsl(var(--warning))]/20 rounded-lg"
            >
              <div className="flex gap-3">
                <AlertTriangle className="w-5 h-5 text-[hsl(var(--warning))] flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-[hsl(var(--warning))] mb-1">
                    {isMomMode ? 'Pretplata otkazana' : 'Subscription Cancelled'}
                  </p>
                  <p className="text-xs text-[hsl(var(--text-muted))]">
                    {isMomMode
                      ? `Vaša pretplata će biti otkazana ${formatDate(subscription.currentPeriodEnd)}`
                      : `Your subscription will be cancelled on ${formatDate(subscription.currentPeriodEnd)}`}
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Usage Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <UsageDisplay />
      </motion.div>

      {/* Actions Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex flex-wrap gap-4"
      >
        {/* Manage Payment Method */}
        {isPaid && <CustomerPortalButton />}

        {/* Upgrade Button */}
        {subscription.tier !== 'enterprise' && (
          <Button
            onClick={() => setShowUpgrade(true)}
            className="bg-[hsl(var(--primary))] text-[hsl(var(--void))] hover:bg-[hsl(var(--secondary))] hover:shadow-[0_0_20px_rgba(153,205,255,0.3)] transition-all duration-200 neon-glow-hover"
          >
            <Crown className="w-4 h-4 me-2" />
            {label('upgradePlan')}
          </Button>
        )}

        {/* Cancel Subscription Button */}
        {isPaid && !subscription.cancelAtPeriodEnd && (
          <Button
            variant="ghost"
            onClick={() => setShowCancel(true)}
            className="text-[hsl(var(--text-muted))] hover:text-[hsl(var(--error))] hover:bg-[hsl(var(--error))]/10"
          >
            {label('cancelSubscription')}
          </Button>
        )}

        {/* Reactivate Button */}
        {subscription.cancelAtPeriodEnd && (
          <Button
            variant="outline"
            onClick={() => {
              // TODO: Implement reactivation
              console.log('Reactivate subscription');
            }}
            className="border-[hsl(var(--primary))] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
          >
            {label('resumeSubscription')}
          </Button>
        )}
      </motion.div>

      {/* Invoice History Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <InvoiceHistory />
      </motion.div>

      {/* Modals */}
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} />

      <CancellationFlowModal
        open={showCancel}
        onClose={() => setShowCancel(false)}
        subscriptionId="sub_id_placeholder" // TODO: Get actual subscription ID from backend
        planName={getPlanLabel(subscription.tier)}
        planFeatures={[
          isUnlimited
            ? isMomMode
              ? 'Neograničeni minuti poziva'
              : 'Unlimited call minutes'
            : `${planLimits.minutes} ${isMomMode ? 'minuta' : 'minutes'}`,
          planLimits.agents === -1
            ? isMomMode
              ? 'Neograničeni agenti'
              : 'Unlimited agents'
            : `${planLimits.agents} ${isMomMode ? 'agenata' : 'agents'}`,
          isMomMode ? 'Napredna analitika' : 'Advanced analytics',
          isMomMode ? 'Prioritetna podrška' : 'Priority support',
        ]}
        onCancelled={() => {
          // Refetch subscription data
          window.location.reload();
        }}
        onRetained={(offer) => {
          console.log('User retained with offer:', offer);
          // Refetch subscription data
          window.location.reload();
        }}
      />
    </div>
  );
}
