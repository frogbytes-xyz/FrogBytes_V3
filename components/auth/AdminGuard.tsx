'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/hooks/useAdminAuth'
import { logger } from '@/lib/utils/logger'

/**
 * Props for AdminGuard component
 */
interface AdminGuardProps {
  /**
   * Child components to render if user has admin access
   */
  children: React.ReactNode

  /**
   * Require super admin role (default: false)
   * If true, only super_admin users can access
   * If false, both admin and super_admin users can access
   */
  requireSuperAdmin?: boolean

  /**
   * Custom loading component to show while checking auth
   */
  loadingComponent?: React.ReactNode

  /**
   * Custom component to show when access is denied
   */
  accessDeniedComponent?: React.ReactNode

  /**
   * Redirect URL when user is not authenticated (default: '/login')
   */
  redirectToLogin?: string

  /**
   * Redirect URL when user lacks admin privileges (default: '/')
   */
  redirectToHome?: string
}

/**
 * AdminGuard Component
 *
 * Protects admin-only pages by checking user authentication and role.
 * Redirects unauthorized users to appropriate pages.
 *
 * Use this component to wrap admin pages and ensure only authorized
 * users can access them. It handles loading states, authentication checks,
 * and role-based access control.
 *
 * @param props - AdminGuard configuration
 * @returns Protected content or loading/error states
 *
 * @example Basic usage
 * ```tsx
 * export default function AdminDashboard() {
 *   return (
 *     <AdminGuard>
 *       <div>Admin Dashboard Content</div>
 *     </AdminGuard>
 *   )
 * }
 * ```
 *
 * @example Super admin only
 * ```tsx
 * export default function UserManagement() {
 *   return (
 *     <AdminGuard requireSuperAdmin>
 *       <div>User Management (Super Admin Only)</div>
 *     </AdminGuard>
 *   )
 * }
 * ```
 *
 * @example Custom loading and access denied components
 * ```tsx
 * <AdminGuard
 *   loadingComponent={<CustomSpinner />}
 *   accessDeniedComponent={<AccessDeniedPage />}
 * >
 *   <AdminContent />
 * </AdminGuard>
 * ```
 */
export function AdminGuard({
  children,
  requireSuperAdmin = false,
  loadingComponent,
  accessDeniedComponent,
  redirectToLogin = '/login',
  redirectToHome = '/'
}: AdminGuardProps): React.ReactElement {
  const router = useRouter()
  const { user, loading, isAdmin, isSuperAdmin, isAuthenticated } =
    useAdminAuth()

  useEffect(() => {
    // Don't redirect while still loading
    if (loading) return

    // Not authenticated - redirect to login
    if (!isAuthenticated) {
      logger.warn('Unauthorized admin access attempt - not authenticated')
      router.push(redirectToLogin)
      return
    }

    // Authenticated but not admin - redirect to home
    if (requireSuperAdmin && !isSuperAdmin) {
      logger.warn('Unauthorized super admin access attempt', {
        userId: user?.id,
        role: user?.role
      })
      router.push(redirectToHome)
      return
    }

    if (!requireSuperAdmin && !isAdmin) {
      logger.warn('Unauthorized admin access attempt', {
        userId: user?.id,
        role: user?.role
      })
      router.push(redirectToHome)
      return
    }
  }, [
    loading,
    isAuthenticated,
    isAdmin,
    isSuperAdmin,
    requireSuperAdmin,
    router,
    redirectToLogin,
    redirectToHome,
    user
  ])

  // Show loading state
  if (loading) {
    if (loadingComponent) {
      return <>{loadingComponent}</>
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated) {
    if (accessDeniedComponent) {
      return <>{accessDeniedComponent}</>
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Authentication Required
          </h1>
          <p className="mb-6 text-gray-600">
            You must be logged in to access this page.
          </p>
          <p className="text-sm text-gray-500">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // Authenticated but lacks required admin role
  if (requireSuperAdmin && !isSuperAdmin) {
    if (accessDeniedComponent) {
      return <>{accessDeniedComponent}</>
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Access Denied
          </h1>
          <p className="mb-6 text-gray-600">
            Super administrator privileges are required to access this page.
          </p>
          <p className="text-sm text-gray-500">Redirecting...</p>
        </div>
      </div>
    )
  }

  if (!requireSuperAdmin && !isAdmin) {
    if (accessDeniedComponent) {
      return <>{accessDeniedComponent}</>
    }

    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">
            Access Denied
          </h1>
          <p className="mb-6 text-gray-600">
            Administrator privileges are required to access this page.
          </p>
          <p className="text-sm text-gray-500">Redirecting...</p>
        </div>
      </div>
    )
  }

  // User has required permissions - render children
  return <>{children}</>
}
