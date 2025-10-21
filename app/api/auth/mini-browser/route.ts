import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth/helpers'
import { authenticationManager } from '@/lib/services/authentication-manager'
import { logger } from '@/lib/utils/logger'

export interface MiniBrowserAuthRequest {
  url: string
  userId: string
  timeout?: number
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
 * POST /api/auth/mini-browser
 * Start a mini-browser authentication session
 */
export async function POST(request: NextRequest): Promise<NextResponse<MiniBrowserAuthResponse>> {
  try {
    // Get authenticated user
    const user = await getAuthUser(request)

    if (!user) {
      return NextResponse.json<MiniBrowserAuthResponse>(
        {
          success: false,
          error: 'Unauthorized',
          errorType: 'authentication',
          message: 'Authentication required',
        },
        { status: 401 }
      )
    }

    const body = await request.json() as MiniBrowserAuthRequest
    const { url, userId, timeout = 300000 } = body

    if (!url) {
      return NextResponse.json<MiniBrowserAuthResponse>(
        {
          success: false,
          error: 'Bad Request',
          errorType: 'validation',
          message: 'URL is required',
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
          message: 'User ID mismatch',
        },
        { status: 403 }
      )
    }

    logger.info(`Starting mini-browser authentication for user ${userId} and URL: ${url}`)

    // For mini-browser, we don't need to start a Puppeteer session
    // The frontend mini-browser will handle the authentication directly
    const sessionId = `mini-browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    return NextResponse.json<MiniBrowserAuthResponse>({
      success: true,
      sessionId,
      authUrl: url,
      message: 'Mini-browser authentication session started successfully',
    })

  } catch (error) {
    logger.error('Mini-browser authentication error', error)
    
    return NextResponse.json<MiniBrowserAuthResponse>(
      {
        success: false,
        error: 'Internal Server Error',
        errorType: 'internal',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/mini-browser?sessionId=xxx
 * Check the status of a mini-browser authentication session
 */
export async function GET(request: NextRequest): Promise<NextResponse<MiniBrowserStatusResponse>> {
  try {
    // Get authenticated user
    const user = await getAuthUser(request)

    if (!user) {
      return NextResponse.json<MiniBrowserStatusResponse>(
        {
          success: false,
          status: 'failed',
          error: 'Unauthorized',
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
          error: 'Session ID is required',
        },
        { status: 400 }
      )
    }

    // For mini-browser sessions, we don't track them in the backend
    // The frontend handles the authentication flow
    // This endpoint is mainly for compatibility with the polling mechanism
    
    // Check if it's a mini-browser session ID
    if (!sessionId.startsWith('mini-browser-')) {
      return NextResponse.json<MiniBrowserStatusResponse>(
        {
          success: false,
          status: 'failed',
          error: 'Invalid session ID',
        },
        { status: 400 }
      )
    }

    // For mini-browser, we return a pending status
    // The actual authentication status is determined by the frontend
    return NextResponse.json<MiniBrowserStatusResponse>({
      success: true,
      status: 'pending',
      message: 'Mini-browser authentication in progress',
    })

  } catch (error) {
    logger.error('Mini-browser status check error', error)
    
    return NextResponse.json<MiniBrowserStatusResponse>(
      {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}
