/**
 * Embed Code Generator
 * Generates HTML/JS embed code for voice agents
 */

export interface EmbedOptions {
  theme?: 'light' | 'dark' | 'auto';
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
  avatar?: string;
}

/**
 * Generates standard embed code for an agent
 */
export function generateEmbedCode(agentId: string): string {
  const cdnUrl =
    process.env.CDN_URL || 'https://cdn.voicevora.com/embed/v1';

  return `<!-- Vora Voice Widget -->
<script
  src="${cdnUrl}/vora-widget.js"
  data-agent-id="${agentId}"
  data-theme="auto"
  data-position="bottom-right"
  async
></script>`;
}

/**
 * Generates customized embed code with options
 */
export function generateCustomEmbedCode(
  agentId: string,
  options: EmbedOptions
): string {
  const cdnUrl =
    process.env.CDN_URL || 'https://cdn.voicevora.com/embed/v1';

  const attrs = Object.entries(options)
    .map(([key, value]) => `data-${key}="${value}"`)
    .join('\n  ');

  return `<!-- Vora Voice Widget -->
<script
  src="${cdnUrl}/vora-widget.js"
  data-agent-id="${agentId}"
  ${attrs}
  async
></script>`;
}

/**
 * Generates programmatic initialization code
 */
export function generateProgrammaticEmbedCode(agentId: string): string {
  const cdnUrl =
    process.env.CDN_URL || 'https://cdn.voicevora.com/embed/v1';
  const apiUrl = process.env.API_URL || 'https://api.voicevora.com';

  return `<!-- Vora Voice Widget (Programmatic) -->
<script src="${cdnUrl}/vora-widget.js"></script>
<div id="vora-agent"></div>

<script>
  const agent = new VoraWidget({
    agentId: '${agentId}',
    apiUrl: '${apiUrl}',
    container: '#vora-agent',
    theme: 'auto',
    position: 'bottom-right',
    // Optional customization:
    // primaryColor: '#6366f1',
    // avatar: 'https://your-site.com/avatar.png',
    // greeting: 'Hi! How can I help you today?',
  });
</script>`;
}

/**
 * Generates React component embed code
 */
export function generateReactEmbedCode(agentId: string): string {
  return `import { VoraWidget } from '@voicevora/react';

function App() {
  return (
    <div>
      <VoraWidget
        agentId="${agentId}"
        theme="auto"
        position="bottom-right"
      />
    </div>
  );
}`;
}
