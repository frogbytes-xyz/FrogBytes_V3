/**
 * Remote Browser Service
 *
 * Launches a Puppeteer browser instance with X-Frame-Options bypass extension
 * and streams the browser view to the frontend for user interaction.
 *
 * This solves the X-Frame-Options problem by running our own browser with
 * the restriction bypass extension pre-loaded.
 */

import type { Browser, Page, CDPSession } from 'puppeteer'
// Puppeteer is imported dynamically at runtime to avoid static analysis issues
// during Next.js build. Use `await import('puppeteer')` inside methods that run
// only on the server.
import { join } from 'path'
import { logger } from '@/lib/utils/logger'

interface RemoteBrowserSession {
  browser: Browser
  page: Page
  cdpSession: CDPSession
  sessionId: string
  url: string
  userId?: string
  createdAt: number
}

class RemoteBrowserService {
  private sessions: Map<string, RemoteBrowserSession> = new Map()
  private extensionPath: string
  private sessionCreationLocks: Map<string, Promise<RemoteBrowserSession>> =
    new Map()
  private screenshotCache: Map<string, { buffer: Buffer; timestamp: number }> =
    new Map()

  constructor() {
    this.extensionPath = join(process.cwd(), 'extensions', 'x-frame-bypass')
  }

  /**
   * Launch a new remote browser session with X-Frame-Options bypass
   * Prevents duplicate sessions with the same sessionId
   */
  async createSession(
    sessionId: string,
    url: string,
    userAgent?: string,
    userId?: string
  ): Promise<RemoteBrowserSession> {
    // Check if session already exists
    const existingSession = this.sessions.get(sessionId)
    if (existingSession) {
      logger.info('Session already exists, returning existing session', {
        sessionId
      })
      return existingSession
    }

    // Check if session is being created (prevent race conditions)
    const existingLock = this.sessionCreationLocks.get(sessionId)
    if (existingLock) {
      logger.info(
        'Session creation already in progress, waiting for completion',
        { sessionId }
      )
      return existingLock
    }

    // Create a lock for this session creation
    const sessionPromise = this._createSessionInternal(
      sessionId,
      url,
      userAgent,
      userId
    )
    this.sessionCreationLocks.set(sessionId, sessionPromise)

    try {
      const session = await sessionPromise
      return session
    } finally {
      // Remove the lock once creation is complete
      this.sessionCreationLocks.delete(sessionId)
    }
  }

