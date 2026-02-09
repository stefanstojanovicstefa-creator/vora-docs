import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Book,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Bot,
  Mic,
  Speaker,
  Brain,
  Code2,
  Shield,
  Zap,
  Play,
  Layers,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

interface FAQItem {
  question: string;
  answer: string;
  category: string;
}

interface DocSection {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  link: string;
  badge?: string;
}

const faqItems: FAQItem[] = [
  {
    category: 'Getting Started',
    question: 'What is Vora Voice?',
    answer:
      'Vora Voice is a comprehensive platform for building, deploying, and managing voice AI agents. It provides tools for creating conversational AI assistants that can handle phone calls, web interactions, and more.',
  },
  {
    category: 'Getting Started',
    question: 'How do I create my first agent?',
    answer:
      'Navigate to the "Create Agent" page from the navigation menu. You\'ll be guided through setting up your agent\'s name, system prompt, voice selection, and provider configuration. Our step-by-step wizard makes it easy to get started.',
  },
  {
    category: 'Getting Started',
    question: 'What are the minimum requirements to start?',
    answer:
      'You need at least one configured credential for an LLM provider (like OpenAI or Anthropic), a TTS provider (like ElevenLabs or Deepgram), and an STT provider. You can configure these in the Credentials page.',
  },
  {
    category: 'Agents',
    question: 'What is a system prompt?',
    answer:
      'A system prompt defines your agent\'s personality, capabilities, and behavior. It tells the AI how to respond, what role it should play, and any specific instructions or constraints. A well-crafted system prompt is key to creating an effective agent.',
  },
  {
    category: 'Agents',
    question: 'Can I use multiple LLM providers?',
    answer:
      'Yes! Vora Voice supports multiple LLM providers including OpenAI, Anthropic, Google, and more. You can configure fallback chains so if one provider is unavailable, another takes over automatically.',
  },
  {
    category: 'Agents',
    question: 'How do I add custom functions to my agent?',
    answer:
      'Use the Custom Functions page to define tools your agent can call. You can create actions for API calls, database queries, or other operations, then attach them to your agent.',
  },
  {
    category: 'Voice',
    question: 'What TTS providers are supported?',
    answer:
      'We support ElevenLabs, Deepgram, Google Cloud TTS, Amazon Polly, and more. Each provider offers different voices, languages, and pricing. You can compare them in the Providers page.',
  },
  {
    category: 'Voice',
    question: 'Can I clone a voice?',
    answer:
      'Voice cloning depends on the TTS provider. ElevenLabs offers voice cloning capabilities. Check your provider\'s documentation and terms of service for voice cloning features.',
  },
  {
    category: 'Voice',
    question: 'What languages are supported?',
    answer:
      'Language support varies by provider. Most providers support English, Spanish, French, German, and other major languages. Check the specific provider\'s capabilities for your target language.',
  },
  {
    category: 'Deployment',
    question: 'How do I deploy my agent?',
    answer:
      'Agents can be deployed via web widget (embed on your website), phone number integration (via Twilio), direct API calls, or LiveKit rooms for real-time communication. Each method has its own setup process.',
  },
  {
    category: 'Deployment',
    question: 'What is LiveKit?',
    answer:
      'LiveKit is our real-time communication infrastructure that handles voice streams between users and agents. It provides low-latency, high-quality audio transmission for natural conversations.',
  },
  {
    category: 'Deployment',
    question: 'Can I integrate with my existing systems?',
    answer:
      'Yes! Use our REST API to integrate agents with your existing applications. You can also define custom functions (tool schemas) to let agents interact with your backend services.',
  },
  {
    category: 'Monitoring',
    question: 'How do I monitor my agents?',
    answer:
      'The Agent Analytics page shows success rates, response times, and error analysis. The Cost Analytics page tracks spending by provider. The Usage Metrics page shows session volumes and token usage.',
  },
  {
    category: 'Monitoring',
    question: 'What metrics should I track?',
    answer:
      'Key metrics include success rate (completed conversations), average response time (latency), cost per conversation, and error rate. Monitor these to optimize your agents\' performance.',
  },
  {
    category: 'Billing',
    question: 'How is billing calculated?',
    answer:
      'Costs are based on provider usage: LLM costs depend on tokens processed, TTS costs depend on characters synthesized, and STT costs depend on audio minutes transcribed. Each provider has different pricing.',
  },
  {
    category: 'Billing',
    question: 'Can I set budget limits?',
    answer:
      'You can monitor costs in real-time through the Cost Analytics dashboard. Setting hard budget limits requires configuration in each provider\'s dashboard (OpenAI, ElevenLabs, etc.).',
  },
];

