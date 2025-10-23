import { createClient, createAdminClient } from '@/services/supabase/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { getAuthUser, type AuthUser } from './helpers'

/**
 * User roles in the system
 */
export type UserRole = 'user' | 'admin' | 'super_admin'

/**
 * Extended user interface with role information
 */
export interface AdminUser extends AuthUser {
  role: UserRole
}

/**
 * Audit log entry for admin actions
 */
export interface AuditLogEntry {
  admin_id: string
  action: string
  resource_type: string
  resource_id?: string
  details?: Record<string, unknown>
  ip_address?: string
  user_agent?: string
}

/**
 * Get authenticated user with role information
 *
 * Extends the basic getAuthUser to include role data needed for admin checks.
 * Use this instead of getAuthUser when you need role information.
 *
 * @param request - Next.js request object
 * @returns User object with role if authenticated, null otherwise
 *
 * @example
 * ```typescript
 * const user = await getAdminUser(request)
 * if (user?.role === 'admin') {
 *   // Admin logic
 * }
 * ```
 */
export async function getAdminUser(
  request: NextRequest
): Promise<AdminUser | null> {
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

    // Fetch user profile with role
    const { data: profileData } = await supabase
      .from('users')
      .select('full_name, university, reputation_score, role')
      .eq('id', user.id)
      .maybeSingle()

    const profile = profileData as {
      full_name?: string
      university?: string
      reputation_score?: number
      role?: UserRole
    } | null

    return {
      id: user.id,
      email: user.email!,
      full_name: profile?.full_name || null,
      university: profile?.university || null,
      reputation_score: profile?.reputation_score || 0,
      role: profile?.role || 'user'
    }
  } catch (error) {
    logger.error('Error getting admin user', { error })
    return null
  }
}

/**
 * Check if a user has admin privileges
 *
 * Returns true if user has 'admin' or 'super_admin' role.
 * This is the primary function for checking admin access.
 *
 * @param user - User object with role
 * @returns true if user is an admin or super admin
 *
 * @example
 * ```typescript
 * const user = await getAdminUser(request)
 * if (isAdmin(user)) {
 *   // Allow admin action
 * }
 * ```
 */
export function isAdmin(user: AdminUser | null): boolean {
  if (!user) return false
  return user.role === 'admin' || user.role === 'super_admin'
}

/**
 * Check if a user has super admin privileges
 *
 * Returns true only if user has 'super_admin' role.
 * Use this for actions that should only be available to super admins.
 *
 * @param user - User object with role
 * @returns true if user is a super admin
 *
 * @example
 * ```typescript
 * const user = await getAdminUser(request)
 * if (isSuperAdmin(user)) {
 *   // Allow super admin action (e.g., changing user roles)
 * }
 * ```
 */
export function isSuperAdmin(user: AdminUser | null): boolean {
  if (!user) return false
  return user.role === 'super_admin'
}

/**
 * Verify admin access from request
 *
 * Convenience function that gets the user and checks if they're an admin.
 * Use this when you just need a quick boolean check.
 *
 * @param request - Next.js request object
 * @returns true if the request is from an admin user
 *
 * @example
 * ```typescript
 * if (await verifyAdminAccess(request)) {
 *   // Process admin request
 * }
 * ```
 */
export async function verifyAdminAccess(
  request: NextRequest
): Promise<boolean> {
  const user = await getAdminUser(request)
  return isAdmin(user)
}

/**
 * Verify super admin access from request
 *
 * Convenience function that gets the user and checks if they're a super admin.
 *
 * @param request - Next.js request object
 * @returns true if the request is from a super admin user
 */
export async function verifySuperAdminAccess(
  request: NextRequest
): Promise<boolean> {
  const user = await getAdminUser(request)
  return isSuperAdmin(user)
}

/**
 * Log an admin action to the audit trail
 *
 * All admin actions should be logged for security and compliance.
 * This function writes to the admin_audit_logs table using the service role
 * to bypass RLS restrictions.
 *
 * @param entry - Audit log entry with action details
 * @returns Promise that resolves when log is written
 *
 * @example
 * ```typescript
 * await logAdminAction({
 *   admin_id: user.id,
 *   action: 'delete_user',
 *   resource_type: 'user',
 *   resource_id: deletedUserId,
 *   details: { reason: 'spam account' },
 *   ip_address: request.headers.get('x-forwarded-for') || undefined,
 *   user_agent: request.headers.get('user-agent') || undefined
 * })
 * ```
 */
