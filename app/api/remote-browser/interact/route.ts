import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { remoteBrowserService } from '@/lib/services/remote-browser-service'
import { logger } from '@/lib/utils/logger'

/**
 * POST /api/remote-browser/interact
 *
 * Handles user interactions with the remote browser
 *
 * Body:
 * - sessionId: string
 * - action: 'click' | 'type'
 * - x?: number (for click)
 * - y?: number (for click)
 * - text?: string (for type)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const { sessionId, action, x, y, text } = body

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'sessionId and action are required' },
        { status: 400 }
      )
    }

    let success = false

    if (action === 'click' && typeof x === 'number' && typeof y === 'number') {
      success = await remoteBrowserService.handleClick(sessionId, x, y)
    } else if (action === 'type' && typeof text === 'string') {
      success = await remoteBrowserService.handleKeypress(sessionId, text)
    } else {
      return NextResponse.json(
        { error: 'Invalid action or missing parameters' },
        { status: 400 }
      )
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to handle interaction' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to handle interaction', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to handle interaction'
      },
      { status: 500 }
    )
  }
}
