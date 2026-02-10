import { Link } from 'react-router-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { BarChart3, ArrowRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ChartDataPoint {
  name: string;
  calls: number;
  cost: number;
}

interface CallTrendsChartProps {
  data: ChartDataPoint[];
}

export function CallTrendsChart({ data }: CallTrendsChartProps) {
  const chartPrimary = '#2563EB';
  const chartGrid = '#27272A';
  const chartText = '#A1A1AA';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-medium text-[hsl(var(--text-high))]">Call Trends</h3>
          <p className="text-sm text-[hsl(var(--text-muted))]">Last 7 days</p>
        </div>
        <div className="h-8 w-8 rounded-[var(--radius-md)] bg-[hsl(var(--surface-elevated))] flex items-center justify-center">
          <BarChart3 className="h-4 w-4 text-[hsl(var(--primary))]" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="callsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={chartPrimary} stopOpacity={0.2} />
              <stop offset="95%" stopColor={chartPrimary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} opacity={0.5} />
          <XAxis
            dataKey="name"
            stroke={chartText}
            tick={{ fill: chartText, fontSize: 12 }}
            axisLine={{ stroke: chartGrid }}
          />
          <YAxis
            stroke={chartText}
            tick={{ fill: chartText, fontSize: 12 }}
            axisLine={{ stroke: chartGrid }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(240 6% 10%)',
              border: '1px solid hsl(240 4% 16%)',
              borderRadius: '8px',
            }}
            labelStyle={{ color: '#EDEDED' }}
            itemStyle={{ color: chartPrimary }}
          />
          <Area
            type="monotone"
            dataKey="calls"
            stroke={chartPrimary}
            strokeWidth={2}
            fill="url(#callsGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
      <Link to="/analytics?tab=overview" className="block mt-4">
        <Button variant="ghost" className="w-full justify-center gap-2 text-xs text-muted-foreground">
          View All Trends <ArrowRight className="h-3 w-3" />
        </Button>
      </Link>
    </Card>
  );
}
