import { logger } from '@/lib/utils/logger'

/**
 * Advanced Bulk Scraping & Validation API
 * Long-running endpoint for comprehensive key discovery and validation
 * 
 * POST /api/admin/bulk-scrape
 * 
 * This endpoint can run for extended periods (up to 5 minutes per invocation)
 * to maximize key discovery and validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { bulkScrapeWithValidation } from '@/lib/api-keys/scraper';
import { addApiKey } from '@/lib/api-keys/manager';
import { createClient } from '@supabase/supabase-js';

export const maxDuration = 300; // 5 minutes max execution time
export const dynamic = 'force-dynamic';

interface BulkScrapeRequest {
  targetKeys?: number;
  maxDuration?: number;
  concurrentValidation?: number;
  autoAdd?: boolean; // Automatically add valid keys to database
}

export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const apiKey = request.headers.get('x-api-key');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || apiKey !== adminKey) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin API key required' },
        { status: 401 }
      );
    }

    const body: BulkScrapeRequest = await request.json();
    const {
      targetKeys = 200,
      maxDuration = 240000, // 4 minutes default (leave buffer)
      concurrentValidation = 5,
      autoAdd = true,
    } = body;

    logger.info('[BULK SCRAPE API] Starting bulk scrape operation');
    logger.info(`[BULK SCRAPE API] Target: ${targetKeys} keys, Max duration: ${maxDuration}ms`);

    const progressUpdates: any[] = [];
    const validatedKeys: { key: string; valid: boolean; timestamp: Date }[] = [];

    // Run bulk scrape with validation
    const result = await bulkScrapeWithValidation({
      targetKeys,
      maxDuration,
      concurrentValidation,
      onProgress: (progress) => {
        progressUpdates.push({
          ...progress,
          timestamp: new Date(),
        });
        
        // Log every 10 processed
        if (progress.processed % 10 === 0) {
          logger.info(
            `[BULK SCRAPE API] Progress: ${progress.processed}/${progress.total} ` +
            `(Found: ${progress.found}, Duplicates: ${progress.duplicates})`
          );
        }
      },
      onValidated: (key, valid) => {
        validatedKeys.push({
          key: key.substring(0, 10) + '...',
          valid,
          timestamp: new Date(),
        });
      },
    });

    logger.info('[BULK SCRAPE API] Scraping completed');
    logger.info(`[BULK SCRAPE API] Found ${result.scraped.length} keys`);
    logger.info(`[BULK SCRAPE API] Valid: ${result.stats.validKeys || 0}`);

    // Auto-add valid keys to database if requested
    const addedKeys: string[] = [];
    const addErrors: string[] = [];

    if (autoAdd) {
      logger.info('[BULK SCRAPE API] Adding valid keys to database');
      
      for (const keyData of result.scraped) {
        const isValid = result.validated?.get(keyData.key) || false;
        
        if (isValid) {
          try {
            const addResult = await addApiKey(
              keyData.key,
              keyData.source,
              keyData.sourceUrl
            );
            
            if (addResult.success) {
              addedKeys.push(keyData.key.substring(0, 10) + '...');
            } else if (!addResult.error?.includes('already exists')) {
              addErrors.push(addResult.error || 'Unknown error');
            }
          } catch (error: any) {
            addErrors.push(error.message);
          }
        }
      }
      
      logger.info(`[BULK SCRAPE API] Added ${addedKeys.length} new valid keys to database`);
    }

    // Calculate statistics
    const durationMinutes = (result.duration / 1000 / 60).toFixed(2);
    const keysPerMinute = (result.scraped.length / (result.duration / 1000 / 60)).toFixed(2);
    const validationRate = ((result.statistics.validKeys / result.statistics.totalScraped) * 100).toFixed(2);

    return NextResponse.json({
      success: true,
      summary: {
        totalScraped: result.statistics.totalScraped,
        validKeys: result.statistics.validKeys,
        invalidKeys: result.statistics.invalidKeys,
        quotaExceeded: result.statistics.quotaExceeded,
        durationMs: result.duration,
        durationMinutes: parseFloat(durationMinutes),
        keysPerMinute: parseFloat(keysPerMinute),
        validationRate: parseFloat(validationRate),
      },
      database: {
        added: addedKeys.length,
        errors: addErrors.length,
        errorMessages: addErrors.slice(0, 5), // First 5 errors
      },
      samples: {
        validKeys: addedKeys.slice(0, 10),
        recentValidations: validatedKeys.slice(-20),
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('[BULK SCRAPE API] Error', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check status and recent results
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (!adminKey || apiKey !== adminKey) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin API key required' },
        { status: 401 }
      );
    }

    // Get statistics from database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: keys, error } = await supabase
      .from('api_keys')
      .select('status, created_at, last_validated_at, success_count, error_count')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      throw error;
    }

    const stats = {
      total: keys?.length || 0,
      valid: keys?.filter(k => k.status === 'valid').length || 0,
      quotaReached: keys?.filter(k => k.status === 'quota_reached').length || 0,
      invalid: keys?.filter(k => k.status === 'invalid').length || 0,
      pending: keys?.filter(k => k.status === 'pending').length || 0,
      recentlyAdded: keys?.filter(k => {
        const createdAt = new Date(k.created_at);
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return createdAt > dayAgo;
      }).length || 0,
    };

    return NextResponse.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
