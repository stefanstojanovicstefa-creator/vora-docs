/**
 * Embed Snippets Page
 *
 * Deployment page for generating embed code snippets.
 * User selects an agent, chooses embed format (Script tag, Iframe, React component),
 * customizes options (theme, position, size), and copies the snippet.
 * Includes a live preview panel.
 *
 * Route: /deploy/embed
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Code2,
  Copy,
  Check,
  ChevronLeft,
  Bot,
  Palette,
  Maximize2,
  Layout,
  Monitor,
  Smartphone,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Label } from '../components/ui/label';
import { apiClient } from '../lib/api-client';

// ============================================================================
// TYPES
// ============================================================================

interface AgentListItem {
  id: string;
  name: string;
  status: string;
}

interface AgentsResponse {
  success: boolean;
  agents: AgentListItem[];
}

type EmbedTheme = 'light' | 'dark' | 'auto';
type EmbedPosition = 'bottom-right' | 'bottom-left' | 'center' | 'full';
type EmbedSize = 'small' | 'medium' | 'large';

const SIZE_MAP: Record<EmbedSize, { width: string; height: string }> = {
  small: { width: '350', height: '500' },
  medium: { width: '400', height: '600' },
  large: { width: '500', height: '700' },
};

const POSITION_STYLES: Record<EmbedPosition, string> = {
  'bottom-right': 'position:fixed;bottom:20px;right:20px;z-index:9999;',
  'bottom-left': 'position:fixed;bottom:20px;left:20px;z-index:9999;',
  center: 'margin:0 auto;display:block;',
  full: 'width:100%;height:100vh;',
};

// ============================================================================
// SNIPPET GENERATORS
// ============================================================================

function generateScriptSnippet(
  agentId: string,
  theme: EmbedTheme,
  position: EmbedPosition,
  size: EmbedSize
): string {
  const { width, height } = SIZE_MAP[size];
  const posStyle = POSITION_STYLES[position];
  const fullWidth = position === 'full';

  return `<!-- Vora Voice Agent Widget -->
<script>
  (function() {
    var d = document, s = d.createElement('div');
    s.id = 'vora-widget-${agentId.slice(0, 8)}';
    ${fullWidth ? "s.style.cssText = 'width:100%;height:100vh;';" : `s.style.cssText = '${posStyle}';`}
    d.body.appendChild(s);

    var f = d.createElement('iframe');
    f.src = 'https://app.vora.ai/orb-preview?agentId=${agentId}&theme=${theme}';
    f.width = '${fullWidth ? '100%' : width}';
    f.height = '${fullWidth ? '100%' : height}';
    f.frameBorder = '0';
    f.allow = 'microphone; autoplay';
    f.style.border = 'none';
    f.style.borderRadius = '${fullWidth ? '0' : '12px'}';
    f.style.boxShadow = '${fullWidth ? 'none' : '0 8px 32px rgba(0,0,0,0.12)'}';
    s.appendChild(f);
  })();
</script>`;
}

function generateIframeSnippet(
  agentId: string,
  theme: EmbedTheme,
  _position: EmbedPosition,
  size: EmbedSize
): string {
  const { width, height } = SIZE_MAP[size];

  return `<!-- Vora Voice Agent (Iframe) -->
<iframe
  src="https://app.vora.ai/orb-preview?agentId=${agentId}&theme=${theme}"
  width="${width}"
  height="${height}"
  frameborder="0"
  allow="microphone; autoplay"
  style="border: none; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);"
  title="Vora Voice Agent"
></iframe>`;
}

function generateReactSnippet(
  agentId: string,
  theme: EmbedTheme,
  _position: EmbedPosition,
  size: EmbedSize
): string {
  const { width, height } = SIZE_MAP[size];

  return `// Vora Voice Agent Component
// npm install (no dependencies required)

interface VoraAgentProps {
  className?: string;
}

export function VoraAgent({ className }: VoraAgentProps) {
  return (
    <iframe
      src="https://app.vora.ai/orb-preview?agentId=${agentId}&theme=${theme}"
      width="${width}"
      height="${height}"
      frameBorder="0"
      allow="microphone; autoplay"
      title="Vora Voice Agent"
      className={className}
      style={{
        border: 'none',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}
    />
  );
}

// Usage in your app:
// import { VoraAgent } from './VoraAgent';
// <VoraAgent />`;
}

// ============================================================================
// SYNTAX HIGHLIGHTING (simple token-based)
// ============================================================================

function highlightCode(code: string, language: 'html' | 'jsx'): React.ReactNode[] {
  if (language === 'html') {
    return code.split('\n').map((line, i) => {
      const highlighted = line
        .replace(/(\/\/.*$)/gm, '<cmt>$1</cmt>')
        .replace(/(&lt;!--.*?--&gt;|<!--.*?-->)/g, '<cmt>$1</cmt>')
        .replace(/('https?:\/\/[^']*'|'[^']*')/g, '<str>$1</str>')
        .replace(/(var|const|let|function|document)\b/g, '<kw>$1</kw>');

      return (
        <span key={i}>
          {highlighted.split(/(<cmt>.*?<\/cmt>|<str>.*?<\/str>|<kw>.*?<\/kw>)/g).map((part, j) => {
            if (part.startsWith('<cmt>'))
              return <span key={j} className="text-emerald-600 dark:text-emerald-400">{part.slice(5, -6)}</span>;
            if (part.startsWith('<str>'))
              return <span key={j} className="text-amber-600 dark:text-amber-400">{part.slice(5, -6)}</span>;
            if (part.startsWith('<kw>'))
              return <span key={j} className="text-violet-600 dark:text-violet-400">{part.slice(4, -5)}</span>;
            return <span key={j}>{part}</span>;
          })}
          {'\n'}
        </span>
      );
    });
  }

  // JSX/TSX
  return code.split('\n').map((line, i) => {
    const highlighted = line
      .replace(/(\/\/.*$)/gm, '<cmt>$1</cmt>')
      .replace(/("https?:\/\/[^"]*"|"[^"]*"|'[^']*')/g, '<str>$1</str>')
      .replace(/(import|export|function|const|interface|return)\b/g, '<kw>$1</kw>')
      .replace(/(\{|\})/g, '<br>$1</br>');

    return (
      <span key={i}>
        {highlighted.split(/(<cmt>.*?<\/cmt>|<str>.*?<\/str>|<kw>.*?<\/kw>|<br>.*?<\/br>)/g).map((part, j) => {
          if (part.startsWith('<cmt>'))
            return <span key={j} className="text-emerald-600 dark:text-emerald-400">{part.slice(5, -6)}</span>;
          if (part.startsWith('<str>'))
            return <span key={j} className="text-amber-600 dark:text-amber-400">{part.slice(5, -6)}</span>;
          if (part.startsWith('<kw>'))
            return <span key={j} className="text-violet-600 dark:text-violet-400">{part.slice(4, -5)}</span>;
          if (part.startsWith('<br>'))
            return <span key={j} className="text-sky-600 dark:text-sky-400">{part.slice(4, -5)}</span>;
          return <span key={j}>{part}</span>;
        })}
        {'\n'}
      </span>
    );
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function EmbedSnippetsPage() {
  const navigate = useNavigate();

  // State
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [embedTab, setEmbedTab] = useState<string>('script');
  const [theme, setTheme] = useState<EmbedTheme>('dark');
  const [position, setPosition] = useState<EmbedPosition>('bottom-right');
  const [size, setSize] = useState<EmbedSize>('medium');
  const [copied, setCopied] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Fetch agents
  const { data: agentsData, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents-for-embed'],
    queryFn: () => apiClient.get<AgentsResponse>('/api/agents?limit=100'),
  });

  const agents = agentsData?.agents?.filter(a => a.status === 'ACTIVE') ?? [];

  // Generate snippet
  const snippet = useMemo(() => {
    if (!selectedAgentId) return '';
    switch (embedTab) {
      case 'script':
        return generateScriptSnippet(selectedAgentId, theme, position, size);
      case 'iframe':
        return generateIframeSnippet(selectedAgentId, theme, position, size);
      case 'react':
        return generateReactSnippet(selectedAgentId, theme, position, size);
      default:
        return '';
    }
  }, [selectedAgentId, embedTab, theme, position, size]);

  const snippetLanguage: 'html' | 'jsx' = embedTab === 'react' ? 'jsx' : 'html';

  // Copy handler
  const handleCopy = () => {
    if (!snippet) return;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    toast.success('Snippet copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Preview dimensions
  const previewDims = SIZE_MAP[size];
  const previewWidth = previewDevice === 'mobile' ? '320' : previewDims.width;
  const previewHeight = previewDevice === 'mobile' ? '480' : previewDims.height;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            Embed Your Agent
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate code snippets to embed your voice agent on any website
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-2 space-y-6">
          {/* Agent Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Select Agent
              </CardTitle>
              <CardDescription>Choose which agent to embed on your website</CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={agentsLoading ? 'Loading agents...' : 'Select an agent'} />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      {agent.name}
                    </SelectItem>
                  ))}
                  {agents.length === 0 && !agentsLoading && (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                      No active agents found
                    </div>
                  )}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Customization Options */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" />
                Customization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Theme</Label>
                  <Select value={theme} onValueChange={(v) => setTheme(v as EmbedTheme)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="auto">Auto (system)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select value={position} onValueChange={(v) => setPosition(v as EmbedPosition)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bottom-right">Bottom Right</SelectItem>
                      <SelectItem value="bottom-left">Bottom Left</SelectItem>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="full">Full Page</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Size</Label>
                  <Select value={size} onValueChange={(v) => setSize(v as EmbedSize)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small (350x500)</SelectItem>
                      <SelectItem value="medium">Medium (400x600)</SelectItem>
                      <SelectItem value="large">Large (500x700)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Embed Format Tabs + Code */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layout className="h-4 w-4" />
                Embed Code
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={embedTab} onValueChange={setEmbedTab}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="script">Script Tag</TabsTrigger>
                  <TabsTrigger value="iframe">Iframe</TabsTrigger>
                  <TabsTrigger value="react">React</TabsTrigger>
                </TabsList>

                <TabsContent value="script" className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Simplest integration. Paste this script tag before the closing <code className="px-1 py-0.5 bg-muted rounded text-[10px]">&lt;/body&gt;</code> tag.
                  </p>
                </TabsContent>

                <TabsContent value="iframe" className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    Sandboxed embed. The agent runs in an isolated iframe with its own security context.
                  </p>
                </TabsContent>

                <TabsContent value="react" className="mt-4">
                  <p className="text-xs text-muted-foreground mb-3">
                    For React/Next.js apps. Copy this component into your project and import it wherever needed.
                  </p>
                </TabsContent>
              </Tabs>

              {/* Code Block */}
              {selectedAgentId ? (
                <div className="relative mt-2">
                  <pre className="bg-[hsl(var(--void,220_20%_5%))] text-foreground p-4 rounded-lg overflow-x-auto text-xs font-mono leading-relaxed max-h-80 border">
                    <code>{highlightCode(snippet, snippetLanguage)}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 mr-1" />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="mt-2 border border-dashed rounded-lg p-8 text-center">
                  <Bot className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Select an agent above to generate embed code</p>
                </div>
              )}

              {/* Integration Notes */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-900 dark:text-blue-300 font-medium mb-1">
                  Integration Notes:
                </p>
                <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-0.5 list-disc list-inside">
                  <li>HTTPS is required for microphone access</li>
                  <li>The widget requests microphone permission when the user starts a conversation</li>
                  <li>Fully responsive and mobile-friendly</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview */}
        <div className="space-y-4">
          <Card className="sticky top-24">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Maximize2 className="h-4 w-4" />
                  Preview
                </CardTitle>
                <div className="flex gap-1">
                  <Button
                    variant={previewDevice === 'desktop' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPreviewDevice('desktop')}
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant={previewDevice === 'mobile' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setPreviewDevice('mobile')}
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <CardDescription>See how the widget will look on your site</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className={`
                  relative rounded-lg overflow-hidden border-2 border-dashed transition-all mx-auto
                  ${theme === 'dark' ? 'bg-zinc-900 border-zinc-700' : theme === 'light' ? 'bg-white border-zinc-300' : 'bg-muted border-border'}
                `}
                style={{
                  width: `${Math.min(parseInt(previewWidth), 400)}px`,
                  height: `${Math.min(parseInt(previewHeight), 500)}px`,
                }}
              >
                {selectedAgentId ? (
                  <>
                    {/* Simulated website content */}
                    <div className="p-3 space-y-2 opacity-30">
                      <div className={`h-3 rounded ${theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`} style={{ width: '60%' }} />
                      <div className={`h-2 rounded ${theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`} style={{ width: '80%' }} />
                      <div className={`h-2 rounded ${theme === 'dark' ? 'bg-zinc-700' : 'bg-zinc-200'}`} style={{ width: '45%' }} />
                    </div>

                    {/* Widget preview */}
                    <div
                      className={`
                        absolute
                        ${position === 'bottom-right' ? 'bottom-3 right-3' : ''}
                        ${position === 'bottom-left' ? 'bottom-3 left-3' : ''}
                        ${position === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' : ''}
                        ${position === 'full' ? 'inset-0' : ''}
                      `}
                    >
                      <div
                        className={`
                          ${position === 'full' ? 'w-full h-full' : 'w-16 h-16'}
                          rounded-full bg-gradient-to-br from-primary to-primary/70
                          flex items-center justify-center
                          shadow-lg shadow-primary/20
                          ${position === 'full' ? 'rounded-none' : ''}
                        `}
                      >
                        {position === 'full' ? (
                          <div className="text-center">
                            <div className="w-20 h-20 rounded-full bg-primary/30 mx-auto mb-2 flex items-center justify-center">
                              <Bot className="h-10 w-10 text-primary-foreground" />
                            </div>
                            <p className="text-xs text-primary-foreground/80">Voice Agent</p>
                          </div>
                        ) : (
                          <Bot className="h-7 w-7 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-2 opacity-30" />
                      <p className="text-xs text-muted-foreground">Select an agent to preview</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedAgentId && (
                <div className="mt-3 text-xs text-muted-foreground text-center">
                  {previewDims.width}x{previewDims.height}px &middot; {theme} theme &middot; {position.replace('-', ' ')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
