/**
 * Cron Job: Scrape API Keys from GitHub
 * Runs continuously (every hour) to scrape new Gemini API keys 24/7
 *
 * Setup with Vercel Cron:
 * Add to vercel.json - schedule: "0 * * * *" (every hour)
 */

import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllSources } from '@/lib/api-keys/scraper';
import { ApiKeyLogger, updateSystemStatus } from '@/lib/api-keys/logger-service';

export const maxDuration = 300; // 5 minutes max execution time
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const executionId = crypto.randomUUID();
  const logger = new ApiKeyLogger('scraper', executionId);

  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      await logger.error('Unauthorized access attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await logger.info('Starting continuous API key scraping', { limit: 50 });
    await updateSystemStatus('scraper', 'running', executionId);

    const startTime = Date.now();

    // Scrape keys with validation and database storage enabled
    const scrapedKeys = await scrapeAllSources(50, undefined, {
      validateKeys: true,
      storeInDatabase: true,
      logger
    });

    const duration = Date.now() - startTime;
    const stats = {
      scraped: scrapedKeys.length,
      duration_ms: duration
    };

    await logger.success(`Scraping completed: ${scrapedKeys.length} keys processed`, stats);
    await updateSystemStatus('scraper', 'completed', executionId, stats);

    return NextResponse.json({
      success: true,
      results: stats,
      executionId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    await logger.error('Scraping failed', { error: error.message, stack: error.stack });
    await updateSystemStatus('scraper', 'failed', executionId, {}, error.message);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        executionId,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// Manual trigger endpoint (POST)
export async function POST(request: NextRequest) {
  const executionId = crypto.randomUUID();
  const logger = new ApiKeyLogger('scraper', executionId);

  try {
    // Require API key for manual triggers
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.ADMIN_API_KEY) {
      await logger.error('Unauthorized manual trigger attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 50;

    await logger.info(`Starting manual scraping`, { limit });
    await updateSystemStatus('scraper', 'running', executionId);

    const startTime = Date.now();
    const scrapedKeys = await scrapeAllSources(limit, undefined, {
      validateKeys: true,
      storeInDatabase: true,
      logger
    });

    const duration = Date.now() - startTime;
    const stats = {
      scraped: scrapedKeys.length,
      duration_ms: duration
    };

    await logger.success(`Manual scraping completed: ${scrapedKeys.length} keys`, stats);
    await updateSystemStatus('scraper', 'completed', executionId, stats);

    return NextResponse.json({
      success: true,
      results: stats,
      executionId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    await logger.error('Manual scraping failed', { error: error.message });
    await updateSystemStatus('scraper', 'failed', executionId, {}, error.message);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        executionId,
      },
      { status: 500 }
    );
  }
}
