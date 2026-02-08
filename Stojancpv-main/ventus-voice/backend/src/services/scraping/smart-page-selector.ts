/**
 * Smart Page Selector
 * Discovers and prioritizes pages from a website using sitemap parsing and BFS fallback.
 * Used by the brand analysis pipeline to select the most informative pages to scrape.
 *
 * Strategy:
 *   1. Try fetching sitemap.xml (then sitemap_index.xml as fallback)
 *   2. If sitemap unavailable, BFS-crawl from homepage (depth 2)
 *   3. Score all discovered URLs by content priority
 *   4. Return top N URLs sorted by score
 */

import { Logger } from '../../utils/simple-logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageDiscoveryResult {
  /** Prioritized list of URLs to scrape */
  urls: string[];
  /** How the URLs were discovered */
  method: 'sitemap' | 'bfs';
}

export interface PagePriorityOptions {
  /** Maximum number of URLs to return (default: 20) */
  maxPages?: number;
}

interface ScoredUrl {
  url: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_MAX_PAGES = 20;
const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; VoraBot/1.0)';

const logger = new Logger('SmartPageSelector');

// ---------------------------------------------------------------------------
// Priority patterns
// ---------------------------------------------------------------------------

/** P1 paths - high business value (score 100) */
const P1_PATTERNS: RegExp[] = [
  /^\/$/,
  /^\/about/i,
  /^\/services/i,
  /^\/products/i,
  /^\/pricing/i,
  /^\/contact/i,
  /^\/faq/i,
  /^\/team/i,
  /^\/menu/i,
];

/** P2 paths - moderate business value (score 50) */
const P2_PATTERNS: RegExp[] = [
  /^\/features/i,
  /^\/solutions/i,
  /^\/how-it-works/i,
  /^\/plans/i,
  /^\/careers/i,
  /^\/category\//i,
];

/** Noise patterns - URLs to skip entirely */
const NOISE_PATTERNS: RegExp[] = [
  /\/blog\//i,
  /\/tag\//i,
  /\/category\//i,
  /\/page\/\d+/i,
  /\/wp-admin\//i,
  /\/wp-login/i,
  /\/author\//i,
  /\/archive\//i,
];

/** File extensions to skip */
const NOISE_EXTENSIONS: RegExp =
  /\.(pdf|jpg|jpeg|png|gif|svg|webp|zip|tar|gz|css|js|xml|json|ico|woff2?|ttf|eot|mp3|mp4|avi|mov)$/i;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a page's text content with timeout and abort support.
 */
async function fetchPage(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
    });
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Returns true if the URL should be excluded based on noise patterns.
 */
function isNoiseUrl(urlString: string): boolean {
  // Fragment-only or javascript: links
  if (urlString.startsWith('#') || urlString.startsWith('javascript:')) {
    return true;
  }

  let pathname: string;
  try {
    pathname = new URL(urlString).pathname;
  } catch {
    return true;
  }

  // File extension check
  if (NOISE_EXTENSIONS.test(pathname)) {
    return true;
  }

  // Noise path check
  for (const pattern of NOISE_PATTERNS) {
    if (pattern.test(pathname)) {
      return true;
    }
  }

  return false;
}

/**
 * Compute a priority score for a single URL.
 *   P1 = 100, P2 = 50, P3 (everything else) = 10
 */
function scoreUrl(urlString: string, baseUrl: string): number {
  let pathname: string;
  try {
    const parsed = new URL(urlString);
    const baseParsed = new URL(baseUrl);

    // Only score same-origin URLs
    if (parsed.origin !== baseParsed.origin) {
      return 0;
    }

    pathname = parsed.pathname;
  } catch {
    return 0;
  }

  // Normalize trailing slash: "/about/" -> "/about"
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';

  for (const pattern of P1_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return 100;
    }
  }

  for (const pattern of P2_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      return 50;
    }
  }

  return 10;
}

/**
 * Extract `<loc>` values from sitemap XML using regex (no XML parser dependency).
 */
