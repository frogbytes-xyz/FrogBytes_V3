import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { remoteBrowserService } from '@/lib/services/remote-browser-service'
import { logger } from '@/lib/utils/logger'

/**
 * GET /api/remote-browser/screenshot?sessionId=xxx
 *
 * Gets a screenshot of the remote browser session
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    const screenshot = await remoteBrowserService.getScreenshot(sessionId)

    if (!screenshot) {
      return NextResponse.json(
        { error: 'Session not found or screenshot failed' },
        { status: 404 }
      )
    }

    return new NextResponse(screenshot as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
  } catch (error) {
    logger.error('Failed to get screenshot', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to get screenshot'
      },
      { status: 500 }
    )
  }
}
