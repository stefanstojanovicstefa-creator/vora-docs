/**
 * Sidebar Navigation Component
 *
 * Features:
 * - Glass card effect with 70% opacity and backdrop blur
 * - Lucide icons at 24px
 * - Active state with neon primary glow
 * - RTL layout support
 * - Keyboard navigation
 * - Collapsible on mobile
 * - Delightful micro-interactions with Framer Motion
 */

import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import {
  LayoutDashboard,
  Sparkles,
  Bot,
  Link2,
  KeyRound,
  Server,
  Key,
  ChevronLeft,
  Menu,
  X,
  Database,
  Code2,
  Settings,
  BarChart3,
  Mic,
  Phone
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { SignedIn } from '@clerk/clerk-react';
import { Button } from '@/components/ui/button';
import { FuelGauge } from '@/components/billing';
import { useLabels } from '@/hooks/useLabel';
import { useViewMode } from '@/hooks/useViewMode';
import type { LabelKey } from '@/constants/modeLabels';

interface NavLink {
  to: string;
  labelKey: LabelKey;
  icon: typeof LayoutDashboard;
  badge?: string;
  godModeOnly?: boolean; // Hide in Mom Mode
}

interface SidebarProps {
  className?: string;
  defaultCollapsed?: boolean;
}

export function Sidebar({ className, defaultCollapsed = false }: SidebarProps) {
  const location = useLocation();
  const { t } = useTranslation(['navigation']);
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const { isMomMode } = useViewMode();

  const links: NavLink[] = [
    {
      to: '/',
      labelKey: 'dashboard',
      icon: LayoutDashboard,
    },
    {
      to: '/agents',
      labelKey: 'agents',
      icon: Bot,
    },
    {
      to: '/analytics',
      labelKey: 'analytics',
      icon: BarChart3,
    },
    {
      to: '/knowledge-base',
      labelKey: 'knowledgeBase',
      icon: Database,
    },
    {
      to: '/custom-functions',
      labelKey: 'customFunctions',
      icon: Code2,
      godModeOnly: true, // Technical feature
    },
    {
      to: '/voices',
      labelKey: 'voices',
      icon: Mic,
    },
    {
      to: '/integrations',
      labelKey: 'integrations',
      icon: Link2,
    },
    {
      to: '/phone-numbers',
      labelKey: 'phoneNumbers',
      icon: Phone,
    },
    {
      to: '/api-keys',
      labelKey: 'apiKeys',
      icon: KeyRound,
      godModeOnly: true, // Technical API management
    },
    {
      to: '/providers',
      labelKey: 'provider',
      icon: Server,
      godModeOnly: true, // Technical provider config
    },
    {
      to: '/credentials',
      labelKey: 'credentials',
      icon: Key,
    },
    {
      to: '/settings',
      labelKey: 'settings',
      icon: Settings,
    },
  ];

  // Filter links based on view mode
  const visibleLinks = links.filter(link => {
    if (link.godModeOnly && isMomMode) {
      return false;
    }
    return true;
  });

  const labels = useLabels(visibleLinks.map((link) => link.labelKey));

  const { focusedIndex, setFocusedIndex } = useKeyboardNavigation({
    itemCount: visibleLinks.length,
    enabled: true,
    loop: true,
    orientation: 'vertical',
    containerRef: navRef,
    onSelect: (index) => {
      // Navigation handled by Link component
    },
  });

  return (
    <>
      {/* Mobile Menu Toggle */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "fixed top-4 left-4 z-50 lg:hidden glass-card",
          isMobileOpen && "left-[252px]"
        )}
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        aria-label={
          isMobileOpen
            ? t('navigation:sidebar.closeMenuAria')
            : t('navigation:sidebar.openMenuAria')
        }
      >
        {isMobileOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </Button>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-[hsl(var(--void))]/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen transition-transform duration-300",
          "glass-card border-r border-[hsl(var(--border))]",
          // Mobile: slide in/out
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          // Desktop: always visible
          "lg:translate-x-0",
          // Width based on collapsed state
          isCollapsed ? "w-20" : "w-64",
          className
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex h-full flex-col">
          {/* Logo / Brand */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-[hsl(var(--border))]">
            {!isCollapsed && (
              <Link
                to="/"
                className="text-xl font-semibold text-[hsl(var(--text-high))] tracking-tight"
                aria-label="Vora Voice home"
              >
                Vora
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="hidden lg:flex h-8 w-8 ml-auto"
              onClick={() => setIsCollapsed(!isCollapsed)}
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <ChevronLeft
                className={cn(
                  "h-5 w-5 transition-transform duration-200 rtl-mirror",
                  isCollapsed && "rotate-180"
                )}
              />
            </Button>
          </div>

          {/* Navigation Links */}
          <nav
            ref={navRef}
            className="flex-1 overflow-y-auto py-4 px-3 space-y-1"
            role="menu"
            aria-label={t('navigation:sidebar.mainMenuAria')}
          >
            {visibleLinks.map((link, index) => {
              const Icon = link.icon;
              const isActive = location.pathname === link.to;
              const isFocused = focusedIndex === index;
              const label = labels[link.labelKey];

              return (
                <motion.div
                  key={link.to}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: index * 0.03,
                    type: "spring",
                    stiffness: 300,
                    damping: 25
                  }}
                >
                  <Link
                    to={link.to}
                    role="menuitem"
                    tabIndex={isFocused ? 0 : -1}
                    aria-label={label}
                    aria-current={isActive ? 'page' : undefined}
                    onFocus={() => setFocusedIndex(index)}
                    onClick={() => setIsMobileOpen(false)}
                    className={cn(
                      "group flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200",
                      "text-[hsl(var(--text-muted))] hover:text-[hsl(var(--text-high))]",
                      "hover:bg-[hsl(var(--surface))]",
                      "focus-visible-ring relative overflow-hidden",
                      isActive && [
                        "bg-[hsl(var(--primary)_/_0.1)]",
                        "text-[hsl(var(--primary))]",
                        "neon-glow-active",
                        "border border-[hsl(var(--primary)_/_0.2)]"
                      ],
                      isCollapsed && "justify-center"
                    )}
                  >
                    {/* Hover shimmer effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '100%' }}
                      transition={{ duration: 0.6, ease: "easeInOut" }}
                    />

                    <motion.div
                      whileHover={{ scale: 1.1, rotate: isActive ? [0, -5, 5, 0] : 0 }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      <Icon
                        className={cn(
                          "h-6 w-6 flex-shrink-0 transition-colors duration-200 relative z-10",
                          isActive && "text-[hsl(var(--primary))]"
                        )}
                        aria-hidden="true"
                      />
                    </motion.div>

                    <AnimatePresence mode="wait">
                      {!isCollapsed && (
                        <motion.span
                          className="text-sm font-medium truncate relative z-10"
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    <AnimatePresence>
                      {!isCollapsed && link.badge && (
                        <motion.span
                          className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full bg-[hsl(var(--primary)_/_0.1)] text-[hsl(var(--primary))] relative z-10"
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        >
                          {link.badge}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                </motion.div>
              );
            })}
          </nav>

          {/* Fuel Gauge */}
          <SignedIn>
            <div className={cn(
              "border-t border-[hsl(var(--border))] px-3 py-3",
              isCollapsed && "px-2 flex justify-center"
            )}>
              {isCollapsed ? (
                <FuelGauge className="w-auto px-2 [&_.fuel-gauge-details]:hidden" />
              ) : (
                <FuelGauge className="w-full" />
              )}
            </div>
          </SignedIn>

          {/* Footer Section */}
          <div className={cn(
            "border-t border-[hsl(var(--border))] p-4",
            isCollapsed && "px-2"
          )}>
            {!isCollapsed && (
              <div className="text-xs text-[hsl(var(--text-muted))] space-y-1">
                <p className="font-medium">Vora Voice AI</p>
                <p>{t('navigation:sidebar.version', { version: '1.0.0' })}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1">
                  <Link to="/policies/privacy" className="hover:text-[hsl(var(--text-high))] transition-colors">Privacy</Link>
                  <Link to="/policies/terms" className="hover:text-[hsl(var(--text-high))] transition-colors">Terms</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
