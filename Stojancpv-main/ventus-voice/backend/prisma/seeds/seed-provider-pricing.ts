/**
 * Provider Pricing Seed Data
 *
 * Populates the provider_pricing table with real per-minute rates
 * so the Command Center cost estimation returns accurate numbers.
 *
 * Usage:
 *   npx tsx prisma/seeds/seed-provider-pricing.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface PricingEntry {
  provider: string;
  providerType: "LLM" | "STT" | "TTS";
  model: string;
  perMinute: number;
  notes?: string;
}

const pricingData: PricingEntry[] = [
  // ============================================================================
  // LLM Providers
  // ============================================================================
  { provider: "google", providerType: "LLM", model: "gemini-2.5-flash", perMinute: 0.0375, notes: "Fast, cost-effective" },
  { provider: "google", providerType: "LLM", model: "gemini-2.5-pro", perMinute: 0.30, notes: "Highest quality" },
  { provider: "google", providerType: "LLM", model: "gemini-2.0-flash", perMinute: 0.02, notes: "Previous gen flash" },
  { provider: "openai", providerType: "LLM", model: "gpt-4o", perMinute: 0.15, notes: "GPT-4o flagship" },
  { provider: "openai", providerType: "LLM", model: "gpt-4o-mini", perMinute: 0.015, notes: "GPT-4o mini" },
  { provider: "openai", providerType: "LLM", model: "gpt-4-turbo", perMinute: 0.18, notes: "GPT-4 Turbo" },
  { provider: "anthropic", providerType: "LLM", model: "claude-sonnet-4-5-20250929", perMinute: 0.18, notes: "Claude Sonnet 4.5" },
  { provider: "anthropic", providerType: "LLM", model: "claude-haiku-4-5-20251001", perMinute: 0.05, notes: "Claude Haiku 4.5" },
  { provider: "groq", providerType: "LLM", model: "llama-3.3-70b-versatile", perMinute: 0.008, notes: "Groq Llama 3.3" },
  { provider: "groq", providerType: "LLM", model: "mixtral-8x7b-32768", perMinute: 0.005, notes: "Groq Mixtral" },

  // ============================================================================
  // TTS Providers
  // ============================================================================
  { provider: "elevenlabs", providerType: "TTS", model: "eleven_multilingual_v2", perMinute: 0.18, notes: "ElevenLabs premium" },
  { provider: "cartesia", providerType: "TTS", model: "sonic-2", perMinute: 0.10, notes: "Cartesia Sonic" },
  { provider: "openai", providerType: "TTS", model: "tts-1", perMinute: 0.09, notes: "OpenAI TTS" },
  { provider: "openai", providerType: "TTS", model: "tts-1-hd", perMinute: 0.12, notes: "OpenAI TTS HD" },
  { provider: "google", providerType: "TTS", model: "neural2", perMinute: 0.04, notes: "Google Cloud TTS" },
  { provider: "azure", providerType: "TTS", model: "neural", perMinute: 0.04, notes: "Azure Cognitive TTS" },

  // ============================================================================
  // STT Providers
  // ============================================================================
  { provider: "deepgram", providerType: "STT", model: "nova-2", perMinute: 0.0043, notes: "Deepgram Nova-2" },
  { provider: "deepgram", providerType: "STT", model: "nova-2-general", perMinute: 0.0043, notes: "Deepgram Nova-2 General" },
  { provider: "deepgram", providerType: "STT", model: "nova-2-phonecall", perMinute: 0.0043, notes: "Deepgram Nova-2 Phone" },
  { provider: "deepgram", providerType: "STT", model: "whisper-large", perMinute: 0.0048, notes: "Deepgram Whisper" },
  { provider: "assemblyai", providerType: "STT", model: "best", perMinute: 0.01, notes: "AssemblyAI Best" },
  { provider: "assemblyai", providerType: "STT", model: "nano", perMinute: 0.006, notes: "AssemblyAI Nano" },
  { provider: "google", providerType: "STT", model: "latest_long", perMinute: 0.006, notes: "Google Cloud STT" },
  { provider: "google", providerType: "STT", model: "chirp", perMinute: 0.008, notes: "Google Chirp" },
  { provider: "azure", providerType: "STT", model: "whisper", perMinute: 0.006, notes: "Azure STT" },
  { provider: "openai", providerType: "STT", model: "whisper-1", perMinute: 0.006, notes: "OpenAI Whisper" },
];

async function main() {
  console.log(`Seeding ${pricingData.length} provider pricing entries...`);

  let created = 0;
  let updated = 0;

  for (const entry of pricingData) {
    const id = `${entry.provider}-${entry.providerType.toLowerCase()}-${entry.model}`;

    await prisma.provider_pricing.upsert({
      where: {
        provider_providerType_model_version: {
          provider: entry.provider,
          providerType: entry.providerType,
          model: entry.model,
          version: 1,
        },
      },
      update: {
        perMinute: entry.perMinute,
        isCurrent: true,
        notes: entry.notes,
        updatedAt: new Date(),
      },
      create: {
        id,
        provider: entry.provider,
        providerType: entry.providerType,
        model: entry.model,
        perMinute: entry.perMinute,
        currency: "USD",
        version: 1,
        isCurrent: true,
        notes: entry.notes,
        updatedAt: new Date(),
      },
    });

    created++;
  }

  console.log(`Done. ${created} pricing entries upserted.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
