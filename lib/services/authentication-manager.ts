/**
 * Authentication Manager Service
 * Handles user login flows with Puppeteer browser automation
 */

import { Page } from 'puppeteer'
import { browserLauncherService } from './browser-launcher-service'
import { cookieService } from './cookie-service'
import { authenticationPopupService } from './authentication-popup-service'
import { videoDownloadConfig } from '../config/video-download'

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
    options: AuthenticationOptions = {}
  ): Promise<LoginResult> {
    try {
      // Show popup to inform user about authentication requirement
      const popupResult = await authenticationPopupService.showAuthenticationPopup(url, userId, {
        title: '🔐 Authentication Required',
        message: `
          <p>This video requires authentication to access.</p>
          <p><strong>URL:</strong> <code>${url}</code></p>
          <p>Please log in to your account to continue with the download.</p>
        `,
        loginButtonText: '🔑 Login & Download',
        cancelButtonText: '❌ Cancel',
        timeout: options.timeout || videoDownloadConfig.authSessionTimeout,
      })

      if (popupResult.action === 'cancel') {
        return {
          success: false,
          error: 'User cancelled authentication',
          errorType: 'credentials',
          errorDetails: 'User chose to cancel the authentication process',
        }
      }

      if (popupResult.action === 'timeout') {
        return {
          success: false,
          error: 'Authentication popup timed out',
          errorType: 'timeout',
          errorDetails: 'User did not respond to the authentication popup within the time limit',
        }
      }

      if (popupResult.action === 'error') {
        return {
          success: false,
          error: popupResult.error || 'Popup error occurred',
          errorType: 'browser',
          errorDetails: 'Failed to show authentication popup',
        }
      }

      // User clicked login, proceed with authentication
      if (popupResult.action === 'login') {
        return await this.handleLogin({
          ...options,
          userId,
          authUrl: url,
        })
      }

      return {
        success: false,
        error: 'Unknown popup action',
        errorType: 'unknown',
        errorDetails: 'Unexpected popup action received',
      }

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorType: 'unknown',
        errorDetails: 'Error during authentication popup flow',
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
      expiresAt: now + timeout,
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
          errorDetails: 'Browser launch failed - check Puppeteer configuration and system resources',
        }
      }

      session.browserInstanceId = browserResult.instanceId
      this.activeSessions.set(sessionId, session)

      // Create page and navigate to auth URL
      const page = await browserLauncherService.createPage(browserResult.instanceId!)
      
      if (!page) {
        session.status = 'failed'
        session.error = 'Failed to create browser page'
        return {
          success: false,
          sessionId,
          error: session.error,
          errorType: 'browser',
          errorDetails: 'Failed to create new browser page - browser may be in an invalid state',
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

      console.log(`Authentication session ${sessionId} started. Browser opened to: ${options.authUrl}`)

      // Wait for authentication to complete
      const authResult = await this.waitForAuthentication(page, session, options)

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
          cookies: authResult.cookies,
        }
      } else {
        const errorType = this.classifyAuthError(authResult.error || 'Unknown error')
        session.status = errorType === 'timeout' ? 'timeout' : 'failed'
        session.error = authResult.error
        this.activeSessions.set(sessionId, session)

        return {
          success: false,
          sessionId,
          error: authResult.error,
          errorType,
          errorDetails: this.getErrorDetails(errorType, authResult.error),
        }
      }
    } catch (error) {
      const errorType = this.classifyAuthError(error instanceof Error ? error.message : 'Unknown error')
      session.status = 'failed'
      session.error = error instanceof Error ? error.message : 'Unknown error occurred'
      this.activeSessions.set(sessionId, session)

      return {
        success: false,
        sessionId,
        error: session.error,
        errorType,
        errorDetails: this.getErrorDetails(errorType, session.error),
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
  private async configurePageForAuth(page: Page, options: AuthenticationOptions): Promise<void> {
    // Set custom headers if provided
    if (options.customHeaders) {
      await page.setExtraHTTPHeaders(options.customHeaders)
    }

    // Set viewport for better user experience
    await page.setViewport({
      width: 1280,
      height: 800,
      deviceScaleFactor: 1,
    })

    // Add authentication-specific event listeners
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`Browser console error: ${msg.text()}`)
      }
    })

    page.on('pageerror', (error) => {
      console.error(`Page error: ${error.message}`)
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
    const startTime = Date.now()

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          error: 'Authentication timeout - user did not complete login within the time limit',
        })
      }, timeout)

      const checkAuth = async () => {
        try {
          // Check if session has expired
          if (Date.now() > session.expiresAt) {
            clearTimeout(timeoutId)
            resolve({
              success: false,
              error: 'Session expired',
            })
            return
          }

          // Check for success indicators
          const isAuthenticated = await this.checkAuthenticationSuccess(page, options)
          
          if (isAuthenticated) {
            clearTimeout(timeoutId)
            
            // Extract cookies
            const cookies = await this.extractCookies(page)
            
            if (cookies) {
              resolve({
                success: true,
                cookies,
              })
            } else {
              resolve({
                success: false,
                error: 'Failed to extract authentication cookies',
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
            error: error instanceof Error ? error.message : 'Error during authentication check',
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
  private async checkAuthenticationSuccess(page: Page, options: AuthenticationOptions): Promise<boolean> {
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
        '.account-menu',
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
      const authCookies = cookies.filter(cookie => 
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
      if (!currentUrl.includes(authUrl.pathname) && 
          !currentUrl.includes('/login') && 
          !currentUrl.includes('/signin') &&
          !currentUrl.includes('/error')) {
        return true
      }

      return false
    } catch (error) {
      console.error('Error checking authentication success:', error)
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
        const domain = cookie.domain.startsWith('.') ? cookie.domain.substring(1) : cookie.domain
        const flag = cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE'
        const path = cookie.path || '/'
        const secure = cookie.secure ? 'TRUE' : 'FALSE'
        const expiration = cookie.expires ? Math.floor(cookie.expires) : 0
        const name = cookie.name
        const value = cookie.value

        return [domain, flag, path, secure, expiration.toString(), name, value].join('\t')
      })

      const header = [
        '# Netscape HTTP Cookie File',
        '# This is a generated file! Do not edit.',
        '',
      ]

      return [...header, ...netscapeCookies].join('\n')
    } catch (error) {
      console.error('Failed to extract cookies:', error)
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
    return currentUrlObj.hostname === authUrlObj.hostname && 
           currentUrlObj.pathname === authUrlObj.pathname
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): LoginSession | undefined {
    return this.activeSessions.get(sessionId)
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): LoginSession[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * Cancel a login session
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
      console.error('Error cancelling session:', error)
      return false
    }
  }

  /**
   * Clean up expired sessions
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
  private classifyAuthError(errorMessage: string): 'timeout' | 'credentials' | 'network' | 'browser' | 'unknown' {
    const lowerError = errorMessage.toLowerCase()
    
    if (lowerError.includes('timeout') || lowerError.includes('expired')) {
      return 'timeout'
    }
    
    if (lowerError.includes('unauthorized') || lowerError.includes('forbidden') || 
        lowerError.includes('invalid credentials') || lowerError.includes('login failed') ||
        lowerError.includes('authentication failed') || lowerError.includes('wrong password') ||
        lowerError.includes('incorrect username') || lowerError.includes('access denied')) {
      return 'credentials'
    }
    
    if (lowerError.includes('network') || lowerError.includes('connection') || 
        lowerError.includes('dns') || lowerError.includes('refused') ||
        lowerError.includes('unreachable') || lowerError.includes('timeout')) {
      return 'network'
    }
    
    if (lowerError.includes('browser') || lowerError.includes('puppeteer') || 
        lowerError.includes('page') || lowerError.includes('navigation')) {
      return 'browser'
    }
    
    return 'unknown'
  }

  /**
   * Get detailed error information based on error type
   */
  private getErrorDetails(errorType: 'timeout' | 'credentials' | 'network' | 'browser' | 'unknown', errorMessage?: string): string {
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
        return errorMessage || 'An unexpected error occurred during authentication.'
    }
  }

  /**
   * Get service statistics
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
      uptime: process.uptime(),
    }
  }
}

// Export singleton instance
export const authenticationManager = new AuthenticationManager()
