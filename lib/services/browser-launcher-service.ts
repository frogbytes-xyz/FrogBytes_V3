/**
 * Browser Launcher Service
 * Dedicated service for launching and managing Puppeteer browser instances
 * with stealth configuration to avoid bot detection
 */

import { Browser, Page } from 'puppeteer'
import puppeteerExtra from 'puppeteer-extra'
import { videoDownloadConfig } from '../config/video-download'

// Conditionally add stealth plugin to avoid detection
// Handle potential compatibility issues gracefully
let stealthPluginInitialized = false
try {
  const StealthPlugin = require('puppeteer-extra-plugin-stealth')
  puppeteerExtra.use(StealthPlugin())
  stealthPluginInitialized = true
  console.log('[BROWSER] Stealth plugin initialized successfully')
} catch (error) {
  console.warn('[BROWSER] Failed to initialize stealth plugin:', error instanceof Error ? error.message : 'Unknown error')
  console.warn('[BROWSER] Continuing without stealth plugin - some sites may detect automation')
}

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
      executablePath: videoDownloadConfig.puppeteerExecutablePath,
      userDataDir: videoDownloadConfig.puppeteerUserDataDir,
      viewport: {
        width: 1280,
        height: 720,
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
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      ],
      timeout: 30000,
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
        ...(launchOptions.userDataDir ? [`--user-data-dir=${launchOptions.userDataDir}`] : []),
      ]

      const browserOptions: any = {
        headless: launchOptions.headless,
        args,
        ignoreDefaultArgs: ['--disable-extensions'],
        defaultViewport: launchOptions.viewport,
        timeout: launchOptions.timeout,
      }

      // Add executable path if specified
      if (launchOptions.executablePath) {
        browserOptions.executablePath = launchOptions.executablePath
      }

      // Launch browser with stealth plugin
      const browser = await puppeteerExtra.launch(browserOptions)

      // Create browser instance record
      const instance: BrowserInstance = {
        browser,
        id: instanceId,
        createdAt: Date.now(),
        lastUsed: Date.now(),
        isActive: true,
      }

      // Store instance
      this.activeBrowsers.set(instanceId, instance)

      // Set up browser event handlers
      this.setupBrowserEventHandlers(browser, instanceId)

      console.log(`Browser launched successfully with instance ID: ${instanceId}`)

      return {
        success: true,
        browser,
        instanceId,
      }
    } catch (error) {
      console.error('Failed to launch browser:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Launch browser for authentication flow
   */
  async launchForAuth(options: BrowserLaunchOptions = {}): Promise<LaunchResult> {
    const authOptions: BrowserLaunchOptions = {
      ...options,
      headless: false, // Always visible for authentication
      viewport: {
        width: 1280,
        height: 800,
      },
      args: [
        ...this.defaultLaunchOptions.args!,
        '--start-maximized',
        '--disable-infobars',
        '--disable-notifications',
        '--disable-popup-blocking',
      ],
    }

    return this.launch(authOptions)
  }

  /**
   * Create a new page in an existing browser
   */
  async createPage(instanceId: string): Promise<Page | null> {
    const instance = this.activeBrowsers.get(instanceId)
    
    if (!instance || !instance.isActive) {
      console.error(`Browser instance ${instanceId} not found or inactive`)
      return null
    }

    try {
      const page = await instance.browser.newPage()
      
      // Configure page
      await this.configurePage(page)
      
      // Update last used timestamp
      instance.lastUsed = Date.now()
      
      return page
    } catch (error) {
      console.error(`Failed to create page for instance ${instanceId}:`, error)
      return null
    }
  }

  /**
   * Configure a page with stealth settings
   */
  private async configurePage(page: Page): Promise<void> {
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    // Set viewport
    await page.setViewport({
      width: 1280,
      height: 720,
      deviceScaleFactor: 1,
    })

    // Set extra headers
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Cache-Control': 'max-age=0',
    })

    // Override navigator properties
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
      })
      
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      })
      
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      })
    })
  }

  /**
   * Close a browser instance
   */
  async closeBrowser(instanceId: string): Promise<boolean> {
    const instance = this.activeBrowsers.get(instanceId)
    
    if (!instance) {
      console.warn(`Browser instance ${instanceId} not found`)
      return false
    }

    try {
      await instance.browser.close()
      instance.isActive = false
      this.activeBrowsers.delete(instanceId)
      console.log(`Browser instance ${instanceId} closed successfully`)
      return true
    } catch (error) {
      console.error(`Failed to close browser instance ${instanceId}:`, error)
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
    
    console.log(`Closed ${instanceIds.length} browser instances`)
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
    return Array.from(this.activeBrowsers.values()).filter(instance => instance.isActive)
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
  async cleanupInactiveBrowsers(maxAge: number = 300000): Promise<number> { // 5 minutes default
    const now = Date.now()
    const inactiveInstances: string[] = []

    for (const [instanceId, instance] of this.activeBrowsers.entries()) {
      if (!instance.isActive || (now - instance.lastUsed) > maxAge) {
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
      uptime: process.uptime(),
    }
  }

  /**
   * Set up browser event handlers
   */
  private setupBrowserEventHandlers(browser: Browser, instanceId: string): void {
    browser.on('disconnected', () => {
      console.log(`Browser instance ${instanceId} disconnected`)
      const instance = this.activeBrowsers.get(instanceId)
      if (instance) {
        instance.isActive = false
      }
    })

    browser.on('targetcreated', (target) => {
      console.log(`New target created in browser instance ${instanceId}: ${target.url()}`)
    })

    browser.on('targetdestroyed', (target) => {
      console.log(`Target destroyed in browser instance ${instanceId}: ${target.url()}`)
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

  /**
   * Validate browser launch options
   */
  private validateLaunchOptions(options: BrowserLaunchOptions): boolean {
    if (options.timeout && options.timeout < 1000) {
      console.warn('Browser timeout should be at least 1000ms')
      return false
    }

    if (options.viewport && (options.viewport.width < 100 || options.viewport.height < 100)) {
      console.warn('Viewport dimensions should be at least 100x100')
      return false
    }

    return true
  }
}

// Export singleton instance
export const browserLauncherService = new BrowserLauncherService()