export async function logAdminAction(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createAdminClient()

    const { error } = await supabase.from('admin_audit_logs').insert({
      admin_id: entry.admin_id,
      action: entry.action,
      resource_type: entry.resource_type,
      ...(entry.resource_id ? { resource_id: entry.resource_id } : {}),
      ...(entry.details ? { details: entry.details } : {}),
      ...(entry.ip_address ? { ip_address: entry.ip_address } : {}),
      ...(entry.user_agent ? { user_agent: entry.user_agent } : {})
    })

    if (error) {
      logger.error('Failed to log admin action', { error, entry })
    }
  } catch (error) {
    // Log error but don't throw - audit logging should not break functionality
    logger.error('Error logging admin action', { error, entry })
  }
}

/**
 * Require admin authentication for a route handler
 *
 * This is a wrapper function that handles admin authentication checking.
 * If user is not authenticated or not an admin, returns appropriate error response.
 * Otherwise, calls the handler with the authenticated admin user.
 *
 * @param handler - Route handler function that receives (request, user)
 * @param requireSuperAdmin - If true, only super admins are allowed (default: false)
 * @returns Wrapped route handler with admin authentication
 *
 * @example
 * ```typescript
 * export const GET = requireAdmin(async (request, user) => {
 *   // user is guaranteed to be an admin here
 *   return NextResponse.json({ data: 'admin data' })
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Require super admin for sensitive operations
 * export const POST = requireAdmin(async (request, user) => {
 *   // user is guaranteed to be a super admin here
 *   return NextResponse.json({ success: true })
 * }, true)
 * ```
 */
export function requireAdmin<T extends NextRequest>(
  handler: (request: T, user: AdminUser) => Promise<NextResponse> | NextResponse,
  requireSuperAdmin = false
) {
  return async (request: T): Promise<NextResponse> => {
    // First check if user is authenticated
    const authUser = await getAuthUser(request)

    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized',
          details: ['Authentication required. Please log in to continue.']
        },
        { status: 401 }
      )
    }

    // Get user with role information
    const adminUser = await getAdminUser(request)

    if (!adminUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden',
          details: ['Unable to verify user permissions.']
        },
        { status: 403 }
      )
    }

    // Check admin access
    if (requireSuperAdmin) {
      if (!isSuperAdmin(adminUser)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Forbidden',
            details: [
              'Super administrator privileges required to access this resource.'
            ]
          },
          { status: 403 }
        )
      }
    } else {
      if (!isAdmin(adminUser)) {
        return NextResponse.json(
          {
            success: false,
            error: 'Forbidden',
            details: ['Administrator privileges required to access this resource.']
          },
          { status: 403 }
        )
      }
    }

    return handler(request, adminUser)
  }
}

/**
 * Extract client IP address from request
 *
 * Checks various headers that might contain the client IP,
 * prioritizing X-Forwarded-For which is commonly set by proxies.
 *
 * @param request - Next.js request object
 * @returns IP address string or undefined if not found
 */
export function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwarded.split(',')[0]?.trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Fallback to remote address (usually undefined in serverless environments)
  return undefined
}

/**
 * Create a standardized audit log entry from a request
 *
 * Helper function to create audit log entries with common fields extracted
 * from the request object.
 *
 * @param request - Next.js request object
 * @param user - Admin user performing the action
 * @param action - Action being performed
 * @param resourceType - Type of resource being acted upon
 * @param resourceId - Optional ID of the specific resource
 * @param details - Optional additional details about the action
 * @returns Audit log entry ready to be logged
 */
export function createAuditLogEntry(
  request: NextRequest,
  user: AdminUser,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, unknown>
): AuditLogEntry {
  return {
    admin_id: user.id,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    details,
    ip_address: getClientIp(request),
    user_agent: request.headers.get('user-agent') || undefined
  }
}
