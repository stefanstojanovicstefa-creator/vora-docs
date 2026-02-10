import { useState, useRef, useCallback, useMemo } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, Upload, FileText, BookTemplate } from "lucide-react";
import { PromptLinter } from "../PromptLinter";
import { JsonToggle } from "../JsonToggle";
import { PROMPT_TEMPLATES, TEMPLATE_CATEGORIES } from "../promptTemplates";
import { commandCenterBrainSchema } from "@/schemas/commandCenterConfig.schema";
import type { CommandCenterBrain } from "@/schemas/commandCenterConfig.schema";

// ============================================================================
// Provider & Model Data
// ============================================================================

const PROVIDERS: Record<string, string[]> = {
  Gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash"],
  OpenAI: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  Anthropic: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001"],
  Groq: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
  Custom: [],
};

const DEFAULT_VARIABLES = [
  "customer_name",
  "customer_email",
  "company_name",
  "appointment_date",
  "sentiment",
];

// ============================================================================
// Types
// ============================================================================

interface BrainTabProps {
  config: CommandCenterBrain;
  onChange: (field: string, value: unknown) => void;
}

// ============================================================================
// Helpers
// ============================================================================

function SectionBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs bg-[hsl(var(--surface-elevated))] text-[hsl(var(--text-muted))] px-2 py-0.5 rounded-full ml-auto">
      {children}
    </span>
  );
}

// ============================================================================
// Component
// ============================================================================

