'use client'

import { logger } from '@/lib/utils/logger'
import { sessionManager } from '@/lib/services/session-manager'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  X,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Home,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react'

/**
 * Props interface for the MiniBrowser component
 */
interface MiniBrowserProps {
  /** The initial URL to load in the browser */
  url: string
  /** Callback function called when the browser is closed */
  onClose: () => void
  /** Optional callback function called when authentication is completed successfully */
  onAuthenticationComplete?: (cookies: string) => void
  /** Optional callback function called when authentication fails */
  onAuthenticationError?: (error: string) => void
  /** Optional title for the browser window (defaults to 'Authentication Required') */
  title?: string
  /** Optional height of the browser window (defaults to '600px') */
  height?: string
  /** Optional width of the browser window (defaults to '800px') */
  width?: string
  /** User ID for authentication session tracking */
  userId?: string
}

/**
 * Authentication session status types
 */
type AuthStatus = 'idle' | 'authenticating' | 'authenticated' | 'failed'

/**
 * Session timeout in milliseconds (5 minutes)
 */
const SESSION_TIMEOUT_MS = 5 * 60 * 1000

/**
 * Auto-close timeout in milliseconds (5 minutes) - security measure
 */
const AUTO_CLOSE_TIMEOUT_MS = 5 * 60 * 1000

/**
 * MiniBrowser Component - Remote Browser Implementation
 *
 * A secure, embedded browser component that uses a remote browser instance
 * to handle authentication flows. This bypasses X-Frame-Options restrictions
 * by running the browser on the server and streaming screenshots to the client.
 *
 * Features:
 * - Remote browser session management
 * - Real-time screenshot streaming
 * - Interactive click forwarding
 * - Cookie extraction after authentication
 * - Session timeout management
 * - No new tabs - everything in the UI
 *
 * @param props - The component props
 * @returns JSX element representing the mini browser interface
 */
