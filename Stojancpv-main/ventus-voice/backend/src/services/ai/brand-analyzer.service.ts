/**
 * Brand Analyzer Service
 * Orchestrates the complete brand analysis pipeline:
 * 1. Scrape website with Playwright
 * 2. Analyze with GPT-OSS-120B via OpenRouter (free tier, 128K context, JSON mode)
 * 3. Store results in database
 */

import { getPlaywrightScraperService } from '../scraping/playwright-scraper.service';
import { createOpenRouterService, OpenRouterService } from './openrouter.service';
import { Logger } from '../../utils/simple-logger';
import { createLogger } from '../../utils/logger';

const logger = createLogger('BrandAnalyzerService');
import {
  BrandAnalysisRequest,
  BrandAnalysisResult,
  BrandAnalysisStatus,
  BrandAnalysisProgress,
} from '../../types/brand-analysis.types';

export interface BrandAnalyzerOptions {
  maxPages?: number; // Maximum pages to scrape (default: 90)
  scrapingTimeout?: number; // Timeout per page in ms (default: 30000)
  routewayApiKey?: string; // Routeway API key (optional, falls back to env)
  onProgress?: (progress: BrandAnalysisProgress) => void; // Progress callback
  signal?: AbortSignal; // AbortSignal for job-level timeout cancellation
}

export class BrandAnalyzerService {
  private scraper: ReturnType<typeof getPlaywrightScraperService>;
  private openRouter: OpenRouterService;
  private logger: Logger;
  private options: Required<Omit<BrandAnalyzerOptions, 'routewayApiKey' | 'onProgress' | 'signal'>> & {
    onProgress?: (progress: BrandAnalysisProgress) => void;
    signal?: AbortSignal;
  };

  constructor(options: BrandAnalyzerOptions = {}) {
    this.scraper = getPlaywrightScraperService();
    this.openRouter = createOpenRouterService({
      apiKey: options.routewayApiKey,
    });
    this.logger = new Logger('BrandAnalyzerService');

    this.options = {
      maxPages: options.maxPages || 90,
      scrapingTimeout: options.scrapingTimeout || 30000,
      onProgress: options.onProgress,
      signal: options.signal,
    };
  }

