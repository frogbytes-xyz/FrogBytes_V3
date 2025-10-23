import { logger } from '@/lib/utils/logger'

/**
 * Authentication Manager Service
 * Handles user login flows with Puppeteer browser automation
 */

import type { Page } from 'puppeteer'
import { browserLauncherService } from './browser-launcher-service'
import { cookieService } from './cookie-service'
import { authenticationPopupService } from './authentication-popup-service'
import { videoDownloadConfig } from '../config/video-download'
import type { BrowserInfo } from '@/lib/utils/browser-info'
import {
  storeBrowserInfo as storeBrowserInfoService,
  clearBrowserInfo,
  getStoredBrowserInfo as getStoredBrowserInfoService
} from './browser-mimicking-service'

export interface LoginSession {
  sessionId: string
  userId: string
  authUrl: string
  status: 'pending' | 'authenticated' | 'failed' | 'timeout'
  browserInstanceId?: string
  page?: Page
  createdAt: number
  expiresAt: number
  error?: string
  type?: 'standard' | 'mini-browser'
  cookies?: string
  timeoutId?: NodeJS.Timeout
}

export interface LoginResult {
  success: boolean
  sessionId?: string
  cookies?: string
  error?: string
  errorType?: 'timeout' | 'credentials' | 'network' | 'browser' | 'unknown'
  errorDetails?: string
}

export interface AuthenticationOptions {
  userId: string
  authUrl: string
  timeout?: number
  waitForSelector?: string
  successIndicator?: string
  customHeaders?: Record<string, string>
}

class AuthenticationManager {
  private activeSessions = new Map<string, LoginSession>()

  /**
   * Handle authentication with popup when media is not found
   */
  async handleAuthenticationWithPopup(
    url: string,
    userId: string,
    options: Partial<AuthenticationOptions> = {}
  ): Promise<LoginResult> {
    try {
      // Show popup to inform user about authentication requirement
      const popupResult =
        await authenticationPopupService.showAuthenticationPopup(url, userId, {
          title: 'Authentication Required',
          message: `
          <p>This video requires authentication to access.</p>
          <p><strong>URL:</strong> <code>${url}</code></p>
          <p>Please log in to your account to continue with the download.</p>
        `,
          loginButtonText: 'Login & Download',
          cancelButtonText: 'Cancel',
          timeout: options.timeout || videoDownloadConfig.authSessionTimeout
        })

      if (popupResult.action === 'cancel') {
        return {
          success: false,
          error: 'User cancelled authentication',
          errorType: 'credentials',
          errorDetails: 'User chose to cancel the authentication process'
        }
      }

      if (popupResult.action === 'timeout') {
        return {
          success: false,
          error: 'Authentication popup timed out',
          errorType: 'timeout',
          errorDetails:
            'User did not respond to the authentication popup within the time limit'
        }
      }

      if (popupResult.action === 'error') {
        return {
          success: false,
          error: popupResult.error || 'Popup error occurred',
          errorType: 'browser',
          errorDetails: 'Failed to show authentication popup'
        }
      }

      // User clicked login, proceed with authentication
      if (popupResult.action === 'login') {
        return await this.handleLogin({
          ...options,
          userId,
          authUrl: url
        })
      }

      return {
        success: false,
        error: 'Unknown popup action',
        errorType: 'unknown',
        errorDetails: 'Unexpected popup action received'
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        errorType: 'unknown',
        errorDetails: 'Error during authentication popup flow'
      }
    }
  }

  /**
   * Handle user login flow
   */
  async handleLogin(options: AuthenticationOptions): Promise<LoginResult> {
    const sessionId = cookieService.generateSessionId()
    const timeout = options.timeout || videoDownloadConfig.authSessionTimeout
    const now = Date.now()

    // Create login session
    const session: LoginSession = {
      sessionId,
      userId: options.userId,
      authUrl: options.authUrl,
      status: 'pending',
      createdAt: now,
      expiresAt: now + timeout
    }

    this.activeSessions.set(sessionId, session)

    try {
      // Launch browser for authentication
      const browserResult = await browserLauncherService.launchForAuth()

      if (!browserResult.success || !browserResult.browser) {
        session.status = 'failed'
        session.error = browserResult.error || 'Failed to launch browser'
        return {
          success: false,
          sessionId,
          error: session.error,
          errorType: 'browser',
          errorDetails:
            'Browser launch failed - check Puppeteer configuration and system resources'
        }
      }

      if (browserResult.instanceId) {
        session.browserInstanceId = browserResult.instanceId
      }
      this.activeSessions.set(sessionId, session)

      // Create page and navigate to auth URL
      const page = await browserLauncherService.createPage(
        browserResult.instanceId!
      )

      if (!page) {
        session.status = 'failed'
        session.error = 'Failed to create browser page'
        return {
          success: false,
          sessionId,
          error: session.error,
          errorType: 'browser',
          errorDetails:
            'Failed to create new browser page - browser may be in an invalid state'
        }
      }

      session.page = page
      this.activeSessions.set(sessionId, session)

      // Configure page for authentication
      await this.configurePageForAuth(page, options)

      // Navigate to authentication URL
      await page.goto(options.authUrl, {
        waitUntil: 'networkidle2',
        timeout: 30000
      })

      logger.info(
        `Authentication session ${sessionId} started. Browser opened to: ${options.authUrl}`
      )

      // Wait for authentication to complete
      const authResult = await this.waitForAuthentication(
        page,
        session,
        options
      )

      if (authResult.success && authResult.cookies) {
        // Store cookies for future use
        await cookieService.setNetscapeCookies(
          options.userId,
          new URL(options.authUrl).hostname,
          authResult.cookies,
          sessionId
        )

        session.status = 'authenticated'
        this.activeSessions.set(sessionId, session)

        return {
          success: true,
          sessionId,
          cookies: authResult.cookies
        }
      } else {
        const errMsg = authResult.error ?? 'Authentication failed'
        const errorType = this.classifyAuthError(errMsg)
        session.status = errorType === 'timeout' ? 'timeout' : 'failed'
        session.error = errMsg
        this.activeSessions.set(sessionId, session)

        return {
          success: false,
          sessionId,
          error: errMsg,
          errorType,
          errorDetails: this.getErrorDetails(errorType, errMsg)
        }
      }
    } catch (error) {
      const errorType = this.classifyAuthError(
        error instanceof Error ? error.message : 'Unknown error'
      )
      session.status = 'failed'
      session.error =
        error instanceof Error ? error.message : 'Unknown error occurred'
      this.activeSessions.set(sessionId, session)

      return {
        success: false,
        sessionId,
        error: session.error,
        errorType,
        errorDetails: this.getErrorDetails(errorType, session.error)
      }
    } finally {
      // Clean up browser resources
      if (session.browserInstanceId) {
        await browserLauncherService.closeBrowser(session.browserInstanceId)
      }
    }
  }

