/**
 * Vora Documentation Navigation Agent
 *
 * Embeddable voice agent widget for docs.voicevora.com
 * Helps users navigate documentation using voice or text.
 *
 * Part of Phase 1 - P0 Journey (P0J-15)
 *
 * Usage:
 * <script src="https://docs.voicevora.com/vora-docs-agent.js"></script>
 * <script>
 *   VoraDocsAgent.init({
 *     agentId: 'YOUR_AGENT_ID',
 *     position: 'bottom-right',
 *     theme: 'dark',
 *   });
 * </script>
 */

(function (window, document) {
  'use strict';

  // Default configuration
  const DEFAULT_CONFIG = {
    agentId: null, // Must be provided by user
    apiUrl: 'https://vora-backend.fly.dev',
    position: 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    theme: 'dark', // 'dark' | 'light'
    primaryColor: '#99CDFF',
    openByDefault: false,
    showWelcomeMessage: true,
    allowVoice: true,
    allowText: true,
  };

  let config = { ...DEFAULT_CONFIG };
  let isInitialized = false;
  let container = null;
  let widget = null;
  let isOpen = false;

  /**
   * Initialize the Vora Docs Agent
   */
  function init(userConfig = {}) {
    if (isInitialized) {
      console.warn('[VoraDocsAgent] Already initialized');
      return;
    }

    config = { ...DEFAULT_CONFIG, ...userConfig };

    if (!config.agentId) {
      console.error('[VoraDocsAgent] agentId is required');
      return;
    }

    createWidget();
    injectStyles();
    attachEventListeners();

    isInitialized = true;

    if (config.openByDefault) {
      open();
    }
  }

  /**
   * Create the widget DOM structure (safe - no user input)
   */
  function createWidget() {
    // Container
    container = document.createElement('div');
    container.id = 'vora-docs-agent';
    container.className = `vora-docs-agent vora-docs-agent-${config.position} vora-docs-agent-${config.theme}`;
    container.setAttribute('aria-label', 'Documentation Assistant');
    container.setAttribute('role', 'complementary');

    // Create widget structure
    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'vora-docs-agent-widget';
    widgetDiv.style.display = 'none';

    // Header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'vora-docs-agent-header';

    const titleDiv = document.createElement('div');
    titleDiv.className = 'vora-docs-agent-title';
    const iconSvg = createIconSVG();
    const titleSpan = document.createElement('span');
    titleSpan.textContent = 'Docs Assistant';
    titleDiv.appendChild(iconSvg);
    titleDiv.appendChild(titleSpan);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'vora-docs-agent-close';
    closeBtn.setAttribute('aria-label', 'Close assistant');
    closeBtn.appendChild(createCloseSVG());

    headerDiv.appendChild(titleDiv);
    headerDiv.appendChild(closeBtn);

    // Content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'vora-docs-agent-content';

    const messagesDiv = document.createElement('div');
    messagesDiv.id = 'vora-docs-agent-messages';
    messagesDiv.className = 'vora-docs-agent-messages';

    // Welcome message
    if (config.showWelcomeMessage) {
      const welcomeMsg = createMessageElement(
        '👋 Hi! I\'m your Vora documentation assistant. Ask me anything about Vora\'s features, APIs, or how to get started.',
        'bot',
      );
      messagesDiv.appendChild(welcomeMsg);
    }

    // Input container
    const inputContainer = document.createElement('div');
    inputContainer.className = 'vora-docs-agent-input-container';

    if (config.allowVoice) {
      const voiceBtn = document.createElement('button');
      voiceBtn.className = 'vora-docs-agent-voice-btn';
      voiceBtn.setAttribute('aria-label', 'Voice input');
      voiceBtn.setAttribute('data-recording', 'false');
      voiceBtn.appendChild(createMicSVG());
      voiceBtn.appendChild(createRecordingSVG());
      inputContainer.appendChild(voiceBtn);
    }

    if (config.allowText) {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'vora-docs-agent-input';
      input.placeholder = 'Ask about Vora docs...';
      input.setAttribute('aria-label', 'Type your question');

      const sendBtn = document.createElement('button');
      sendBtn.className = 'vora-docs-agent-send-btn';
      sendBtn.setAttribute('aria-label', 'Send message');
      sendBtn.appendChild(createSendSVG());

      inputContainer.appendChild(input);
      inputContainer.appendChild(sendBtn);
    }

    contentDiv.appendChild(messagesDiv);
    contentDiv.appendChild(inputContainer);

    widgetDiv.appendChild(headerDiv);
    widgetDiv.appendChild(contentDiv);

    // Trigger button
    const triggerBtn = document.createElement('button');
    triggerBtn.className = 'vora-docs-agent-trigger';
    triggerBtn.setAttribute('aria-label', 'Open documentation assistant');
    const triggerIconOpen = createChatSVG();
    triggerIconOpen.className = 'vora-docs-agent-trigger-icon';
    const triggerIconClose = createCloseSVG();
    triggerIconClose.className = 'vora-docs-agent-trigger-close';
    triggerIconClose.style.display = 'none';
    triggerBtn.appendChild(triggerIconOpen);
    triggerBtn.appendChild(triggerIconClose);

    container.appendChild(widgetDiv);
    container.appendChild(triggerBtn);

    document.body.appendChild(container);
    widget = widgetDiv;
  }

  /**
   * Create SVG icons (safe - no user input)
   */
  function createIconSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'vora-docs-agent-icon');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '10');

    svg.appendChild(circle);
    return svg;
  }

  function createCloseSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');

    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '18');
    line1.setAttribute('y1', '6');
    line1.setAttribute('x2', '6');
    line1.setAttribute('y2', '18');

    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', '6');
    line2.setAttribute('y1', '6');
    line2.setAttribute('x2', '18');
    line2.setAttribute('y2', '18');

    svg.appendChild(line1);
    svg.appendChild(line2);
    return svg;
  }

  function createMicSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'vora-docs-agent-voice-icon');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z');
    svg.appendChild(path);
    return svg;
  }

  function createRecordingSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'vora-docs-agent-voice-recording');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'currentColor');

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', '12');
    circle.setAttribute('cy', '12');
    circle.setAttribute('r', '8');

    svg.appendChild(circle);
    return svg;
  }

  function createSendSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '22');
    line.setAttribute('y1', '2');
    line.setAttribute('x2', '11');
    line.setAttribute('y2', '13');

    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', '22 2 15 22 11 13 2 9 22 2');

    svg.appendChild(line);
    svg.appendChild(polygon);
    return svg;
  }

  function createChatSVG() {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '24');
    svg.setAttribute('height', '24');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');

    svg.appendChild(path);
    return svg;
  }

  /**
   * Create message element (safe - escapes user text)
   */
  function createMessageElement(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `vora-docs-agent-message vora-docs-agent-message-${sender}`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'vora-docs-agent-message-content';

    const p = document.createElement('p');
    p.textContent = text; // Safe - uses textContent not innerHTML

    contentDiv.appendChild(p);
    messageDiv.appendChild(contentDiv);

    return messageDiv;
  }

  /**
   * Inject CSS styles
   */
  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .vora-docs-agent {
        --vora-primary: ${config.primaryColor};
        --vora-bg: ${config.theme === 'dark' ? '#121212' : '#ffffff'};
        --vora-surface: ${config.theme === 'dark' ? '#1a1a1a' : '#f5f5f5'};
        --vora-text: ${config.theme === 'dark' ? '#ededed' : '#1a1a1a'};
        --vora-text-muted: ${config.theme === 'dark' ? '#a1a1aa' : '#6b7280'};
        --vora-border: ${config.theme === 'dark' ? '#27272a' : '#e5e7eb'};
        position: fixed;
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      }
      .vora-docs-agent-bottom-right { bottom: 24px; right: 24px; }
      .vora-docs-agent-bottom-left { bottom: 24px; left: 24px; }
      .vora-docs-agent-top-right { top: 24px; right: 24px; }
      .vora-docs-agent-top-left { top: 24px; left: 24px; }
      .vora-docs-agent-trigger {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: var(--vora-primary);
        border: none;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        transition: transform 0.2s, box-shadow 0.2s;
        color: #000;
      }
      .vora-docs-agent-trigger:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(153, 205, 255, 0.4);
      }
      .vora-docs-agent-widget {
        position: absolute;
        bottom: 80px;
        right: 0;
        width: 400px;
        max-width: calc(100vw - 48px);
        height: 600px;
        max-height: calc(100vh - 120px);
        background: var(--vora-bg);
        border: 1px solid var(--vora-border);
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .vora-docs-agent-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px;
        background: var(--vora-surface);
        border-bottom: 1px solid var(--vora-border);
      }
      .vora-docs-agent-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        color: var(--vora-text);
      }
      .vora-docs-agent-close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--vora-text-muted);
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .vora-docs-agent-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .vora-docs-agent-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .vora-docs-agent-message {
        display: flex;
        gap: 8px;
      }
      .vora-docs-agent-message-content {
        background: var(--vora-surface);
        padding: 12px;
        border-radius: 12px;
        color: var(--vora-text);
        max-width: 80%;
      }
      .vora-docs-agent-message-content p {
        margin: 0;
      }
      .vora-docs-agent-input-container {
        display: flex;
        gap: 8px;
        padding: 16px;
        border-top: 1px solid var(--vora-border);
        background: var(--vora-surface);
      }
      .vora-docs-agent-input {
        flex: 1;
        padding: 10px 12px;
        background: var(--vora-bg);
        border: 1px solid var(--vora-border);
        border-radius: 8px;
        color: var(--vora-text);
        font-size: 14px;
      }
      .vora-docs-agent-input:focus {
        outline: none;
        border-color: var(--vora-primary);
      }
      .vora-docs-agent-voice-btn,
      .vora-docs-agent-send-btn {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--vora-primary);
        padding: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .vora-docs-agent-voice-recording {
        display: none;
      }
      .vora-docs-agent-voice-btn[data-recording="true"] .vora-docs-agent-voice-icon {
        display: none;
      }
      .vora-docs-agent-voice-btn[data-recording="true"] .vora-docs-agent-voice-recording {
        display: block;
        animation: pulse 1.5s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      @media (max-width: 480px) {
        .vora-docs-agent-widget {
          width: calc(100vw - 32px);
          height: calc(100vh - 100px);
          bottom: 16px;
          right: 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Attach event listeners
   */
  function attachEventListeners() {
    const trigger = container.querySelector('.vora-docs-agent-trigger');
    const closeBtn = container.querySelector('.vora-docs-agent-close');
    const input = container.querySelector('.vora-docs-agent-input');
    const sendBtn = container.querySelector('.vora-docs-agent-send-btn');
    const voiceBtn = container.querySelector('.vora-docs-agent-voice-btn');

    trigger.addEventListener('click', toggle);
    closeBtn.addEventListener('click', close);

    if (sendBtn) {
      sendBtn.addEventListener('click', handleSendMessage);
    }

    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          handleSendMessage();
        }
      });
    }

    if (voiceBtn) {
      voiceBtn.addEventListener('click', handleVoiceToggle);
    }
  }

  /**
   * Toggle widget visibility
   */
  function toggle() {
    isOpen ? close() : open();
  }

  /**
   * Open widget
   */
  function open() {
    widget.style.display = 'flex';
    isOpen = true;
    const triggerIcon = container.querySelector('.vora-docs-agent-trigger-icon');
    const triggerClose = container.querySelector('.vora-docs-agent-trigger-close');
    triggerIcon.style.display = 'none';
    triggerClose.style.display = 'block';
  }

  /**
   * Close widget
   */
  function close() {
    widget.style.display = 'none';
    isOpen = false;
    const triggerIcon = container.querySelector('.vora-docs-agent-trigger-icon');
    const triggerClose = container.querySelector('.vora-docs-agent-trigger-close');
    triggerIcon.style.display = 'block';
    triggerClose.style.display = 'none';
  }

  /**
   * Handle send message
   */
  function handleSendMessage() {
    const input = container.querySelector('.vora-docs-agent-input');
    const message = input.value.trim();

    if (!message) return;

    addMessage(message, 'user');
    input.value = '';

    // TODO: Send to Vora API
    setTimeout(() => {
      addMessage(
        'This feature is coming soon! For now, please browse the documentation manually.',
        'bot',
      );
    }, 500);
  }

  /**
   * Handle voice toggle
   */
  function handleVoiceToggle() {
    const voiceBtn = container.querySelector('.vora-docs-agent-voice-btn');
    const isRecording = voiceBtn.getAttribute('data-recording') === 'true';

    if (isRecording) {
      voiceBtn.setAttribute('data-recording', 'false');
      // TODO: Stop recording
    } else {
      voiceBtn.setAttribute('data-recording', 'true');
      // TODO: Start recording
    }
  }

  /**
   * Add message to chat (safe - uses createMessageElement)
   */
  function addMessage(text, sender) {
    const messagesContainer = container.querySelector('.vora-docs-agent-messages');
    const messageElement = createMessageElement(text, sender);
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Public API
  window.VoraDocsAgent = {
    init,
    open,
    close,
    toggle,
  };
})(window, document);
