import { useState } from 'react';
import {
  Settings,
  Key,
  Palette,
  Bell,
  Shield,
  User,
  Database,
  Zap,
  CreditCard,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GeneralSettings } from '@/components/Settings/GeneralSettings';
import { ApiKeySettings } from '@/components/Settings/ApiKeySettings';
import { AppearanceSettings } from '@/components/Settings/AppearanceSettings';
import { NotificationSettings } from '@/components/Settings/NotificationSettings';
import { SecuritySettings } from '@/components/Settings/SecuritySettings';
import { ProfileSettings } from '@/components/Settings/ProfileSettings';
import { BillingSettings } from '@/components/Settings/BillingSettings';
import { useViewMode } from '@/hooks/useViewMode';

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  godModeOnly?: boolean; // Hide in Mom Mode
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('general');
  const { isMomMode } = useViewMode();

  const settingsTabs: SettingsTab[] = [
    {
      id: 'general',
      label: 'General',
      icon: <Settings className="h-4 w-4" />,
      component: <GeneralSettings />,
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: <User className="h-4 w-4" />,
      component: <ProfileSettings />,
    },
    {
      id: 'billing',
      label: 'Billing',
      icon: <CreditCard className="h-4 w-4" />,
      component: <BillingSettings />,
    },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: <Palette className="h-4 w-4" />,
      component: <AppearanceSettings />,
    },
    {
      id: 'api-keys',
      label: 'API Keys',
      icon: <Key className="h-4 w-4" />,
      component: <ApiKeySettings />,
      godModeOnly: true, // Technical API management
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: <Bell className="h-4 w-4" />,
      component: <NotificationSettings />,
    },
    {
      id: 'security',
      label: 'Security',
      icon: <Shield className="h-4 w-4" />,
      component: <SecuritySettings />,
    },
  ];

  // Filter tabs based on view mode
  const visibleTabs = settingsTabs.filter(tab => {
    if (tab.godModeOnly && isMomMode) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      {/* Settings Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Tab Navigation */}
        <TabsList className="flex flex-wrap justify-start gap-2 h-auto p-2 bg-surface/70 backdrop-blur-xl border border-border/50 rounded-xl">
          {visibleTabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="flex items-center gap-2 px-4 py-3 rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Content */}
        {visibleTabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="space-y-6">
            {tab.component}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