export function BrainTab({ config, onChange }: BrainTabProps) {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);

  const providerName = useMemo(() => {
    return (
      Object.keys(PROVIDERS).find(p => p.toLowerCase() === config.provider?.toLowerCase()) ||
      Object.keys(PROVIDERS)[0]
    );
  }, [config.provider]);

  const models = PROVIDERS[providerName] || [];

  const estimatedTokens = useMemo(
    () => Math.ceil((config.systemPrompt?.length || 0) / 4),
    [config.systemPrompt]
  );
  const estimatedCost = useMemo(
    () => ((estimatedTokens / 1000) * 0.01).toFixed(4),
    [estimatedTokens]
  );

  // Context file handling
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextFiles = useMemo(() => config.contextFiles || [], [config.contextFiles]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      const fileNames = Array.from(e.target.files).map(f => f.name);
      onChange("contextFiles", [...contextFiles, ...fileNames]);
      e.target.value = "";
    },
    [contextFiles, onChange]
  );

  const removeFile = useCallback(
    (name: string) => {
      onChange(
        "contextFiles",
        contextFiles.filter(f => f !== name)
      );
    },
    [contextFiles, onChange]
  );

  // Variable autocomplete
  const handlePromptKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const pos = el.selectionStart;
    const text = el.value;

    if (text.substring(pos - 2, pos) === "{{") {
      setShowAutocomplete(true);
    }
  }, []);

  const insertVariable = useCallback(
    (varName: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = el.selectionStart;
      const text = el.value;
      // Check if {{ is already there
      const before = text.substring(0, pos);
      const after = text.substring(pos);
      const hasOpenBraces = before.endsWith("{{");
      const insertion = hasOpenBraces ? `${varName}}}` : `{{${varName}}}`;
      const newText = before + insertion + after;
      onChange("systemPrompt", newText);
      setShowAutocomplete(false);
      setTimeout(() => {
        const newPos = pos + insertion.length;
        el.focus();
        el.setSelectionRange(newPos, newPos);
      }, 0);
    },
    [onChange]
  );

  const insertTemplate = useCallback(
    (content: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = el.selectionStart;
      const text = el.value;
      const newText = text.substring(0, pos) + content + text.substring(pos);
      onChange("systemPrompt", newText);
      setTemplateDialogOpen(false);
    },
    [onChange]
  );

  const handleJsonApply = useCallback(
    (data: Record<string, unknown>) => {
      // Apply all fields from JSON
      for (const [key, value] of Object.entries(data)) {
        onChange(key, value);
      }
    },
    [onChange]
  );

  return (
    <JsonToggle
      sectionSchema={commandCenterBrainSchema}
      sectionData={config as unknown as Record<string, unknown>}
      onJsonApply={handleJsonApply}
    >
      <Accordion type="multiple" defaultValue={["provider", "intelligence", "system-prompt"]}>
        {/* Provider Section */}
        <AccordionItem value="provider">
          <AccordionTrigger>Provider<SectionBadge>{providerName}{config.model ? ` / ${config.model}` : ""}</SectionBadge></AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select
                value={providerName}
                onValueChange={v => {
                  onChange("provider", v.toLowerCase());
                  const firstModel = PROVIDERS[v]?.[0];
                  if (firstModel) onChange("model", firstModel);
                }}
              >
                <SelectTrigger className="w-full text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(PROVIDERS).map(p => (
                    <SelectItem key={p} value={p} className="text-sm">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={config.model || ""} onValueChange={v => onChange("model", v)}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map(m => (
                    <SelectItem key={m} value={m} className="text-sm">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {providerName === "Custom" && (
              <div className="space-y-2">
                <Label>Custom Endpoint</Label>
                <Input
                  value={config.customEndpoint || ""}
                  onChange={e => onChange("customEndpoint", e.target.value)}
                  placeholder="https://api.example.com/v1"
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Intelligence Section */}
        <AccordionItem value="intelligence">
          <AccordionTrigger>Intelligence<SectionBadge>temp {config.temperature ?? 0.7}</SectionBadge></AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Temperature:{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {config.temperature ?? 0.7}
                  </span>
                </Label>
                <Input
                  type="number"
                  className="w-20 h-7 text-xs"
                  value={config.temperature ?? 0.7}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={e => onChange("temperature", parseFloat(e.target.value) || 0)}
                />
              </div>
              <Slider
                value={[config.temperature ?? 0.7]}
                min={0}
                max={2}
                step={0.1}
                onValueChange={([v]) => onChange("temperature", v)}
              />
            </div>

            <div className="space-y-2">
              <Label>
                Max Tokens:{" "}
                <span className="font-mono text-xs text-muted-foreground">
                  {config.maxTokens ?? 1024}
                </span>
              </Label>
              <Input
                type="number"
                value={config.maxTokens ?? 1024}
                min={1}
                onChange={e => onChange("maxTokens", parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Top P:{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {config.topP ?? 0.9}
                  </span>
                </Label>
                <Input
                  type="number"
                  className="w-20 h-7 text-xs"
                  value={config.topP ?? 0.9}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={e => onChange("topP", parseFloat(e.target.value) || 0)}
                />
              </div>
              <Slider
                value={[config.topP ?? 0.9]}
                min={0}
                max={1}
                step={0.05}
                onValueChange={([v]) => onChange("topP", v)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>
                  Frequency Penalty:{" "}
                  <span className="font-mono text-xs text-muted-foreground">
                    {config.frequencyPenalty ?? 0}
                  </span>
                </Label>
                <Input
                  type="number"
                  className="w-20 h-7 text-xs"
                  value={config.frequencyPenalty ?? 0}
                  min={-2}
                  max={2}
                  step={0.1}
                  onChange={e => onChange("frequencyPenalty", parseFloat(e.target.value) || 0)}
                />
              </div>
              <Slider
                value={[config.frequencyPenalty ?? 0]}
                min={-2}
                max={2}
                step={0.1}
                onValueChange={([v]) => onChange("frequencyPenalty", v)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* First Contact Section */}
        <AccordionItem value="first-contact">
          <AccordionTrigger>First Contact</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label>
                {config.firstSpeaker === "agent" ? "Agent speaks first" : "User speaks first"}
              </Label>
              <Switch
                checked={config.firstSpeaker === "agent"}
                onCheckedChange={checked => onChange("firstSpeaker", checked ? "agent" : "user")}
              />
            </div>
            {config.firstSpeaker === "agent" && (
              <div className="space-y-2">
                <Label>First Message</Label>
                <Textarea
                  value={config.firstMessage || ""}
                  onChange={e => onChange("firstMessage", e.target.value)}
                  placeholder="Hi there! How can I help you today?"
                  rows={2}
                  className="max-h-[4.5rem] resize-none text-sm"
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* System Prompt Section */}
        <AccordionItem value="system-prompt">
          <AccordionTrigger>System Prompt<SectionBadge>~{estimatedTokens} tokens</SectionBadge></AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between mb-1">
              <Label>System Prompt</Label>
              <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
                    <BookTemplate className="h-3 w-3" />
                    Templates
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[70vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Prompt Templates</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {TEMPLATE_CATEGORIES.map(cat => (
                      <div key={cat}>
                        <h4 className="text-sm font-semibold mb-2">{cat}</h4>
                        <div className="space-y-2">
                          {PROMPT_TEMPLATES.filter(t => t.category === cat).map(t => (
                            <button
                              key={t.id}
                              className="w-full text-left p-3 rounded border hover:border-[hsl(var(--primary)/0.5)] hover:bg-[hsl(var(--primary)/0.05)] hover-lift transition-colors"
                              onClick={() => insertTemplate(t.content)}
                            >
                              <p className="text-sm font-medium">{t.name}</p>
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {t.content}
                              </p>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={config.systemPrompt || ""}
                onChange={e => onChange("systemPrompt", e.target.value)}
                onKeyUp={handlePromptKeyDown}
                className="min-h-[200px] max-h-[400px] resize-y font-mono text-sm bg-[hsl(var(--void))] focus:shadow-[0_0_0_1px_hsl(var(--primary)),0_0_10px_rgba(153,205,255,0.2)]"
                placeholder="You are a helpful voice assistant..."
              />

              {/* Variable Autocomplete */}
              {showAutocomplete && (
                <Popover open={showAutocomplete} onOpenChange={setShowAutocomplete}>
                  <PopoverTrigger asChild>
                    <span className="absolute bottom-2 left-2" />
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-1" align="start">
                    {DEFAULT_VARIABLES.map(v => (
                      <button
                        key={v}
                        className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted"
                        onClick={() => insertVariable(v)}
                      >
                        <code>{`{{${v}}}`}</code>
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Token Counter */}
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--text-muted))]">
              <span className="font-mono">
                Estimated: {estimatedTokens} tokens (~${estimatedCost})
              </span>
            </div>

            {/* Prompt Linter */}
            <PromptLinter systemPrompt={config.systemPrompt || ""} />
          </AccordionContent>
        </AccordionItem>

        {/* Context Files Section */}
        <AccordionItem value="context-files">
          <AccordionTrigger>Context Files<SectionBadge>{contextFiles.length} file{contextFiles.length !== 1 ? "s" : ""}</SectionBadge></AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".txt,.md,.pdf,.json"
              multiple
              onChange={handleFileSelect}
            />
            <button
              className="w-full border-2 border-dashed rounded-lg p-6 text-center text-sm text-[hsl(var(--text-muted))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.05)] transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Drag files here or click to browse
              <br />
              <span className="text-xs">.txt, .md, .pdf, .json</span>
            </button>

            {contextFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {contextFiles.map(name => (
                  <Badge key={name} variant="secondary" className="gap-1.5 pr-1">
                    <FileText className="h-3 w-3" />
                    {name}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 hover:bg-transparent"
                      onClick={() => removeFile(name)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </JsonToggle>
  );
}
