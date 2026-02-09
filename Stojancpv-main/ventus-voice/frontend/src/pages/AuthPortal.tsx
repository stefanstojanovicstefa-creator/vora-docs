import { SignIn, SignUp } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getVoraClerkAppearance } from '@/lib/clerk-theme';
import { useResolvedTheme } from '@/components/ThemeProvider';
import { HeroSphere } from '@/components/three/HeroSphere';

interface AuthPortalProps {
  mode?: 'sign-in' | 'sign-up';
}

/**
 * AuthPortal - Split-screen authentication page
 *
 * Left: Clerk auth form with Vora branding
 * Right: Visual showcase with 3D sphere placeholder and testimonial
 */
export function AuthPortal({ mode = 'sign-in' }: AuthPortalProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left Side - Auth Form */}
      <LeftPanel mode={mode} />

      {/* Right Side - Visual */}
      <RightPanel />
    </div>
  );
}

/**
 * Left Panel - Authentication Form
 */
function LeftPanel({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { t } = useTranslation(['common']);
  const resolvedTheme = useResolvedTheme();
  const clerkAppearance = getVoraClerkAppearance(resolvedTheme);
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.4,
        ease: [0.33, 1, 0.68, 1], // --ease-out
      },
    },
  };

  return (
    <motion.div
      className="w-full lg:w-1/2 min-h-screen bg-void flex flex-col justify-center px-8 lg:px-16 py-12"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Logo */}
      <motion.div variants={itemVariants} className="mb-8">
        <VoraLogo />
      </motion.div>

      {/* Title & Subtitle */}
      <motion.div variants={itemVariants} className="mb-8">
        <h1 className="text-h1 text-text-high mb-2">
          {mode === 'sign-in'
            ? t('common:auth.portal.signInTitle')
            : t('common:auth.portal.signUpTitle')}
        </h1>
        <p className="text-body text-text-muted">
          {mode === 'sign-in'
            ? t('common:auth.portal.signInSubtitle')
            : t('common:auth.portal.signUpSubtitle')}
        </p>
      </motion.div>

      {/* Clerk Auth Component */}
      <motion.div variants={itemVariants} className="w-full max-w-md">
        {mode === 'sign-in' ? (
          <SignIn
            appearance={clerkAppearance}
            routing="path"
            path="/sign-in"
            signUpUrl="/sign-up"
            forceRedirectUrl="/dashboard"
          />
        ) : (
          <SignUp
            appearance={clerkAppearance}
            routing="path"
            path="/sign-up"
            signInUrl="/sign-in"
            forceRedirectUrl="/onboarding"
          />
        )}
      </motion.div>
    </motion.div>
  );
}

/**
 * Right Panel - Visual Showcase
 */
function RightPanel() {
  const sphereVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: 0.8,
        ease: [0.33, 1, 0.68, 1],
      },
    },
  };

  const testimonialVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        delay: 0.4,
        duration: 0.6,
        ease: [0.33, 1, 0.68, 1],
      },
    },
  };

  return (
    <div className="hidden lg:flex w-1/2 min-h-screen relative overflow-hidden">
      {/* Radial Gradient Background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at center, hsl(217 91% 10%) 0%, hsl(var(--void)) 100%)',
        }}
      />

      {/* 3D Hero Sphere */}
      <motion.div
        className="absolute inset-0 z-10"
        variants={sphereVariants}
        initial="hidden"
        animate="visible"
      >
        <HeroSphere
          showOrbitControls={false}
          sphereColor="#99cdff"
          particleCount={80}
        />
      </motion.div>

      {/* Glass Testimonial Card */}
      <motion.div
        className="absolute bottom-8 start-8 end-8 z-20 max-w-lg mx-auto"
        variants={testimonialVariants}
        initial="hidden"
        animate="visible"
      >
        <GlassTestimonialCard />
      </motion.div>
    </div>
  );
}

/**
 * Vora Logo Component
 */
function VoraLogo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10">
        {/* V Symbol with glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="text-2xl font-bold text-primary"
            style={{
              textShadow: '0 0 20px hsl(var(--primary) / 0.5)',
            }}
          >
            V
          </div>
        </div>
      </div>
      <span className="text-h3 font-semibold text-text-high">Vora</span>
    </div>
  );
}

/**
 * Glass Testimonial Card
 */
function GlassTestimonialCard() {
  const { t } = useTranslation(['common']);
  return (
    <div
      className="backdrop-blur-2xl rounded-2xl p-6 border border-border/50"
      style={{
        background: 'hsl(var(--surface) / 0.6)',
      }}
    >
      <blockquote className="mb-4">
        <p className="text-body text-text-high leading-relaxed">
          {t('common:auth.portal.testimonial.quote')}
        </p>
      </blockquote>

      <footer className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30" />

        <div>
          <p className="text-body-sm font-medium text-text-high">Maja S.</p>
          <p className="text-caption text-text-muted">{t('common:auth.portal.testimonial.role')}</p>
        </div>
      </footer>
    </div>
  );
}

export default AuthPortal;
