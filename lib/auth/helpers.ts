import { createClient } from '@/services/supabase/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
// (type Database import removed — not used in this helper)

export interface AuthUser {
  id: string
  email: string
  full_name?: string | null
  university?: string | null
  reputation_score?: number
}

/**
 * Get authenticated user from request
 *
 * This function should be used in API route handlers to get the current user.
 * The middleware adds user info to headers, but we still verify the session.
 *
 * @param request - Next.js request object
 * @returns User object if authenticated, null otherwise
 */
export async function getAuthUser(
  _request: NextRequest
): Promise<AuthUser | null> {
  try {
    const supabase = await createClient()

    // Get user from session
    const {
      data: { user },
      error
    } = await supabase.auth.getUser()

    if (error || !user) {
      return null
    }

    // Fetch user profile
    const { data: profileData } = await supabase
      .from('users')
      .select('full_name, university, reputation_score')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as {
      full_name?: string
      university?: string
      reputation_score?: number
    } | null

    return {
      id: user.id,
      email: user.email!,
      full_name: profile?.full_name || null,
      university: profile?.university || null,
      reputation_score: profile?.reputation_score || 0
    }
  } catch (error) {
    logger.error('Error getting auth user', error)
    return null
  }
}

/**
 * Require authentication for a route handler
 *
 * This is a wrapper function that handles authentication checking.
 * If user is not authenticated, returns 401 response.
 * Otherwise, calls the handler with the authenticated user.
 *
 * @param handler - Route handler function that receives (request, user)
 * @returns Next.js Response
 */
export function requireAuth<T extends NextRequest>(
  handler: (request: T, user: AuthUser) => Promise<NextResponse> | NextResponse
) {
  return async (request: T): Promise<NextResponse> => {
    const user = await getAuthUser(request)

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          details: ['Authentication required']
        },
        { status: 401 }
      )
    }

    return handler(request, user)
  }
}

/**
 * Check if user has permission (placeholder for future RBAC)
 *
 * Currently just checks if user exists.
 * Can be extended to check roles, permissions, etc.
 *
 * @param user - Authenticated user
 * @param permission - Permission to check (unused for now)
 * @returns true if user has permission
 */
export function hasPermission(
  user: AuthUser | null,
  _permission?: string
): boolean {
  if (!user) return false

  // Add role-based checks here in the future
  // For now, just check if user exists
  return true
}

/**
 * Extract bearer token from Authorization header
 *
 * @param request - Next.js request object
 * @returns JWT token string or null
 */
export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')

  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }

  return authHeader.substring(7) // Remove 'Bearer ' prefix
}
