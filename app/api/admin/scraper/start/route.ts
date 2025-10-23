import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getBackgroundScraper } from '@/lib/api-keys/background-scraper'
import { logger } from '@/lib/utils/logger'
import {
  requireAdmin,
  logAdminAction,
  createAuditLogEntry
} from '@/lib/auth/admin-auth'

/**
 * POST /api/admin/scraper/start
 *
 * Start the background scraper service
 *
 * Returns:
 * - 200: Scraper started successfully
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const scraper = getBackgroundScraper()

    // Start scraper with options (will run in background)
    scraper
      .start({
        limit: 100,
        intervalMinutes: 60 // 1 hour intervals
      })
      .catch((error: unknown) => {
        logger.error('[API] Scraper error', { error })
      })

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(request, user, 'start_scraper', 'background_service')
    )

    return NextResponse.json({
      success: true,
      message: 'Background scraper started'
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('[API] Error starting scraper', { error })
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/admin/scraper/start
 *
 * Stop the background scraper service
 *
 * Returns:
 * - 200: Scraper stopped successfully
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const DELETE = requireAdmin(async (request: NextRequest, user) => {
  try {
    const scraper = getBackgroundScraper()
    scraper.stop()

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(request, user, 'stop_scraper', 'background_service')
    )

    return NextResponse.json({
      success: true,
      message: 'Background scraper stopped'
    })
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    logger.error('[API] Error stopping scraper', { error })
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
})

/**
 * GET /api/admin/scraper/start
 *
 * Get background scraper status
 *
 * Returns:
 * - 200: Scraper status and statistics
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const scraper = getBackgroundScraper()
    const stats = scraper.getStatus()

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(
        request,
        user,
        'view_scraper_status',
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
    logger.error('[API] Error getting scraper status', { error })
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
})
