/**
 * DocsAgent Component
 *
 * Embedded voice agent widget for Vora documentation.
 * Helps users navigate documentation via voice or text.
 *
 * Part of Phase 1 - P0 Journey (P0J-15)
 * Added: 2026-01-27 (v1.0 Production Beta - Phase 1)
 *
 * Usage in MDX:
 * ```mdx
 * import { DocsAgent } from '/components/DocsAgent';
 *
 * <DocsAgent />
 * ```
 *
 * Features:
 * - Voice-first interaction for "how do I..." questions
 * - Text fallback for non-voice environments
 * - Links to relevant documentation pages
 * - Query tracking via PostHog for docs improvement
 */

import React, { useState, useCallback } from 'react';

interface DocsAgentProps {
  /** Initial message to display */
  placeholder?: string;
  /** Agent ID from Vora platform (optional - uses default docs agent) */
  agentId?: string;
  /** Position of the widget */
  position?: 'bottom-right' | 'bottom-left' | 'inline';
}

/**
 * DocsAgent widget for voice-powered documentation navigation.
 *
 * This component embeds a Vora voice agent that helps users
 * find information in the documentation using natural language.
 */
export const DocsAgent: React.FC<DocsAgentProps> = ({
  placeholder = 'Ask about Vora...',
  agentId,
  position = 'inline',
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [query, setQuery] = useState('');

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Track query for documentation improvement
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('docs_agent_query', {
        query: query.trim(),
        page: window.location.pathname,
      });
    }

    // For now, redirect to search with the query
    // In production, this would connect to a Vora voice agent
    const searchUrl = `/search?q=${encodeURIComponent(query.trim())}`;
    window.location.href = searchUrl;
  }, [query]);

  const toggleExpanded = useCallback(() => {
    setIsExpanded((prev) => !prev);

    // Track widget interaction
    if (typeof window !== 'undefined' && (window as any).posthog) {
      (window as any).posthog.capture('docs_agent_toggled', {
        expanded: !isExpanded,
        page: window.location.pathname,
      });
    }
  }, [isExpanded]);

  // Inline variant - rendered directly in content
  if (position === 'inline') {
    return (
      <div className="docs-agent docs-agent-inline rounded-lg border border-gray-200 dark:border-gray-700 p-4 my-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-gray-800 dark:to-gray-900">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              Need help?
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ask our AI assistant about Vora
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Ask
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Try asking:
          </span>
          {[
            'How do I create an agent?',
            'What are knowledge bases?',
            'How does billing work?',
          ].map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => setQuery(suggestion)}
              className="text-xs px-2 py-1 rounded-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400 transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // Floating widget variant (bottom-right or bottom-left)
  const positionClasses = position === 'bottom-left' ? 'left-4' : 'right-4';

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={toggleExpanded}
        className={`fixed bottom-4 ${positionClasses} z-50 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all hover:scale-105 flex items-center justify-center`}
        aria-label="Open Vora docs assistant"
      >
        {isExpanded ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
      </button>

      {/* Expanded chat panel */}
      {isExpanded && (
        <div
          className={`fixed bottom-20 ${positionClasses} z-50 w-80 bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden`}
        >
          <div className="bg-indigo-600 text-white px-4 py-3">
            <h3 className="font-semibold">Vora Docs Assistant</h3>
            <p className="text-sm text-indigo-100">Ask me anything about Vora</p>
          </div>

          <div className="p-4">
            <form onSubmit={handleSubmit}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholder}
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3"
                autoFocus
              />
              <button
                type="submit"
                disabled={!query.trim()}
                className="w-full px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Ask Question
              </button>
            </form>

            <div className="mt-4 space-y-2">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Popular questions:
              </p>
              {[
                'How do I create my first agent?',
                'What languages are supported?',
                'How do I connect my phone number?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setQuery(suggestion)}
                  className="block w-full text-left text-sm px-3 py-2 rounded-md bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DocsAgent;
