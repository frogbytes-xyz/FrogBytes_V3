import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { remoteBrowserService } from '@/lib/services/remote-browser-service'
import { logger } from '@/lib/utils/logger'

/**
 * POST /api/remote-browser/start
 *
 * Starts a new remote browser session with X-Frame-Options bypass extension
 *
 * Body:
 * - sessionId: string
 * - url: string
 * - userAgent?: string
 * - userId?: string
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { sessionId, url, userAgent, userId } = body

    if (!sessionId || !url) {
      return NextResponse.json(
        { error: 'sessionId and url are required' },
        { status: 400 }
      )
    }

    logger.info('Starting remote browser session', {
      sessionId,
      url,
      userId
    })

    const session = await remoteBrowserService.createSession(
      sessionId,
      url,
      userAgent,
      userId
    )

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      message: 'Remote browser session started'
    })
  } catch (error) {
    logger.error('Failed to start remote browser session', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to start remote browser session'
      },
      { status: 500 }
    )
  }
}
