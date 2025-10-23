import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/helpers'
// Import authenticationManager dynamically inside handlers to avoid
// pulling puppeteer-related modules into Next's build analysis.
import { logger } from '@/lib/utils/logger'
import type { BrowserInfo } from '@/lib/utils/browser-info'

export interface MiniBrowserAuthRequest {
  url: string
  userId: string
  timeout?: number
  browserInfo?: BrowserInfo // Stored for future API requests, not for Puppeteer
}

export interface MiniBrowserAuthResponse {
  success: boolean
  sessionId?: string
  authUrl?: string
  error?: string
  errorType?: string
  message?: string
}

export interface MiniBrowserStatusResponse {
  success: boolean
  status: 'pending' | 'authenticated' | 'failed' | 'timeout'
  message?: string
  cookies?: string
  error?: string
}

/**
 * Classifies error messages into specific error types for better client-side handling
 *
 * @param errorMessage - The error message to classify
 * @returns The error type category
 */
function classifyError(errorMessage: string): string {
  const message = errorMessage.toLowerCase()

  if (message.includes('timeout') || message.includes('timed out')) {
    return 'timeout'
  }

  if (message.includes('invalid') || message.includes('validation')) {
    return 'validation'
  }

  if (message.includes('unauthorized') || message.includes('authentication')) {
    return 'authentication'
  }

  if (message.includes('forbidden') || message.includes('permission')) {
    return 'authorization'
  }

  if (message.includes('network') || message.includes('connection')) {
    return 'network'
  }

  return 'internal'
}

