import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Book,
  HelpCircle,
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
  Puzzle,
  GitBranch,
  Database,
  Wand2,
  BookOpen,
  BarChart3,
  ArrowRight,
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
  {
    category: 'MCP',
    question: 'How do I browse and connect MCP tools from the Marketplace?',
    answer:
      'Go to Integrations > MCP Marketplace to browse available tool servers organized by category and industry. Click on any server to view its tools, then hit "Connect" to add it to your organization. Once connected, you can assign the server\'s tools to individual agents.',
  },
  {
    category: 'Flow Studio',
    question: 'How do I create and test conversation flows in Flow Studio?',
    answer:
      'Open an agent and navigate to its Flow Studio tab. Use the drag-and-drop canvas to add nodes for messages, conditions, and actions. Connect them to define conversation paths. Use the built-in simulator to test your flow before deploying by clicking the play button in the top toolbar.',
  },
  {
    category: 'Memory',
    question: 'How does the Memory System work with layers and RIF scoring?',
    answer:
      'Vora uses a multi-layer memory system: short-term memory holds context within a single call, working memory persists across calls in a session, and long-term memory stores key facts about returning customers. RIF (Recency, Importance, Frequency) scoring automatically prioritizes which memories to surface during a conversation.',
  },
  {
    category: 'Forge',
    question: 'What is the difference between Forge URL Wizard and Interview Bot?',
    answer:
      'The URL Wizard scrapes a website to auto-generate an agent\'s system prompt, voice, and personality from your brand content. The Interview Bot walks you through a guided conversation, asking questions about your business to build the agent step by step. Both produce a ready-to-deploy agent, but URL Wizard is faster while Interview Bot gives more control.',
  },
  {
    category: 'Knowledge Base',
    question: 'How do I upload documents and use RAG search in the Knowledge Base?',
    answer:
      'Navigate to your agent\'s Knowledge Base section and click "Upload Document" to add PDFs, text files, or URLs. Vora automatically chunks and embeds the content. During calls, the agent uses RAG (Retrieval-Augmented Generation) to search the knowledge base and include relevant information in its responses.',
  },
  {
    category: 'Functions',
    question: 'How do I create and assign Custom Functions to my agent?',
    answer:
      'Go to the Custom Functions page and click "Create Function." Define the function name, description, parameters (JSON Schema), and the execution code or API endpoint. Once saved, open your agent\'s configuration and attach the function so the agent can call it during conversations when relevant.',
  },
  {
    category: 'Analytics',
    question: 'Where can I view call data, session transcripts, and performance metrics?',
    answer:
      'The Analytics hub provides a unified view of your platform. The Sessions tab shows individual call recordings and transcripts. The Performance tab tracks success rates, latency, and error breakdowns per agent. The Costs tab displays spending across LLM, TTS, and STT providers over time.',
  },
  {
    category: 'Voice',
    question: 'How do I choose TTS and STT providers in the Voice Library?',
    answer:
      'Open your agent\'s configuration and navigate to the Voice section. You can preview available voices from providers like ElevenLabs, Deepgram, and Google, filtering by language and style. For STT, select a provider based on your latency and accuracy needs. Each provider displays supported languages and estimated cost per minute.',
  },
  {
    category: 'Billing',
    question: 'How are minutes calculated and how do I upgrade my plan?',
    answer:
      'Minutes are measured by the duration of active voice sessions between your agents and callers. Each plan includes a monthly minute allowance. You can view your current usage on the Subscription page and upgrade to a higher tier at any time. Unused minutes do not roll over to the next billing cycle.',
  },
  {
    category: 'Deployment',
    question: 'How do I embed and deploy my agent to a website?',
    answer:
      'After creating your agent, go to its Deploy tab to get the embed code. Copy the script tag and paste it into your website\'s HTML. The Vora widget will appear as a floating button your visitors can click to start a voice conversation. You can customize the widget\'s appearance and position from the deploy settings.',
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
  MCP: Puzzle,
  'Flow Studio': GitBranch,
  Memory: Database,
  Forge: Wand2,
  'Knowledge Base': BookOpen,
  Functions: Code2,
  Analytics: BarChart3,
};

interface GuideCard {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  link: string;
}

const guideCards: GuideCard[] = [
  {
    title: 'Create Your First Agent',
    description: 'Build and configure a voice AI agent in minutes with our step-by-step wizard.',
    icon: Bot,
    link: '/agents/create',
  },
  {
    title: 'Build a Conversation Flow',
    description: 'Design branching dialogue paths with the drag-and-drop Flow Studio canvas.',
    icon: GitBranch,
    link: '/agents',
  },
  {
    title: 'Connect External Tools',
    description: 'Browse the MCP Marketplace and connect third-party tool servers to your agents.',
    icon: Puzzle,
    link: '/integrations/marketplace',
  },
  {
    title: 'Understand Your Calls',
    description: 'Review session transcripts, latency metrics, and cost breakdowns in Analytics.',
    icon: BarChart3,
    link: '/analytics',
  },
];

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

      {/* Guide Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {guideCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} to={card.link}>
              <Card className="h-full hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="p-2 rounded-lg bg-primary/10 w-fit">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base mt-3">{card.title}</CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <CardDescription className="text-sm">{card.description}</CardDescription>
                  <span className="inline-flex items-center gap-1 text-sm text-primary mt-3 font-medium">
                    Get started <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
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
                            <Badge variant="secondary" className="mt-1">
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
