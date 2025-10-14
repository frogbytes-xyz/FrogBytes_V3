/**
 * Cron Job: Revalidate Working Gemini Keys
 * Checks working_gemini_keys and toggles status between 'valid' and 'quota_exceeded'.
 * Invalid keys are removed from the working pool.
 *
 * Setup with Vercel Cron:
 * Add to vercel.json (schedule every 5 minutes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateGeminiKey } from '@/lib/api-keys/validator';
import { getKeysNeedingRevalidation, updateKeyStatus, removeInvalidKey } from '@/lib/api-keys/database';
import { delay } from '@/lib/api-keys/utils';
import { ApiKeyLogger, updateSystemStatus } from '@/lib/api-keys/logger-service';

export const maxDuration = 300; // 5 minutes
export const dynamic = 'force-dynamic';

async function runRevalidation(limit: number, logger: ApiKeyLogger, executionId: string, concurrency = 5) {
  const startTime = Date.now();

  const keys = await getKeysNeedingRevalidation(limit);
  if (!keys || keys.length === 0) {
    await logger.info('No keys need revalidation');
    await updateSystemStatus('revalidator', 'completed', executionId, {
      processed: 0,
      stillValid: 0,
      quotaExceeded: 0,
      removed: 0
    });
    return {
      processed: 0,
      stillValid: 0,
      quotaExceeded: 0,
      removed: 0,
      duration: Date.now() - startTime
    };
  }

  await logger.info(`Revalidating ${keys.length} working keys`);

  const results = {
    processed: 0,
    stillValid: 0,
    quotaExceeded: 0,
    removed: 0,
    errors: 0
  };

  // Process in batches with bounded concurrency
  const chunks = [] as any[];
  for (let i = 0; i < keys.length; i += concurrency) chunks.push(keys.slice(i, i + concurrency));

  for (let batchIdx = 0; batchIdx < chunks.length; batchIdx++) {
    const batch = chunks[batchIdx]!;
    await Promise.allSettled(batch.map(async (rec: any, j: number) => {
      const i = batchIdx * concurrency + j;
      const preview = rec.api_key.substring(0, 12);
      try {
        await logger.info(`Revalidate ${i + 1}/${keys.length}`, { keyPreview: preview + '...' });
        const validation = await validateGeminiKey(rec.api_key);
        results.processed++;
        const isQuota = validation.status === 'quota_reached' || validation.status === 'quota_exceeded' || (typeof validation.quotaRemaining === 'number' && validation.quotaRemaining === 0);
        if (validation.isValid && !isQuota) {
          await updateKeyStatus(rec.api_key, 'valid');
          results.stillValid++;
          await logger.success(`VALID: ${preview}...`, { outcome: 'valid', previousStatus: rec.status, newStatus: 'valid' }, rec.api_key);
        } else if (isQuota) {
          await updateKeyStatus(rec.api_key, 'quota_exceeded');
          results.quotaExceeded++;
          await logger.warn(`QUOTA_EXCEEDED: ${preview}...`, { outcome: 'quota_exceeded', previousStatus: rec.status, newStatus: 'quota_exceeded' }, rec.api_key);
        } else {
          await removeInvalidKey(rec.api_key);
          results.removed++;
          await logger.warn(`REMOVED (invalid): ${preview}...`, { outcome: 'removed', previousStatus: rec.status, newStatus: 'removed' }, rec.api_key);
        }
      } catch (error: any) {
        results.errors++;
        await logger.error(`Error revalidating ${preview}...`, { error: error.message });
      }
    }));
    // Small delay between batches
    await delay(200);
  }

  const duration = Date.now() - startTime;
  await logger.success('Revalidation run complete', { ...results, duration });
  await updateSystemStatus('revalidator', 'completed', executionId, results);

  return { ...results, duration };
}

export async function GET(request: NextRequest) {
  const executionId = crypto.randomUUID();
  const logger = new ApiKeyLogger('validator', executionId);

  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      await logger.error('Unauthorized access attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await updateSystemStatus('validator', 'running', executionId);

    // default limit for cron invocations
    const concurrency = parseInt(process.env.REVALIDATOR_CONCURRENCY || '5', 10) || 5;
    const result = await runRevalidation(50, logger, executionId, concurrency);

    return NextResponse.json({ success: true, results: result, executionId, timestamp: new Date().toISOString() });
  } catch (error: any) {
    await logger.error('Revalidation failed', { error: error.message, stack: error.stack });
    await updateSystemStatus('validator', 'failed', executionId, {}, error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const executionId = crypto.randomUUID();
  const logger = new ApiKeyLogger('validator', executionId);

  try {
    const apiKey = request.headers.get('x-api-key');
    if (apiKey !== process.env.ADMIN_API_KEY) {
      await logger.error('Unauthorized manual trigger attempt');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const limit = typeof body.limit === 'number' ? Math.max(1, Math.min(body.limit, 200)) : 100;

    await updateSystemStatus('validator', 'running', executionId);
    const result = await runRevalidation(limit, logger, executionId);

    return NextResponse.json({ success: true, results: result, executionId, timestamp: new Date().toISOString() });
  } catch (error: any) {
    await logger.error('Revalidation failed', { error: error.message, stack: error.stack });
    await updateSystemStatus('validator', 'failed', executionId, {}, error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