const docSections: DocSection[] = [
  {
    title: 'Quick Start Guide',
    description: 'Get your first agent up and running in minutes',
    icon: Play,
    link: '/onboarding',
    badge: 'Start Here',
  },
  {
    title: 'Agent Creation',
    description: 'Learn how to create and configure voice agents',
    icon: Bot,
    link: '/agents/create',
  },
  {
    title: 'Brand Analyzer',
    description: 'Auto-generate agent prompts from your brand',
    icon: Zap,
    link: '/brands/analyze',
  },
  {
    title: 'Custom Functions',
    description: 'Add custom capabilities to your agents',
    icon: Code2,
    link: '/custom-functions',
  },
  {
    title: 'Provider Setup',
    description: 'Configure LLM, TTS, and STT providers',
    icon: Layers,
    link: '/providers',
  },
  {
    title: 'Credentials',
    description: 'Manage API keys and authentication',
    icon: Shield,
    link: '/credentials',
  },
  {
    title: 'Agent Analytics',
    description: 'Monitor agent performance and success rates',
    icon: Brain,
    link: '/agent-performance',
  },
  {
    title: 'Cost Management',
    description: 'Track and optimize your AI spending',
    icon: Wallet,
    link: '/cost-analytics',
  },
];

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Getting Started': Play,
  Agents: Bot,
  Voice: Speaker,
  Deployment: Zap,
  Monitoring: Brain,
  Billing: Wallet,
};

export function DocumentationPage() {
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = ['all', ...new Set(faqItems.map((item) => item.category))];

  const filteredFAQs =
    selectedCategory === 'all'
      ? faqItems
      : faqItems.filter((item) => item.category === selectedCategory);

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Book className="h-8 w-8" />
          Documentation
        </h1>
        <p className="text-muted-foreground mt-2">
          Learn how to build and deploy powerful voice AI agents with Vora Voice
        </p>
      </div>

      <Tabs defaultValue="guides">
        <TabsList>
          <TabsTrigger value="guides">Guides</TabsTrigger>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="concepts">Key Concepts</TabsTrigger>
        </TabsList>

        {/* Guides Tab */}
        <TabsContent value="guides" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {docSections.map((section) => {
              const Icon = section.icon;
              return (
                <Link key={section.title} to={section.link}>
                  <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        {section.badge && (
                          <Badge variant="default">{section.badge}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-base mt-3">{section.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription>{section.description}</CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </TabsContent>

        {/* FAQ Tab */}
        <TabsContent value="faq" className="space-y-6">
          {/* Category Filter */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
              >
                {category === 'all' ? 'All Questions' : category}
              </Button>
            ))}
          </div>

          {/* FAQ List */}
          <div className="space-y-3">
            {filteredFAQs.map((item, index) => {
              const CategoryIcon = categoryIcons[item.category] || HelpCircle;
              const isExpanded = expandedFAQ === index;

              return (
                <Card key={index}>
                  <button
                    onClick={() => toggleFAQ(index)}
                    className="w-full text-left"
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-1.5 rounded bg-muted flex-shrink-0 mt-0.5">
                            <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div>
                            <CardTitle className="text-base font-medium">
                              {item.question}
                            </CardTitle>
                            <Badge variant="secondary\" className="mt-1">
                              {item.category}
                            </Badge>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                      </div>
                    </CardHeader>
                  </button>
                  {isExpanded && (
                    <CardContent className="pt-0 pb-4">
                      <p className="text-muted-foreground pl-10">{item.answer}</p>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Key Concepts Tab */}
        <TabsContent value="concepts" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <ConceptCard
              icon={Bot}
              title="Voice Agent"
              description="An AI-powered assistant that can engage in voice conversations. Combines LLM intelligence with speech-to-text and text-to-speech capabilities."
              details={[
                'Defined by a system prompt that sets personality and behavior',
                'Uses LLM for understanding and generating responses',
                'Converts speech to text for processing',
                'Synthesizes natural-sounding voice responses',
              ]}
            />
            <ConceptCard
              icon={Brain}
              title="LLM Provider"
              description="Large Language Model providers power the intelligence behind your agents. They process text and generate contextually appropriate responses."
              details={[
                'OpenAI (GPT-4, GPT-3.5)',
                'Anthropic (Claude)',
                'Google (Gemini)',
                'Local models via Ollama',
              ]}
            />
            <ConceptCard
              icon={Mic}
              title="STT (Speech-to-Text)"
              description="Converts spoken audio into text that the LLM can process. Critical for understanding user input in voice conversations."
              details={[
                'Deepgram - Fast, accurate transcription',
                'OpenAI Whisper - Multi-language support',
                'Google Cloud Speech - Enterprise grade',
                'Real-time streaming transcription',
              ]}
            />
            <ConceptCard
              icon={Speaker}
              title="TTS (Text-to-Speech)"
              description="Converts text responses from the LLM into natural-sounding speech. The voice of your agent."
              details={[
                'ElevenLabs - Natural, expressive voices',
                'Deepgram - Low-latency synthesis',
                'Amazon Polly - Many language options',
                'Google Cloud TTS - Neural voices',
              ]}
            />
            <ConceptCard
              icon={Code2}
              title="Custom Functions"
              description="Tools and actions your agent can perform during conversations. Enables integration with external systems."
              details={[
                'JSON Schema format for defining tools',
                'API integrations for real-time data',
                'Database queries and updates',
                'Workflow automation triggers',
              ]}
            />
            <ConceptCard
              icon={Layers}
              title="Fallback Chains"
              description="Automatic failover between providers for high availability. If one provider fails, the next in the chain takes over."
              details={[
                'Configure priority order for providers',
                'Circuit breakers prevent cascading failures',
                'Automatic recovery when providers come back',
                'Minimize downtime and user impact',
              ]}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ConceptCard({
  icon: Icon,
  title,
  description,
  details,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  details: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
        <CardDescription className="mt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {details.map((detail, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-1">•</span>
              <span className="text-muted-foreground">{detail}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default DocumentationPage;
