import { Link } from 'react-router-dom';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { DollarSign, ArrowRight } from 'lucide-react';
import {
  BarChart,
  Bar,
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

interface CostAnalyticsChartProps {
  data: ChartDataPoint[];
}

export function CostAnalyticsChart({ data }: CostAnalyticsChartProps) {
  const chartSecondary = '#3B82F6';
  const chartGrid = '#27272A';
  const chartText = '#A1A1AA';

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-medium text-[hsl(var(--text-high))]">Cost Analytics</h3>
          <p className="text-sm text-[hsl(var(--text-muted))]">Weekly spending</p>
        </div>
        <div className="h-8 w-8 rounded-[var(--radius-md)] bg-[hsl(var(--surface-elevated))] flex items-center justify-center">
          <DollarSign className="h-4 w-4 text-[hsl(var(--primary))]" />
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data}>
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
            itemStyle={{ color: chartSecondary }}
          />
          <Bar dataKey="cost" fill={chartSecondary} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <Link to="/analytics?tab=costs" className="block mt-4">
        <Button variant="ghost" className="w-full justify-center gap-2 text-xs text-muted-foreground">
          View Cost Details <ArrowRight className="h-3 w-3" />
        </Button>
      </Link>
    </Card>
  );
}
