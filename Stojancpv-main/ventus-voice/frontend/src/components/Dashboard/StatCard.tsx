// D:\VoraSve\Stojancpv\Vora\ventus-voice\novi front end\src\components\Dashboard\StatCard.tsx

import { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
  };
  iconColor?: string;
  href?: string;
}

/**
 * StatCard Component - Delightfully Enhanced
 *
 * Clean stat card with delightful micro-interactions:
 * - Animated number counters
 * - Hover lift and glow effects
 * - Breathing animation on icon
 * - Smooth entrance animations
 */
export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  iconColor = 'text-[hsl(var(--primary))]',
  href,
}: StatCardProps) {
  const isPositiveTrend = trend && trend.value > 0;
  const trendColor = isPositiveTrend
    ? 'text-[hsl(var(--success))]'
    : 'text-[hsl(var(--error))]';

  // Animated counter for numeric values
  const count = useMotionValue(0);
  const numericValue = typeof value === 'number' ? value : parseFloat(value.replace(/[^0-9.]/g, ''));
  const isNumeric = !isNaN(numericValue);
  const displayValue = useTransform(count, (latest) => {
    if (!isNumeric) return value;
    const formatted = Math.round(latest).toLocaleString();
    // Preserve non-numeric characters (like $ or %)
    if (typeof value === 'string') {
      return value.replace(/[\d,]+/, formatted);
    }
    return formatted;
  });

  useEffect(() => {
    if (isNumeric) {
      const controls = animate(count, numericValue, {
        duration: 1,
        ease: "easeOut"
      });
      return controls.stop;
    }
  }, [numericValue, isNumeric]);

  const Wrapper = href ? Link : 'div';
  const wrapperProps = href ? { to: href } : {};

  return (
    <Wrapper {...wrapperProps as any} className="block">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        whileHover={{ y: -4 }}
      >
        <Card
          className="p-6 relative overflow-hidden group cursor-pointer"
          interactive
        >
        {/* Hover glow effect */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-[#99CDFF]/0 to-[#4A9EFF]/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          style={{
            boxShadow: '0 0 20px rgba(153, 205, 255, 0)',
          }}
          whileHover={{
            boxShadow: '0 0 20px rgba(153, 205, 255, 0.15)',
          }}
        />

        <div className="flex items-center justify-between relative z-10">
          <span className="text-sm font-medium text-[hsl(var(--text-muted))]">
            {title}
          </span>
          <motion.div
            className="h-8 w-8 rounded-[var(--radius-md)] bg-[hsl(var(--surface-elevated))] flex items-center justify-center"
            animate={{
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <motion.div
              whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <Icon className={cn('h-4 w-4', iconColor)} />
            </motion.div>
          </motion.div>
        </div>

        <div className="mt-3 relative z-10">
          <motion.p
            className="text-2xl font-semibold text-[hsl(var(--text-high))] tabular-nums"
          >
            {isNumeric ? displayValue : value}
          </motion.p>
          {trend && (
            <motion.div
              className="mt-1 flex items-center gap-1.5 text-xs"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <motion.span
                className={cn('font-medium', trendColor)}
                animate={{
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              >
                {isPositiveTrend ? '+' : ''}{trend.value}%
              </motion.span>
              <span className="text-[hsl(var(--text-muted))]">
                {trend.label}
              </span>
            </motion.div>
          )}
        </div>
        </Card>
      </motion.div>
    </Wrapper>
  );
}
