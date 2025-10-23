import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { getBackgroundScraper } from '@/lib/api-keys/background-scraper'
import { getContinuousValidator } from '@/lib/api-keys/continuous-validator'
import {
  requireAdmin,
  logAdminAction,
  createAuditLogEntry
} from '@/lib/auth/admin-auth'

/**
 * POST /api/admin/api-keys/control
 *
 * Control background services (start/stop/restart)
 *
 * Request Body:
 * - action: 'start_scraper' | 'stop_scraper' | 'start_validator' | 'stop_validator' | 'restart_all'
 *
 * Returns:
 * - 200: Service control action executed
 * - 400: Invalid action
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const POST = requireAdmin(async (request: NextRequest, user) => {
  try {
    const body = await request.json()
    const { action } = body

    logger.info(`[Control API] Received action: ${action}`)

    let result = { success: false, message: '' }

    switch (action) {
      case 'start_scraper':
        try {
          logger.info('[Control API] Starting background scraper...')
          const scraper = getBackgroundScraper()
          if (scraper.isActive()) {
            result = { success: false, message: 'Scraper is already running' }
          } else {
            // Start in background without blocking
            scraper.start().catch(error => {
              logger.error('[API] Scraper error', error)
            })
            result = { success: true, message: 'Background scraper started' }
            logger.info('[Control API] Background scraper started successfully')
          }
        } catch (error: any) {
          logger.error('[Control API] Error starting scraper', error)
          result = { success: false, message: error.message }
        }
        break

      case 'stop_scraper':
        try {
          const scraper = getBackgroundScraper()
          scraper.stop()
          result = { success: true, message: 'Background scraper stopped' }
        } catch (error: any) {
          result = { success: false, message: error.message }
        }
        break

      case 'start_validator':
        try {
          const validator = getContinuousValidator()
          // Start in background without blocking
          validator.start().catch(error => {
            logger.error('[API] Validator error', error)
          })
          result = { success: true, message: 'Continuous validator started' }
        } catch (error: any) {
          result = { success: false, message: error.message }
        }
        break

      case 'stop_validator':
        try {
          const validator = getContinuousValidator()
          validator.stop()
          result = { success: true, message: 'Continuous validator stopped' }
        } catch (error: any) {
          result = { success: false, message: error.message }
        }
        break

      case 'restart_all':
        try {
          // Stop both
          try {
            getBackgroundScraper().stop()
          } catch {}
          try {
            getContinuousValidator().stop()
          } catch {}

          // Wait a moment
          await new Promise(resolve => setTimeout(resolve, 2000))

          // Start both in background without blocking
          getBackgroundScraper()
            .start()
            .catch(error => {
              logger.error('[API] Scraper error', error)
            })
          getContinuousValidator()
            .start()
            .catch(error => {
              logger.error('[API] Validator error', error)
            })

          result = { success: true, message: 'All services restarted' }
        } catch (error: any) {
          result = { success: false, message: error.message }
        }
        break

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        )
    }

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(request, user, 'control_service', 'api_keys', undefined, {
        action,
        result
      })
    )

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error controlling services', { error })
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to control services'
      },
      { status: 500 }
    )
  }
})
