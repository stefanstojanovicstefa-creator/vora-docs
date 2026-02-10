import { useState, useCallback, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, ArrowUp, ArrowDown, X, Zap, Check } from "lucide-react";
import { JsonToggle } from "../JsonToggle";
import { commandCenterEarsSchema } from "@/schemas/commandCenterConfig.schema";
import type { CommandCenterEars } from "@/schemas/commandCenterConfig.schema";
import { cn } from "@/lib/utils";

// ============================================================================
// Data
// ============================================================================

// STT providers and models from backend registry (stt.registry.ts)
const STT_PROVIDERS: Record<string, { models: string[]; description: string; streaming: boolean }> =
  {
    Deepgram: {
      models: ["nova-2", "nova-2-general", "nova-2-meeting", "nova-2-phonecall"],
      description: "Fast and accurate speech recognition",
      streaming: true,
    },
    AssemblyAI: {
      models: ["best", "nano"],
      description: "AI-powered speech recognition",
      streaming: true,
    },
    Google: {
      models: ["latest_long", "latest_short", "chirp"],
      description: "Google Cloud Speech-to-Text",
      streaming: true,
    },
    Azure: {
      models: ["speech-to-text-v3"],
      description: "Microsoft Azure Speech Services",
      streaming: true,
    },
    Whisper: {
      models: ["whisper-1"],
      description: "OpenAI Whisper transcription",
      streaming: false,
    },
  };

const LANGUAGES: { code: string; name: string }[] = [
  { code: "en-US", name: "English (United States)" },
  { code: "en-GB", name: "English (United Kingdom)" },
  { code: "en-AU", name: "English (Australia)" },
  { code: "en-IN", name: "English (India)" },
  { code: "es-ES", name: "Spanish (Spain)" },
  { code: "es-MX", name: "Spanish (Mexico)" },
  { code: "fr-FR", name: "French (France)" },
  { code: "de-DE", name: "German (Germany)" },
  { code: "pt-BR", name: "Portuguese (Brazil)" },
  { code: "it-IT", name: "Italian (Italy)" },
  { code: "nl-NL", name: "Dutch (Netherlands)" },
  { code: "ja-JP", name: "Japanese (Japan)" },
  { code: "ko-KR", name: "Korean (South Korea)" },
  { code: "zh-CN", name: "Chinese (Simplified)" },
  { code: "zh-TW", name: "Chinese (Traditional)" },
  { code: "hi-IN", name: "Hindi (India)" },
  { code: "ar-SA", name: "Arabic (Saudi Arabia)" },
  { code: "tr-TR", name: "Turkish (Turkey)" },
  { code: "ru-RU", name: "Russian (Russia)" },
  { code: "pl-PL", name: "Polish (Poland)" },
];

const ACCENT_OPTIONS = ["American", "British", "Indian", "Australian", "South African"];

const VOCAB_CATEGORIES = ["product", "person", "company", "technical", "other"] as const;

// ============================================================================
// Types
// ============================================================================

interface EarsTabProps {
  config: CommandCenterEars;
  onChange: (field: string, value: unknown) => void;
}

interface VocabEntry {
  term: string;
  pronunciation?: string;
  boost?: number;
  category?: (typeof VOCAB_CATEGORIES)[number];
}

// ============================================================================
// Sub-components
// ============================================================================

/** Single provider card: shows name, description, streaming badge. Highlighted when selected. */
function ProviderCard({
  name,
  description,
  streaming,
  isSelected,
  onClick,
}: {
  name: string;
  description: string;
  streaming: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full text-left rounded-lg border p-3 transition-all",
        "hover:border-primary/50 hover:bg-accent/50",
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
          : "border-border bg-background"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {isSelected && (
              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                <Check className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            )}
            <span className="text-sm font-medium">{name}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{description}</p>
        </div>
        {streaming && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <Zap className="h-2.5 w-2.5" />
            Streaming
          </span>
        )}
      </div>
    </button>
  );
}

