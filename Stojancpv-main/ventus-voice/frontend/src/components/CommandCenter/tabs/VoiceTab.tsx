import { useState, useCallback, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, RotateCcw, ArrowUp, ArrowDown, Plus, X } from "lucide-react";
import { JsonToggle } from "../JsonToggle";
import { commandCenterVoiceSchema } from "@/schemas/commandCenterConfig.schema";
import type { CommandCenterVoice } from "@/schemas/commandCenterConfig.schema";

// ============================================================================
// Voice Data
// ============================================================================

// TTS providers and voices from backend registry (tts.registry.ts)
const TTS_PROVIDERS = [
  {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Realistic AI voice synthesis with emotion control",
  },
  { id: "cartesia", name: "Cartesia", description: "Ultra low-latency voice synthesis" },
  { id: "openai", name: "OpenAI TTS", description: "OpenAI Text-to-Speech with natural voices" },
  { id: "google", name: "Google Cloud TTS", description: "Google Cloud TTS with Neural voices" },
  { id: "azure", name: "Azure Speech", description: "Microsoft Azure TTS with Neural voices" },
];

const VOICES: Record<string, { id: string; name: string; gender: string; description?: string }[]> =
  {
    elevenlabs: [
      {
        id: "21m00Tcm4TlvDq8ikWAM",
        name: "Rachel",
        gender: "female",
        description: "Calm, young American female",
      },
      {
        id: "pNInz6obpgDQGcFmaJgB",
        name: "Adam",
        gender: "male",
        description: "Deep, middle-aged American male",
      },
      {
        id: "EXAVITQu4vr4xnSDxMaL",
        name: "Bella",
        gender: "female",
        description: "Soft, young American female",
      },
      {
        id: "ErXwobaYiN019PkySvjV",
        name: "Antoni",
        gender: "male",
        description: "Well-rounded, young American male",
      },
      {
        id: "MF3mGyEYCl7XYWbV9V6O",
        name: "Elli",
        gender: "female",
        description: "Emotional, young American female",
      },
      {
        id: "TxGEqnHWrfWFTfGW9XjX",
        name: "Josh",
        gender: "male",
        description: "Deep, young American male",
      },
      {
        id: "VR6AewLTigWG4xSOukaG",
        name: "Arnold",
        gender: "male",
        description: "Crisp, middle-aged American male",
      },
      {
        id: "onwK4e9ZLuTAKqWW03F9",
        name: "Daniel",
        gender: "male",
        description: "Deep, authoritative British male",
      },
      {
        id: "XB0fDUnXU5powFXDhCwa",
        name: "Charlotte",
        gender: "female",
        description: "Seductive, young Swedish female",
      },
      {
        id: "Xb7hH8MSUJpSbSDYk0k2",
        name: "Alice",
        gender: "female",
        description: "Confident, middle-aged British female",
      },
    ],
    cartesia: [
      {
        id: "a0e99841-438c-4a64-b679-ae501e7d6091",
        name: "Barbershop Man",
        gender: "male",
        description: "Warm, conversational male",
      },
      {
        id: "156fb8d2-335b-4950-9cb3-a2d33f8fd7e9",
        name: "Friendly Reading Man",
        gender: "male",
        description: "Clear, friendly male narrator",
      },
      {
        id: "79a125e8-cd45-4c13-8a67-188112f4dd22",
        name: "British Lady",
        gender: "female",
        description: "Elegant British female",
      },
      {
        id: "2ee87190-8f84-4925-97da-e52547f9462c",
        name: "Calm Lady",
        gender: "female",
        description: "Soothing, calm female voice",
      },
      {
        id: "5619d38c-cf51-4d8e-9575-48f61a280413",
        name: "Spanish Narrator",
        gender: "female",
        description: "Professional Spanish narrator",
      },
    ],
    openai: [
      { id: "alloy", name: "Alloy", gender: "neutral", description: "Balanced, neutral voice" },
      { id: "echo", name: "Echo", gender: "male", description: "Deep, resonant male voice" },
      { id: "fable", name: "Fable", gender: "neutral", description: "Expressive, narrative voice" },
      { id: "onyx", name: "Onyx", gender: "male", description: "Deep, authoritative male voice" },
      { id: "nova", name: "Nova", gender: "female", description: "Warm, friendly female voice" },
      { id: "shimmer", name: "Shimmer", gender: "female", description: "Soft, clear female voice" },
    ],
    google: [
      {
        id: "en-US-Neural2-C",
        name: "Neural2-C (Female)",
        gender: "female",
        description: "Natural US English female",
      },
      {
        id: "en-US-Neural2-D",
        name: "Neural2-D (Male)",
        gender: "male",
        description: "Natural US English male",
      },
      {
        id: "en-US-Neural2-A",
        name: "Neural2-A (Male)",
        gender: "male",
        description: "Professional US English male",
      },
      {
        id: "en-US-Neural2-E",
        name: "Neural2-E (Female)",
        gender: "female",
        description: "Expressive US English female",
      },
      {
        id: "en-GB-Neural2-A",
        name: "Neural2-A (British F)",
        gender: "female",
        description: "Natural British English female",
      },
      {
        id: "en-GB-Neural2-B",
        name: "Neural2-B (British M)",
        gender: "male",
        description: "Natural British English male",
      },
    ],
    azure: [
      {
        id: "en-US-JennyNeural",
        name: "Jenny",
        gender: "female",
        description: "Friendly US English female",
      },
      {
        id: "en-US-GuyNeural",
        name: "Guy",
        gender: "male",
        description: "Friendly US English male",
      },
      {
        id: "en-GB-SoniaNeural",
        name: "Sonia",
        gender: "female",
        description: "Professional British English female",
      },
      {
        id: "en-GB-RyanNeural",
        name: "Ryan",
        gender: "male",
        description: "Professional British English male",
      },
    ],
  };

