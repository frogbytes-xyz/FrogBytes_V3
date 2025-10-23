import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { getBackgroundScraper } from '@/lib/api-keys/background-scraper'
import { getContinuousValidator } from '@/lib/api-keys/continuous-validator'

/**
 * POST /api/admin/api-keys/control
 *
 * Control background services (start/stop/restart)
 * Body: { action: 'start_scraper' | 'stop_scraper' | 'start_validator' | 'stop_validator' | 'restart_all' }
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication - allow if ADMIN_API_KEY is set and matches, or if not set at all
    const authHeader = request.headers.get('x-api-key')
    const adminKey =
      process.env.ADMIN_API_KEY || process.env.NEXT_PUBLIC_ADMIN_API_KEY

    if (adminKey && authHeader !== adminKey) {
      logger.warn('[Control API] Unauthorized access attempt')
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

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

    return NextResponse.json(result)
  } catch (error) {
    logger.error('Error controlling services', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to control services'
      },
      { status: 500 }
    )
  }
}
