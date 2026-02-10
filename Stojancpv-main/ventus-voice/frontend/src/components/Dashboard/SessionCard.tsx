import { ArrowRight, Bot, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDateTime, formatDuration } from '@/lib/utils';
import { RecentSession } from '@/services/dashboard.service';

interface SessionCardProps {
  session: RecentSession;
  onClick?: () => void;
}

export function SessionCard({ session, onClick }: SessionCardProps) {
  const getStatusColor = (status: RecentSession['status']) => {
    switch (status) {
      case 'active':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'completed':
        return 'bg-success/20 text-success border-success/30';
      case 'failed':
        return 'bg-error/20 text-error border-error/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'flex items-center justify-between p-4 rounded-lg',
        'bg-background/40 border border-border/30',
        'hover:bg-background/60 hover:border-primary/20 transition-all duration-200',
        'group cursor-pointer'
      )}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground truncate">{session.agentName}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(session.duration)}</span>
            <span>•</span>
            <span>{formatDateTime(session.timestamp)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={cn('capitalize', getStatusColor(session.status))}>
          {session.status}
        </Badge>
        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
}
