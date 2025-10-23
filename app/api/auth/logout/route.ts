import { createClient } from '@/services/supabase/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
// Import authenticationManager dynamically inside handler to avoid pulling
// server-only puppeteer dependencies into Next's build analysis.
import { logger } from '@/lib/utils/logger'

export interface LogoutResponse {
  success: boolean
  message: string
  sessionsCleanedUp?: number
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

/**
 * POST /api/auth/logout
 *
 * Log out the current user and clean up all associated sessions.
 * This endpoint performs the following cleanup operations:
 * - Signs out from Supabase Auth
 * - Cleans up all active mini-browser authentication sessions for the user
 * - Closes any open browser instances associated with the user's sessions
 *
 * @param request - Next.js request object (user auth from cookies)
 * @returns 200 on success with cleanup count, 401 if not authenticated, 500 on error
 */
export async function POST(_request: NextRequest) {
  try {
    // Create Supabase client
    const supabase = await createClient()

    // Get current user
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Unauthorized',
          details: ['No active session found']
        },
        { status: 401 }
      )
    }

    const userId = user.id

    // Clean up mini-browser sessions for this user
    let cleanedUpCount = 0
    try {
      const { authenticationManager } = await import(
        '@/lib/services/authentication-manager'
      )
      const sessions = authenticationManager.getActiveSessions()
      const userSessions = sessions.filter(
        session => session.userId === userId && session.type === 'mini-browser'
      )

      logger.info(
        `Found ${userSessions.length} mini-browser sessions for user ${userId}`
      )

      for (const session of userSessions) {
        const cancelled = await authenticationManager.cancelSession(
          session.sessionId
        )
        if (cancelled) {
          cleanedUpCount++
        }
      }

      logger.info(
        `Cleaned up ${cleanedUpCount} mini-browser sessions for user ${userId}`
      )
    } catch (cleanupError) {
      // Log error but continue with logout
      logger.error(
        'Error cleaning up mini-browser sessions during logout',
        cleanupError,
        {
          userId
        }
      )
    }

    // Sign out from Supabase
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      logger.error('Supabase signout error', signOutError, { userId })
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Logout failed',
          details: [signOutError.message]
        },
        { status: 500 }
      )
    }

    // Success response
    return NextResponse.json<LogoutResponse>(
      {
        success: true,
        message: 'Logout successful',
        sessionsCleanedUp: cleanedUpCount
      },
      { status: 200 }
    )
  } catch (error) {
    // Handle unexpected errors
    logger.error('Unexpected logout error', error)
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: ['An unexpected error occurred during logout']
      },
      { status: 500 }
    )
  }
}
