/**
 * Cron Job: Continuous Validate API Keys
 * Runs every 5 minutes to validate keys in the pool
 *
 * Setup with Vercel Cron:
 * Add to vercel.json - schedule: "*\/5 * * * *" (every 5 minutes)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPendingKeysForValidation, markKeyAsValidating, storeValidationResult, storeValidationError } from '@/lib/api-keys/database';
import { validateGeminiKey } from '@/lib/api-keys/validator';
import { delay } from '@/lib/api-keys/utils';
import { ApiKeyLogger, updateSystemStatus } from '@/lib/api-keys/logger-service';

export const maxDuration = 300; // 5 minutes max execution time
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const executionId = crypto.randomUUID();
  const logger = new ApiKeyLogger('validator', executionId);

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

    await logger.info('Starting continuous key validation');
    await updateSystemStatus('validator', 'running', executionId);

    const startTime = Date.now();

    // Get pending keys for validation (limit to 20 per run to fit in 5 min window)
    const pendingKeys = await getPendingKeysForValidation(20);

    if (pendingKeys.length === 0) {
      await logger.info('No pending keys to validate');
      await updateSystemStatus('validator', 'completed', executionId, {
        validated: 0,
        valid: 0,
        invalid: 0
      });

      return NextResponse.json({
        success: true,
        results: {
          validated: 0,
          valid: 0,
          invalid: 0
        },
        duration: Date.now() - startTime,
        executionId,
        timestamp: new Date().toISOString(),
      });
    }

    await logger.info(`Found ${pendingKeys.length} pending keys to validate`);

    const results = {
      validated: 0,
      valid: 0,
      invalid: 0,
      errors: 0
    };

    // Validate each pending key
    for (const keyRecord of pendingKeys) {
      const keyPreview = keyRecord.key.substring(0, 12);

      try {
        await logger.info(`Validating key ${results.validated + 1}/${pendingKeys.length}`, {
          keyPreview: keyPreview + '...',
          source: keyRecord.source
        });

        await markKeyAsValidating(keyRecord.key);

        const validationResult = await validateGeminiKey(keyRecord.key);
        await storeValidationResult(validationResult);

        results.validated++;

        if (validationResult.isValid) {
          results.valid++;
          await logger.success(`Key ${results.validated}/${pendingKeys.length} is valid: ${validationResult.totalModelsAccessible}/${validationResult.totalModelsTested} models accessible`, {
            keyPreview: keyPreview + '...',
            modelsAccessible: validationResult.totalModelsAccessible,
            modelsTested: validationResult.totalModelsTested,
            bestModel: validationResult.capabilities.find(c => c.isAccessible)?.modelName
          });
        } else {
          results.invalid++;
          await logger.warn(`Key ${results.validated}/${pendingKeys.length} is invalid`, {
            keyPreview: keyPreview + '...',
            reason: 'No models accessible'
          });
        }

        // Delay between validations
        await delay(1000);
      } catch (error: any) {
        results.errors++;
        await logger.error(`Failed to validate key`, {
          keyPreview: keyPreview + '...',
          error: error.message
        });
        await storeValidationError(keyRecord.key, error.message);
      }
    }

    const duration = Date.now() - startTime;

    await logger.success(`Validation completed: ${results.valid} valid, ${results.invalid} invalid out of ${results.validated} total`, results);
    await updateSystemStatus('validator', 'completed', executionId, results);

    return NextResponse.json({
      success: true,
      results,
      duration,
      executionId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    await logger.error('Validation process failed', {
      error: error.message,
      stack: error.stack
    });
    await updateSystemStatus('validator', 'failed', executionId, {}, error.message);

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
  const logger = new ApiKeyLogger('validator', executionId);

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

    await logger.info(`Starting manual validation`, { limit });
    await updateSystemStatus('validator', 'running', executionId);

    const startTime = Date.now();
    const pendingKeys = await getPendingKeysForValidation(limit);

    if (pendingKeys.length === 0) {
      await logger.info('No pending keys to validate');
      await updateSystemStatus('validator', 'completed', executionId, {
        validated: 0,
        valid: 0,
        invalid: 0
      });

      return NextResponse.json({
        success: true,
        results: {
          validated: 0,
          valid: 0,
          invalid: 0
        },
        executionId,
        timestamp: new Date().toISOString(),
      });
    }

    await logger.info(`Validating ${pendingKeys.length} pending keys`);

    const results = {
      validated: 0,
      valid: 0,
      invalid: 0,
      errors: 0
    };

    for (const keyRecord of pendingKeys) {
      const keyPreview = keyRecord.key.substring(0, 12);

      try {
        await logger.info(`Validating key ${results.validated + 1}/${pendingKeys.length}`, {
          keyPreview: keyPreview + '...'
        });

        await markKeyAsValidating(keyRecord.key);
        const validationResult = await validateGeminiKey(keyRecord.key);
        await storeValidationResult(validationResult);

        results.validated++;

        if (validationResult.isValid) {
          results.valid++;
          await logger.success(`Key ${results.validated}/${pendingKeys.length} is valid`, {
            keyPreview: keyPreview + '...',
            modelsAccessible: validationResult.totalModelsAccessible
          });
        } else {
          results.invalid++;
          await logger.warn(`Key ${results.validated}/${pendingKeys.length} is invalid`, {
            keyPreview: keyPreview + '...'
          });
        }

        await delay(500);
      } catch (error: any) {
        results.errors++;
        await logger.error(`Validation failed for key ${results.validated + 1}`, {
          keyPreview: keyPreview + '...',
          error: error.message
        });
        await storeValidationError(keyRecord.key, error.message);
      }
    }

    const duration = Date.now() - startTime;

    await logger.success(`Manual validation completed`, results);
    await updateSystemStatus('validator', 'completed', executionId, results);

    return NextResponse.json({
      success: true,
      results,
      duration,
      executionId,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    await logger.error('Manual validation failed', { error: error.message });
    await updateSystemStatus('validator', 'failed', executionId, {}, error.message);

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
