import { logger } from '@/lib/utils/logger'

/**
 * Puppeteer Service for Browser Automation
 * Handles browser launching, authentication flows, and cookie extraction
 */

import { Browser, Page } from 'puppeteer'
import puppeteerExtra from 'puppeteer-extra'
import { videoDownloadConfig } from '../config/video-download'
import { cookieEncryptionService } from './cookie-encryption-service'

// Conditionally add stealth plugin to avoid detection
// Handle potential compatibility issues gracefully
let stealthPluginInitialized = false
try {
  const StealthPlugin = require('puppeteer-extra-plugin-stealth')
  puppeteerExtra.use(StealthPlugin())
  stealthPluginInitialized = true
  logger.info('[PUPPETEER] Stealth plugin initialized successfully')
} catch (error) {
  logger.warn('[PUPPETEER] Failed to initialize stealth plugin', { error: error instanceof Error ? error.message : 'Unknown error' })
  logger.warn('[PUPPETEER] Continuing without stealth plugin - some sites may detect automation')
}

export interface AuthSession {
  sessionId: string
  userId: string
  status: 'pending' | 'authenticated' | 'failed' | 'expired'
  browser?: Browser
  page?: Page
  authUrl?: string
  createdAt: number
  expiresAt: number
}

export interface AuthResult {
  success: boolean
  cookies?: string
  error?: string
  sessionId: string
}

class PuppeteerService {
  private activeSessions = new Map<string, AuthSession>()

  /**
   * Launch a new browser instance with stealth configuration
   */
  async launchBrowser(): Promise<Browser> {
    const launchOptions: any = {
      headless: videoDownloadConfig.puppeteerHeadless,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ],
      ignoreDefaultArgs: ['--disable-extensions'],
      defaultViewport: {
        width: 1280,
        height: 720,
      },
    }

    // Add executable path if specified
    if (videoDownloadConfig.puppeteerExecutablePath) {
      launchOptions.executablePath = videoDownloadConfig.puppeteerExecutablePath
    }

    // Add user data directory if specified
    if (videoDownloadConfig.puppeteerUserDataDir) {
      launchOptions.userDataDir = videoDownloadConfig.puppeteerUserDataDir
    }

    try {
      const browser = await puppeteerExtra.launch(launchOptions)
      return browser
    } catch (error) {
      throw new Error(`Failed to launch browser: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Create a new authentication session
   */
  async createAuthSession(userId: string, authUrl: string): Promise<AuthSession> {
    const sessionId = cookieEncryptionService.generateSecureToken()
    const now = Date.now()
    
    const session: AuthSession = {
      sessionId,
      userId,
      status: 'pending',
      authUrl,
      createdAt: now,
      expiresAt: now + videoDownloadConfig.authSessionTimeout,
    }

    this.activeSessions.set(sessionId, session)

    try {
      // Launch browser
      const browser = await this.launchBrowser()
      const page = await browser.newPage()

      // Set up page configuration
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      
      // Navigate to auth URL
      await page.goto(authUrl, { waitUntil: 'networkidle2', timeout: 30000 })

      // Update session with browser and page
      session.browser = browser
      session.page = page
      session.status = 'pending'

      this.activeSessions.set(sessionId, session)

      return session
    } catch (error) {
      session.status = 'failed'
      this.activeSessions.set(sessionId, session)
      throw new Error(`Failed to create auth session: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Wait for user authentication to complete
   */
  async waitForAuthentication(sessionId: string, timeoutMs: number = videoDownloadConfig.authSessionTimeout): Promise<AuthResult> {
    const session = this.activeSessions.get(sessionId)
    
    if (!session) {
      return {
        success: false,
        error: 'Session not found',
        sessionId,
      }
    }

    if (!session.page) {
      return {
        success: false,
        error: 'Browser page not available',
        sessionId,
      }
    }

    try {
      // Wait for authentication to complete
      // This is a simplified approach - in practice, you'd want to detect
      // specific indicators that authentication is complete
      await this.detectAuthenticationComplete(session.page, timeoutMs)

      // Extract cookies
      const cookies = await this.extractCookies(session.page)
      
      if (!cookies) {
        return {
          success: false,
          error: 'Failed to extract cookies',
          sessionId,
        }
      }

      // Update session status
      session.status = 'authenticated'
      this.activeSessions.set(sessionId, session)

      return {
        success: true,
        cookies,
        sessionId,
      }
    } catch (error) {
      session.status = 'failed'
      this.activeSessions.set(sessionId, session)
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        sessionId,
      }
    }
  }

  /**
   * Detect when authentication is complete
   * This is a simplified implementation - you may need to customize this
   * based on the specific authentication flow you're handling
   */
  private async detectAuthenticationComplete(page: Page, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'))
      }, timeoutMs)

      // Check for common indicators of successful authentication
      const checkAuth = async () => {
        try {
          const url = page.url()
          
          // Check if we're still on a login page
          if (url.includes('/login') || url.includes('/signin') || url.includes('/auth')) {
            // Still on auth page, continue waiting
            setTimeout(checkAuth, 1000)
            return
          }

          // Check for success indicators in the page
          const successSelectors = [
            'button[data-testid="logout"]',
            '.user-menu',
            '.profile-menu',
            '[data-testid="user-menu"]',
            '.authenticated',
          ]

          for (const selector of successSelectors) {
            try {
              const element = await page.$(selector)
              if (element) {
                clearTimeout(timeout)
                resolve()
                return
              }
            } catch {
              // Ignore selector errors
            }
          }

          // Check for cookies that indicate authentication
          const cookies = await page.cookies()
          const authCookies = cookies.filter(cookie => 
            cookie.name.toLowerCase().includes('session') ||
            cookie.name.toLowerCase().includes('auth') ||
            cookie.name.toLowerCase().includes('token') ||
            cookie.name.toLowerCase().includes('jwt')
          )

          if (authCookies.length > 0) {
            clearTimeout(timeout)
            resolve()
            return
          }

          // Continue checking
          setTimeout(checkAuth, 1000)
        } catch (error) {
          clearTimeout(timeout)
          reject(error)
        }
      }

      // Start checking
      checkAuth()
    })
  }

  /**
   * Extract cookies from the current page
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
      logger.error('Failed to extract cookies', error)
      return null
    }
  }

  /**
   * Close an authentication session
   */
  async closeAuthSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId)
    
    if (!session) {
      return
    }

    try {
      if (session.browser) {
        await session.browser.close()
      }
    } catch (error) {
      logger.error('Error closing browser', error)
    } finally {
      this.activeSessions.delete(sessionId)
    }
  }

  /**
   * Get session information
   */
  getSession(sessionId: string): AuthSession | undefined {
    return this.activeSessions.get(sessionId)
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now()
    const expiredSessions: string[] = []

    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (now > session.expiresAt) {
        expiredSessions.push(sessionId)
      }
    }

    for (const sessionId of expiredSessions) {
      await this.closeAuthSession(sessionId)
    }

    if (expiredSessions.length > 0) {
      logger.info(`Cleaned up ${expiredSessions.length} expired authentication sessions`)
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): AuthSession[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * Check if a session exists and is valid
   */
  isSessionValid(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId)
    return session !== undefined && Date.now() < session.expiresAt
  }
}

// Export singleton instance
export const puppeteerService = new PuppeteerService()