  /**
   * Configure page for authentication
   */
  private async configurePageForAuth(
    page: Page,
    options: AuthenticationOptions
  ): Promise<void> {
    // Set custom headers if provided
    if (options.customHeaders) {
      await page.setExtraHTTPHeaders(options.customHeaders)
    }

    // Set viewport for better user experience
    await page.setViewport({
      width: 1280,
      height: 800,
      deviceScaleFactor: 1
    })

    // Add authentication-specific event listeners
    page.on('console', msg => {
      if (msg.type() === 'error') {
        logger.error(`Browser console error: ${msg.text()}`)
      }
    })

    page.on('pageerror', error => {
      logger.error(`Page error: ${error.message}`)
    })
  }

  /**
   * Wait for authentication to complete
   */
  private async waitForAuthentication(
    page: Page,
    session: LoginSession,
    options: AuthenticationOptions
  ): Promise<{ success: boolean; cookies?: string; error?: string }> {
    const timeout = options.timeout || videoDownloadConfig.authSessionTimeout
    return new Promise(resolve => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error:
            'Authentication timeout - user did not complete login within the time limit'
        })
      }, timeout)

      const checkAuth = async () => {
        try {
          // Check if session has expired
          if (Date.now() > session.expiresAt) {
            clearTimeout(timeoutId)
            resolve({
              success: false,
              error: 'Session expired'
            })
            return
          }

          // Check for success indicators
          const isAuthenticated = await this.checkAuthenticationSuccess(
            page,
            options
          )

          if (isAuthenticated) {
            clearTimeout(timeoutId)

            // Extract cookies
            const cookies = await this.extractCookies(page)

            if (cookies) {
              resolve({
                success: true,
                cookies
              })
            } else {
              resolve({
                success: false,
                error: 'Failed to extract authentication cookies'
              })
            }
            return
          }

          // Check if user is still on login page (not authenticated yet)
          const currentUrl = page.url()
          if (this.isStillOnLoginPage(currentUrl, options.authUrl)) {
            // Continue waiting
            setTimeout(checkAuth, 1000)
          } else {
            // User navigated away from login page, might be authenticated
            setTimeout(checkAuth, 1000)
          }
        } catch (error) {
          clearTimeout(timeoutId)
          resolve({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : 'Error during authentication check'
          })
        }
      }

      // Start checking
      checkAuth()
    })
  }

  /**
   * Check if authentication was successful
   */
  private async checkAuthenticationSuccess(
    page: Page,
    options: AuthenticationOptions
  ): Promise<boolean> {
    try {
      // Method 1: Check for custom success indicator
      if (options.successIndicator) {
        const element = await page.$(options.successIndicator)
        if (element) {
          return true
        }
      }

      // Method 2: Check for common authentication success patterns
      const successSelectors = [
        'button[data-testid="logout"]',
        '.user-menu',
        '.profile-menu',
        '[data-testid="user-menu"]',
        '.authenticated',
        '.logged-in',
        '.user-dashboard',
        '.account-menu'
      ]

      for (const selector of successSelectors) {
        try {
          const element = await page.$(selector)
          if (element) {
            return true
          }
        } catch {
          // Ignore selector errors
        }
      }

      // Method 3: Check for authentication cookies
      const cookies = await page.cookies()
      const authCookies = cookies.filter(
        cookie =>
          cookie.name.toLowerCase().includes('session') ||
          cookie.name.toLowerCase().includes('auth') ||
          cookie.name.toLowerCase().includes('token') ||
          cookie.name.toLowerCase().includes('jwt') ||
          cookie.name.toLowerCase().includes('login')
      )

      if (authCookies.length > 0) {
        return true
      }

      // Method 4: Check URL patterns (user might have been redirected)
      const currentUrl = page.url()
      const authUrl = new URL(options.authUrl)

      // If user is no longer on the login page and not on an error page
      if (
        !currentUrl.includes(authUrl.pathname) &&
        !currentUrl.includes('/login') &&
        !currentUrl.includes('/signin') &&
        !currentUrl.includes('/error')
      ) {
        return true
      }

      return false
    } catch (error) {
      logger.error('Error checking authentication success', error)
      return false
    }
  }

  /**
   * Extract cookies from the page
   */
  private async extractCookies(page: Page): Promise<string | null> {
    try {
      const cookies = await page.cookies()

      if (cookies.length === 0) {
        return null
      }

      // Convert cookies to Netscape format
      const netscapeCookies = cookies.map(cookie => {
        const domain = cookie.domain.startsWith('.')
          ? cookie.domain.substring(1)
          : cookie.domain
        const flag = cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE'
        const path = cookie.path || '/'
        const secure = cookie.secure ? 'TRUE' : 'FALSE'
        const expiration = cookie.expires ? Math.floor(cookie.expires) : 0
        const name = cookie.name
        const value = cookie.value

        return [
          domain,
          flag,
          path,
          secure,
          expiration.toString(),
          name,
          value
        ].join('\t')
      })

      const header = [
        '# Netscape HTTP Cookie File',
        '# This is a generated file! Do not edit.',
        ''
      ]

      return [...header, ...netscapeCookies].join('\n')
    } catch (error) {
      logger.error('Failed to extract cookies', error)
      return null
    }
  }

  /**
   * Check if user is still on login page
   */
  private isStillOnLoginPage(currentUrl: string, authUrl: string): boolean {
    const authUrlObj = new URL(authUrl)
    const currentUrlObj = new URL(currentUrl)

    // Check if still on same domain and path
    return (
      currentUrlObj.hostname === authUrlObj.hostname &&
      currentUrlObj.pathname === authUrlObj.pathname
    )
  }

  /**
   * Get session information by session ID
   *
   * Retrieves the current state of an authentication session, including status,
   * browser instance details, and any error information.
   *
   * @param sessionId - The unique session identifier
   * @returns LoginSession object if found, undefined otherwise
   */
  getSession(sessionId: string): LoginSession | undefined {
    return this.activeSessions.get(sessionId)
  }

  /**
   * Get all active authentication sessions
   *
   * Returns a list of all current sessions across all users. This is useful for:
   * - Admin monitoring and debugging
   * - Session cleanup operations
   * - User-specific session queries
   *
   * @returns Array of all active LoginSession objects
   */
  getActiveSessions(): LoginSession[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * Cancel an active login session
   *
   * Terminates a session by closing the associated browser instance and marking
   * the session as failed. This is used for:
   * - User-initiated cancellation
   * - Timeout cleanup
   * - Logout operations
   *
   * @param sessionId - The unique session identifier to cancel
   * @returns Promise resolving to true if session was found and cancelled, false otherwise
   */
  async cancelSession(sessionId: string): Promise<boolean> {
    const session = this.activeSessions.get(sessionId)

    if (!session) {
      return false
    }

    try {
      // Close browser if open
      if (session.browserInstanceId) {
        await browserLauncherService.closeBrowser(session.browserInstanceId)
      }

      // Update session status
      session.status = 'failed'
      session.error = 'Session cancelled by user'
      this.activeSessions.set(sessionId, session)

      return true
    } catch (error) {
      logger.error('Error cancelling session', error)
      return false
    }
  }

  /**
   * Clean up expired authentication sessions
   *
   * Automatically removes sessions that have exceeded their expiration time.
   * This method should be called periodically to prevent memory leaks and
   * ensure browser resources are properly released.
   *
   * Best practice: Run this via a scheduled job every 5-10 minutes.
   *
   * @returns Promise resolving to the number of sessions that were cleaned up
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now()
    const expiredSessions: string[] = []

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now > session.expiresAt) {
        expiredSessions.push(sessionId)
      }
    }

    for (const sessionId of expiredSessions) {
      await this.cancelSession(sessionId)
    }

    return expiredSessions.length
  }

  /**
   * Classify authentication error type
   */
  private classifyAuthError(
    errorMessage: string
  ): 'timeout' | 'credentials' | 'network' | 'browser' | 'unknown' {
    const lowerError = errorMessage.toLowerCase()

    if (lowerError.includes('timeout') || lowerError.includes('expired')) {
      return 'timeout'
    }

    if (
      lowerError.includes('unauthorized') ||
      lowerError.includes('forbidden') ||
      lowerError.includes('invalid credentials') ||
      lowerError.includes('login failed') ||
      lowerError.includes('authentication failed') ||
      lowerError.includes('wrong password') ||
      lowerError.includes('incorrect username') ||
      lowerError.includes('access denied')
    ) {
      return 'credentials'
    }

    if (
      lowerError.includes('network') ||
      lowerError.includes('connection') ||
      lowerError.includes('dns') ||
      lowerError.includes('refused') ||
      lowerError.includes('unreachable') ||
      lowerError.includes('timeout')
    ) {
      return 'network'
    }

    if (
      lowerError.includes('browser') ||
      lowerError.includes('puppeteer') ||
      lowerError.includes('page') ||
      lowerError.includes('navigation')
    ) {
      return 'browser'
    }

    return 'unknown'
  }

  /**
   * Get detailed error information based on error type
   */
  private getErrorDetails(
    errorType: 'timeout' | 'credentials' | 'network' | 'browser' | 'unknown',
    errorMessage?: string
  ): string {
    switch (errorType) {
      case 'timeout':
        return 'Authentication session timed out. Please try again and complete the login process within the time limit.'

      case 'credentials':
        return 'Authentication failed due to invalid credentials. Please check your username and password, or contact your institution if you continue to have issues.'

      case 'network':
        return 'Network error occurred during authentication. Please check your internet connection and try again.'

      case 'browser':
        return 'Browser-related error occurred. This may be due to browser configuration issues or system resources.'

      default:
        return (
          errorMessage || 'An unexpected error occurred during authentication.'
        )
    }
  }

  /**
   * Get authentication manager service statistics
   *
   * Provides operational metrics for monitoring and debugging purposes.
   * Useful for health checks and capacity planning.
   *
   * @returns Object containing:
   *   - activeSessions: Number of currently active authentication sessions
   *   - totalSessions: Total number of sessions in the session map
   *   - uptime: Process uptime in seconds
   */
  getStats(): {
    activeSessions: number
    totalSessions: number
    uptime: number
  } {
    const activeSessions = this.getActiveSessions().length
    const totalSessions = this.activeSessions.size

    return {
      activeSessions,
      totalSessions,
      uptime: process.uptime()
    }
  }

  /**
   * Create a frontend-only mini-browser session (no Puppeteer)
   *
   * This method stores session metadata and browser info for tracking purposes.
   * The actual authentication happens in the user's browser via iframe.
   * Browser info is stored for use in subsequent API requests.
   *
   * @param options - Session configuration
   * @returns Promise resolving to session ID
   */
  async createFrontendMiniBrowserSession(options: {
    sessionId: string
    url: string
    userId: string
    timeout?: number
    browserInfo?: BrowserInfo
  }): Promise<string> {
    const timeout = options.timeout ?? 300000
    const now = Date.now()

    logger.info(
      `Creating frontend mini-browser session ${options.sessionId} for user ${options.userId}`
    )

    // Create session record (no browser launch needed - frontend only)
    const session: LoginSession = {
      sessionId: options.sessionId,
      userId: options.userId,
      authUrl: options.url,
      status: 'pending',
      createdAt: now,
      expiresAt: now + timeout,
      type: 'mini-browser'
    }

    this.activeSessions.set(options.sessionId, session)

    // Store browser info for use in API requests
    if (options.browserInfo) {
      await storeBrowserInfoService(options.sessionId, options.browserInfo)
      logger.info(`Stored browser info for session ${options.sessionId}`, {
        userAgent: options.browserInfo.userAgent.substring(0, 50),
        platform: options.browserInfo.platform
      })
    }

    // Set up timeout
    setTimeout(() => {
      const currentSession = this.activeSessions.get(options.sessionId)
      if (currentSession && currentSession.status === 'pending') {
        currentSession.status = 'timeout'
        currentSession.error = 'Session timeout - authentication took too long'
        this.activeSessions.set(options.sessionId, currentSession)
      }
    }, timeout)

    return options.sessionId
  }

  /**
   * Update frontend mini-browser session with authentication result
   *
   * Called by the frontend when user completes authentication in iframe.
   * Stores cookies and marks session as authenticated.
   *
   * @param sessionId - Session ID
   * @param cookies - Captured cookies in Netscape format
   */
  async updateFrontendMiniBrowserSession(
    sessionId: string,
    cookies: string
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId)

    if (!session) {
      throw new Error(`Session ${sessionId} not found`)
    }

    session.status = 'authenticated'
    session.cookies = cookies
    this.activeSessions.set(sessionId, session)

    // Store cookies in cookie service
    await cookieService.setNetscapeCookies(
      session.userId,
      new URL(session.authUrl).hostname,
      cookies,
      sessionId
    )

    logger.info(
      `Frontend mini-browser session ${sessionId} authenticated successfully`
    )
  }

  /**
   * Create a mini-browser authentication session with Puppeteer support (SERVER-SIDE ONLY)
   *
   * This method launches a Puppeteer browser instance, navigates to the authentication URL,
   * and sets up monitoring for authentication success detection. The session is tracked
   * in the activeSessions map with metadata for status polling.
   *
   * @param options - Configuration options for the mini-browser session
   * @param options.url - The authentication URL to navigate to
   * @param options.userId - The user ID associated with this authentication session
   * @param options.timeout - Optional timeout in milliseconds (defaults to 5 minutes)
   * @param options.browserInfo - Optional user's actual browser info for mimicking
   * @returns Promise resolving to a unique session ID for status polling
   * @throws Error if browser launch fails or page creation fails
   */
  async createMiniBrowserSession(options: {
    url: string
    userId: string
    timeout?: number
    browserInfo?: BrowserInfo
  }): Promise<string> {
    const sessionId = `mini-browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const timeout = options.timeout ?? 300000
    const now = Date.now()

    logger.info(
      `Creating mini-browser session ${sessionId} for user ${options.userId}`
    )

    try {
      // Launch browser using existing service with user's browser info if available
      const browserResult = await browserLauncherService.launchForAuth(
        options.browserInfo ? { browserInfo: options.browserInfo } : {}
      )

      if (!browserResult.success || !browserResult.browser) {
        const errorMessage =
          browserResult.error ??
          'Failed to launch browser for mini-browser session'
        logger.error(
          `Failed to launch browser for mini-browser session ${sessionId}`,
          new Error(errorMessage)
        )
        throw new Error(errorMessage)
      }

      // Create new page - instanceId must exist if browser launch succeeded
      const instanceId = browserResult.instanceId
      if (!instanceId) {
        throw new Error('Browser instance ID missing after successful launch')
      }

      const page = await browserLauncherService.createPage(
        instanceId,
        options.browserInfo
      )

      if (!page) {
        logger.error(
          `Failed to create page for mini-browser session ${sessionId}`
        )
        await browserLauncherService.closeBrowser(instanceId)
        throw new Error(
          'Failed to create browser page for mini-browser session'
        )
      }

      // Inject login notification script before navigation
      await this.injectLoginNotification(page)

      // Navigate to authentication URL
      // Note: We create the session even if navigation fails, so the MiniBrowser
      // can display helpful error messages and fallback options
      let navigationError: string | undefined

      try {
        const response = await page.goto(options.url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        })

        // Check for 403 or other error responses
        if (response && !response.ok()) {
          const status = response.status()
          logger.warn(`Navigation to ${options.url} returned status ${status}`)

          if (status === 403) {
            navigationError =
              'Platform blocking detected (403 Forbidden). Please use the "Open in New Window" option.'
            // Don&apos;t throw - let the session be created so MiniBrowser can show the error
          } else if (status >= 400) {
            navigationError = `Failed to load authentication page (HTTP ${status})`
            // Don&apos;t throw - let the session be created so MiniBrowser can show the error
          }
        }
      } catch (navError) {
        if (navError instanceof Error && navError.message.includes('timeout')) {
          logger.warn(
            `Navigation timeout for ${options.url} - page may still be loading`
          )
          navigationError =
            'Page loading timeout - you may need to use the "Open in New Window" option.'
          // Continue anyway - page might still work
        } else {
          // For other navigation errors, still create session but mark as failed
          navigationError =
            navError instanceof Error ? navError.message : 'Navigation failed'
          logger.warn(`Navigation error for ${options.url}: ${navigationError}`)
        }
      }

      // Create session record with metadata
      const session: LoginSession = {
        sessionId,
        userId: options.userId,
        authUrl: options.url,
        status: navigationError ? 'failed' : 'pending',
        ...(browserResult.instanceId
          ? { browserInstanceId: browserResult.instanceId }
          : {}),
        page,
        createdAt: now,
        expiresAt: now + timeout,
        type: 'mini-browser',
        ...(navigationError ? { error: navigationError } : {})
      }

      this.activeSessions.set(sessionId, session)

      // Start monitoring authentication in background
      void this.monitorMiniBrowserAuthentication(sessionId)

      // Set up auto-click for continue button after login
      void this.setupContinueButtonAutoClick(sessionId)

      logger.info(
        `Mini-browser session ${sessionId} created successfully and navigated to ${options.url}`
      )

      return sessionId
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown error occurred during mini-browser session creation'
      logger.error(`Error creating mini-browser session ${sessionId}`, error)

      // Clean up any partial session
      const session = this.activeSessions.get(sessionId)
      if (session?.browserInstanceId) {
        await browserLauncherService.closeBrowser(session.browserInstanceId)
      }
      this.activeSessions.delete(sessionId)

      throw new Error(errorMessage)
    }
  }

  /**
   * Inject login notification into the page
   *
   * Displays a non-intrusive notification at the top of the page prompting
   * the user to log in. The notification automatically dismisses after login
   * or when clicked.
   *
   * @param page - The Puppeteer page to inject the notification into
   */
  private async injectLoginNotification(page: Page): Promise<void> {
    try {
      await page.evaluateOnNewDocument(() => {
        window.addEventListener('DOMContentLoaded', () => {
          // Create notification element
          const notification = document.createElement('div')
          notification.id = 'frogbytes-login-notification'
          notification.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 16px 24px;
            text-align: center;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            z-index: 999999;
            animation: slideDown 0.3s ease-out;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
          `

          // Add animation
          const style = document.createElement('style')
          style.textContent = `
            @keyframes slideDown {
              from {
                transform: translateY(-100%);
                opacity: 0;
              }
              to {
                transform: translateY(0);
                opacity: 1;
              }
            }
            @keyframes slideUp {
              from {
                transform: translateY(0);
                opacity: 1;
              }
              to {
                transform: translateY(-100%);
                opacity: 0;
              }
            }
          `
          document.head.appendChild(style)

          // Add content
          notification.innerHTML = `
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Please log in to your account to continue with the download</span>
            <button id="dismiss-notification" style="
              margin-left: auto;
              background: rgba(255, 255, 255, 0.2);
              border: 1px solid rgba(255, 255, 255, 0.3);
              color: white;
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 12px;
              cursor: pointer;
              transition: background 0.2s;
            " onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
              Dismiss
            </button>
          `

          document.body.appendChild(notification)

          // Remove notification on click or after successful login detection
          const removeNotification = () => {
            notification.style.animation = 'slideUp 0.3s ease-out'
            setTimeout(() => {
              if (notification.parentNode) {
                notification.parentNode.removeChild(notification)
              }
            }, 300)
          }

          document
            .getElementById('dismiss-notification')
            ?.addEventListener('click', e => {
              e.stopPropagation()
              removeNotification()
            })

          // Auto-dismiss after 15 seconds
          setTimeout(removeNotification, 15000)

          // Watch for login indicators and dismiss notification
          const checkForLogin = setInterval(() => {
            const hasAuthCookies =
              document.cookie.includes('session') ||
              document.cookie.includes('auth') ||
              document.cookie.includes('token')
            const hasLogoutButton =
              document.querySelector('[data-testid="logout"]') ||
              document.querySelector('.logout') ||
              document.querySelector('[href*="logout"]')

            if (hasAuthCookies || hasLogoutButton) {
              clearInterval(checkForLogin)
              removeNotification()
            }
          }, 1000)
        })
      })

      logger.info('Login notification script injected successfully')
    } catch (error) {
      logger.error('Failed to inject login notification', error)
    }
  }

  /**
   * Set up auto-click for continue button after login detection
   *
   * Monitors the page for successful login and automatically clicks any
   * continue/proceed/download buttons that appear after authentication.
   *
   * @param sessionId - The session ID to monitor
   */
  private async setupContinueButtonAutoClick(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)

    if (!session?.page) {
      logger.error(
        `Cannot setup auto-click for session ${sessionId} - session or page not found`
      )
      return
    }

    const page = session.page

    try {
      await page.evaluateOnNewDocument(() => {
        window.addEventListener('DOMContentLoaded', () => {
          let loginDetected = false

          const checkForContinueButton = setInterval(() => {
            // Detect if user has logged in
            const hasAuthCookies =
              document.cookie.includes('session') ||
              document.cookie.includes('auth') ||
              document.cookie.includes('token')
            const hasLogoutButton =
              document.querySelector('[data-testid="logout"]') ||
              document.querySelector('.logout') ||
              document.querySelector('[href*="logout"]')

            if (!loginDetected && (hasAuthCookies || hasLogoutButton)) {
              loginDetected = true

              // Wait a moment for the continue button to appear
              setTimeout(() => {
                // Common continue button selectors
                const continueSelectors = [
                  'button[type="submit"]',
                  'button:contains("Continue")',
                  'button:contains("Proceed")',
                  'button:contains("Next")',
                  'button:contains("Download")',
                  'a:contains("Continue")',
                  '[data-testid="continue"]',
                  '[data-testid="proceed"]',
                  '.continue-button',
                  '.proceed-button',
                  '#continue',
                  '#proceed'
                ]

                // Try to find and click continue button
                for (const selector of continueSelectors) {
                  try {
                    // Simple selector (no :contains support in querySelector)
                    let button = document.querySelector(selector) as HTMLElement

                    // If not found, try text-based search
                    if (!button) {
                      const buttons = Array.from(
                        document.querySelectorAll('button, a')
                      )
                      button = buttons.find(btn => {
                        const text = btn.textContent?.toLowerCase() || ''
                        return (
                          text.includes('continue') ||
                          text.includes('proceed') ||
                          text.includes('next') ||
                          text.includes('download')
                        )
                      }) as HTMLElement
                    }

                    if (button) {
                      // Found a continue button, click it
                      button.click()
                      clearInterval(checkForContinueButton)
                      break
                    }
                  } catch (error) {
                    // Ignore selector errors and continue trying
                  }
                }
              }, 1000)
            }
          }, 500)

          // Stop checking after 30 seconds
          setTimeout(() => {
            clearInterval(checkForContinueButton)
          }, 30000)
        })
      })

      logger.info(`Auto-click script set up for session ${sessionId}`)
    } catch (error) {
      logger.error(`Failed to setup auto-click for session ${sessionId}`, error)
    }
  }

  /**
   * Monitor mini-browser authentication completion
   *
   * This private method sets up event listeners on the Puppeteer page to detect
   * authentication success. It monitors HTTP responses for authentication indicators
   * (URL patterns, Set-Cookie headers) and captures cookies when authentication completes.
   *
   * @param sessionId - The session ID to monitor
   * @returns Promise that resolves when monitoring is set up
   */
  private monitorMiniBrowserAuthentication(sessionId: string): void {
    const session = this.activeSessions.get(sessionId)

    if (!session?.page) {
      logger.error(
        `Cannot monitor mini-browser session ${sessionId} - session or page not found`
      )
      return
    }

    logger.info(`Starting monitoring for mini-browser session ${sessionId}`)

    try {
      const page = session.page

      // Listen for HTTP responses to detect authentication success
      page.on('response', (response): void => {
        void (async (): Promise<void> => {
          try {
            const url = response.url()
            const headers = response.headers()

            // Check for authentication success indicators
            const isAuthSuccess = this.isAuthenticationSuccessFromResponse(
              url,
              headers
            )

            if (isAuthSuccess) {
              logger.info(
                `Authentication success detected for session ${sessionId}`
              )

              // Capture cookies from the page
              const cookies = await page.cookies()

              if (cookies.length > 0) {
                // Validate cookies before formatting
                const validation = this.validateCookies(cookies)

                // Log validation warnings if any
                if (validation.warnings.length > 0) {
                  for (const warning of validation.warnings) {
                    logger.warn(
                      `Cookie validation warning for session ${sessionId}: ${warning}`
                    )
                  }
                }

                // Format cookies for download (Netscape format)
                const formattedCookies = this.formatCookiesForDownload(cookies)

                // Update session with success status and cookies
                session.status = 'authenticated'
                session.cookies = formattedCookies
                this.activeSessions.set(sessionId, session)

                logger.info(
                  `Successfully captured ${cookies.length} cookies for session ${sessionId}`
                )

                // Store cookies in cookie service for future use
                await cookieService.setNetscapeCookies(
                  session.userId,
                  new URL(session.authUrl).hostname,
                  formattedCookies,
                  sessionId
                )

                // Clean up timeout if it exists
                if (session.timeoutId) {
                  clearTimeout(session.timeoutId)
                }

                // Clean up browser resources after successful authentication
                if (session.browserInstanceId) {
                  await browserLauncherService.closeBrowser(
                    session.browserInstanceId
                  )
                }
              }
            }
          } catch (error) {
            logger.error(
              `Error processing response in mini-browser session ${sessionId}`,
              error
            )
          }
        })()
      })

      // Set up timeout handler
      const timeoutId = setTimeout((): void => {
        const currentSession = this.activeSessions.get(sessionId)
        if (currentSession && currentSession.status === 'pending') {
          logger.warn(`Mini-browser session ${sessionId} timed out`)
          currentSession.status = 'timeout'
          currentSession.error =
            'Authentication session timed out - please try again'
          this.activeSessions.set(sessionId, currentSession)

          // Clean up browser resources
          if (currentSession.browserInstanceId) {
            void browserLauncherService.closeBrowser(
              currentSession.browserInstanceId
            )
          }
        }
      }, session.expiresAt - session.createdAt)

      // Store timeout ID for potential cleanup
      session.timeoutId = timeoutId
      this.activeSessions.set(sessionId, session)
    } catch (error) {
      logger.error(
        `Error setting up monitoring for mini-browser session ${sessionId}`,
        error
      )
      session.status = 'failed'
      session.error =
        error instanceof Error
          ? error.message
          : 'Failed to monitor authentication'
      this.activeSessions.set(sessionId, session)
    }
  }

  /**
   * Check if an HTTP response indicates authentication success
   *
   * @param url - The response URL
   * @param headers - The response headers
   * @returns True if authentication success is detected
   */
  private isAuthenticationSuccessFromResponse(
    url: string,
    headers: Record<string, string>
  ): boolean {
    // Check for Set-Cookie headers (common authentication indicator)
    const hasCookies = 'set-cookie' in headers

    // Check for authentication success URL patterns
    const authSuccessPatterns = [
      '/dashboard',
      '/home',
      '/account',
      '/profile',
      '/success',
      '/authenticated',
      'auth=success',
      'login=success'
    ]

    const hasAuthSuccessUrl = authSuccessPatterns.some(pattern =>
      url.toLowerCase().includes(pattern.toLowerCase())
    )

    // Check for redirect patterns (common after successful login)
    const statusCode = headers['status'] ?? headers[':status']
    const isRedirect =
      statusCode === '302' || statusCode === '301' || statusCode === '303'

    return (hasCookies && isRedirect) || hasAuthSuccessUrl
  }

  /**
   * Validate cookie structure and security attributes
   *
   * This method performs comprehensive validation on cookies before they are formatted
   * for download. It checks for required fields, security attributes, and expiration status.
   *
   * @param cookies - Array of cookies to validate
   * @returns Validation result object containing validity status and any warnings
   */
  private validateCookies(
    cookies: Array<{
      name: string
      value: string
      domain: string
      path: string
      expires?: number
      secure?: boolean
      httpOnly?: boolean
    }>
  ): {
    valid: boolean
    warnings: string[]
  } {
    const warnings: string[] = []

    for (const cookie of cookies) {
      // Check required attributes
      if (!cookie.name || !cookie.value) {
        warnings.push(
          `Cookie missing required fields: ${cookie.name || 'unnamed'}`
        )
      }

      // Check domain validity
      if (!cookie.domain || cookie.domain === '') {
        warnings.push(`Cookie ${cookie.name} has invalid domain`)
      }

      // Warn about insecure cookies
      if (!cookie.secure && cookie.domain.includes('https')) {
        warnings.push(
          `Cookie ${cookie.name} is not marked secure for HTTPS domain`
        )
      }

      // Check expiration
      if (cookie.expires && cookie.expires < Date.now() / 1000) {
        warnings.push(`Cookie ${cookie.name} has already expired`)
      }
    }

    return {
      valid: warnings.length === 0,
      warnings
    }
  }

  /**
   * Format Puppeteer cookies into Netscape cookie format for yt-dlp compatibility
   *
   * This method converts Puppeteer cookie objects into the Netscape cookie file format,
   * which is required by yt-dlp and other download tools. The format is a tab-delimited
   * text file with specific columns for domain, flags, path, security, expiration, name, and value.
   *
   * @param cookies - Array of Puppeteer cookies
   * @returns Formatted cookie string in Netscape format
   */
  private formatCookiesForDownload(
    cookies: Array<{
      name: string
      value: string
      domain: string
      path: string
      expires?: number
      httpOnly?: boolean
      secure?: boolean
    }>
  ): string {
    const netscapeCookies = cookies.map(cookie => {
      const domain = cookie.domain.startsWith('.')
        ? cookie.domain.substring(1)
        : cookie.domain
      const flag = cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE'
      const path = cookie.path ?? '/'
      const secure = cookie.secure ? 'TRUE' : 'FALSE'
      const expiration = cookie.expires ? Math.floor(cookie.expires) : 0
      const name = cookie.name
      const value = cookie.value

      return [
        domain,
        flag,
        path,
        secure,
        expiration.toString(),
        name,
        value
      ].join('\t')
    })

    const header = [
      '# Netscape HTTP Cookie File',
      '# This is a generated file! Do not edit.',
      ''
    ]

    return [...header, ...netscapeCookies].join('\n')
  }

  /**
   * Get the status of a mini-browser authentication session
   *
   * This method retrieves the current status of a mini-browser session, including
   * authentication state, captured cookies, and status messages for the client.
   *
   * @param sessionId - The session ID to query
   * @returns Object containing session status, cookies (if authenticated), and status message
   */
  getMiniBrowserSessionStatus(sessionId: string): {
    status: 'pending' | 'authenticated' | 'failed' | 'timeout'
    cookies?: string
    message?: string
  } {
    const session = this.activeSessions.get(sessionId)

    if (!session) {
      logger.warn(`Mini-browser session ${sessionId} not found`)
      return {
        status: 'failed',
        message:
          'Authentication session not found - it may have expired or been cleaned up'
      }
    }

    logger.debug(
      `Retrieving status for mini-browser session ${sessionId}: ${session.status}`
    )

    const result: {
      status: 'pending' | 'authenticated' | 'failed' | 'timeout'
      cookies?: string
      message?: string
    } = {
      status: session.status,
      ...(session.cookies ? { cookies: session.cookies } : {}),
      message: this.getMiniBrowserStatusMessage(session.status, session.error)
    }

    return result
  }

  /**
   * Get user-friendly status message for mini-browser session
   *
   * @param status - The session status
   * @param error - Optional error message
   * @returns User-friendly status message
   */
  private getMiniBrowserStatusMessage(
    status: 'pending' | 'authenticated' | 'failed' | 'timeout',
    error?: string
  ): string {
    switch (status) {
      case 'pending':
        return 'Waiting for authentication to complete. Please log in using the browser window.'
      case 'authenticated':
        return 'Authentication completed successfully. Cookies have been captured.'
      case 'failed':
        return (
          error ??
          'Authentication failed. Please try again or contact support if the issue persists.'
        )
      case 'timeout':
        return 'Authentication session timed out. Please try again and complete the login process within the time limit.'
      default:
        return 'Unknown session status'
    }
  }

  /**
   * Clean up a mini-browser authentication session
   *
   * Removes the session from active sessions, clears any timeouts,
   * closes the associated browser page if it's still open, and clears stored browser info.
   *
   * @param sessionId - The session ID to clean up
   */
  cleanupMiniBrowserSession(sessionId: string): void {
    const session = this.activeSessions.get(sessionId)

    if (!session) {
      logger.debug(
        `Mini-browser session ${sessionId} already cleaned up or not found`
      )
      return
    }

    logger.info(`Cleaning up mini-browser session ${sessionId}`)

    // Clear timeout if exists
    if (session.timeoutId) {
      clearTimeout(session.timeoutId)
    }

    // Close the page if it's still open (for server-side sessions)
    if (session.page) {
      void session.page.close().catch((error: unknown) => {
        logger.warn(`Failed to close page for session ${sessionId}`, {
          error: error instanceof Error ? error.message : String(error)
        })
      })
    }

    // Clear stored browser info
    clearBrowserInfo(sessionId)

    // Remove from active sessions
    this.activeSessions.delete(sessionId)

    logger.info(`Mini-browser session ${sessionId} cleaned up successfully`)
  }

  /**
   * Visit a URL using Puppeteer with user browser context
   * This method uses the stored browser info to mimic the user's browser
   * and returns the HTML content for iframe display
   */
  async visitUrlWithUserContext(
    targetUrl: string,
    sessionId: string
  ): Promise<{
    success: boolean
    html?: string
    cookies?: string
    error?: string
    frameBlocked?: boolean
    responseHeaders?: Record<string, string>
  }> {
    try {
      logger.info(
        `Visiting ${targetUrl} with user context for session ${sessionId}`
      )

      // Get the session
      const session = this.activeSessions.get(sessionId)

      // If session is not in-memory (e.g., stateless server or different instance),
      // try to recover enough browser info from the browser-mimicking service so
      // we can still open a Puppeteer page that mimics the user's browser.
      let fallbackBrowserInfo = null
      if (!session) {
        logger.warn(
          `Session ${sessionId} not found in-memory; attempting to recover stored browser info`
        )
        try {
          fallbackBrowserInfo = await getStoredBrowserInfoService(sessionId)
          if (!fallbackBrowserInfo) {
            logger.warn(`No stored browser info found for session ${sessionId}`)
          } else {
            logger.info(`Recovered browser info for session ${sessionId}`, {
              userAgent: fallbackBrowserInfo.userAgent?.substring(0, 60)
            })
          }
        } catch (err) {
          logger.warn(
            `Failed to retrieve stored browser info for session ${sessionId}`,
            { error: err instanceof Error ? err.message : String(err) }
          )
        }
      }

      // Launch browser with user context for authentication
      // Launch a fresh browser for the proxy visit. We don&apos;t reuse session.browserInstanceId
      // here because this route may be invoked on a different server instance than the
      // one that created the frontend session.
      const launchResult = await browserLauncherService.launchForAuth(
        fallbackBrowserInfo ? { browserInfo: fallbackBrowserInfo } : undefined
      )
      if (!launchResult.success || !launchResult.browser) {
        return {
          success: false,
          error: launchResult.error || 'Failed to launch browser'
        }
      }

      const browser = launchResult.browser
      const page = await browser.newPage()

      try {
        // Set user agent and other browser mimicking. Prefer session-stored info,
        // otherwise use recovered fallback info from browser mimicking service.
        let browserInfo = null
        if (session) {
          browserInfo = await this.getBrowserInfo(sessionId)
        } else if (fallbackBrowserInfo) {
          browserInfo = fallbackBrowserInfo
        } else {
          browserInfo = await this.getBrowserInfo(sessionId) // fallback to defaults inside method
        }

        if (browserInfo) {
          if (browserInfo.userAgent) {
            await page.setUserAgent(browserInfo.userAgent)
          }
          // BrowserInfo uses 'screenResolution' for width/height
          await page.setViewport({
            width: browserInfo.screenResolution?.width || 1920,
            height: browserInfo.screenResolution?.height || 1080
          })
        }

        // Set additional headers to mimic user's browser
        await page.setExtraHTTPHeaders({
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          DNT: '1',
          Connection: 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        })

        // Navigate to the target URL and capture the main response
        const response = await page.goto(targetUrl, {
          waitUntil: 'networkidle2',
          timeout: 30000
        })

        // Collect response headers for analysis
        const respHeaders: Record<string, string> = response
          ? response.headers()
          : {}

        // Detect common frame-blocking policies
        const xFrame = (
          respHeaders['x-frame-options'] ||
          respHeaders['X-Frame-Options'] ||
          ''
        )
          .toString()
          .toLowerCase()
        const csp = (
          respHeaders['content-security-policy'] ||
          respHeaders['Content-Security-Policy'] ||
          ''
        )
          .toString()
          .toLowerCase()

        const frameBlocked = Boolean(
          xFrame.includes('deny') ||
            xFrame.includes('sameorigin') ||
            (csp &&
              csp.includes('frame-ancestors') &&
              (csp.includes("frame-ancestors 'none'") ||
                !csp.includes("frame-ancestors 'self'")))
        )

        // Get the HTML content
        const html = await page.content()

        // Extract cookies
        const cookies = await page.cookies()
        const cookieString = cookies
          .map(cookie => `${cookie.name}=${cookie.value}`)
          .join('; ')

        // Close the page but keep browser for potential reuse
        await page.close()

        logger.info(`Successfully visited ${targetUrl} with user context`, {
          cookieCount: cookies.length,
          hasCookies: cookieString.length > 0,
          frameBlocked
        })

        return {
          success: true,
          html,
          cookies: cookieString,
          frameBlocked,
          responseHeaders: respHeaders
        }
      } catch (error) {
        await page.close()
        throw error
      }
    } catch (error) {
      logger.error(`Failed to visit ${targetUrl} with user context:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get browser info for a session
   * This retrieves the stored browser info that was captured from the user's actual browser
   */
  private async getBrowserInfo(sessionId: string): Promise<BrowserInfo | null> {
    try {
      // Try to get stored browser info first
      const storedInfo = await this.getStoredBrowserInfo(sessionId)
      if (storedInfo) {
        return storedInfo
      }

      // Fallback to default browser info if no stored info
      logger.warn(
        `No stored browser info found for session ${sessionId}, using defaults`
      )
      return {
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        screenResolution: {
          width: 1920,
          height: 1080,
          colorDepth: 24,
          pixelRatio: 1
        },
        language: 'en-US',
        timezone: 'America/New_York',
        platform: 'Win32',
        languages: ['en-US'],
        vendor: 'Google Inc.',
        hardwareConcurrency: 4,
        cookieEnabled: true,
        doNotTrack: null,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US'
        }
      }
    } catch (error) {
      logger.warn(`Failed to get browser info for session ${sessionId}:`, {
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * Store browser info for a session
   */
  async storeBrowserInfo(
    sessionId: string,
    browserInfo: BrowserInfo
  ): Promise<void> {
    try {
      logger.info(`Storing browser info for session ${sessionId}`, {
        userAgent: browserInfo.userAgent,
        screenResolution: browserInfo.screenResolution,
        language: browserInfo.language
      })

      // Store the browser info using the browser mimicking service
      await storeBrowserInfoService(sessionId, browserInfo)
    } catch (error) {
      logger.error(
        `Failed to store browser info for session ${sessionId}:`,
        error
      )
      throw error
    }
  }

  /**
   * Get stored browser info for a session
   */
  private async getStoredBrowserInfo(
    sessionId: string
  ): Promise<BrowserInfo | null> {
    try {
      // This would retrieve the browser info that was stored when the session was created
      // For now, return null to use defaults
      return null
    } catch (error) {
      logger.warn(
        `Failed to get stored browser info for session ${sessionId}:`,
        { error: error instanceof Error ? error.message : String(error) }
      )
      return null
    }
  }
}

// Export singleton instance
export const authenticationManager = new AuthenticationManager()
