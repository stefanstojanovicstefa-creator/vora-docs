/**
 * Brand Analysis Job Processor
 * Background job processing for brand analysis with WebSocket progress updates
 */

import { prisma } from '../config/database';
import { getBrandAnalyzerService } from '../services/ai/brand-analyzer.service';
import { BrandAnalysisStatus, BrandAnalysisProgress } from '../types/brand-analysis.types';
import { Logger } from '../utils/simple-logger';
import WebSocket from 'ws';

const logger = new Logger('BrandAnalysisJob');

// In-memory job queue (simple implementation)
interface BrandAnalysisJob {
  brandId: string;
  websiteUrl: string;
  userId: string;
  customerId?: string;
}

const jobQueue: BrandAnalysisJob[] = [];
let isProcessing = false;

// WebSocket connections store: brandId -> Set of WebSocket clients
const wsConnections = new Map<string, Set<WebSocket>>();

/**
 * Register WebSocket connection for a brand
 */
export function registerBrandWebSocket(brandId: string, ws: WebSocket): void {
  if (!wsConnections.has(brandId)) {
    wsConnections.set(brandId, new Set());
  }
  wsConnections.get(brandId)!.add(ws);

  logger.info(
    `WebSocket registered for brand ${brandId}. Total connections: ${wsConnections.get(brandId)!.size}`
  );

  // Cleanup on close
  ws.on('close', () => {
    const connections = wsConnections.get(brandId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        wsConnections.delete(brandId);
      }
    }
    logger.info(`WebSocket disconnected for brand ${brandId}`);
  });
}

/**
 * Emit progress update to all connected WebSocket clients
 */
function emitProgress(progress: BrandAnalysisProgress): void {
  const connections = wsConnections.get(progress.brandId);
  if (!connections || connections.size === 0) {
    logger.debug(`No WebSocket connections for brand ${progress.brandId}`);
    return;
  }

  const message = JSON.stringify({
    type: progress.status.toLowerCase(),
    progress: progress.progress,
    message: progress.message,
    status: progress.status,
    currentStep: progress.currentStep,
    estimatedTimeRemaining: progress.estimatedTimeRemaining,
    timestamp: new Date().toISOString(),
  });

  let sentCount = 0;
  connections.forEach(ws => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
      sentCount++;
    }
  });

  logger.debug(
    `Progress emitted to ${sentCount} clients for brand ${progress.brandId}: ${progress.message}`
  );
}

/**
 * Enqueue a brand analysis job
 */
export async function enqueueBrandAnalysis(job: BrandAnalysisJob): Promise<void> {
  logger.info(`Enqueueing brand analysis job for ${job.websiteUrl}`);

  jobQueue.push({
    ...job,
  });

  // Start processing if not already running
  if (!isProcessing) {
    processNextJob();
  }
}

/**
 * Process the next job in the queue
 */
