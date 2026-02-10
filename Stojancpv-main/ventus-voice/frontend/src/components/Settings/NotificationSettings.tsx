import { useState } from 'react';
import { Save, Bell, Mail, MessageSquare, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

interface NotificationPreferences {
  emailNotifications: {
    agentDeployment: boolean;
    systemAlerts: boolean;
    usageReports: boolean;
    marketingUpdates: boolean;
  };
  pushNotifications: {
    agentErrors: boolean;
    costAlerts: boolean;
    securityAlerts: boolean;
  };
  inAppNotifications: {
    mentions: boolean;
    comments: boolean;
    updates: boolean;
  };
}

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    emailNotifications: {
      agentDeployment: true,
      systemAlerts: true,
      usageReports: false,
      marketingUpdates: false,
    },
    pushNotifications: {
      agentErrors: true,
      costAlerts: true,
      securityAlerts: true,
    },
    inAppNotifications: {
      mentions: true,
      comments: true,
      updates: false,
    },
  });

  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (
    category: keyof NotificationPreferences,
    key: string,
    value: boolean
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [category]: {
        ...prev[category],
        [key]: value,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    // TODO: Save notification preferences
    toast.success('Notification preferences saved');
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Email Notifications */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Notifications
          </CardTitle>
          <CardDescription>
            Choose what updates you want to receive via email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-deployment" className="text-base">
                Agent Deployments
              </Label>
              <p className="text-sm text-muted-foreground">
                Notifications when agents are deployed or updated
              </p>
            </div>
            <Switch
              id="email-deployment"
              checked={preferences.emailNotifications.agentDeployment}
              onCheckedChange={(checked) =>
                handleToggle('emailNotifications', 'agentDeployment', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-alerts" className="text-base">
                System Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                Important system updates and maintenance notifications
              </p>
            </div>
            <Switch
              id="email-alerts"
              checked={preferences.emailNotifications.systemAlerts}
              onCheckedChange={(checked) =>
                handleToggle('emailNotifications', 'systemAlerts', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-reports" className="text-base">
                Usage Reports
              </Label>
              <p className="text-sm text-muted-foreground">
                Weekly summaries of your agent usage and analytics
              </p>
            </div>
            <Switch
              id="email-reports"
              checked={preferences.emailNotifications.usageReports}
              onCheckedChange={(checked) =>
                handleToggle('emailNotifications', 'usageReports', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-marketing" className="text-base">
                Marketing Updates
              </Label>
              <p className="text-sm text-muted-foreground">
                Product news, tips, and promotional content
              </p>
            </div>
            <Switch
              id="email-marketing"
              checked={preferences.emailNotifications.marketingUpdates}
              onCheckedChange={(checked) =>
                handleToggle('emailNotifications', 'marketingUpdates', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Real-time alerts for critical events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-errors" className="text-base">
                Agent Errors
              </Label>
              <p className="text-sm text-muted-foreground">
                Immediate alerts when agents encounter errors
              </p>
            </div>
            <Switch
              id="push-errors"
              checked={preferences.pushNotifications.agentErrors}
              onCheckedChange={(checked) =>
                handleToggle('pushNotifications', 'agentErrors', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-cost" className="text-base">
                Cost Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                Warnings when usage exceeds budget thresholds
              </p>
            </div>
            <Switch
              id="push-cost"
              checked={preferences.pushNotifications.costAlerts}
              onCheckedChange={(checked) =>
                handleToggle('pushNotifications', 'costAlerts', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-security" className="text-base">
                Security Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                Critical security events and suspicious activity
              </p>
            </div>
            <Switch
              id="push-security"
              checked={preferences.pushNotifications.securityAlerts}
              onCheckedChange={(checked) =>
                handleToggle('pushNotifications', 'securityAlerts', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* In-App Notifications */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            In-App Notifications
          </CardTitle>
          <CardDescription>
            Notifications within the Vora dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inapp-mentions" className="text-base">
                Mentions
              </Label>
              <p className="text-sm text-muted-foreground">
                When someone mentions you in comments or notes
              </p>
            </div>
            <Switch
              id="inapp-mentions"
              checked={preferences.inAppNotifications.mentions}
              onCheckedChange={(checked) =>
                handleToggle('inAppNotifications', 'mentions', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inapp-comments" className="text-base">
                Comments
              </Label>
              <p className="text-sm text-muted-foreground">
                New comments on agents you're watching
              </p>
            </div>
            <Switch
              id="inapp-comments"
              checked={preferences.inAppNotifications.comments}
              onCheckedChange={(checked) =>
                handleToggle('inAppNotifications', 'comments', checked)
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inapp-updates" className="text-base">
                Product Updates
              </Label>
              <p className="text-sm text-muted-foreground">
                New features and platform improvements
              </p>
            </div>
            <Switch
              id="inapp-updates"
              checked={preferences.inAppNotifications.updates}
              onCheckedChange={(checked) =>
                handleToggle('inAppNotifications', 'updates', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center gap-3 justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setPreferences({
              emailNotifications: {
                agentDeployment: true,
                systemAlerts: true,
                usageReports: false,
                marketingUpdates: false,
              },
              pushNotifications: {
                agentErrors: true,
                costAlerts: true,
                securityAlerts: true,
              },
              inAppNotifications: {
                mentions: true,
                comments: true,
                updates: false,
              },
            });
            setHasChanges(false);
            toast.info('Changes discarded');
          }}
          disabled={!hasChanges}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <Save className="h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
