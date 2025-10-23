/**
 * API Route: Capture Browser Info
 *
 * This endpoint captures the user's browser information for cookie extraction.
 * It's called when the frontend MiniBrowser starts to store browser context.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

/**
 * POST /api/auth/capture-browser-info
 *
 * Captures user's browser information for later cookie extraction
 *
 * @param request - The incoming request containing browser info and sessionId
 * @returns JSON response confirming browser info was stored
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      sessionId: string
      userAgent: string
      viewport: { width: number; height: number }
      language: string
      timezone: string
      platform: string
    }

    const { sessionId, userAgent, viewport, language, timezone, platform } =
      body

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameter: sessionId' },
        { status: 400 }
      )
    }

    logger.info('Capturing browser info for frontend session', {
      sessionId,
      userAgent: userAgent?.substring(0, 60),
      viewport,
      language,
      timezone,
      platform
    })

    // For now, we&apos;ll just log the browser info
    // In a production system, you might want to store this in a database
    // or cache it for later use during cookie extraction

    return NextResponse.json({
      success: true,
      message: 'Browser info captured successfully',
      sessionId
    })
  } catch (error) {
    logger.error('Error in capture-browser-info endpoint', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
