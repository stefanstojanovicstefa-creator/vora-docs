/**
 * Page Layout Template Component
 *
 * Features:
 * - The Void (#050505) background
 * - Content areas with proper spacing
 * - Responsive grid system
 * - RTL layout support
 * - Integrates Sidebar and TopBar
 * - Interactive Tutorial System (P0J-01)
 */

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { TutorialOverlay } from '@/components/tutorial';

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  noPadding?: boolean;
  sidebarCollapsed?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-3xl',
  md: 'max-w-5xl',
  lg: 'max-w-7xl',
  xl: 'max-w-[1440px]',
  '2xl': 'max-w-[1920px]',
  full: 'max-w-full',
};

export function PageLayout({
  children,
  className,
  maxWidth = 'xl',
  noPadding = false,
  sidebarCollapsed = false,
}: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-[hsl(var(--void))]">
      {/* Sidebar Navigation */}
      <Sidebar defaultCollapsed={sidebarCollapsed} />

      {/* Main Content Area */}
      <div
        className={cn(
          "transition-all duration-300",
          // Adjust margin based on sidebar state
          sidebarCollapsed ? "lg:ms-20" : "lg:ms-64"
        )}
      >
        {/* Top Bar */}
        <TopBar sidebarCollapsed={sidebarCollapsed} />

        {/* Page Content */}
        <main
          className={cn(
            "pt-16", // Account for fixed top bar
            !noPadding && "px-4 sm:px-6 lg:px-8 pb-8",
            className
          )}
          role="main"
        >
          <div
            className={cn(
              "mx-auto",
              maxWidthClasses[maxWidth]
            )}
          >
            {children}
          </div>
        </main>
      </div>

      {/* Tutorial Overlay - shows for new users (P0J-01) */}
      <TutorialOverlay />
    </div>
  );
}

/**
 * Page Header Component
 * For consistent page titles and descriptions
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        "pb-6 border-b border-[hsl(var(--border))]",
        className
      )}
    >
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-[hsl(var(--text-high))]">
          {title}
        </h1>
        {description && (
          <p className="text-base text-[hsl(var(--text-muted))] max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * Page Section Component
 * For grouping related content
 */
interface PageSectionProps {
  children: ReactNode;
  title?: string;
  description?: string;
  className?: string;
}

export function PageSection({
  children,
  title,
  description,
  className,
}: PageSectionProps) {
  return (
    <section className={cn("space-y-6", className)}>
      {(title || description) && (
        <div className="space-y-2">
          {title && (
            <h2 className="text-xl font-semibold tracking-tight text-[hsl(var(--text-high))]">
              {title}
            </h2>
          )}
          {description && (
            <p className="text-sm text-[hsl(var(--text-muted))] leading-relaxed">
              {description}
            </p>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Grid Layout Component
 * Responsive grid system following Vora spacing scale
 */
interface GridLayoutProps {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  className?: string;
}

const colsClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
};

const gapClasses = {
  sm: 'gap-4',
  md: 'gap-6',
  lg: 'gap-8',
};

export function GridLayout({
  children,
  cols = 3,
  gap = 'md',
  className,
}: GridLayoutProps) {
  return (
    <div
      className={cn(
        "grid",
        colsClasses[cols],
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Empty State Component
 * For displaying when no content is available
 */
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-4 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-[hsl(var(--text-muted))]">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-[hsl(var(--text-high))] mb-2">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-[hsl(var(--text-muted))] max-w-md mb-6 leading-relaxed">
          {description}
        </p>
      )}
      {action && action}
    </div>
  );
}