/** A single vocabulary entry card (stacked layout, no pixel grid). */
function VocabCard({
  entry,
  index,
  onUpdate,
  onRemove,
}: {
  entry: VocabEntry;
  index: number;
  onUpdate: (idx: number, field: string, value: unknown) => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <Input
            className="h-8 text-sm"
            placeholder="Term (e.g. Vora)"
            value={entry.term}
            onChange={e => onUpdate(index, "term", e.target.value)}
          />
          <Input
            className="h-8 text-sm"
            placeholder="Pronunciation hint (optional)"
            value={entry.pronunciation || ""}
            onChange={e => onUpdate(index, "pronunciation", e.target.value)}
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(index)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-[140px]">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Boost</Label>
          <Slider
            value={[entry.boost || 5]}
            min={1}
            max={10}
            step={1}
            onValueChange={([v]) => onUpdate(index, "boost", v)}
            className="flex-1"
          />
          <span className="text-xs font-mono w-5 text-right tabular-nums">{entry.boost || 5}</span>
        </div>
        <div className="flex items-center gap-2 min-w-[120px]">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Category</Label>
          <Select
            value={entry.category || "other"}
            onValueChange={v => onUpdate(index, "category", v)}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOCAB_CATEGORIES.map(c => (
                <SelectItem key={c} value={c} className="capitalize text-xs">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

/** A single fallback transcriber row (vertical list item). */
function FallbackItem({
  fb,
  index,
  total,
  onMove,
  onRemove,
  onUpdate,
}: {
  fb: { provider: string; model?: string };
  index: number;
  total: number;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: string, value: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex flex-col gap-0.5">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
      </div>
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-16 shrink-0">Provider</Label>
          <Select value={fb.provider} onValueChange={v => onUpdate(index, "provider", v)}>
            <SelectTrigger className="h-8 flex-1">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(STT_PROVIDERS).map(p => (
                <SelectItem key={p} value={p.toLowerCase()}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground w-16 shrink-0">Model</Label>
          <Input
            className="h-8 flex-1"
            placeholder="Model name"
            value={fb.model || ""}
            onChange={e => onUpdate(index, "model", e.target.value)}
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(index)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function EarsTab({ config, onChange }: EarsTabProps) {
  const [langSearch, setLangSearch] = useState("");

  const providerName =
    Object.keys(STT_PROVIDERS).find(p => p.toLowerCase() === config.provider?.toLowerCase()) ||
    Object.keys(STT_PROVIDERS)[0];

  const providerInfo = STT_PROVIDERS[providerName];
  const models = providerInfo?.models || [];
  const vocab = useMemo(
    () => (config.customVocabulary || []) as VocabEntry[],
    [config.customVocabulary]
  );
  const fallbacks = useMemo(() => config.fallbackTranscribers || [], [config.fallbackTranscribers]);

  const filteredLangs = langSearch
    ? LANGUAGES.filter(
        l =>
          l.code.toLowerCase().includes(langSearch.toLowerCase()) ||
          l.name.toLowerCase().includes(langSearch.toLowerCase())
      )
    : LANGUAGES;

  // Vocabulary helpers
  const addVocabEntry = useCallback(() => {
    onChange("customVocabulary", [...vocab, { term: "", boost: 5, category: "other" }]);
  }, [vocab, onChange]);

  const updateVocabEntry = useCallback(
    (idx: number, field: string, value: unknown) => {
      const newArr = [...vocab];
      newArr[idx] = { ...newArr[idx], [field]: value };
      onChange("customVocabulary", newArr);
    },
    [vocab, onChange]
  );

  const removeVocabEntry = useCallback(
    (idx: number) => {
      onChange(
        "customVocabulary",
        vocab.filter((_, i) => i !== idx)
      );
    },
    [vocab, onChange]
  );

  // Fallback helpers
  const addFallback = useCallback(() => {
    if (fallbacks.length >= 2) return;
    onChange("fallbackTranscribers", [...fallbacks, { provider: "", model: "" }]);
  }, [fallbacks, onChange]);

  const removeFallback = useCallback(
    (idx: number) => {
      onChange(
        "fallbackTranscribers",
        fallbacks.filter((_, i) => i !== idx)
      );
    },
    [fallbacks, onChange]
  );

  const moveFallback = useCallback(
    (idx: number, dir: -1 | 1) => {
      const newArr = [...fallbacks];
      const target = idx + dir;
      if (target < 0 || target >= newArr.length) return;
      [newArr[idx], newArr[target]] = [newArr[target], newArr[idx]];
      onChange("fallbackTranscribers", newArr);
    },
    [fallbacks, onChange]
  );

  const updateFallback = useCallback(
    (idx: number, field: string, value: string) => {
      const newArr = [...fallbacks];
      newArr[idx] = { ...newArr[idx], [field]: value };
      onChange("fallbackTranscribers", newArr);
    },
    [fallbacks, onChange]
  );

  const handleJsonApply = useCallback(
    (data: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(data)) onChange(key, value);
    },
    [onChange]
  );

  // Additional languages as tags
  const additionalLangs = useMemo(
    () => config.additionalLanguages || [],
    [config.additionalLanguages]
  );

  const addLang = useCallback(
    (lang: string) => {
      if (additionalLangs.includes(lang)) return;
      onChange("additionalLanguages", [...additionalLangs, lang]);
    },
    [additionalLangs, onChange]
  );

  const removeLang = useCallback(
    (lang: string) => {
      onChange(
        "additionalLanguages",
        additionalLangs.filter(l => l !== lang)
      );
    },
    [additionalLangs, onChange]
  );

  /** Helper to look up full language name from code. */
  const getLangName = useCallback((code: string) => {
    const found = LANGUAGES.find(l => l.code === code);
    return found ? found.name : code;
  }, []);

  return (
    <JsonToggle
      sectionSchema={commandCenterEarsSchema}
      sectionData={config as unknown as Record<string, unknown>}
      onJsonApply={handleJsonApply}
    >
      <Accordion type="multiple" defaultValue={["provider", "language", "recognition"]}>
        {/* ================================================================ */}
        {/* Provider Selection - Card Layout                                 */}
        {/* ================================================================ */}
        <AccordionItem value="provider">
          <AccordionTrigger>Provider</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {/* Provider cards */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Select an STT provider</Label>
              <div className="grid gap-2">
                {Object.entries(STT_PROVIDERS).map(([name, { description, streaming }]) => {
                  const isSelected = name.toLowerCase() === providerName.toLowerCase();
                  return (
                    <div key={name}>
                      <ProviderCard
                        name={name}
                        description={description}
                        streaming={streaming}
                        isSelected={isSelected}
                        onClick={() => {
                          onChange("provider", name.toLowerCase());
                          const firstModel = STT_PROVIDERS[name]?.models?.[0];
                          if (firstModel) onChange("model", firstModel);
                        }}
                      />

                      {/* Expanded model selector inside selected card */}
                      {isSelected && models.length > 0 && (
                        <div className="ml-6 mt-2 mb-1 space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Model</Label>
                          <Select
                            value={config.model || ""}
                            onValueChange={v => onChange("model", v)}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent>
                              {models.map(m => (
                                <SelectItem key={m} value={m}>
                                  {m}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================ */}
        {/* Language - Full names with search                                */}
        {/* ================================================================ */}
        <AccordionItem value="language">
          <AccordionTrigger>Language</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Primary Language</Label>
              <Select
                value={config.language || "en-US"}
                onValueChange={v => onChange("language", v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{getLangName(config.language || "en-US")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2">
                    <Input
                      placeholder="Search languages..."
                      value={langSearch}
                      onChange={e => setLangSearch(e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  {filteredLangs.map(l => (
                    <SelectItem key={l.code} value={l.code}>
                      <span className="flex items-center gap-2">
                        <span>{l.name}</span>
                        <span className="text-xs text-muted-foreground">{l.code}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Additional Languages</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {additionalLangs.map(l => (
                  <span
                    key={l}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded text-xs"
                  >
                    {getLangName(l)}
                    <button onClick={() => removeLang(l)}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <Select onValueChange={addLang}>
                <SelectTrigger className="h-8 w-full">
                  <SelectValue placeholder="Add language..." />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.filter(
                    l => l.code !== config.language && !additionalLangs.includes(l.code)
                  ).map(l => (
                    <SelectItem key={l.code} value={l.code}>
                      <span className="flex items-center gap-2">
                        <span>{l.name}</span>
                        <span className="text-xs text-muted-foreground">{l.code}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Auto-Detect Language</Label>
              <Switch
                checked={config.autoDetect}
                onCheckedChange={v => onChange("autoDetect", v)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================ */}
        {/* Recognition Settings                                            */}
        {/* ================================================================ */}
        <AccordionItem value="recognition">
          <AccordionTrigger>Recognition</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Accuracy Mode</Label>
              <RadioGroup
                value={config.accuracyMode || "balanced"}
                onValueChange={v => onChange("accuracyMode", v)}
                className="flex gap-4"
              >
                {["fast", "balanced", "accurate"].map(m => (
                  <div key={m} className="flex items-center gap-1.5">
                    <RadioGroupItem value={m} id={`acc-${m}`} />
                    <Label htmlFor={`acc-${m}`} className="capitalize text-sm">
                      {m}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="flex items-center justify-between">
              <Label>Punctuation</Label>
              <Switch
                checked={config.punctuation}
                onCheckedChange={v => onChange("punctuation", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Profanity Filter</Label>
              <Switch
                checked={config.profanityFilter}
                onCheckedChange={v => onChange("profanityFilter", v)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================ */}
        {/* Custom Vocabulary - Stacked Card Layout                         */}
        {/* ================================================================ */}
        <AccordionItem value="vocabulary">
          <AccordionTrigger>Custom Vocabulary</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {vocab.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">
                No custom vocabulary entries. Add terms to boost recognition accuracy for
                domain-specific words.
              </p>
            )}
            {vocab.map((entry, idx) => (
              <VocabCard
                key={idx}
                entry={entry}
                index={idx}
                onUpdate={updateVocabEntry}
                onRemove={removeVocabEntry}
              />
            ))}
            <Button variant="outline" size="sm" className="w-full" onClick={addVocabEntry}>
              <Plus className="h-3 w-3 mr-1" />
              Add Term
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================ */}
        {/* Accent Hints                                                    */}
        {/* ================================================================ */}
        <AccordionItem value="accents">
          <AccordionTrigger>Accent Hints</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="flex flex-wrap gap-3">
              {ACCENT_OPTIONS.map(accent => (
                <div key={accent} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`accent-${accent}`}
                    checked={config.accentHints?.includes(accent) ?? false}
                    onCheckedChange={checked => {
                      const current = config.accentHints || [];
                      onChange(
                        "accentHints",
                        checked ? [...current, accent] : current.filter(a => a !== accent)
                      );
                    }}
                  />
                  <Label htmlFor={`accent-${accent}`} className="text-sm">
                    {accent}
                  </Label>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================ */}
        {/* Noise Cancellation                                              */}
        {/* ================================================================ */}
        <AccordionItem value="noise">
          <AccordionTrigger>Noise Cancellation</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <Select
              value={config.noiseCancellation || "standard"}
              onValueChange={v => onChange("noiseCancellation", v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="enhanced">Enhanced</SelectItem>
              </SelectContent>
            </Select>
          </AccordionContent>
        </AccordionItem>

        {/* ================================================================ */}
        {/* Fallback Transcribers - Vertical removable list                 */}
        {/* ================================================================ */}
        <AccordionItem value="fallbacks">
          <AccordionTrigger>Fallback Transcribers</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {fallbacks.length === 0 && (
              <p className="text-xs text-muted-foreground py-2">
                No fallback transcribers configured. Add up to 2 backup providers in case the
                primary STT service is unavailable.
              </p>
            )}
            <div className="space-y-2">
              {fallbacks.map((fb, idx) => (
                <FallbackItem
                  key={idx}
                  fb={fb}
                  index={idx}
                  total={fallbacks.length}
                  onMove={moveFallback}
                  onRemove={removeFallback}
                  onUpdate={updateFallback}
                />
              ))}
            </div>
            {fallbacks.length < 2 && (
              <Button variant="outline" size="sm" className="w-full" onClick={addFallback}>
                <Plus className="h-3 w-3 mr-1" />
                Add Fallback
              </Button>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </JsonToggle>
  );
}
