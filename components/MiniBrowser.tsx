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
  Loader2
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
 * MiniBrowser Component
 *
 * A remote browser component that uses a server-side browser instance
 * to handle authentication flows. This bypasses X-Frame-Options restrictions
 * by running the browser on the server and streaming screenshots to the client.
 *
 * Features:
 * - Remote browser session management
 * - Real-time screenshot streaming
 * - Interactive click forwarding
 * - Cookie extraction after authentication
 * - Session timeout management
 *
 * @param props - The component props
 * @returns JSX element representing the remote browser interface
 *
 * @example
 * ```tsx
 * <MiniBrowser
 *   url="https://example.com/auth"
 *   onClose={() => setShowBrowser(false)}
 *   onAuthenticationComplete={(cookies) => handleAuthSuccess(cookies)}
 *   onAuthenticationError={(error) => handleAuthError(error)}
 *   title="Login to Service"
 *   height="500px"
 *   width="700px"
 * />
 * ```
 */
export default function MiniBrowser({
  url,
  onClose,
  onAuthenticationComplete,
  onAuthenticationError,
  title = 'Authentication Required',
  height = '600px',
  width = '800px',
  userId
}: MiniBrowserProps): JSX.Element {
  const [currentUrl, setCurrentUrl] = useState(url)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  // Remote browser state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle')
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number>(SESSION_TIMEOUT_MS)
  const [showConfirmationButton, setShowConfirmationButton] = useState(false)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [remoteBrowserReady, setRemoteBrowserReady] = useState(false)

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null)
  const screenshotPollingRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const initializationRef = useRef(false)
  const lastScreenshotTimeRef = useRef<number>(0)
  const screenshotRequestRef = useRef<Promise<void> | null>(null)

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
   * Debounced screenshot update to prevent excessive requests
   */
  const updateScreenshot = useCallback(
    async (sessionId: string): Promise<void> => {
      const now = Date.now()
      const timeSinceLastUpdate = now - lastScreenshotTimeRef.current

      // Debounce: only update if at least 1.5 seconds have passed
      if (timeSinceLastUpdate < 1500) {
        return
      }

      // Prevent concurrent requests
      if (screenshotRequestRef.current) {
        return
      }

      lastScreenshotTimeRef.current = now

      screenshotRequestRef.current = (async (): Promise<void> => {
        try {
          // Update screenshot URL with timestamp to prevent caching
          setScreenshotUrl(
            `/api/remote-browser/screenshot?sessionId=${sessionId}&t=${now}`
          )
        } catch (error) {
          logger.warn('Failed to update screenshot', { error })
        } finally {
          screenshotRequestRef.current = null
        }
      })()

      await screenshotRequestRef.current
    },
    []
  )

  /**
   * Poll for screenshots from remote browser with optimized polling
   */
  const startScreenshotPolling = useCallback(
    (sessionId: string): void => {
      logger.info('Starting screenshot polling', { sessionId })

      // Initial screenshot load
      setScreenshotUrl(`/api/remote-browser/screenshot?sessionId=${sessionId}`)
      lastScreenshotTimeRef.current = Date.now()

      // Poll every 2 seconds instead of 1 second to reduce server load
      screenshotPollingRef.current = setInterval(() => {
        // Only update URL if session is still active
        if (sessionId && authStatus === 'authenticating') {
          void updateScreenshot(sessionId)
        }
      }, 2000) // Poll every 2 seconds
    },
    [authStatus, updateScreenshot]
  )

  /**
   * Start remote browser session
   */
  const startRemoteBrowser = useCallback(async (): Promise<void> => {
    try {
      setAuthStatus('authenticating')
      setError(null)
      setSessionStartTime(Date.now())
      setIsLoading(true)

      const newSessionId = `remote-browser-${Date.now()}-${Math.random().toString(36).substring(7)}`
      setSessionId(newSessionId)

      logger.info('Starting remote browser session', {
        sessionId: newSessionId,
        url,
        userAgent: navigator.userAgent
      })

      const response = await fetch('/api/remote-browser/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: newSessionId,
          url: currentUrl,
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

      if (!data.success) {
        throw new Error('Remote browser failed to start')
      }

      logger.info('Remote browser started successfully', {
        sessionId: newSessionId
      })

      // Start polling for screenshots
      startScreenshotPolling(newSessionId)
      setRemoteBrowserReady(true)
      setIsLoading(false)
      setShowConfirmationButton(true)
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
  }, [url, currentUrl, userId, startScreenshotPolling, onAuthenticationError])

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
  const handleManualAuthConfirm = useCallback(async (): Promise<void> => {
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

      if (onAuthenticationComplete) {
        setTimeout(() => {
          onAuthenticationComplete(data.cookies ?? '')
        }, 1000)
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
   * Fixed to prevent multiple initializations and race conditions
   */
  useEffect(() => {
    // Prevent multiple session creation with stronger guards
    if (initializationRef.current || sessionId) {
      logger.info(
        'Initialization already completed or session exists, skipping',
        {
          sessionId,
          initializationComplete: initializationRef.current
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
        setShowConfirmationButton(true)
        setRemoteBrowserReady(true)
        return
      }
    }

    const initialize = async (): Promise<void> => {
      // Set initialization flag immediately to prevent race conditions
      initializationRef.current = true

      try {
        logger.info('Starting remote browser initialization', { url, userId })

        // Start remote browser session
        await startRemoteBrowser()

        // Register session with global manager
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
  }, [url, userId, sessionId, startRemoteBrowser, captureBrowserInfo])

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
  }, [sessionId, stopScreenshotPolling])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div
        className="bg-background rounded-lg shadow-2xl border border-border overflow-hidden"
        style={{ width, height: `calc(${height} + 60px)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <h3 className="font-medium text-foreground ml-2">{title}</h3>
            {authStatus === 'authenticating' && (
              <Badge variant="secondary" className="ml-2">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Authenticating...
              </Badge>
            )}
            {authStatus === 'authenticated' && (
              <Badge variant="default" className="ml-2">
                Authenticated
              </Badge>
            )}
            {authStatus === 'failed' && (
              <Badge variant="destructive" className="ml-2">
                Authentication Failed
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                logger.info('Back navigation requested for remote browser')
              }
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                logger.info('Forward navigation requested for remote browser')
              }
              className="h-8 w-8 p-0"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                logger.info('Refresh requested for remote browser')
              }
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCurrentUrl(url)
                logger.info('Home navigation requested for remote browser')
              }}
              className="h-8 w-8 p-0"
            >
              <Home className="h-4 w-4" />
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
            className="flex-1 flex items-center gap-2"
          >
            <Input
              value={currentUrl}
              onChange={e => setCurrentUrl(e.target.value)}
              placeholder="Enter URL..."
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" className="h-8">
              Go
            </Button>
          </form>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(currentUrl, '_blank')}
            className="h-8 w-8 p-0"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="relative" style={{ height }}>
          {/* Loading state */}
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">
                  {remoteBrowserReady
                    ? 'Loading remote browser...'
                    : 'Starting authentication session...'}
                </p>
              </div>
            </div>
          )}

          {/* Remote Browser Screenshot Display */}
          {remoteBrowserReady && screenshotUrl && (
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

                {/* Loading indicator for screenshot updates */}
                <div className="absolute top-2 right-2">
                  <div className="bg-background/80 backdrop-blur-sm rounded-full p-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                </div>
              </div>

              {/* Confirmation Button Overlay */}
              {showConfirmationButton && authStatus === 'authenticating' && (
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
                        onClick={handleManualAuthConfirm}
                        size="sm"
                        variant="default"
                        className="ml-4"
                      >
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
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center p-8 max-w-lg">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900/20 mb-4">
                  <svg
                    className="w-8 h-8 text-orange-600 dark:text-orange-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-lg text-foreground mb-2">
                  Remote Browser Failed
                </h3>
                <p className="text-sm text-muted-foreground mb-6">{error}</p>
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
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center p-6">
                <div className="text-green-500 mb-2 font-bold text-xl">
                  Success
                </div>
                <h3 className="font-medium text-foreground mb-2">
                  Authentication Successful
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You have been successfully authenticated. The download will
                  now proceed.
                </p>
                <Button onClick={onClose} size="sm">
                  Continue
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/10">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Remote browser authentication</span>
              {authStatus === 'authenticating' && (
                <span>
                  Time remaining: {Math.floor(timeRemaining / 60000)}:
                  {String(Math.floor((timeRemaining % 60000) / 1000)).padStart(
                    2,
                    '0'
                  )}
                </span>
              )}
              {authStatus === 'idle' && <span>Session timeout: 5 minutes</span>}
              {showConfirmationButton && (
                <span className="text-primary">Ready for confirmation</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              {sessionId && (
                <span className="text-xs opacity-50">
                  Session: {sessionId.slice(0, 8)}
                </span>
              )}
              <span>Remote Browser v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
