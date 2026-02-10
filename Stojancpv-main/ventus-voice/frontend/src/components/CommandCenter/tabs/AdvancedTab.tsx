import { useCallback, useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { JsonToggle } from "../JsonToggle";
import { commandCenterAdvancedSchema } from "@/schemas/commandCenterConfig.schema";
import type { CommandCenterAdvanced } from "@/schemas/commandCenterConfig.schema";

// ============================================================================
// Data
// ============================================================================

const WEBHOOK_EVENTS = [
  "call.started",
  "call.ended",
  "call.failed",
  "transcript.ready",
  "summary.ready",
] as const;

const WEBHOOK_EVENT_LABELS: Record<(typeof WEBHOOK_EVENTS)[number], string> = {
  "call.started": "Call Started",
  "call.ended": "Call Ended",
  "call.failed": "Call Failed",
  "transcript.ready": "Transcript Ready",
  "summary.ready": "Summary Ready",
};

// ============================================================================
// Types
// ============================================================================

interface AdvancedTabProps {
  config: CommandCenterAdvanced;
  onChange: (field: string, value: unknown) => void;
}

interface WebhookEntry {
  id: string;
  url: string;
  events: Array<(typeof WEBHOOK_EVENTS)[number]>;
  enabled: boolean;
  secret?: string;
}

// ============================================================================
// Component
// ============================================================================

export function AdvancedTab({ config, onChange }: AdvancedTabProps) {
  const webhooks = useMemo(() => (config.webhooks || []) as WebhookEntry[], [config.webhooks]);

  // Webhook helpers
  const addWebhook = useCallback(() => {
    onChange("webhooks", [
      ...webhooks,
      {
        id: crypto.randomUUID(),
        url: "",
        events: [],
        enabled: true,
      },
    ]);
  }, [webhooks, onChange]);

  const updateWebhook = useCallback(
    (idx: number, field: string, value: unknown) => {
      const newArr = [...webhooks];
      newArr[idx] = { ...newArr[idx], [field]: value };
      onChange("webhooks", newArr);
    },
    [webhooks, onChange]
  );

  const removeWebhook = useCallback(
    (idx: number) => {
      onChange(
        "webhooks",
        webhooks.filter((_, i) => i !== idx)
      );
    },
    [webhooks, onChange]
  );

  const toggleWebhookEvent = useCallback(
    (idx: number, event: (typeof WEBHOOK_EVENTS)[number], checked: boolean) => {
      const webhook = webhooks[idx];
      const currentEvents = webhook.events;
      const newEvents = checked
        ? [...currentEvents, event]
        : currentEvents.filter(e => e !== event);
      updateWebhook(idx, "events", newEvents);
    },
    [webhooks, updateWebhook]
  );

  const handleJsonApply = useCallback(
    (data: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(data)) onChange(key, value);
    },
    [onChange]
  );

  return (
    <JsonToggle
      sectionSchema={commandCenterAdvancedSchema}
      sectionData={config as unknown as Record<string, unknown>}
      onJsonApply={handleJsonApply}
    >
      <Accordion type="multiple" defaultValue={["recording"]}>
        {/* Recording */}
        <AccordionItem value="recording">
          <AccordionTrigger>Recording</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label>Enable Recording</Label>
              <Switch
                checked={config.recording.enabled}
                onCheckedChange={v => onChange("recording", { ...config.recording, enabled: v })}
              />
            </div>

            {config.recording.enabled && (
              <>
                <div className="space-y-2">
                  <Label>Recording Format</Label>
                  <Select
                    value={config.recording.format}
                    onValueChange={v => onChange("recording", { ...config.recording, format: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="wav">WAV</SelectItem>
                      <SelectItem value="mp3">MP3</SelectItem>
                      <SelectItem value="ogg">OGG</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Consent Mode</Label>
                  <Select
                    value={config.recording.consentMode}
                    onValueChange={v =>
                      onChange("recording", { ...config.recording, consentMode: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="announce">Announce</SelectItem>
                      <SelectItem value="ask">Ask</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(config.recording.consentMode === "announce" ||
                  config.recording.consentMode === "ask") && (
                  <div className="space-y-2">
                    <Label>Consent Message</Label>
                    <Textarea
                      placeholder="This call will be recorded for quality assurance..."
                      value={config.recording.consentMessage || ""}
                      onChange={e =>
                        onChange("recording", {
                          ...config.recording,
                          consentMessage: e.target.value,
                        })
                      }
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Storage Retention (Days)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={365}
                    value={config.recording.storageRetentionDays || ""}
                    onChange={e =>
                      onChange("recording", {
                        ...config.recording,
                        storageRetentionDays: e.target.value
                          ? parseInt(e.target.value, 10)
                          : undefined,
                      })
                    }
                    placeholder="e.g., 30"
                  />
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Webhooks */}
        <AccordionItem value="webhooks">
          <AccordionTrigger>Webhooks</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {webhooks.map((webhook, idx) => (
              <div
                key={webhook.id}
                className="p-3 rounded-lg border border-[hsl(var(--border))] space-y-3"
              >
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <Input
                    placeholder="https://example.com/webhook"
                    value={webhook.url}
                    onChange={e => updateWebhook(idx, "url", e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {WEBHOOK_EVENTS.map(event => (
                      <div key={event} className="flex items-center gap-2">
                        <Checkbox
                          id={`webhook-${idx}-${event}`}
                          checked={webhook.events.includes(event)}
                          onCheckedChange={checked =>
                            toggleWebhookEvent(idx, event, checked as boolean)
                          }
                        />
                        <Label
                          htmlFor={`webhook-${idx}-${event}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {WEBHOOK_EVENT_LABELS[event]}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between">
                    <Label>Enabled</Label>
                    <Switch
                      checked={webhook.enabled}
                      onCheckedChange={v => updateWebhook(idx, "enabled", v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Secret</Label>
                    <Input
                      type="password"
                      placeholder="Webhook secret"
                      value={webhook.secret || ""}
                      onChange={e => updateWebhook(idx, "secret", e.target.value)}
                    />
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => removeWebhook(idx)}
                >
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete Webhook
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" className="w-full" onClick={addWebhook}>
              <Plus className="h-3 w-3 mr-1" />
              Add Webhook
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Session */}
        <AccordionItem value="session">
          <AccordionTrigger>Session</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max Duration</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.floor(config.session.maxDuration / 60)} minutes
                </span>
              </div>
              <Slider
                value={[config.session.maxDuration]}
                min={60}
                max={3600}
                step={60}
                onValueChange={([v]) => onChange("session", { ...config.session, maxDuration: v })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Reconnection Enabled</Label>
              <Switch
                checked={config.session.reconnectionEnabled}
                onCheckedChange={v =>
                  onChange("session", { ...config.session, reconnectionEnabled: v })
                }
              />
            </div>

            {config.session.reconnectionEnabled && (
              <div className="space-y-2">
                <Label>Reconnection Window (seconds)</Label>
                <Input
                  type="number"
                  min={1}
                  max={300}
                  value={config.session.reconnectionWindow || ""}
                  onChange={e =>
                    onChange("session", {
                      ...config.session,
                      reconnectionWindow: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    })
                  }
                  placeholder="e.g., 30"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Max Concurrent Calls (optional)</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={config.session.maxConcurrentCalls || ""}
                onChange={e =>
                  onChange("session", {
                    ...config.session,
                    maxConcurrentCalls: e.target.value ? parseInt(e.target.value, 10) : undefined,
                  })
                }
                placeholder="e.g., 10"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Developer */}
        <AccordionItem value="developer">
          <AccordionTrigger>Developer</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Debug Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Enables verbose logging and additional debugging information
                </p>
              </div>
              <Switch
                checked={config.developer.debugMode}
                onCheckedChange={v => onChange("developer", { ...config.developer, debugMode: v })}
              />
            </div>

            <div className="space-y-2">
              <Label>Log Level</Label>
              <Select
                value={config.developer.logLevel}
                onValueChange={v => onChange("developer", { ...config.developer, logLevel: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="debug">Debug</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label>Test Mode</Label>
                  <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs">
                    CAUTION
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Test mode prevents real calls from being charged
                </p>
              </div>
              <Switch
                checked={config.developer.testMode}
                onCheckedChange={v => onChange("developer", { ...config.developer, testMode: v })}
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </JsonToggle>
  );
}
