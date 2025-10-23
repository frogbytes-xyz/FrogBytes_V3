import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getContinuousValidator } from '@/lib/api-keys/continuous-validator'
import { logger } from '@/lib/utils/logger'

/**
 * POST /api/admin/validator/start
 * Start the continuous validator
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-api-key')
    const adminKey =
      process.env.ADMIN_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY
    if (!authHeader || authHeader !== adminKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const validator = getContinuousValidator()

    // Start validator with options (will run in background)
    validator
      .start({
        batchSize: 10,
        intervalMinutes: 30 // 30 minute intervals
      })
      .catch((error: any) => {
        logger.error('[API] Validator error', error)
      })

    return NextResponse.json({
      success: true,
      message: 'Continuous validator started'
    })
  } catch (error: any) {
    logger.error('[API] Error starting validator', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/validator/start
 * Stop the continuous validator
 */
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-api-key')
    const adminKey =
      process.env.ADMIN_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY
    if (!authHeader || authHeader !== adminKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const validator = getContinuousValidator()
    validator.stop()

    return NextResponse.json({
      success: true,
      message: 'Continuous validator stopped'
    })
  } catch (error: any) {
    logger.error('[API] Error stopping validator', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/validator/start
 * Get validator status
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-api-key')
    const adminKey =
      process.env.ADMIN_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY
    if (!authHeader || authHeader !== adminKey) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const validator = getContinuousValidator()
    const stats = validator.getStatus()

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error: any) {
    logger.error('[API] Error getting validator status', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
