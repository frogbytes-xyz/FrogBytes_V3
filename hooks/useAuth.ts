'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/services/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

/**
 * Custom hook for managing client-side authentication state
 * Provides real-time updates via Supabase's auth state change listener
 *
 * @returns {object} Auth state with user, session, loading status, and signOut function
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  /**
   * Signs out the current user and redirects to home
   */
  const signOut = async () => {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return {
    user,
    session,
    loading,
    signOut,
    isAuthenticated: !!user
  }
}