function extractLocsFromXml(xml: string): string[] {
  const locs: string[] = [];
  const locRegex = /<loc>\s*(.*?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;

  while ((match = locRegex.exec(xml)) !== null) {
    const url = match[1].trim();
    if (url) {
      locs.push(url);
    }
  }

  return locs;
}

/**
 * Detect whether XML is a sitemap index (contains `<sitemapindex`).
 */
function isSitemapIndex(xml: string): boolean {
  return /<sitemapindex/i.test(xml);
}

/**
 * Extract href values from anchor tags in HTML using regex.
 * Resolves relative URLs against the base URL and deduplicates.
 */
function extractLinksFromHtml(html: string, pageUrl: string): string[] {
  const links: string[] = [];
  const hrefRegex = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;

  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const rawHref = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) {
      continue;
    }

    try {
      const resolved = new URL(rawHref, pageUrl);
      if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
        continue;
      }
      // Strip fragment
      resolved.hash = '';
      links.push(resolved.toString());
    } catch {
      // Invalid URL, skip
    }
  }

  return Array.from(new Set(links));
}

// ---------------------------------------------------------------------------
// Sitemap discovery
// ---------------------------------------------------------------------------

/**
 * Attempt to fetch and parse a sitemap. Returns URLs or null on failure.
 */
