'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/services/supabase/client'
import { logger } from '@/lib/utils/logger'
import type { UserRole } from '@/lib/auth/admin-auth'

/**
 * Admin user data with role information
 */
export interface AdminUserData {
  id: string
  email: string
  role: UserRole
  full_name?: string | null
  university?: string | null
  reputation_score?: number
}

/**
 * Custom hook for managing admin authentication state
 *
 * Extends the basic auth functionality to include role checking.
 * Use this hook in admin pages and components to verify admin access.
 *
 * @returns Admin auth state with user data, role, loading status, and helper functions
 *
 * @example
 * ```tsx
 * function AdminDashboard() {
 *   const { user, isAdmin, loading } = useAdminAuth()
 *
 *   if (loading) return <div>Loading...</div>
 *   if (!isAdmin) return <div>Access Denied</div>
 *
 *   return <div>Admin Dashboard</div>
 * }
 * ```
 */
export function useAdminAuth() {
  const [user, setUser] = useState<AdminUserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    /**
     * Initialize admin auth state
     * Fetches user data including role from the database
     */
    const initializeAdminAuth = async () => {
      try {
        // Get current auth user
        const {
          data: { user: authUser },
          error: authError
        } = await supabase.auth.getUser()

        if (authError || !authUser) {
          setUser(null)
          setLoading(false)
          return
        }

        // Fetch user profile with role
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('id, email, role, full_name, university, reputation_score')
          .eq('id', authUser.id)
          .maybeSingle()

        if (profileError) {
          logger.error('Error fetching user profile', { error: profileError })
          setError('Failed to load user profile')
          setUser(null)
          setLoading(false)
          return
        }

        if (!profileData) {
          setUser(null)
          setLoading(false)
          return
        }

        setUser({
          id: profileData.id,
          email: profileData.email,
          role: (profileData.role as UserRole) || 'user',
          full_name: profileData.full_name,
          university: profileData.university,
          reputation_score: profileData.reputation_score || 0
        })
      } catch (err) {
        logger.error('Error initializing admin auth', { error: err })
        setError('Failed to initialize authentication')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    initializeAdminAuth()

    // Listen for auth changes
    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null)
        setLoading(false)
      } else {
        // Re-fetch user data when auth state changes
        initializeAdminAuth()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  /**
   * Check if current user has admin privileges
   */
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'

  /**
   * Check if current user has super admin privileges
   */
  const isSuperAdmin = user?.role === 'super_admin'

  /**
   * Check if user is authenticated (regardless of role)
   */
  const isAuthenticated = !!user

  return {
    user,
    loading,
    error,
    isAdmin,
    isSuperAdmin,
    isAuthenticated
  }
}
