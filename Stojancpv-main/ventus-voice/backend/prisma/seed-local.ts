/**
 * Local Development Seed Script
 * Populates the local database with demo data for dashboard testing.
 *
 * Usage:
 *   npx tsx prisma/seed-local.ts
 *   npm run seed:local
 *
 * All operations use upsert for idempotency — running twice produces no errors or duplicates.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const DEMO_USER_ID = process.env.DEMO_USER_ID || 'user_local_dev_demo';
const DEMO_ORG_ID = process.env.DEMO_ORG_ID || 'org_local_dev_demo';

// ---------------------------------------------------------------------------
// 1. Organization
// ---------------------------------------------------------------------------
async function seedOrganization() {
  console.log('Seeding organizations...');
  await prisma.organizations.upsert({
    where: { id: DEMO_ORG_ID },
    update: { name: 'Vora Demo Workspace' },
    create: {
      id: DEMO_ORG_ID,
      name: 'Vora Demo Workspace',
      clerkOrgId: 'org_demo',
      slug: 'demo-workspace',
      updatedAt: new Date(),
    },
  });
  console.log('  ✓ Organizations seeded');
}

// ---------------------------------------------------------------------------
// 2. User
// ---------------------------------------------------------------------------
async function seedUser() {
  console.log('Seeding users...');
  await prisma.users.upsert({
    where: { id: DEMO_USER_ID },
    update: { name: 'Demo User' },
    create: {
      id: DEMO_USER_ID,
      email: 'demo@voicevora.com',
      name: 'Demo User',
      orgId: DEMO_ORG_ID,
      apiKey: `vora_demo_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
      updatedAt: new Date(),
    },
  });
  console.log('  ✓ Users seeded');
}

// ---------------------------------------------------------------------------
// 3. Agents
// ---------------------------------------------------------------------------
const AGENT_IDS = [
  'agent_local_support_001',
  'agent_local_sales_002',
  'agent_local_interview_003',
];

async function seedAgents() {
  console.log('Seeding agents...');

  const agents = [
    {
      id: AGENT_IDS[0],
      name: 'Customer Support Agent',
      description: 'Handles customer inquiries, troubleshooting, and FAQ responses.',
      status: 'ACTIVE' as const,
      originalPrompt: 'You are a helpful customer support agent for Vora Voice.',
      config: {
        voiceProvider: 'ELEVENLABS',
        greeting: 'Hello! How can I help you today?',
      },
    },
    {
      id: AGENT_IDS[1],
      name: 'Sales Outreach Agent',
      description: 'Engages potential customers, qualifies leads, and books demos.',
      status: 'ACTIVE' as const,
      originalPrompt: 'You are a friendly sales agent representing Vora Voice.',
      config: {
        voiceProvider: 'ELEVENLABS',
        greeting: 'Hi there! I would love to tell you about Vora Voice.',
      },
    },
    {
      id: AGENT_IDS[2],
      name: 'Interview Screener',
      description: 'Conducts initial candidate screening interviews.',
      status: 'DRAFT' as const,
      originalPrompt: 'You are an interview screening agent for Vora Voice hiring.',
      config: {
        voiceProvider: 'ELEVENLABS',
        greeting: 'Welcome to the interview. Let us get started.',
      },
    },
  ];

  for (const agent of agents) {
    await prisma.agents.upsert({
      where: { id: agent.id },
      update: { name: agent.name, description: agent.description },
      create: {
        id: agent.id,
        userId: DEMO_USER_ID,
        orgId: DEMO_ORG_ID,
        name: agent.name,
        description: agent.description,
        status: agent.status,
        originalPrompt: agent.originalPrompt,
        config: agent.config,
        updatedAt: new Date(),
      },
    });
  }

  console.log('  ✓ Agents seeded (3)');
}

// ---------------------------------------------------------------------------
// 4. Agent Sessions
// ---------------------------------------------------------------------------
async function seedSessions() {
  console.log('Seeding sessions...');

  const now = Date.now();
  const DAY = 86_400_000;

  const sessions = [
    {
      id: 'sess_local_001',
      agentId: AGENT_IDS[0],
      duration: 120,
      messageCount: 8,
      errorCount: 0,
      startedAt: new Date(now - 1 * DAY),
      endedAt: new Date(now - 1 * DAY + 120_000),
    },
    {
      id: 'sess_local_002',
      agentId: AGENT_IDS[0],
      duration: 45,
      messageCount: 4,
      errorCount: 1,
      startedAt: new Date(now - 2 * DAY),
      endedAt: new Date(now - 2 * DAY + 45_000),
    },
    {
      id: 'sess_local_003',
      agentId: AGENT_IDS[1],
      duration: 180,
      messageCount: 12,
      errorCount: 0,
      startedAt: new Date(now - 3 * DAY),
      endedAt: new Date(now - 3 * DAY + 180_000),
    },
    {
      id: 'sess_local_004',
      agentId: AGENT_IDS[1],
      duration: 60,
      messageCount: 5,
      errorCount: 0,
      startedAt: new Date(now - 5 * DAY),
      endedAt: new Date(now - 5 * DAY + 60_000),
    },
    {
      id: 'sess_local_005',
      agentId: AGENT_IDS[0],
      duration: 30,
      messageCount: 3,
      errorCount: 2,
      startedAt: new Date(now - 6 * DAY),
      endedAt: new Date(now - 6 * DAY + 30_000),
    },
  ];

  await prisma.agent_sessions.createMany({
    data: sessions.map((s) => ({
      id: s.id,
      agentId: s.agentId,
      userId: DEMO_USER_ID,
      orgId: DEMO_ORG_ID,
      livekitRoomName: `local-room-${s.id}`,
      duration: s.duration,
      messageCount: s.messageCount,
      errorCount: s.errorCount,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    })),
    skipDuplicates: true,
  });

  console.log('  ✓ Sessions seeded (5)');
}

// ---------------------------------------------------------------------------
// 5. Credit Packs (reuse existing seed data)
// ---------------------------------------------------------------------------
async function seedCreditPacks() {
  console.log('Seeding credit packs...');

  const creditPacks = [
    {
      name: '10 Credits',
      minutes: 10,
      priceInCents: 1000,
      paddlePriceId: process.env.PADDLE_CREDIT_PACK_10_PRICE_ID || 'pri_placeholder_10',
      isActive: true,
      sortOrder: 1,
      description: 'Perfect for trying out Vora',
    },
    {
      name: '50 Credits',
      minutes: 50,
      priceInCents: 5000,
      paddlePriceId: process.env.PADDLE_CREDIT_PACK_50_PRICE_ID || 'pri_placeholder_50',
      isActive: true,
      sortOrder: 2,
      description: 'Most popular choice',
    },
    {
      name: '100 Credits',
      minutes: 100,
      priceInCents: 10000,
      paddlePriceId: process.env.PADDLE_CREDIT_PACK_100_PRICE_ID || 'pri_placeholder_100',
      isActive: true,
      sortOrder: 3,
      description: 'Best value for power users',
    },
  ];

  for (const pack of creditPacks) {
    const existing = await prisma.minute_packs.findFirst({
      where: { name: pack.name },
    });

    if (existing) {
      await prisma.minute_packs.update({
        where: { id: existing.id },
        data: {
          minutes: pack.minutes,
          priceInCents: pack.priceInCents,
          paddlePriceId: pack.paddlePriceId,
          isActive: pack.isActive,
          sortOrder: pack.sortOrder,
          description: pack.description,
        },
      });
    } else {
      await prisma.minute_packs.create({ data: pack });
    }
  }

  console.log('  ✓ Credit packs seeded (3)');
}

// ---------------------------------------------------------------------------
// 6. Pricing (reuse existing seed data)
// ---------------------------------------------------------------------------
async function seedPricing() {
  console.log('Seeding pricing...');

  const pricingData = [
    {
      provider: 'openai',
      providerType: 'LLM' as const,
      model: 'gpt-4o',
      inputTokensPerMillion: 2.5,
      outputTokensPerMillion: 10.0,
      notes: 'GPT-4o - Flagship model',
    },
    {
      provider: 'openai',
      providerType: 'LLM' as const,
      model: 'gpt-4o-mini',
      inputTokensPerMillion: 0.15,
      outputTokensPerMillion: 0.6,
      notes: 'GPT-4o mini - Affordable',
    },
    {
      provider: 'anthropic',
      providerType: 'LLM' as const,
      model: 'claude-3-5-sonnet-20241022',
      inputTokensPerMillion: 3.0,
      outputTokensPerMillion: 15.0,
      notes: 'Claude 3.5 Sonnet',
    },
    {
      provider: 'google',
      providerType: 'LLM' as const,
      model: 'gemini-2.0-flash-exp',
      inputTokensPerMillion: 0.0,
      outputTokensPerMillion: 0.0,
      notes: 'Gemini 2.0 Flash - Free experimental',
    },
    {
      provider: 'deepgram',
      providerType: 'STT' as const,
      model: 'nova-2',
      perMinute: 0.0043,
      notes: 'Nova-2 STT',
    },
    {
      provider: 'elevenlabs',
      providerType: 'TTS' as const,
      model: null,
      perCharacter: 0.0003,
      per1kCharacters: 0.3,
      notes: 'ElevenLabs TTS',
    },
  ];

  for (const pricing of pricingData) {
    const existing = await prisma.providerPricing.findFirst({
      where: {
        provider: pricing.provider,
        providerType: pricing.providerType,
        model: pricing.model || null,
        isCurrent: true,
      },
    });

    if (!existing) {
      await prisma.providerPricing.create({
        data: {
          id: randomUUID(),
          ...pricing,
          currency: 'USD',
          version: 1,
          isCurrent: true,
          effectiveFrom: new Date(),
          updatedAt: new Date(),
        },
      });
    }
  }

  console.log('  ✓ Pricing seeded');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('\n🚀 Vora Local Development Seed\n');

  await seedOrganization();
  await seedUser();
  await seedAgents();
  await seedSessions();
  await seedCreditPacks();
  await seedPricing();

  console.log('\n✅ All local seed data created successfully!\n');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
