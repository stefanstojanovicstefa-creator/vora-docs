import { useState } from 'react';
import {
  Key,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
  Plus,
  Trash2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  maskedKey: string;
  createdAt: Date;
  lastUsed?: Date;
  status: 'active' | 'revoked';
}

export function ApiKeySettings() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    {
      id: '1',
      name: 'Production Key',
      key: 'vora_sk_prod_1234567890abcdef1234567890abcdef',
      maskedKey: 'vora_sk_prod_••••••••••••••••abcdef',
      createdAt: new Date('2025-01-01'),
      lastUsed: new Date('2025-01-04'),
      status: 'active',
    },
    {
      id: '2',
      name: 'Development Key',
      key: 'vora_sk_dev_abcdef1234567890abcdef1234567890',
      maskedKey: 'vora_sk_dev_••••••••••••••••567890',
      createdAt: new Date('2024-12-15'),
      lastUsed: new Date('2025-01-03'),
      status: 'active',
    },
  ]);

  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [copiedKeys, setCopiedKeys] = useState<Set<string>>(new Set());

  const toggleReveal = (keyId: string) => {
    setRevealedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(keyId)) {
        newSet.delete(keyId);
      } else {
        newSet.add(keyId);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (keyId: string, key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedKeys((prev) => new Set(prev).add(keyId));
      toast.success('API key copied to clipboard');

      // Reset copied state after 2 seconds
      setTimeout(() => {
        setCopiedKeys((prev) => {
          const newSet = new Set(prev);
          newSet.delete(keyId);
          return newSet;
        });
      }, 2000);
    } catch (err) {
      toast.error('Failed to copy API key');
    }
  };

  const regenerateKey = (keyId: string) => {
    // TODO: Implement regenerate logic
    toast.success('API key regenerated successfully');
  };

  const revokeKey = (keyId: string) => {
    setApiKeys((prev) =>
      prev.map((key) =>
        key.id === keyId ? { ...key, status: 'revoked' as const } : key
      )
    );
    toast.success('API key revoked');
  };

  const createNewKey = () => {
    // TODO: Implement create new key logic
    toast.success('New API key created');
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Key className="h-5 w-5" />
                API Keys
              </CardTitle>
              <CardDescription className="mt-2">
                Manage your API keys for programmatic access to Vora Voice AI
              </CardDescription>
            </div>
            <Button onClick={createNewKey} className="gap-2">
              <Plus className="h-4 w-4" />
              Create New Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-4 rounded-lg bg-info/10 border border-info/20">
            <AlertCircle className="h-5 w-5 text-info mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Keep your API keys secure</p>
              <p className="text-sm text-muted-foreground">
                Your API keys carry many privileges. Keep them secure and never share them in
                publicly accessible areas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <div className="space-y-4">
        {apiKeys.map((apiKey) => {
          const isRevealed = revealedKeys.has(apiKey.id);
          const isCopied = copiedKeys.has(apiKey.id);
          const isRevoked = apiKey.status === 'revoked';

          return (
            <Card
              key={apiKey.id}
              className={cn(
                'bg-surface/70 backdrop-blur-xl border-border/50 transition-all',
                isRevoked && 'opacity-50'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">{apiKey.name}</CardTitle>
                      <Badge
                        variant={isRevoked ? 'destructive' : 'default'}
                        className={cn(
                          !isRevoked && 'bg-success/10 text-success border-success/20'
                        )}
                      >
                        {apiKey.status}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs">
                      Created {formatDate(apiKey.createdAt)}
                      {apiKey.lastUsed && (
                        <> • Last used {formatDate(apiKey.lastUsed)}</>
                      )}
                    </CardDescription>
                  </div>
                  {!isRevoked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeKey(apiKey.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* API Key Display */}
                <div className="space-y-2">
                  <Label htmlFor={`key-${apiKey.id}`} className="text-xs font-medium">
                    API Key
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <Input
                        id={`key-${apiKey.id}`}
                        value={isRevealed ? apiKey.key : apiKey.maskedKey}
                        readOnly
                        className="font-mono text-sm pr-24 bg-background/50"
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => toggleReveal(apiKey.id)}
                                disabled={isRevoked}
                              >
                                {isRevealed ? (
                                  <EyeOff className="h-4 w-4" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isRevealed ? 'Hide' : 'Reveal'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => copyToClipboard(apiKey.id, apiKey.key)}
                                disabled={isRevoked}
                              >
                                {isCopied ? (
                                  <Check className="h-4 w-4 text-success" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isCopied ? 'Copied!' : 'Copy'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {!isRevoked && (
                  <div className="flex items-center gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateKey(apiKey.id)}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Regenerate
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Usage Guidelines */}
      <Card className="bg-surface/70 backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Usage Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
            <p>
              Include your API key in the <code className="text-xs bg-muted px-1.5 py-0.5 rounded">Authorization</code> header
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
            <p>
              Regenerate keys periodically and after any potential security incidents
            </p>
          </div>
          <div className="flex items-start gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2" />
            <p>
              Revoke unused keys to minimize security risks
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
