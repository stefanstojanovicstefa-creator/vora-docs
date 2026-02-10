import { useState } from 'react';
import { Save, Sun, Moon, Monitor, Palette, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/components/ThemeProvider';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function AppearanceSettings() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const themeOptions = [
    {
      id: 'light',
      label: 'Light',
      description: 'Clean and bright interface',
      icon: Sun,
    },
    {
      id: 'dark',
      label: 'Dark',
      description: 'Premium dark mode with neon accents',
      icon: Moon,
    },
    {
      id: 'system',
      label: 'System',
      description: 'Follow your system preferences',
      icon: Monitor,
    },
  ] as const;

  const handleThemeChange = (newTheme: typeof theme) => {
    setTheme(newTheme);
    toast.success(`Theme changed to ${newTheme}`);
  };

  const handleSave = () => {
    // TODO: Save accessibility preferences to backend
    toast.success('Appearance settings saved');
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Theme Selection */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Theme
          </CardTitle>
          <CardDescription>
            Choose your preferred color theme
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.id;

              return (
                <button
                  key={option.id}
                  onClick={() => handleThemeChange(option.id)}
                  className={cn(
                    'relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all',
                    'hover:border-primary/50 hover:shadow-md',
                    isActive
                      ? 'border-primary bg-primary/5 shadow-lg'
                      : 'border-border/50 bg-background/50'
                  )}
                >
                  <div
                    className={cn(
                      'p-4 rounded-full transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="text-center">
                    <div className={cn(
                      'font-semibold mb-1',
                      isActive && 'text-primary'
                    )}>
                      {option.label}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  {isActive && (
                    <div className="absolute top-3 right-3">
                      <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Theme Preview */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-xl">Preview</CardTitle>
          <CardDescription>
            See how your theme looks in action
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 p-6 rounded-lg border border-border/50 bg-background/50">
            {/* Sample UI Elements */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Sample Card Title</h3>
                <p className="text-sm text-muted-foreground">
                  This is how text appears in the current theme
                </p>
              </div>
              <Button size="sm" className="bg-primary hover:bg-primary/90">
                Primary Button
              </Button>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm">Outline</Button>
              <Button variant="ghost" size="sm">Ghost</Button>
              <Button variant="outline" size="sm" disabled>Disabled</Button>
            </div>

            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm">
                This is a muted background section showing how content containers appear
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Accessibility
          </CardTitle>
          <CardDescription>
            Configure accessibility options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="reduced-motion" className="text-base">
                Reduce Motion
              </Label>
              <p className="text-sm text-muted-foreground">
                Minimize animations and transitions
              </p>
            </div>
            <Switch
              id="reduced-motion"
              checked={reducedMotion}
              onCheckedChange={(checked) => {
                setReducedMotion(checked);
                setHasChanges(true);
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="high-contrast" className="text-base">
                High Contrast
              </Label>
              <p className="text-sm text-muted-foreground">
                Increase contrast for better readability
              </p>
            </div>
            <Switch
              id="high-contrast"
              checked={highContrast}
              onCheckedChange={(checked) => {
                setHighContrast(checked);
                setHasChanges(true);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {hasChanges && (
        <div className="flex items-center gap-3 justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setReducedMotion(false);
              setHighContrast(false);
              setHasChanges(false);
              toast.info('Changes discarded');
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        </div>
      )}
    </div>
  );
}