export default function MiniBrowserFrontend({
  url,
  onClose,
  onAuthenticationComplete,
  onAuthenticationError,
  title = 'Authentication Required',
  height = '600px',
  width = '800px',
  userId
}: MiniBrowserProps): JSX.Element {
  // State management
  const [currentUrl, setCurrentUrl] = useState<string>(url)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [sessionStartTime, setSessionStartTime] = useState<number>(0)
  const [timeRemaining, setTimeRemaining] = useState<number>(SESSION_TIMEOUT_MS)
  const [showConfirmationButton, setShowConfirmationButton] =
    useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [showSuccess, setShowSuccess] = useState(false)

  // Remote browser state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [remoteBrowserReady, setRemoteBrowserReady] = useState(false)
  // lastScreenshotUpdate state replaced by ref to avoid frequent re-renders
  const [autoCloseTime, setAutoCloseTime] = useState<number>(0)
  const [showSecurityWarning, setShowSecurityWarning] = useState<boolean>(false)

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null)
  const screenshotPollingRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  // Separate refs for auto-close and warning timers to avoid clearing the wrong timeout
  const autoCloseTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const autoCloseWarningRef = useRef<NodeJS.Timeout | null>(null)
  // Use refs to avoid frequent state updates for last screenshot timestamp
  const lastScreenshotUpdateRef = useRef<number>(0)
  const pageVisibleRef = useRef<boolean>(true)
  const initializationRef = useRef(false)

  /**
   * Stop polling for screenshots
   */
  const stopScreenshotPolling = useCallback((): void => {
    if (screenshotPollingRef.current) {
      clearInterval(screenshotPollingRef.current)
      screenshotPollingRef.current = null
      logger.info('Stopped screenshot polling')
    }
  }, [])

  /**
   * Start auto-close timer for security
   */
  const startAutoCloseTimer = useCallback(
    (sid?: string): void => {
      const startTime = Date.now()
      setAutoCloseTime(startTime)

      logger.info('Starting auto-close timer for security', {
        timeoutMs: AUTO_CLOSE_TIMEOUT_MS,
        sessionId: sid ?? sessionId
      })

      // Clear any existing timers first
      if (autoCloseTimeoutRef.current) {
        clearTimeout(autoCloseTimeoutRef.current)
        autoCloseTimeoutRef.current = null
      }
      if (autoCloseWarningRef.current) {
        clearTimeout(autoCloseWarningRef.current)
        autoCloseWarningRef.current = null
      }

      // Show warning at 4 minutes (1 minute before auto-close)
      autoCloseWarningRef.current = setTimeout(() => {
        setShowSecurityWarning(true)
        logger.warn('Security warning: Browser will auto-close in 1 minute', {
          sessionId: sid ?? sessionId
        })
      }, AUTO_CLOSE_TIMEOUT_MS - 60000) // 4 minutes

      // Auto-close at 5 minutes
      autoCloseTimeoutRef.current = setTimeout(async () => {
        logger.warn(
          'Auto-closing remote browser session due to security timeout',
          {
            sessionId: sid ?? sessionId,
            elapsedMs: Date.now() - startTime
          }
        )

        // Close the browser session
        const closeSessionId = sid ?? sessionId
        if (closeSessionId) {
          try {
            await fetch(
              `/api/remote-browser/cookies?sessionId=${closeSessionId}`,
              {
                method: 'DELETE'
              }
            )
          } catch (error) {
            logger.error(
              'Failed to close remote browser session on auto-close',
              { error }
            )
          }
        }

        // Close the component
        onClose()
      }, AUTO_CLOSE_TIMEOUT_MS)
    },
    [sessionId, onClose]
  )

  /**
   * Stop auto-close timer
   */
  const stopAutoCloseTimer = useCallback((): void => {
    if (autoCloseTimeoutRef.current) {
      clearTimeout(autoCloseTimeoutRef.current)
      autoCloseTimeoutRef.current = null
    }
    if (autoCloseWarningRef.current) {
      clearTimeout(autoCloseWarningRef.current)
      autoCloseWarningRef.current = null
    }
    logger.info('Stopped auto-close timer')
    setShowSecurityWarning(false)
  }, [])

  /**
   * Poll for screenshots from remote browser with proper debouncing
   */
  const startScreenshotPolling = useCallback((sessionId: string): void => {
    logger.info('Starting screenshot polling', { sessionId })

    // Avoid duplicate intervals
    if (screenshotPollingRef.current) return

    const pollIntervalMs = 5000

    const poll = async (): Promise<void> => {
      if (!pageVisibleRef.current) return

      const now = Date.now()
      if (now - lastScreenshotUpdateRef.current < pollIntervalMs) return
      lastScreenshotUpdateRef.current = now

      const newScreenshotUrl = `/api/remote-browser/screenshot?sessionId=${sessionId}&t=${now}`

      // Preload image to avoid flicker and reduce reflows
      const img = new Image()
      img.src = newScreenshotUrl
      img.onload = () => {
        // Only update state when image successfully loaded
        setScreenshotUrl(newScreenshotUrl)
      }
      img.onerror = () => {
        logger.warn('Failed to load remote screenshot', {
          sessionId,
          url: newScreenshotUrl
        })
      }
    }

    // Initial poll
    void poll()

    screenshotPollingRef.current = setInterval(() => {
      void poll()
    }, pollIntervalMs)
  }, [])

  // Pause polling when page is hidden to reduce CPU/network usage
  useEffect(() => {
    const handleVisibility = () => {
      pageVisibleRef.current = !document.hidden
      if (!pageVisibleRef.current) {
        // stop immediate polling when hidden
        stopScreenshotPolling()
      } else if (sessionId && remoteBrowserReady) {
        // resume polling when visible
        startScreenshotPolling(sessionId)
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [
    sessionId,
    remoteBrowserReady,
    startScreenshotPolling,
    stopScreenshotPolling
  ])

  /**
   * Start remote browser session
   */
  const startRemoteBrowser = useCallback(async (): Promise<void> => {
    try {
      // Prevent multiple concurrent starts
      if (initializationRef.current) {
        logger.info(
          'startRemoteBrowser called but initialization already in progress, skipping'
        )
        return
      }

      initializationRef.current = true

      setAuthStatus('authenticating')
      setError(null)
      setSessionStartTime(Date.now())
      setIsLoading(true)

      // Check if there's already an active session and reuse it
      if (userId && sessionManager.hasActiveSession(userId, url)) {
        const existingSession = sessionManager.getExistingSession(userId, url)
        if (existingSession) {
          logger.info(
            'Found existing session, reusing instead of creating new one',
            {
              existingSessionId: existingSession.sessionId
            }
          )
          const existingId = existingSession.sessionId
          setSessionId(existingId)
          setSessionStartTime(Date.now())
          setRemoteBrowserReady(true)
          setIsLoading(false)
          setShowConfirmationButton(true)
          startScreenshotPolling(existingId)
          startAutoCloseTimer(existingId)
          // Register session with global manager in case it wasn't registered
          try {
            sessionManager.registerSession(existingId, userId, url)
          } catch (err) {
            // ignore
          }
          return
        }
      }

      logger.info('Starting new remote browser session', {
        url,
        userAgent: navigator.userAgent
      })

      const response = await fetch('/api/remote-browser/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: currentUrl || url,
          userAgent: navigator.userAgent,
          userId
        })
      })

      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({
          error: 'Failed to start remote browser'
        }))) as { error?: string }
        throw new Error(errorData.error ?? 'Failed to start remote browser')
      }

      const data = (await response.json()) as {
        success: boolean
        sessionId: string
        message: string
      }

      if (!data.success || !data.sessionId) {
        throw new Error('Remote browser failed to start')
      }

      const serverSessionId = data.sessionId
      setSessionId(serverSessionId)

      logger.info('Remote browser started successfully', {
        sessionId: serverSessionId
      })

      // Register session with manager immediately so other components know about it
      if (userId) {
        try {
          sessionManager.registerSession(serverSessionId, userId, url)
        } catch (err) {
          logger.warn('Failed to register session with sessionManager', { err })
        }
      }

      // Start polling for screenshots
      startScreenshotPolling(serverSessionId)
      setRemoteBrowserReady(true)
      setIsLoading(false)
      setShowConfirmationButton(true)

      // Start auto-close timer for security
      startAutoCloseTimer(serverSessionId)
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to start remote browser'
      logger.error('Failed to start remote browser', error, { url })
      setAuthStatus('failed')
      setError(errorMessage)
      setIsLoading(false)

      if (onAuthenticationError) {
        onAuthenticationError(errorMessage)
      }
    }
  }, [
    url,
    currentUrl,
    userId,
    onAuthenticationError,
    startScreenshotPolling,
    startAutoCloseTimer
  ])

  /**
   * Handle click on remote browser screenshot
   */
  const handleScreenshotClick = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>): Promise<void> => {
      if (!sessionId || !remoteBrowserReady) return

      const rect = event.currentTarget.getBoundingClientRect()
      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      logger.info('Forwarding click to remote browser', { sessionId, x, y })

      try {
        await fetch('/api/remote-browser/interact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId,
            action: 'click',
            x,
            y
          })
        })
      } catch (error) {
        logger.error('Failed to forward click', error)
      }
    },
    [sessionId, remoteBrowserReady]
  )

  /**
   * Handle manual authentication confirmation - extracts cookies from remote browser
   */
  const handleAuthenticationComplete = useCallback(async (): Promise<void> => {
    if (!sessionId) {
      setError('No active session found')
      return
    }

    try {
      logger.info('Extracting cookies from remote browser', { sessionId })

      setIsLoading(true)
      setError(null)

      const response = await fetch(
        `/api/remote-browser/cookies?sessionId=${sessionId}`
      )

      if (!response.ok) {
        const errorData = (await response
          .json()
          .catch(() => ({ error: 'Failed to extract cookies' }))) as {
          error?: string
        }
        throw new Error(errorData.error ?? 'Failed to extract cookies')
      }

      const data = (await response.json()) as {
        success: boolean
        cookies?: string
        cookieCount?: number
        error?: string
      }

      if (!data.success || !data.cookies) {
        throw new Error(data.error ?? 'No cookies found after authentication')
      }

      logger.info('Cookies extracted successfully from remote browser', {
        sessionId,
        cookieCount: data.cookieCount
      })

      setAuthStatus('authenticated')
      setShowSuccess(true)
      setIsLoading(false)
      stopScreenshotPolling()
      stopAutoCloseTimer() // Stop auto-close timer on successful authentication

      // Call authentication completion callback immediately
      if (onAuthenticationComplete) {
        logger.info('Calling authentication completion callback', {
          sessionId,
          cookieCount: data.cookieCount
        })
        onAuthenticationComplete(data.cookies ?? '')
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to extract cookies'
      logger.error('Cookie extraction failed', error)
      setError(errorMessage)
      setIsLoading(false)
      setAuthStatus('failed')

      if (onAuthenticationError) {
        onAuthenticationError(errorMessage)
      }
    }
  }, [
    sessionId,
    stopScreenshotPolling,
    onAuthenticationComplete,
    onAuthenticationError
  ])

  /**
   * Capture user's browser information
   */
  const captureBrowserInfo = useCallback(
    async (sessionId: string): Promise<void> => {
      try {
        const browserInfo = {
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          },
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          platform: navigator.platform,
          cookieEnabled: navigator.cookieEnabled,
          onLine: navigator.onLine
        }

        logger.info('Capturing user browser info', browserInfo)

        await fetch('/api/auth/capture-browser-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sessionId,
            browserInfo
          })
        })

        logger.info('Browser info captured successfully')
      } catch (error) {
        logger.warn('Failed to capture browser info:', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        // Don&apos;t fail the entire flow if browser info capture fails
      }
    },
    []
  )

  /**
   * Initialize remote browser session on component mount
   */
  useEffect(() => {
    // Prevent multiple initialization
    if (initializationRef.current) {
      logger.info('Initialization already in progress, skipping', { sessionId })
      return
    }

    // Don&apos;t re-initialize if already authenticated or showing success
    if (authStatus === 'authenticated' || showSuccess) {
      logger.info(
        'Already authenticated or showing success, skipping initialization',
        {
          sessionId,
          authStatus,
          showSuccess
        }
      )
      return
    }

    // Check if there's already an active session for this user/URL
    if (userId && sessionManager.hasActiveSession(userId, url)) {
      const existingSession = sessionManager.getExistingSession(userId, url)
      if (existingSession) {
        logger.info('Active session already exists, using existing session', {
          existingSessionId: existingSession.sessionId,
          userId,
          url
        })
        setSessionId(existingSession.sessionId)
        setRemoteBrowserReady(true)
        setShowConfirmationButton(true)
        // Start polling for existing session
        startScreenshotPolling(existingSession.sessionId)
        return
      }
    }

    const initialize = async (): Promise<void> => {
      // Set initialization flag immediately to prevent race conditions
      initializationRef.current = true

      try {
        // Start remote browser session
        await startRemoteBrowser()

        // Register session with global manager AFTER session is created
        if (sessionId && userId) {
          sessionManager.registerSession(sessionId, userId, url)
        }

        // Capture user's browser info for the session
        if (sessionId) {
          await captureBrowserInfo(sessionId)
        }

        setShowConfirmationButton(true)
        logger.info('Remote browser session initialized successfully')
      } catch (error) {
        logger.error('Failed to initialize remote browser session', { error })
        // Reset flag on error to allow retry
        initializationRef.current = false
      }
    }

    void initialize()
  }, []) // Run only once on mount to prevent infinite loops

  /**
   * Update timeout countdown
   * Updates the time remaining display every second
   */
  useEffect(() => {
    if (authStatus !== 'authenticating' || !sessionStartTime) {
      return (): void => {}
    }

    timeoutCheckIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - sessionStartTime
      const remaining = Math.max(0, SESSION_TIMEOUT_MS - elapsed)
      setTimeRemaining(remaining)

      if (remaining === 0) {
        setAuthStatus('failed')
        setError('Session timeout - authentication took too long')
        stopScreenshotPolling()

        if (onAuthenticationError) {
          onAuthenticationError(
            'Session timeout - authentication took too long'
          )
        }
      }
    }, 1000)

    return (): void => {
      if (timeoutCheckIntervalRef.current) {
        clearInterval(timeoutCheckIntervalRef.current)
      }
    }
  }, [
    authStatus,
    sessionStartTime,
    stopScreenshotPolling,
    onAuthenticationError
  ])

  /**
   * Cleanup on unmount
   * Stops polling and cleans up resources when component unmounts
   */
  useEffect(() => {
    return (): void => {
      // Clear screenshot polling
      stopScreenshotPolling()

      // Clear timeout check interval
      if (timeoutCheckIntervalRef.current) {
        clearInterval(timeoutCheckIntervalRef.current)
      }

      // Stop auto-close timer
      stopAutoCloseTimer()

      // Clean up remote browser session
      if (sessionId) {
        logger.info('Cleaning up remote browser session on unmount', {
          sessionId
        })

        // Unregister from global session manager
        sessionManager.unregisterSession(sessionId)

        // Close remote browser session
        void fetch(`/api/remote-browser/cookies?sessionId=${sessionId}`, {
          method: 'DELETE'
        }).catch(error => {
          logger.warn('Failed to cleanup remote browser session on unmount', {
            error
          })
        })
      }

      // Reset initialization flag for potential re-mount
      initializationRef.current = false

      logger.info('MiniBrowser unmounted, cleaned up resources')
    }
  }, [sessionId, stopScreenshotPolling, stopAutoCloseTimer])

  /**
   * Format time remaining as MM:SS
   */
  const formatTimeRemaining = useCallback((milliseconds: number): string => {
    const totalSeconds = Math.ceil(milliseconds / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
        style={{ width, height }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            <Badge
              variant={
                authStatus === 'authenticated'
                  ? 'default'
                  : authStatus === 'failed'
                    ? 'destructive'
                    : 'secondary'
              }
              className="text-xs"
            >
              {authStatus === 'authenticated' && (
                <CheckCircle className="w-3 h-3 mr-1" />
              )}
              {authStatus === 'failed' && (
                <AlertCircle className="w-3 h-3 mr-1" />
              )}
              {authStatus === 'authenticating' && (
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              )}
              {authStatus === 'authenticated'
                ? 'Authenticated'
                : authStatus === 'failed'
                  ? 'Failed'
                  : authStatus === 'authenticating'
                    ? 'Authenticating...'
                    : 'Ready'}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center space-x-2 p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                logger.info('Back navigation requested for remote browser')
              }
              className="p-1 h-8 w-8"
              title="Go back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                logger.info('Forward navigation requested for remote browser')
              }
              className="p-1 h-8 w-8"
              title="Go forward"
            >
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                logger.info('Refresh requested for remote browser')
              }
              className="p-1 h-8 w-8"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentUrl(url)
                logger.info('Home navigation requested for remote browser')
              }}
              className="p-1 h-8 w-8"
              title="Go to home"
            >
              <Home className="w-4 h-4" />
            </Button>
          </div>

          <form
            onSubmit={e => {
              e.preventDefault()
              if (currentUrl) {
                logger.info('URL navigation requested for remote browser', {
                  url: currentUrl
                })
                setIsLoading(true)
                setError(null)
              }
            }}
            className="flex-1 flex items-center space-x-2"
          >
            <Input
              type="url"
              value={currentUrl}
              onChange={e => setCurrentUrl(e.target.value)}
              placeholder="Enter URL..."
              className="flex-1 text-sm"
            />
            <Button type="submit" size="sm" variant="outline">
              Go
            </Button>
          </form>

          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              window.open(currentUrl, '_blank', 'noopener,noreferrer')
            }
            className="p-1 h-8 w-8"
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>

        {/* Content Area */}
        <div
          className="relative flex-1"
          style={{ height: `calc(${height} - 140px)` }}
        >
          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-gray-800 z-10">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {remoteBrowserReady
                    ? 'Loading remote browser...'
                    : 'Starting authentication session...'}
                </p>
              </div>
            </div>
          )}

          {/* Remote Browser Screenshot Display */}
          {remoteBrowserReady && screenshotUrl && !showSuccess && (
            <div className="relative w-full h-full">
              <div
                ref={canvasRef}
                className="w-full h-full bg-background cursor-pointer relative overflow-hidden"
                onClick={handleScreenshotClick}
                style={{
                  backgroundImage: `url(${screenshotUrl})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center'
                }}
              >
                {/* Overlay to show it's interactive */}
                <div className="absolute inset-0 bg-transparent hover:bg-black/5 transition-colors" />
              </div>

              {/* Security Warning Overlay */}
              {showSecurityWarning && (
                <div className="absolute top-4 left-4 right-4 z-30">
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                        <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-orange-900 dark:text-orange-100">
                          Security Notice: Browser will auto-close in 1 minute
                        </p>
                        <p className="text-xs text-orange-700 dark:text-orange-300">
                          Complete authentication now or the session will be
                          automatically closed to prevent resource overusage.
                        </p>
                      </div>
                      <Button
                        onClick={() => setShowSecurityWarning(false)}
                        size="sm"
                        variant="ghost"
                        className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Confirmation Button Overlay */}
              {showConfirmationButton &&
                authStatus === 'authenticating' &&
                !showSuccess && (
                  <div className="absolute bottom-4 left-4 right-4 z-20">
                    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-4 shadow-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <svg
                              className="w-4 h-4 text-primary"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              Authentication Complete?
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Click "I've Completed Login" when you're done
                              authenticating
                            </p>
                          </div>
                        </div>
                        <Button
                          onClick={handleAuthenticationComplete}
                          size="sm"
                          variant="default"
                          className="ml-4"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          I've Completed Login
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* Error state for remote browser failures */}
          {error && !remoteBrowserReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50 dark:bg-red-900/20 z-10">
              <div className="text-center p-6">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                  Remote Browser Failed
                </h3>
                <p className="text-red-700 dark:text-red-300 mb-4">{error}</p>
                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3 text-left">
                    <svg
                      className="w-5 h-5 text-primary flex-shrink-0 mt-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium text-foreground">
                        Remote browser authentication failed:
                      </p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Check your internet connection</li>
                        <li>Try refreshing the page</li>
                        <li>Contact support if the issue persists</li>
                      </ol>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => window.location.reload()}
                    size="lg"
                    variant="default"
                    className="flex-1 max-w-xs"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Retry
                  </Button>
                  <Button onClick={onClose} size="lg" variant="ghost">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {showSuccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-green-50 dark:bg-green-900/20 z-10">
              <div className="text-center p-6">
                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
                  Authentication Successful
                </h3>
                <p className="text-green-700 dark:text-green-300 mb-4">
                  You have been successfully authenticated. The download will
                  now proceed.
                </p>
                <Button onClick={onClose} size="sm" variant="default">
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Remote browser authentication</span>
            {authStatus === 'authenticating' && (
              <span>Time remaining: {formatTimeRemaining(timeRemaining)}</span>
            )}
            {autoCloseTime > 0 && !showSecurityWarning && (
              <span className="text-blue-600 dark:text-blue-400">
                Auto-close:{' '}
                {formatTimeRemaining(
                  AUTO_CLOSE_TIMEOUT_MS - (Date.now() - autoCloseTime)
                )}
              </span>
            )}
            {showSecurityWarning && (
              <span className="text-orange-600 dark:text-orange-400 font-medium">
                ⚠️ Auto-closing in 1 minute
              </span>
            )}
            <span
              className={
                authStatus === 'authenticated'
                  ? 'text-green-600 dark:text-green-400'
                  : ''
              }
            >
              {authStatus === 'authenticated'
                ? 'Ready for download'
                : 'Ready for confirmation'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
            {sessionId && <span>Session: {sessionId.substring(0, 12)}...</span>}
            <span>Remote Browser v1.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
