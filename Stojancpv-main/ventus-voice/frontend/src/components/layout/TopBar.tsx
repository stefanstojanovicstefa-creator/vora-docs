/**
 * Top Bar Component
 *
 * Features:
 * - Transparent to blur transition on scroll
 * - User avatar with status indicator
 * - Theme toggle button
 * - Command palette trigger
 * - RTL layout support
 */

import { useEffect, useState } from 'react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { Command } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CommandPaletteTrigger } from '@/components/CommandPalette';
import { ModeToggle } from '@/components/mode';
import { LanguageSwitcher } from '@/components/language/LanguageSwitcher';

interface TopBarProps {
  className?: string;
  sidebarCollapsed?: boolean;
}

export function TopBar({ className, sidebarCollapsed = false }: TopBarProps) {
  const [isScrolled, setIsScrolled] = useState(false);
  const { t } = useTranslation(['common']);

  useEffect(() => {
    const handleScroll = () => {
      // Trigger blur effect after scrolling 20px
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 right-0 z-30 h-16 transition-all duration-300",
        // Adjust left margin based on sidebar state
        sidebarCollapsed ? "left-0 lg:left-20" : "left-0 lg:left-64",
        // Transparent by default, blur on scroll
        isScrolled
          ? "glass-card border-b border-[hsl(var(--border))]"
          : "bg-transparent",
        className
      )}
      role="banner"
    >
      <div className="flex h-full items-center justify-between px-6">
        {/* Left Section - Breadcrumbs or Page Title */}
        <div className="flex items-center gap-4">
          {/* This can be replaced with breadcrumbs or page title */}
          <div className="hidden md:block">
            {/* Placeholder for dynamic content */}
          </div>
        </div>

        {/* Right Section - Actions and User */}
        <div className="flex items-center gap-3">
          {/* Command Palette Trigger */}
          <CommandPaletteTrigger />

          {/* Language Switcher */}
          <LanguageSwitcher compact />

          {/* Theme Toggle */}
          <ThemeToggle
            variant="ghost"
            size="icon"
            className={cn(
              "h-9 w-9 rounded-lg transition-colors duration-200",
              "hover:bg-[hsl(var(--surface))]",
              "focus-visible-ring"
            )}
          />

          {/* Mode Toggle - Fixed-width container prevents layout shift during animation */}
          <SignedIn>
            <div className="w-[180px] flex-shrink-0">
              <ModeToggle />
            </div>
          </SignedIn>

          {/* Authentication */}
          <SignedOut>
            <SignInButton mode="modal">
              <Button
                variant="default"
                size="sm"
                className={cn(
                  "h-9 px-4 rounded-lg font-medium",
                  "bg-[hsl(var(--primary))] text-[hsl(var(--void))]",
                  "hover:bg-[hsl(var(--primary)_/_0.9)]",
                  "neon-glow",
                  "transition-all duration-200"
                )}
                aria-label={t('common:auth.signInAria')}
              >
                {t('common:auth.signIn')}
              </Button>
            </SignInButton>
          </SignedOut>

          <SignedIn>
            <div className="relative">
              {/* Online Status Indicator */}
              <div className="absolute -top-0.5 -right-0.5 z-10">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--success))] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[hsl(var(--success))] border-2 border-[hsl(var(--void))]"></span>
                </span>
              </div>

              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: cn(
                      "h-9 w-9 rounded-lg",
                      "ring-2 ring-[hsl(var(--border))]",
                      "hover:ring-[hsl(var(--primary))]",
                      "transition-all duration-200"
                    ),
                    userButtonPopoverCard: "glass-card",
                    userButtonPopoverActionButton: cn(
                      "hover:bg-[hsl(var(--surface))]",
                      "focus-visible-ring"
                    )
                  }
                }}
              />
            </div>
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