  /**
   * Analyze a brand from website URL
   */
  async analyzeBrand(
    request: Pick<BrandAnalysisRequest, 'websiteUrl' | 'customerId'>
  ): Promise<BrandAnalysisResult> {
    const startTime = Date.now();
    const brandId = this.generateBrandId();

    try {
      this.logger.info(`Starting brand analysis for ${request.websiteUrl}`);

      // Step 1: Scraping
      this.reportProgress(
        brandId,
        BrandAnalysisStatus.SCRAPING,
        10,
        'Discovering and scraping website pages...'
      );

      const scrapeResult = await this.scraper.smartScrapeWebsite(request.websiteUrl, {
        maxPages: this.options.maxPages,
        timeout: this.options.scrapingTimeout,
        signal: this.options.signal,
      });

      if (scrapeResult.successCount === 0) {
        throw new Error('Failed to scrape any pages from the website');
      }

      this.logger.info(
        `Scraped ${scrapeResult.successCount}/${scrapeResult.totalPages} pages in ${scrapeResult.duration}ms`
      );

      this.reportProgress(
        brandId,
        BrandAnalysisStatus.SCRAPING,
        40,
        `Scraped ${scrapeResult.successCount} pages successfully`
      );

      // Step 2: Preprocess content (truncate, deduplicate, enforce budget)
      const { pages: processedPages, metadata: contentMetadata } = this.preprocessContent(
        scrapeResult.pages.map(page => ({
          url: page.url,
          title: page.title,
          content: page.content,
          textContent: page.textContent,
        }))
      );
      this.logger.info('Content prepared for analysis', {
        event: 'content_prepared',
        ...contentMetadata,
      });

      // Step 3: AI Analysis with GPT-OSS-120B via OpenRouter
      this.reportProgress(brandId, BrandAnalysisStatus.ANALYZING, 50, 'Analyzing brand with AI...');

      const { analysis, usage } = await this.openRouter.analyzeBrand(
        request.websiteUrl,
        processedPages
      );

      this.logger.info(
        `AI analysis completed - Cost: $${usage.costUsd.toFixed(4)}, Tokens: ${usage.totalTokens}`
      );

      this.reportProgress(
        brandId,
        BrandAnalysisStatus.ANALYZING,
        90,
        'Analysis complete, preparing results...'
      );

      // Step 3: Prepare result
      const duration = Date.now() - startTime;

      const result: BrandAnalysisResult = {
        brandId,
        websiteUrl: request.websiteUrl,
        customerId: request.customerId,
        brandBook: analysis.brand_book,
        systemPrompt: analysis.system_prompt,
        knowledgeBase: analysis.knowledge_base,
        recommendedIntegrations: analysis.recommended_integrations,
        detectedLanguage: analysis.detected_language || undefined,
        audienceAnalysis: analysis.audience_analysis || undefined,
        competitorAnalysis: analysis.competitor_analysis || undefined,
        vocabulary: analysis.vocabulary || undefined,
        useCaseScenarios: analysis.use_case_scenarios || undefined,
        pagesScraped: scrapeResult.successCount,
        tokensUsed: usage.totalTokens,
        analysisCost: usage.costUsd,
        scrapeDuration: duration,
      };

      this.reportProgress(
        brandId,
        BrandAnalysisStatus.COMPLETED,
        100,
        'Brand analysis completed successfully'
      );

      this.logger.info(
        `Brand analysis completed in ${duration}ms - ${scrapeResult.successCount} pages, ${usage.totalTokens} tokens, $${usage.costUsd.toFixed(4)}`
      );

      return result;
    } catch (error) {
      this.logger.error('Brand analysis failed', error);
      this.reportProgress(
        brandId,
        BrandAnalysisStatus.FAILED,
        0,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Analyze brand from pre-scraped content
   */
  async analyzeBrandFromContent(
    request: BrandAnalysisRequest
  ): Promise<Omit<BrandAnalysisResult, 'brandId'>> {
    const startTime = Date.now();

    try {
      this.logger.info(`Analyzing brand from ${request.scrapedContent.length} pre-scraped pages`);

      // AI Analysis with GPT-OSS-120B via OpenRouter
      const { analysis, usage } = await this.openRouter.analyzeBrand(
        request.websiteUrl,
        request.scrapedContent
      );

      const duration = Date.now() - startTime;

      return {
        websiteUrl: request.websiteUrl,
        customerId: request.customerId,
        brandBook: analysis.brand_book,
        systemPrompt: analysis.system_prompt,
        knowledgeBase: analysis.knowledge_base,
        recommendedIntegrations: analysis.recommended_integrations,
        pagesScraped: request.scrapedContent.length,
        tokensUsed: usage.totalTokens,
        analysisCost: usage.costUsd,
        scrapeDuration: duration,
      };
    } catch (error) {
      this.logger.error('Brand analysis from content failed', error);
      throw error;
    }
  }

  /**
   * Analyze a brand by ID (for refresh operations)
   */
  async analyzeBrandById(brandId: string): Promise<void> {
    const { prisma } = await import('../../config/database');

    const brand = await prisma.brands.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new Error(`Brand with ID ${brandId} not found`);
    }

    this.logger.info(`Re-analyzing brand ${brandId} (${brand.websiteUrl})`);

    try {
      const result = await this.analyzeBrand({
        websiteUrl: brand.websiteUrl,
        customerId: brand.userId,
      });

      // Update the brand with new results and set cache expiration
      const { brandCacheService } = await import('../brand/brand-cache.service');
      await prisma.brands.update({
        where: { id: brandId },
        data: {
          status: 'COMPLETED',
          brandBook: result.brandBook as any,
          systemPrompt: result.systemPrompt as any,
          knowledgeBase: result.knowledgeBase as any,
          pagesScraped: result.pagesScraped,
          analysisCost: result.analysisCost || null,
          tokensUsed: result.tokensUsed,
          scrapeDuration: result.scrapeDuration,
          lastRefreshedAt: new Date(),
          errorMessage: null,
        },
      });

      await brandCacheService.setCacheExpiration(brandId);
    } catch (error) {
      // Update brand with error status
      await prisma.brands.update({
        where: { id: brandId },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Unknown error during refresh',
        },
      });
      throw error;
    }
  }

  /**
   * Test the brand analyzer with a simple website
   */
  async test(websiteUrl: string = 'https://example.com'): Promise<BrandAnalysisResult> {
    this.logger.info(`Testing brand analyzer with ${websiteUrl}`);

    return this.analyzeBrand({
      websiteUrl,
      customerId: 'test-customer',
    });
  }

  /**
   * Report progress (if callback provided)
   */
  private reportProgress(
    brandId: string,
    status: BrandAnalysisStatus,
    progress: number,
    message: string
  ): void {
    if (this.options.onProgress) {
      this.options.onProgress({
        brandId,
        status,
        progress,
        message,
      });
    }
  }

  /**
   * Preprocess scraped content: truncate, strip noise, deduplicate, enforce budget
   */
  private preprocessContent(
    pages: Array<{ url: string; title: string; content: string; textContent: string }>
  ): {
    pages: Array<{ url: string; title: string; content: string; textContent: string }>;
    metadata: {
      pagesIncluded: number;
      pagesDeduped: number;
      totalCharsBeforeTruncation: number;
      totalCharsAfterTruncation: number;
    };
  } {
    const MAX_PAGE_CHARS = 4000;
    const TOTAL_BUDGET = 200000;
    const SIMILARITY_THRESHOLD = 0.8;
    const FINGERPRINT_LENGTH = 500;

    // Noise patterns to strip
    const noisePatterns = [
      /accept\s+cookies?/gi,
      /we\s+use\s+cookies?/gi,
      /cookie\s+policy/gi,
      /skip\s+to\s+content/gi,
      /all\s+rights\s+reserved/gi,
      /©\s*\d{4}/g,
      /privacy\s+policy\s*\|?\s*terms\s+of\s+service/gi,
    ];

    let totalCharsBeforeTruncation = 0;
    let totalCharsAfterTruncation = 0;
    let pagesDeduped = 0;
    let runningBudget = 0;

    const includedPages: Array<{
      url: string;
      title: string;
      content: string;
      textContent: string;
    }> = [];
    const fingerprints: string[] = [];

    for (const page of pages) {
      totalCharsBeforeTruncation += (page.textContent || '').length;

      // Strip noise
      let cleaned = page.textContent || '';
      for (const pattern of noisePatterns) {
        cleaned = cleaned.replace(pattern, '');
      }

      // Truncate to max page chars
      const truncated = cleaned.substring(0, MAX_PAGE_CHARS);

      // Deduplicate: check fingerprint similarity against already-included pages
      const fingerprint = truncated
        .substring(0, FINGERPRINT_LENGTH)
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

      let isDuplicate = false;
      for (const existingFp of fingerprints) {
        if (this.calculateSimilarity(fingerprint, existingFp) > SIMILARITY_THRESHOLD) {
          isDuplicate = true;
          pagesDeduped++;
          break;
        }
      }

      if (isDuplicate) {
        continue;
      }

      // Enforce total budget
      if (runningBudget + truncated.length > TOTAL_BUDGET) {
        break;
      }

      fingerprints.push(fingerprint);
      runningBudget += truncated.length;
      totalCharsAfterTruncation += truncated.length;

      includedPages.push({
        url: page.url,
        title: page.title,
        content: page.content,
        textContent: truncated,
      });
    }

    return {
      pages: includedPages,
      metadata: {
        pagesIncluded: includedPages.length,
        pagesDeduped,
        totalCharsBeforeTruncation,
        totalCharsAfterTruncation,
      },
    };
  }

  /**
   * Calculate character-level similarity between two strings (Jaccard-like)
   */
  private calculateSimilarity(a: string, b: string): number {
    const setA = new Set(a.split(''));
    const setB = new Set(b.split(''));
    let intersection = 0;
    for (const char of setA) {
      if (setB.has(char)) intersection++;
    }
    return intersection / Math.max(setA.size, setB.size);
  }

  /**
   * Generate a unique brand ID
   */
  private generateBrandId(): string {
    return `brand_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  async close(): Promise<void> {
    await this.scraper.close();
  }
}

// Factory function
let brandAnalyzerService: BrandAnalyzerService | null = null;

export function getBrandAnalyzerService(options?: BrandAnalyzerOptions): BrandAnalyzerService {
  if (!brandAnalyzerService) {
    brandAnalyzerService = new BrandAnalyzerService(options);
  }
  return brandAnalyzerService;
}

// Cleanup on exit
process.on('exit', () => {
  if (brandAnalyzerService) {
    brandAnalyzerService.close().catch(console.error);
  }
});

process.on('SIGINT', async () => {
  if (brandAnalyzerService) {
    await brandAnalyzerService.close().catch(console.error);
  }
  process.exit(0);
});
