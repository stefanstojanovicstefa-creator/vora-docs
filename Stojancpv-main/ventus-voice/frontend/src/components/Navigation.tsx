import { useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Sparkles, Activity, Key, Bot, Code2, DollarSign, BarChart3, Server, TrendingUp, Book, GraduationCap, Rocket, Link2, KeyRound, Command, Settings, Database, History } from 'lucide-react';
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { CommandPaletteTrigger } from './CommandPalette';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';

export function Navigation() {
  const location = useLocation();
  const navRef = useRef<HTMLDivElement>(null);

  const links = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, ariaLabel: 'Go to Dashboard' },
    { to: '/agents', label: 'Agents', icon: Bot, ariaLabel: 'View all voice agents' },
    { to: '/brands', label: 'Brands', icon: Sparkles, ariaLabel: 'Go to Brands page' },
    { to: '/brands/analyze', label: 'Brand Analyzer', icon: BarChart3, ariaLabel: 'Analyze brand performance' },
    { to: '/knowledge-base', label: 'Knowledge', icon: Database, ariaLabel: 'Knowledge Base' },
    { to: '/custom-functions', label: 'Functions', icon: Code2, ariaLabel: 'Custom Functions' },
    { to: '/sessions', label: 'Sessions', icon: Activity, ariaLabel: 'View session history' },
    { to: '/deployments', label: 'Deployments', icon: Rocket, ariaLabel: 'View deployments' },
    { to: '/integrations', label: 'Integrations', icon: Link2, ariaLabel: 'Connect apps and integrations' },
    { to: '/cost-analytics', label: 'Analytics', icon: DollarSign, ariaLabel: 'Cost analytics' },
    { to: '/monitoring', label: 'Monitoring', icon: BarChart3, ariaLabel: 'System monitoring' },
    { to: '/settings', label: 'Settings', icon: Settings, ariaLabel: 'Application settings' },
  ];

  const { focusedIndex, setFocusedIndex } = useKeyboardNavigation({
    itemCount: links.length,
    enabled: true,
    loop: true,
    orientation: 'horizontal',
    containerRef: navRef,
    onSelect: (index) => {
      // Navigation handled by Link component
    },
  });

  return (
    <nav className="border-b" role="navigation" aria-label="Main navigation">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="text-xl font-bold"
              aria-label="Vora Voice home"
            >
              Vora Voice
            </Link>
            <div
              ref={navRef}
              className="flex gap-4"
              role="menu"
              aria-label="Main menu"
            >
              {links.map((link, index) => {
                const Icon = link.icon;
                const isActive = location.pathname === link.to;
                const isFocused = focusedIndex === index;
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    role="menuitem"
                    tabIndex={isFocused ? 0 : -1}
                    aria-label={link.ariaLabel}
                    aria-current={isActive ? 'page' : undefined}
                    onFocus={() => setFocusedIndex(index)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                      isFocused && 'ring-2 ring-ring ring-offset-2'
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <CommandPaletteTrigger />
            <SignedOut>
              <SignInButton mode="modal">
                <Button
                  variant="default"
                  size="sm"
                  aria-label="Sign in to your account"
                >
                  Sign In
                </Button>
              </SignInButton>
            </SignedOut>
            <SignedIn>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "h-8 w-8"
                  }
                }}
              />
            </SignedIn>
          </div>
        </div>
      </div>
    </nav>
  );
}