  /**
   * Internal method to create a session (without locking)
   */
  private async _createSessionInternal(
    sessionId: string,
    url: string,
    userAgent?: string,
    userId?: string
  ): Promise<RemoteBrowserSession> {
    try {
      logger.info('Launching remote browser session', {
        sessionId,
        url,
        userAgent
      })

      // Launch Puppeteer with extension and CDP
      // Use `any` here to avoid TypeScript mismatches when importing at runtime.
      // We only use this in server runtime code, not in browser bundles.
      const puppeteer: any = (await import('puppeteer')).default
      const browser = await puppeteer.launch({
        headless: false, // Required for extensions
        args: [
          `--load-extension=${this.extensionPath}`,
          `--disable-extensions-except=${this.extensionPath}`,
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--remote-debugging-port=0', // Use random available port
          ...(userAgent ? [`--user-agent=${userAgent}`] : [])
        ],
        defaultViewport: {
          width: 1280,
          height: 720
        }
      })

      const page = await browser.newPage()

      // Get CDP session for advanced control
      const cdpSession = await page.target().createCDPSession()

      // Enable CDP domains for screenshot/screencast
      await cdpSession.send('Page.enable')
      await cdpSession.send('Page.startScreencast', {
        format: 'jpeg',
        quality: 80,
        maxWidth: 1280,
        maxHeight: 720
      })

      // Set user agent if provided
      if (userAgent) {
        await page.setUserAgent(userAgent)
      }

      // Navigate to URL with better error handling
      try {
        await page.goto(url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        })
      } catch (navigationError) {
        logger.warn('Navigation failed, but continuing with session', {
          sessionId,
          url,
          error:
            navigationError instanceof Error
              ? navigationError.message
              : 'Unknown error'
        })
        // Continue even if navigation fails - user can navigate manually
      }

      const session: RemoteBrowserSession = {
        browser,
        page,
        cdpSession,
        sessionId,
        url,
        ...(userId ? { userId } : {}),
        createdAt: Date.now()
      }

      this.sessions.set(sessionId, session)

      logger.info('Remote browser session created', {
        sessionId,
        debuggerUrl: await this.getDebuggerUrl(browser)
      })

      return session
    } catch (error) {
      logger.error('Failed to create remote browser session', error)
      throw error
    }
  }

  /**
   * Get CDP debugger URL for the browser
   */
  private async getDebuggerUrl(browser: Browser): Promise<string | null> {
    try {
      const endpoint = browser.wsEndpoint()
      return endpoint
    } catch {
      return null
    }
  }

  /**
   * Get current screenshot of the browser with caching
   */
  async getScreenshot(sessionId: string): Promise<Buffer | null> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      logger.warn('Session not found for screenshot', { sessionId })
      return null
    }

    // Check cache first (cache for 1 second to reduce load)
    const cached = this.screenshotCache.get(sessionId)
    const now = Date.now()
    if (cached && now - cached.timestamp < 1000) {
      return cached.buffer
    }

    try {
      const screenshot = await session.page.screenshot({
        type: 'jpeg',
        quality: 80,
        encoding: 'binary'
      })

      const buffer = Buffer.from(screenshot)

      // Cache the screenshot
      this.screenshotCache.set(sessionId, {
        buffer,
        timestamp: now
      })

      return buffer
    } catch (error) {
      logger.error('Failed to capture screenshot', error)
      return null
    }
  }

  /**
   * Handle user click on the remote browser
   */
  async handleClick(sessionId: string, x: number, y: number): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    try {
      await session.page.mouse.click(x, y)
      return true
    } catch (error) {
      logger.error('Failed to handle click', error)
      return false
    }
  }

  /**
   * Handle keyboard input on the remote browser
   */
  async handleKeypress(sessionId: string, key: string): Promise<boolean> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return false
    }

    try {
      await session.page.keyboard.type(key)
      return true
    } catch (error) {
      logger.error('Failed to handle keypress', error)
      return false
    }
  }

  /**
   * Extract cookies from the remote browser after authentication
   */
  async extractCookies(sessionId: string): Promise<string | null> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return null
    }

    try {
      const cookies = await session.page.cookies()

      // Convert to Netscape format
      const lines = [
        '# Netscape HTTP Cookie File',
        '# This is a generated file. Do not edit.',
        ''
      ]

      for (const cookie of cookies) {
        const domain = cookie.domain.startsWith('.')
          ? cookie.domain.substring(1)
          : cookie.domain
        const domainFlag = cookie.domain.startsWith('.') ? 'TRUE' : 'FALSE'
        const path = cookie.path || '/'
        const secure = cookie.secure ? 'TRUE' : 'FALSE'
        const expiration = cookie.expires ? Math.floor(cookie.expires) : 0
        const name = cookie.name
        const value = cookie.value

        lines.push(
          `${domain}\t${domainFlag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}`
        )
      }

      logger.info('Extracted cookies from remote browser', {
        sessionId,
        cookieCount: cookies.length
      })

      return lines.join('\n')
    } catch (error) {
      logger.error('Failed to extract cookies', error)
      return null
    }
  }

  /**
   * Close a remote browser session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return
    }

    try {
      await session.cdpSession.detach()
      await session.browser.close()
      this.sessions.delete(sessionId)

      // Clear screenshot cache for this session
      this.screenshotCache.delete(sessionId)

      logger.info('Remote browser session closed', { sessionId })
    } catch (error) {
      logger.error('Failed to close remote browser session', error)
    }
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): RemoteBrowserSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * Clean up old sessions (older than 1 hour) and cache entries
   */
  async cleanupStaleSessions(): Promise<void> {
    const now = Date.now()
    const oneHour = 60 * 60 * 1000

    // Clean up old sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.createdAt > oneHour) {
        logger.info('Cleaning up stale session', { sessionId })
        await this.closeSession(sessionId)
      }
    }

    // Clean up old cache entries (older than 5 minutes)
    const fiveMinutes = 5 * 60 * 1000
    for (const [sessionId, cacheEntry] of this.screenshotCache.entries()) {
      if (now - cacheEntry.timestamp > fiveMinutes) {
        this.screenshotCache.delete(sessionId)
      }
    }
  }
}

export const remoteBrowserService = new RemoteBrowserService()

// Clean up stale sessions and cache every 10 minutes
setInterval(
  () => {
    void remoteBrowserService.cleanupStaleSessions()
  },
  10 * 60 * 1000
)
