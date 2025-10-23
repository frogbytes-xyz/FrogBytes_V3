import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { remoteBrowserService } from '@/lib/services/remote-browser-service'
import { logger } from '@/lib/utils/logger'

/**
 * GET /api/remote-browser/cookies?sessionId=xxx
 *
 * Extracts cookies from the remote browser session after authentication
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

    const cookies = await remoteBrowserService.extractCookies(sessionId)

    if (!cookies) {
      return NextResponse.json(
        { error: 'Session not found or cookie extraction failed' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      cookies,
      cookieCount: cookies
        .split('\n')
        .filter(line => !line.startsWith('#') && line.trim()).length
    })
  } catch (error) {
    logger.error('Failed to extract cookies', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to extract cookies'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/remote-browser/cookies?sessionId=xxx
 *
 * Closes the remote browser session
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      )
    }

    await remoteBrowserService.closeSession(sessionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to close session', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to close session'
      },
      { status: 500 }
    )
  }
}
