import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getContinuousValidator } from '@/lib/api-keys/continuous-validator'
import { logger } from '@/lib/utils/logger'
import {
  requireAdmin,
  logAdminAction,
  createAuditLogEntry
} from '@/lib/auth/admin-auth'

/**
 * POST /api/admin/validator/start
 *
 * Start the continuous validator service
 *
 * Returns:
 * - 200: Validator started successfully
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const validator = getContinuousValidator()

    // Start validator with options (will run in background)
    validator
      .start({
        batchSize: 10,
        intervalMinutes: 30 // 30 minute intervals
      })
      .catch((error: unknown) => {
        logger.error('[API] Validator error', { error })
      })

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(request, user, 'start_validator', 'background_service')
    )

    return NextResponse.json({
      success: true,
      message: 'Continuous validator started'
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('[API] Error starting validator', { error })
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/admin/validator/start
 *
 * Stop the continuous validator service
 *
 * Returns:
 * - 200: Validator stopped successfully
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const DELETE = requireAdmin(async (request: NextRequest, user) => {
  try {
    const validator = getContinuousValidator()
    validator.stop()

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(request, user, 'stop_validator', 'background_service')
    )

    return NextResponse.json({
      success: true,
      message: 'Continuous validator stopped'
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('[API] Error stopping validator', { error })
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
})

/**
 * GET /api/admin/validator/start
 *
 * Get continuous validator status
 *
 * Returns:
 * - 200: Validator status and statistics
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const validator = getContinuousValidator()
    const stats = validator.getStatus()

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(
        request,
        user,
        'view_validator_status',
        'background_service'
      )
    )

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('[API] Error getting validator status', { error })
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
})