const EMOTION_PRESETS: Record<string, string> = {
  professional: "Speak in a calm, confident, measured tone. Maintain a neutral pace.",
  friendly: "Speak warmly and enthusiastically, with a smile in your voice.",
  urgent: "Speak with focused energy and clear enunciation.",
  empathetic: "Speak gently and compassionately, with understanding pauses.",
};

// ============================================================================
// Types
// ============================================================================

interface VoiceTabProps {
  config: CommandCenterVoice;
  onChange: (field: string, value: unknown) => void;
}

// ============================================================================
// Component
// ============================================================================

export function VoiceTab({ config, onChange }: VoiceTabProps) {
  const [voiceSearch, setVoiceSearch] = useState("");

  const providerKey = (config.provider || "elevenlabs").toLowerCase();
  const voiceList = useMemo(() => VOICES[providerKey] || [], [providerKey]);
  const isElevenLabs = providerKey === "elevenlabs";

  const filteredVoices = useMemo(() => {
    if (!voiceSearch) return voiceList;
    return voiceList.filter(v => v.name.toLowerCase().includes(voiceSearch.toLowerCase()));
  }, [voiceList, voiceSearch]);

  // Fallback voices
  const fallbacks = useMemo(() => config.fallbackVoices || [], [config.fallbackVoices]);

  const addFallback = useCallback(() => {
    if (fallbacks.length >= 3) return;
    onChange("fallbackVoices", [...fallbacks, { provider: "", voiceId: "" }]);
  }, [fallbacks, onChange]);

  const removeFallback = useCallback(
    (idx: number) => {
      onChange(
        "fallbackVoices",
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
      onChange("fallbackVoices", newArr);
    },
    [fallbacks, onChange]
  );

  const updateFallback = useCallback(
    (idx: number, field: string, value: string) => {
      const newArr = [...fallbacks];
      newArr[idx] = { ...newArr[idx], [field]: value };
      onChange("fallbackVoices", newArr);
    },
    [fallbacks, onChange]
  );

  const handleJsonApply = useCallback(
    (data: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(data)) {
        onChange(key, value);
      }
    },
    [onChange]
  );

  return (
    <JsonToggle
      sectionSchema={commandCenterVoiceSchema}
      sectionData={config as unknown as Record<string, unknown>}
      onJsonApply={handleJsonApply}
    >
      <Accordion type="multiple" defaultValue={["provider", "voice-selector", "tuning"]}>
        {/* Provider Section */}
        <AccordionItem value="provider">
          <AccordionTrigger>Provider</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>TTS Provider</Label>
              <Select
                value={config.provider || ""}
                onValueChange={v => {
                  onChange("provider", v);
                  // Auto-select first voice of new provider
                  const firstVoice = VOICES[v]?.[0];
                  if (firstVoice) onChange("voiceId", firstVoice.id);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {TTS_PROVIDERS.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <span>{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Voice Selector */}
        <AccordionItem value="voice-selector">
          <AccordionTrigger>Voice</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <Input
              placeholder="Search voices..."
              value={voiceSearch}
              onChange={e => setVoiceSearch(e.target.value)}
            />
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {filteredVoices.map(voice => (
                <button
                  key={voice.id}
                  className={`voice-card flex items-center justify-between text-sm px-3 py-2 rounded border transition-all ${
                    config.voiceId === voice.id
                      ? "voice-card-selected border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.1)]"
                      : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.3)]"
                  }`}
                  onClick={() => onChange("voiceId", voice.id)}
                >
                  <div className="text-left">
                    <span className="font-medium">{voice.name}</span>
                    {voice.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{voice.description}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" disabled>
                    <Play className="h-3 w-3" />
                  </Button>
                </button>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Tuning Section */}
        <AccordionItem value="tuning">
          <AccordionTrigger>Tuning</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {[
              { label: "Speed", field: "speed", min: 0.5, max: 2, step: 0.1, default: 1 },
              { label: "Pitch", field: "pitch", min: -20, max: 20, step: 1, default: 0 },
              { label: "Volume", field: "volume", min: 0, max: 100, step: 5, default: 80 },
            ].map(({ label, field, min, max, step, default: def }) => (
              <div key={field} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{label}</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      className="w-20 h-7 text-xs"
                      value={((config as Record<string, unknown>)[field] as number) ?? def}
                      min={min}
                      max={max}
                      step={step}
                      onChange={e => onChange(field, parseFloat(e.target.value) || def)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onChange(field, def)}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <Slider
                  value={[((config as Record<string, unknown>)[field] as number) ?? def]}
                  min={min}
                  max={max}
                  step={step}
                  onValueChange={([v]) => onChange(field, v)}
                />
              </div>
            ))}

            {/* ElevenLabs Advanced */}
            {isElevenLabs && (
              <div className="pt-2 border-t space-y-4">
                <p className="text-xs text-muted-foreground font-medium">ElevenLabs Advanced</p>
                {[
                  { label: "Stability", field: "stability", default: 0.5 },
                  { label: "Similarity", field: "similarity", default: 0.75 },
                  { label: "Style Exaggeration", field: "styleExaggeration", default: 0 },
                ].map(({ label, field, default: def }) => (
                  <div key={field} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>{label}</Label>
                      <Input
                        type="number"
                        className="w-20 h-7 text-xs"
                        value={((config as Record<string, unknown>)[field] as number) ?? def}
                        min={0}
                        max={1}
                        step={0.05}
                        onChange={e => onChange(field, parseFloat(e.target.value) || def)}
                      />
                    </div>
                    <Slider
                      value={[((config as Record<string, unknown>)[field] as number) ?? def]}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={([v]) => onChange(field, v)}
                    />
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Voice Character */}
        <AccordionItem value="voice-character">
          <AccordionTrigger>Voice Character</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Intonation Prompt</Label>
              <Textarea
                value={config.intonationPrompt || ""}
                onChange={e => onChange("intonationPrompt", e.target.value)}
                placeholder="Speak warmly with a slight smile, pause thoughtfully before important points"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Emotion Preset</Label>
              <div className="flex flex-wrap gap-2">
                {(["professional", "friendly", "urgent", "empathetic", "custom"] as const).map(
                  preset => (
                    <Button
                      key={preset}
                      variant={config.emotionPreset === preset ? "default" : "outline"}
                      size="sm"
                      className={`capitalize ${config.emotionPreset === preset ? "shadow-[0_0_10px_rgba(153,205,255,0.2)]" : ""}`}
                      onClick={() => {
                        onChange("emotionPreset", preset);
                        if (preset !== "custom" && EMOTION_PRESETS[preset]) {
                          onChange("intonationPrompt", EMOTION_PRESETS[preset]);
                        }
                      }}
                    >
                      {preset}
                    </Button>
                  )
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Filler Words */}
        <AccordionItem value="filler-words">
          <AccordionTrigger>Filler Words</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <Label>Enable Filler Words</Label>
              <Switch
                checked={config.fillerWords?.enabled ?? false}
                onCheckedChange={checked =>
                  onChange("fillerWords", {
                    ...config.fillerWords,
                    enabled: checked,
                    frequency: config.fillerWords?.frequency || "natural",
                    contextAware: config.fillerWords?.contextAware ?? true,
                  })
                }
              />
            </div>
            {config.fillerWords?.enabled && (
              <>
                <div className="space-y-2">
                  <Label>Frequency</Label>
                  <Select
                    value={config.fillerWords?.frequency || "natural"}
                    onValueChange={v =>
                      onChange("fillerWords", { ...config.fillerWords, frequency: v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minimal">Minimal</SelectItem>
                      <SelectItem value="natural">Natural</SelectItem>
                      <SelectItem value="conversational">Conversational</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Context-Aware</Label>
                  <Switch
                    checked={config.fillerWords?.contextAware ?? true}
                    onCheckedChange={checked =>
                      onChange("fillerWords", { ...config.fillerWords, contextAware: checked })
                    }
                  />
                </div>
              </>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Pause Patterns */}
        <AccordionItem value="pause-patterns">
          <AccordionTrigger>Pause Patterns</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {[
              { label: "Before important points", field: "beforeImportant", default: 300 },
              { label: "After questions", field: "afterQuestions", default: 500 },
              { label: "Thinking pause", field: "thinkingPause", default: 200 },
            ].map(({ label, field, default: def }) => (
              <div key={field} className="flex items-center justify-between">
                <Label>{label}</Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    className="w-24 h-7 text-xs"
                    value={
                      ((config.pausePatterns as Record<string, unknown> | undefined)?.[
                        field
                      ] as number) ?? def
                    }
                    onChange={e =>
                      onChange("pausePatterns", {
                        ...config.pausePatterns,
                        [field]: parseInt(e.target.value) || def,
                      })
                    }
                  />
                  <span className="text-xs text-muted-foreground">ms</span>
                </div>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* Fallback Voices */}
        <AccordionItem value="fallback-voices">
          <AccordionTrigger>Fallback Voices</AccordionTrigger>
          <AccordionContent className="space-y-4 pt-2">
            {fallbacks.map((fb, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background">
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={idx === 0}
                    onClick={() => moveFallback(idx, -1)}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={idx === fallbacks.length - 1}
                    onClick={() => moveFallback(idx, 1)}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <Select value={fb.provider} onValueChange={v => updateFallback(idx, "provider", v)}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {TTS_PROVIDERS.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="flex-1 h-8"
                  placeholder="Voice ID"
                  value={fb.voiceId}
                  onChange={e => updateFallback(idx, "voiceId", e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => removeFallback(idx)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {fallbacks.length < 3 && (
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
