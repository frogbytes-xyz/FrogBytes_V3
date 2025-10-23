import { logger } from '@/lib/utils/logger'

/**
 * API Route: Trigger validation of pending API keys
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import {
  getPendingKeysForValidation,
  markKeyAsValidating,
  storeValidationResult,
  storeValidationError
} from '@/lib/api-keys/database'
import { validateGeminiKey } from '@/lib/api-keys/validator'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { batchSize = 10 } = await request.json()

    // Get pending keys
    const pendingKeys = await getPendingKeysForValidation(batchSize)

    if (pendingKeys.length === 0) {
      return NextResponse.json({
        message: 'No pending keys to validate',
        processed: 0
      })
    }

    // Start validation process (this would typically be done in a background job)
    const results = {
      processed: 0,
      valid: 0,
      invalid: 0,
      errors: 0
    }

    for (const key of pendingKeys) {
      try {
        // Mark as validating
        await markKeyAsValidating(key.key)

        // Validate the key
        const validationResult = await validateGeminiKey(key.key)

        // Store the result
        await storeValidationResult(validationResult)

        results.processed++
        if (validationResult.isValid) {
          results.valid++
        } else {
          results.invalid++
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        logger.error(
          `Failed to validate key ${key.key.substring(0, 12)}...`,
          error
        )

        try {
          await storeValidationError(key.key, String(error))
        } catch (storeError) {
          logger.error('Failed to store validation error', storeError)
        }

        results.errors++
      }
    }

    return NextResponse.json({
      message: `Validated ${results.processed} keys`,
      results
    })
  } catch (error: any) {
    logger.error('Failed to validate API keys', error)
    return NextResponse.json(
      { error: 'Failed to start validation process' },
      { status: 500 }
    )
  }
}

// Get validation status
export async function GET(_request: NextRequest) {
  try {
    const pendingKeys = await getPendingKeysForValidation(1)

    return NextResponse.json({
      hasPendingKeys: pendingKeys.length > 0,
      pendingCount: pendingKeys.length
    })
  } catch (error: any) {
    logger.error('Failed to get validation status', error)
    return NextResponse.json(
      { error: 'Failed to get validation status' },
      { status: 500 }
    )
  }
}