async function fetchSitemap(baseUrl: string): Promise<string[] | null> {
  const sitemapUrls = [
    new URL('/sitemap.xml', baseUrl).toString(),
    new URL('/sitemap_index.xml', baseUrl).toString(),
  ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      logger.info('Attempting sitemap fetch', {
        event: 'sitemap_fetch',
        url: sitemapUrl,
        status: 'attempting',
      });

      const xml = await fetchPage(sitemapUrl);

      // Check if we got actual XML (not an HTML error page)
      if (!xml.includes('<urlset') && !xml.includes('<sitemapindex')) {
        logger.info('Sitemap not found (not valid XML)', {
          event: 'sitemap_fetch',
          url: sitemapUrl,
          status: 'not_found',
        });
        continue;
      }

      // Handle sitemap index: parse only the first child sitemap
      if (isSitemapIndex(xml)) {
        const childSitemapUrls = extractLocsFromXml(xml);
        if (childSitemapUrls.length === 0) {
          logger.info('Sitemap index empty', {
            event: 'sitemap_fetch',
            url: sitemapUrl,
            status: 'not_found',
          });
          continue;
        }

        logger.info('Sitemap index found, fetching first child', {
          event: 'sitemap_fetch',
          url: childSitemapUrls[0],
          status: 'found',
        });

        const childXml = await fetchPage(childSitemapUrls[0]);
        const childLocs = extractLocsFromXml(childXml);

        if (childLocs.length > 0) {
          logger.info('Sitemap URLs extracted from child sitemap', {
            event: 'sitemap_fetch',
            url: sitemapUrl,
            status: 'found',
          });
          return childLocs;
        }

        continue;
      }

      // Regular sitemap
      const locs = extractLocsFromXml(xml);

      if (locs.length > 0) {
        logger.info('Sitemap URLs extracted', {
          event: 'sitemap_fetch',
          url: sitemapUrl,
          status: 'found',
        });
        return locs;
      }

      logger.info('Sitemap parsed but contained no URLs', {
        event: 'sitemap_fetch',
        url: sitemapUrl,
        status: 'not_found',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Sitemap fetch failed', {
        event: 'sitemap_fetch',
        url: sitemapUrl,
        status: 'error',
        error: message,
      });
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// BFS discovery
// ---------------------------------------------------------------------------

/**
 * Discover pages via breadth-first crawl from the homepage (max depth 2).
 * Only follows same-origin links that pass the noise filter.
 */
async function bfsDiscover(baseUrl: string, maxPages: number): Promise<string[]> {
  const baseOrigin = new URL(baseUrl).origin;
  const visited = new Set<string>();
  const discovered: string[] = [];

  // Queue entries: [url, depth]
  const queue: Array<[string, number]> = [[baseUrl, 0]];

  while (queue.length > 0 && discovered.length < maxPages) {
    const entry = queue.shift();
    if (!entry) break;

    const [currentUrl, depth] = entry;

    // Normalize URL for visited check (strip trailing slash for consistency)
    const normalizedUrl = currentUrl.replace(/\/+$/, '') || currentUrl;
    if (visited.has(normalizedUrl)) {
      continue;
    }
    visited.add(normalizedUrl);

    // Skip noise URLs (but always include the base URL itself at depth 0)
    if (depth > 0 && isNoiseUrl(currentUrl)) {
      continue;
    }

    // Ensure same origin
    try {
      if (new URL(currentUrl).origin !== baseOrigin) {
        continue;
      }
    } catch {
      continue;
    }

    discovered.push(currentUrl);

    // Only crawl links up to depth 2
    if (depth >= 2) {
      continue;
    }

    try {
      const html = await fetchPage(currentUrl);
      const links = extractLinksFromHtml(html, currentUrl);

      for (const link of links) {
        const normalizedLink = link.replace(/\/+$/, '') || link;
        if (visited.has(normalizedLink)) {
          continue;
        }

        try {
          if (new URL(link).origin !== baseOrigin) {
            continue;
          }
        } catch {
          continue;
        }

        if (!isNoiseUrl(link)) {
          queue.push([link, depth + 1]);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`BFS failed to fetch ${currentUrl}: ${message}`);
    }
  }

  return discovered;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score and sort URLs by business relevance, returning the top N.
 * The baseUrl is always placed first in the result regardless of score.
 *
 * @param urls     - Raw list of discovered URLs
 * @param baseUrl  - The website's root URL (guaranteed to be first in output)
 * @param maxPages - Maximum number of URLs to return
 * @returns Prioritized URL list
 */
export function prioritizeUrls(urls: string[], baseUrl: string, maxPages: number): string[] {
  // Normalize baseUrl for comparison (strip trailing slash)
  const normalizedBase = baseUrl.replace(/\/+$/, '') || baseUrl;

  // Filter noise and deduplicate
  const seen = new Set<string>();
  const candidates: ScoredUrl[] = [];

  for (const url of urls) {
    const normalizedUrl = url.replace(/\/+$/, '') || url;

    if (seen.has(normalizedUrl)) {
      continue;
    }
    seen.add(normalizedUrl);

    if (isNoiseUrl(url)) {
      continue;
    }

    const score = scoreUrl(url, baseUrl);
    if (score > 0) {
      candidates.push({ url, score });
    }
  }

  // Sort by score descending, then alphabetically for deterministic ordering
  candidates.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.url.localeCompare(b.url);
  });

  // Build result: baseUrl always first
  const result: string[] = [];
  let baseUrlIncluded = false;

  // Check if baseUrl is already in candidates
  for (const candidate of candidates) {
    const normalizedCandidate = candidate.url.replace(/\/+$/, '') || candidate.url;
    if (normalizedCandidate === normalizedBase) {
      result.push(candidate.url);
      baseUrlIncluded = true;
      break;
    }
  }

  // If baseUrl was not in the candidate list, prepend it
  if (!baseUrlIncluded) {
    result.push(baseUrl);
  }

  // Add remaining candidates (skip baseUrl if already added)
  for (const candidate of candidates) {
    if (result.length >= maxPages) {
      break;
    }
    const normalizedCandidate = candidate.url.replace(/\/+$/, '') || candidate.url;
    if (normalizedCandidate === normalizedBase) {
      continue;
    }
    result.push(candidate.url);
  }

  return result.slice(0, maxPages);
}

/**
 * Discover pages from a website, trying sitemap first then BFS fallback.
 *
 * @param baseUrl - The website root URL (e.g. "https://example.com")
 * @param options - Optional configuration
 * @returns Prioritized list of URLs and the discovery method used
 */
export async function discoverPages(
  baseUrl: string,
  options?: PagePriorityOptions
): Promise<PageDiscoveryResult> {
  const maxPages = options?.maxPages ?? DEFAULT_MAX_PAGES;
  const startTime = Date.now();

  // Strategy 1: Try sitemap
  const sitemapUrls = await fetchSitemap(baseUrl);

  if (sitemapUrls !== null && sitemapUrls.length > 0) {
    const prioritized = prioritizeUrls(sitemapUrls, baseUrl, maxPages);
    const durationMs = Date.now() - startTime;

    logger.info('Page discovery complete', {
      event: 'discovery_complete',
      baseUrl,
      pagesDiscovered: prioritized.length,
      method: 'sitemap',
      durationMs,
    });

    return { urls: prioritized, method: 'sitemap' };
  }

  // Strategy 2: BFS fallback
  logger.info('No sitemap found, falling back to BFS discovery');
  const bfsUrls = await bfsDiscover(baseUrl, maxPages * 3); // discover more than needed, then prioritize
  const prioritized = prioritizeUrls(bfsUrls, baseUrl, maxPages);
  const durationMs = Date.now() - startTime;

  logger.info('Page discovery complete', {
    event: 'discovery_complete',
    baseUrl,
    pagesDiscovered: prioritized.length,
    method: 'bfs',
    durationMs,
  });

  return { urls: prioritized, method: 'bfs' };
}
