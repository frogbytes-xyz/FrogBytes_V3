'use client'

import { useState, useCallback, useRef } from 'react'

export interface MiniBrowserAuthState {
  isOpen: boolean
  isLoading: boolean
  sessionId: string | null
  authUrl: string | null
  error: string | null
  isAuthenticated: boolean
}

export interface MiniBrowserAuthOptions {
  url: string
  userId: string
  timeout?: number
  onSuccess?: (cookies: string) => void
  onError?: (error: string) => void
  onClose?: () => void
}

export function useMiniBrowserAuth() {
  const [state, setState] = useState<MiniBrowserAuthState>({
    isOpen: false,
    isLoading: false,
    sessionId: null,
    authUrl: null,
    error: null,
    isAuthenticated: false,
  })

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Start authentication session
  const startAuth = useCallback(async (options: MiniBrowserAuthOptions) => {
    setState(prev => ({
      ...prev,
      isLoading: false, // No loading since we're not calling backend
      error: null,
      isAuthenticated: false,
    }))

    try {
      // Generate a simple session ID for tracking
      const sessionId = `mini-browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

      setState(prev => ({
        ...prev,
        isOpen: true,
        sessionId,
        authUrl: options.url,
        error: null,
      }))

      // No polling needed - the mini-browser handles authentication directly
      // The success/error callbacks will be called by the MiniBrowser component

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start authentication'
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      options.onError?.(errorMessage)
    }
  }, [])

  // No polling needed for frontend-only authentication

  // Close mini-browser
  const closeAuth = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      isLoading: false,
      sessionId: null,
      authUrl: null,
      error: null,
      isAuthenticated: false,
    }))

    // Stop polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  // Cleanup on unmount
  const cleanup = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }, [])

  return {
    ...state,
    startAuth,
    closeAuth,
    cleanup,
  }
}