/**
 * POST /api/auth/mini-browser
 *
 * Initiates a mini-browser authentication session for the authenticated user.
 * Creates a session in the AuthenticationManager and returns session details
 * for the frontend to begin the authentication flow.
 *
 * @param request - Next.js request object containing authentication URL and user details
 * @returns JSON response with session ID and authentication URL or error details
 *
 * @example
 * POST /api/auth/mini-browser
 * Body: { url: "https://example.com/login", userId: "user123", timeout: 300000 }
 * Response: { success: true, sessionId: "mini-browser-abc123", authUrl: "https://example.com/login" }
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<MiniBrowserAuthResponse>> {
  try {
    // Get authenticated user
    const user = await getAuthUser(request)

    if (!user) {
      return NextResponse.json<MiniBrowserAuthResponse>(
        {
          success: false,
          error: 'Unauthorized',
          errorType: 'authentication',
          message: 'Authentication required'
        },
        { status: 401 }
      )
    }

    const body = (await request.json()) as MiniBrowserAuthRequest
    const { url, userId, timeout, browserInfo } = body

    if (!url) {
      return NextResponse.json<MiniBrowserAuthResponse>(
        {
          success: false,
          error: 'Bad Request',
          errorType: 'validation',
          message: 'URL is required'
        },
        { status: 400 }
      )
    }

    if (userId !== user.id) {
      return NextResponse.json<MiniBrowserAuthResponse>(
        {
          success: false,
          error: 'Forbidden',
          errorType: 'authorization',
          message: 'User ID mismatch'
        },
        { status: 403 }
      )
    }

    logger.info(`Creating mini-browser session for user ${userId}`, {
      hasBrowserInfo: !!browserInfo,
      userAgent: browserInfo?.userAgent.substring(0, 50)
    })

    // Create a simple session ID for tracking (no Puppeteer needed)
    const sessionId = `mini-browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      // Store session with browser info for future API requests
      const { authenticationManager } = await import(
        '@/lib/services/authentication-manager'
      )
      await authenticationManager.createFrontendMiniBrowserSession({
        sessionId,
        url,
        userId,
        timeout: timeout ?? 300000,
        ...(browserInfo ? { browserInfo } : {})
      })

      logger.info(`Mini-browser session created: ${sessionId}`)

      return NextResponse.json<MiniBrowserAuthResponse>({
        success: true,
        sessionId,
        authUrl: url,
        message: 'Mini-browser authentication session started successfully'
      })
    } catch (sessionError) {
      logger.error('Failed to create mini-browser session', sessionError)

      const errorMessage =
        sessionError instanceof Error
          ? sessionError.message
          : 'Unknown error occurred'
      const errorType = classifyError(errorMessage)

      return NextResponse.json<MiniBrowserAuthResponse>(
        {
          success: false,
          error: errorMessage,
          errorType,
          message: 'Failed to create authentication session'
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('Mini-browser authentication error', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    const errorType = classifyError(errorMessage)

    return NextResponse.json<MiniBrowserAuthResponse>(
      {
        success: false,
        error: errorMessage,
        errorType,
        message: 'Failed to process authentication request'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/mini-browser?sessionId=xxx
 *
 * Retrieves the current status of a mini-browser authentication session.
 * This endpoint is polled by the frontend to detect when the user has
 * successfully authenticated and cookies have been extracted.
 *
 * @param request - Next.js request object containing sessionId query parameter
 * @returns JSON response with session status, cookies (if authenticated), and message
 *
 * @example
 * GET /api/auth/mini-browser?sessionId=mini-browser-abc123
 * Response: { success: true, status: "authenticated", cookies: "session=xyz; token=abc" }
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<MiniBrowserStatusResponse>> {
  try {
    // Get authenticated user
    const user = await getAuthUser(request)

    if (!user) {
      return NextResponse.json<MiniBrowserStatusResponse>(
        {
          success: false,
          status: 'failed',
          error: 'Unauthorized'
        },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json<MiniBrowserStatusResponse>(
        {
          success: false,
          status: 'failed',
          error: 'Session ID is required'
        },
        { status: 400 }
      )
    }

    // Check if it's a mini-browser session ID
    if (!sessionId.startsWith('mini-browser-')) {
      return NextResponse.json<MiniBrowserStatusResponse>(
        {
          success: false,
          status: 'failed',
          error: 'Invalid session ID'
        },
        { status: 400 }
      )
    }

    logger.debug(`Checking mini-browser session status: ${sessionId}`)

    const { authenticationManager } = await import(
      '@/lib/services/authentication-manager'
    )
    const sessionStatus =
      authenticationManager.getMiniBrowserSessionStatus(sessionId)

    logger.debug(`Session ${sessionId} status: ${sessionStatus.status}`)

    const response: MiniBrowserStatusResponse = {
      success: true,
      status: sessionStatus.status,
      ...(sessionStatus.cookies ? { cookies: sessionStatus.cookies } : {}),
      ...(sessionStatus.message ? { message: sessionStatus.message } : {})
    }

    return NextResponse.json<MiniBrowserStatusResponse>(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
        Expires: '0'
      }
    })
  } catch (error) {
    logger.error('Mini-browser status check error', error)

    return NextResponse.json<MiniBrowserStatusResponse>(
      {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/auth/mini-browser?sessionId=xxx
 *
 * Cleans up a mini-browser authentication session when the component unmounts
 * or when the authentication flow is cancelled.
 *
 * @param request - Next.js request object containing sessionId query parameter
 * @returns JSON response confirming session cleanup
 *
 * @example
 * DELETE /api/auth/mini-browser?sessionId=mini-browser-abc123
 * Response: { success: true, message: "Session cleaned up successfully" }
 */
export async function DELETE(
  request: NextRequest
): Promise<
  NextResponse<{ success: boolean; message?: string; error?: string }>
> {
  try {
    // Get authenticated user
    const user = await getAuthUser(request)

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized'
        },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Session ID is required'
        },
        { status: 400 }
      )
    }

    // Check if it's a mini-browser session ID
    if (!sessionId.startsWith('mini-browser-')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid session ID'
        },
        { status: 400 }
      )
    }

    logger.info(`Cleaning up mini-browser session: ${sessionId}`)

    // Clean up the session in AuthenticationManager
    const { authenticationManager } = await import(
      '@/lib/services/authentication-manager'
    )
    authenticationManager.cleanupMiniBrowserSession(sessionId)

    return NextResponse.json({
      success: true,
      message: 'Session cleaned up successfully'
    })
  } catch (error) {
    logger.error('Mini-browser session cleanup error', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
