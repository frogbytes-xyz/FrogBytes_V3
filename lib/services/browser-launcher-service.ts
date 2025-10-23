import { logger } from '@/lib/utils/logger'

/**
 * Browser Launcher Service
 * Dedicated service for launching and managing Puppeteer browser instances
 * with stealth configuration to avoid bot detection
 */

import type { Browser, Page } from 'puppeteer'
// Delay importing puppeteer-extra and stealth plugin until runtime to avoid
// static analysis issues during Next.js build.
import { videoDownloadConfig } from '../config/video-download'
import type { BrowserInfo } from '@/lib/utils/browser-info'
import { browserInfoToPuppeteerConfig } from '@/lib/utils/browser-info'

// Conditionally add stealth plugin to avoid detection
// Handle potential compatibility issues gracefully
let stealthPluginInitialized = false
// Stealth plugin will be initialized at runtime when launching a browser.

export interface BrowserLaunchOptions {
  headless?: boolean
  executablePath?: string
  userDataDir?: string
  viewport?: {
    width: number
    height: number
  }
  args?: string[]
  timeout?: number
  browserInfo?: BrowserInfo
}

export interface BrowserInstance {
  browser: Browser
  id: string
  createdAt: number
  lastUsed: number
  isActive: boolean
}

export interface LaunchResult {
  success: boolean
  browser?: Browser
  error?: string
  instanceId?: string
}

class BrowserLauncherService {
  private activeBrowsers = new Map<string, BrowserInstance>()
  private defaultLaunchOptions: BrowserLaunchOptions