async function processNextJob(): Promise<void> {
  if (isProcessing || jobQueue.length === 0) {
    return;
  }

  isProcessing = true;
  const job = jobQueue.shift()!;

  try {
    const JOB_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes
    const abortController = new AbortController();

    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, JOB_TIMEOUT_MS);

    try {
      await Promise.race([
        processBrandAnalysisJob(job, abortController.signal),
        new Promise<never>((_, reject) => {
          abortController.signal.addEventListener('abort', () => {
            reject(new Error('Analysis timed out after 4 minutes'));
          });
        }),
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    logger.error(`Failed to process job for brand ${job.brandId}`, error);

    // On timeout or any error, mark as FAILED
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    try {
      await prisma.brands.update({
        where: { id: job.brandId },
        data: {
          status: 'FAILED',
          errorMessage,
        },
      });
    } catch (dbError) {
      logger.error(`Failed to update brand status for ${job.brandId}`, dbError);
    }

    // Log structured event
    if (errorMessage.includes('timed out')) {
      logger.info('Brand analysis timeout', {
        event: 'brand_analysis_timeout',
        brandId: job.brandId,
        websiteUrl: job.websiteUrl,
        elapsedMs: 240000,
      });
    }
  } finally {
    isProcessing = false;
    if (jobQueue.length > 0) {
      setTimeout(() => processNextJob(), 1000);
    }
  }
}

/**
 * Process a single brand analysis job
 */
async function processBrandAnalysisJob(job: BrandAnalysisJob, signal?: AbortSignal): Promise<void> {
  const { brandId, websiteUrl, userId, customerId } = job;

  logger.info('Brand analysis started', {
    event: 'brand_analysis_start',
    brandId,
    websiteUrl,
    userId,
  });

  try {
    // Update status to SCRAPING
    await prisma.brands.update({
      where: { id: brandId },
      data: { status: 'SCRAPING' },
    });

    emitProgress({
      brandId,
      status: BrandAnalysisStatus.SCRAPING,
      progress: 10,
      message: 'Starting website scraping...',
      currentStep: 'scraping',
    });

    // Create brand analyzer with progress callback
    const brandAnalyzer = getBrandAnalyzerService({
      maxPages: 20,
      onProgress: progress => {
        emitProgress(progress);
      },
      signal,
    });

    // Run analysis
    const result = await brandAnalyzer.analyzeBrand({
      websiteUrl,
      customerId: customerId || undefined,
    });

    // Update database with results
    const finalStatus = result.circuitBreakerTriggered ? 'COMPLETED_PARTIAL' : 'COMPLETED';

    await prisma.brands.update({
      where: { id: brandId },
      data: {
        status: finalStatus,
        brandBook: result.brandBook as any,
        systemPrompt: { ...result.systemPrompt as any, detectedLanguage: result.detectedLanguage || undefined } as any,
        knowledgeBase: result.knowledgeBase as any,
        recommendedIntegrations: result.recommendedIntegrations as any,
        pagesScraped: result.pagesScraped,
        tokensUsed: result.tokensUsed,
        analysisCost: result.analysisCost,
        scrapeDuration: result.scrapeDuration,
        analyzedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
    });

    // Create cost tracking record
    await prisma.brand_analysis_costs.create({
      data: {
        id: `brand_cost_${brandId}_${Date.now()}`,
        brands: {
          connect: { id: brandId },
        },
        provider: 'openrouter',
        modelName: 'gpt-oss-120b:free',
        totalTokens: result.tokensUsed,
        inputTokens: Math.floor(result.tokensUsed * 0.7), // Estimate
        outputTokens: Math.floor(result.tokensUsed * 0.3), // Estimate
        totalCost: result.analysisCost,
        inputCost: result.analysisCost * 0.7, // Estimate
        outputCost: result.analysisCost * 0.3, // Estimate
      },
    });

    // Emit completion
    emitProgress({
      brandId,
      status: result.circuitBreakerTriggered
        ? BrandAnalysisStatus.COMPLETED_PARTIAL
        : BrandAnalysisStatus.COMPLETED,
      progress: 100,
      message: result.circuitBreakerTriggered
        ? 'Brand analysis completed with partial results (circuit breaker triggered)'
        : 'Brand analysis completed successfully',
      currentStep: 'completed',
    });

    logger.info(
      `Brand analysis completed for ${brandId}: ${result.pagesScraped} pages, $${result.analysisCost.toFixed(4)}`
    );
  } catch (error) {
    logger.error(`Brand analysis failed for ${brandId}`, error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Mark as FAILED immediately - no retries
    await prisma.brands.update({
      where: { id: brandId },
      data: {
        status: 'FAILED',
        errorMessage,
      },
    });

    emitProgress({
      brandId,
      status: BrandAnalysisStatus.FAILED,
      progress: 0,
      message: `Analysis failed: ${errorMessage}`,
    });

    logger.info('Brand analysis failed', {
      event: 'brand_analysis_failed',
      brandId,
      error: errorMessage,
    });
  }
}

/**
 * Get job queue status
 */
export function getQueueStatus(): {
  queueLength: number;
  isProcessing: boolean;
  activeConnections: number;
} {
  return {
    queueLength: jobQueue.length,
    isProcessing,
    activeConnections: Array.from(wsConnections.values()).reduce((sum, set) => sum + set.size, 0),
  };
}
