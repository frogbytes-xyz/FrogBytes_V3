import { createClient } from '@/services/supabase/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import {
  requireAdmin,
  logAdminAction,
  createAuditLogEntry
} from '@/lib/auth/admin-auth'

/**
 * GET /api/admin/users
 *
 * Retrieve list of users (admin only)
 *
 * Query Parameters:
 * - limit: Maximum number of users to return (default: 50, max: 200)
 *
 * Returns:
 * - 200: List of users with basic profile information
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const supabase = await createClient()
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)

    // Get recent users
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, full_name, role, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      throw error
    }

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(
        request,
        user,
        'view_users',
        'user_list',
        undefined,
        { limit }
      )
    )

    return NextResponse.json({
      success: true,
      users: users || []
    })
  } catch (error) {
    logger.error('Error fetching users', { error })
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch users',
        users: []
      },
      { status: 500 }
    )
  }
})