  constructor() {
    this.defaultLaunchOptions = {
      headless: videoDownloadConfig.puppeteerHeadless,
      ...(videoDownloadConfig.puppeteerExecutablePath
        ? { executablePath: videoDownloadConfig.puppeteerExecutablePath }
        : {}),
      userDataDir: videoDownloadConfig.puppeteerUserDataDir,
      viewport: {
        width: 1280,
        height: 720
      },
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
        '--disable-blink-features=AutomationControlled',
        '--disable-extensions',
        '--disable-plugins',
        '--disable-images',
        '--disable-javascript',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--hide-scrollbars',
        '--mute-audio',
        '--no-default-browser-check',
        '--no-pings',
        '--password-store=basic',
        '--use-mock-keychain',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ],
      timeout: 30000
    }
  }

  /**
   * Launch a new browser instance
   */
  async launch(options: BrowserLaunchOptions = {}): Promise<LaunchResult> {
    try {
      const launchOptions = { ...this.defaultLaunchOptions, ...options }
      const instanceId = this.generateInstanceId()

      // Prepare launch arguments
      const args = [
        ...launchOptions.args!,
        ...(launchOptions.userDataDir
          ? [`--user-data-dir=${launchOptions.userDataDir}`]
          : [])
      ]

      const browserOptions: any = {
        headless: launchOptions.headless,
        args,
        ignoreDefaultArgs: ['--disable-extensions'],
        defaultViewport: launchOptions.viewport,
        timeout: launchOptions.timeout
      }

      // Add executable path if specified
      if (launchOptions.executablePath) {
        browserOptions.executablePath = launchOptions.executablePath
      }

      // Dynamic import puppeteer-extra and initialize stealth plugin once
      const puppeteerExtra: any =
        (await import('puppeteer-extra')).default ||
        (await import('puppeteer-extra'))

      if (!stealthPluginInitialized) {
        try {
          const StealthPlugin =
            (await import('puppeteer-extra-plugin-stealth')).default ||
            (await import('puppeteer-extra-plugin-stealth'))
          if (StealthPlugin) {
            puppeteerExtra.use(StealthPlugin())
            stealthPluginInitialized = true
            logger.info('[BROWSER] Stealth plugin initialized successfully')
          }
        } catch (err) {
          logger.warn('[BROWSER] Failed to initialize stealth plugin', {
            error: err instanceof Error ? err.message : 'Unknown error'
          })
          logger.warn(
            '[BROWSER] Continuing without stealth plugin - some sites may detect automation'
          )
        }
      }

      // Launch browser with puppeteer-extra
      const browser = await puppeteerExtra.launch(browserOptions)

      // Create browser instance record
      const instance: BrowserInstance = {
        browser,
        id: instanceId,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: true
      }

      // Store instance
      this.activeBrowsers.set(instanceId, instance)

      // Set up browser event handlers
      this.setupBrowserEventHandlers(browser, instanceId)

      logger.info(
        `Browser launched successfully with instance ID: ${instanceId}`
      )

      return {
        success: true,
        browser,
        instanceId
      }
    } catch (error) {
      logger.error('Failed to launch browser', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  /**
   * Launch browser for authentication flow
   */
  async launchForAuth(
    options: BrowserLaunchOptions = {}
  ): Promise<LaunchResult> {
    // Generate unique userDataDir for each auth session to avoid conflicts
    const uniqueUserDataDir = `${videoDownloadConfig.puppeteerUserDataDir}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    const authOptions: BrowserLaunchOptions = {
      ...options,
      headless: false, // Always visible for authentication
      userDataDir: uniqueUserDataDir, // Use unique directory for this instance
      viewport: {
        width: 1280,
        height: 800
      },
      args: [
        ...this.defaultLaunchOptions.args!,
        '--start-maximized',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-popup-blocking'
      ]
    }

    return this.launch(authOptions)
  }

  /**
   * Create a new page in an existing browser
   */
  async createPage(
    instanceId: string,
    browserInfo?: BrowserInfo
  ): Promise<Page | null> {
    const instance = this.activeBrowsers.get(instanceId)

    if (!instance?.isActive) {
      logger.error(`Browser instance ${instanceId} not found or inactive`)
      return null
    }

    try {
      const page = await instance.browser.newPage()

      // Configure page with user's browser info if available
      await this.configurePage(page, browserInfo)

      // Update last used timestamp
      instance.lastUsed = Date.now()

      return page
    } catch (error) {
      logger.error(`Failed to create page for instance ${instanceId}:`, error)
      return null
    }
  }

  /**
   * Configure a page with stealth settings and optional user browser info
   */
  private async configurePage(
    page: Page,
    browserInfo?: BrowserInfo
  ): Promise<void> {
    if (browserInfo) {
      // Use user's actual browser configuration
      const config = browserInfoToPuppeteerConfig(browserInfo)

      logger.info('Configuring page with user browser info', {
        userAgent: config.userAgent.substring(0, 50),
        viewport: config.viewport,
        timezone: config.timezone
      })

      // Set user agent from user's browser
      await page.setUserAgent(config.userAgent)

      // Set viewport to match user's screen
      await page.setViewport(config.viewport)

      // Set extra headers from user's browser
      await page.setExtraHTTPHeaders(config.extraHTTPHeaders)

      // Set timezone to match user's location
      await page.emulateTimezone(config.timezone)

      // Override navigator properties with user's actual values
      await page.evaluateOnNewDocument((info: BrowserInfo) => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        })

        Object.defineProperty(navigator, 'platform', {
          get: () => info.platform
        })

        Object.defineProperty(navigator, 'vendor', {
          get: () => info.vendor
        })

        Object.defineProperty(navigator, 'language', {
          get: () => info.language
        })

        Object.defineProperty(navigator, 'languages', {
          get: () => info.languages
        })

        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => info.hardwareConcurrency
        })

        if (info.deviceMemory !== undefined) {
          Object.defineProperty(navigator, 'deviceMemory', {
            get: () => info.deviceMemory
          })
        }
      }, browserInfo)
    } else {
      // Fallback to default configuration
      logger.info(
        'Configuring page with default settings (no user browser info)'
      )

      await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      )

      await page.setViewport({
        width: 1280,
        height: 720,
        deviceScaleFactor: 1
      })

      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      })

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        })

        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        })

        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en']
        })
      })
    }
  }

  /**
   * Close a browser instance
   */
  async closeBrowser(instanceId: string): Promise<boolean> {
    const instance = this.activeBrowsers.get(instanceId)

    if (!instance) {
      logger.warn(`Browser instance ${instanceId} not found`)
      return false
    }

    try {
      await instance.browser.close()
      instance.isActive = false
      this.activeBrowsers.delete(instanceId)
      logger.info(`Browser instance ${instanceId} closed successfully`)
      return true
    } catch (error) {
      logger.error(`Failed to close browser instance ${instanceId}:`, error)
      return false
    }
  }

  /**
   * Close all active browser instances
   */
  async closeAllBrowsers(): Promise<void> {
    const instanceIds = Array.from(this.activeBrowsers.keys())

    for (const instanceId of instanceIds) {
      await this.closeBrowser(instanceId)
    }

    logger.info(`Closed ${instanceIds.length} browser instances`)
  }

  /**
   * Get browser instance by ID
   */
  getBrowserInstance(instanceId: string): BrowserInstance | undefined {
    return this.activeBrowsers.get(instanceId)
  }

  /**
   * Get all active browser instances
   */
  getActiveBrowsers(): BrowserInstance[] {
    return Array.from(this.activeBrowsers.values()).filter(
      instance => instance.isActive
    )
  }

  /**
   * Check if browser instance is active
   */
  isBrowserActive(instanceId: string): boolean {
    const instance = this.activeBrowsers.get(instanceId)
    return instance ? instance.isActive : false
  }

  /**
   * Clean up inactive browser instances
   */
  async cleanupInactiveBrowsers(maxAge: number = 300000): Promise<number> {
    // 5 minutes default
    const now = Date.now()
    const inactiveInstances: string[] = []

    for (const [instanceId, instance] of this.activeBrowsers.entries()) {
      if (!instance.isActive || now - instance.lastUsed > maxAge) {
        inactiveInstances.push(instanceId)
      }
    }

    for (const instanceId of inactiveInstances) {
      await this.closeBrowser(instanceId)
    }

    return inactiveInstances.length
  }

  /**
   * Get service statistics
   */
  getStats(): {
    activeBrowsers: number
    totalLaunched: number
    uptime: number
  } {
    const activeBrowsers = this.getActiveBrowsers().length
    const totalLaunched = this.activeBrowsers.size

    return {
      activeBrowsers,
      totalLaunched,
      uptime: process.uptime()
    }
  }

  /**
   * Set up browser event handlers
   */
  private setupBrowserEventHandlers(
    browser: Browser,
    instanceId: string
  ): void {
    browser.on('disconnected', () => {
      logger.info(`Browser instance ${instanceId} disconnected`)
      const instance = this.activeBrowsers.get(instanceId)
      if (instance) {
        instance.isActive = false
      }
    })

    browser.on('targetcreated', target => {
      logger.info(
        `New target created in browser instance ${instanceId}: ${target.url()}`
      )
    })

    browser.on('targetdestroyed', target => {
      logger.info(
        `Target destroyed in browser instance ${instanceId}: ${target.url()}`
      )
    })
  }

  /**
   * Generate unique instance ID
   */
  private generateInstanceId(): string {
    return `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Reset service state (for testing)
   */
  reset(): void {
    this.activeBrowsers.clear()
  }
}

// Export singleton instance
export const browserLauncherService = new BrowserLauncherService()
