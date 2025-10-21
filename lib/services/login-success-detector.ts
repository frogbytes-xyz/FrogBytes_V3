import { logger } from '@/lib/utils/logger'

/**
 * Login Success Detection Service
 * Robust mechanism to automatically detect when a user has successfully logged in
 */

import { Page } from 'puppeteer'
import { authRequirementDetector } from './auth-requirement-detector'

export interface LoginSuccessConfig {
  // Selectors to wait for (elements that only appear after login)
  successSelectors: string[]
  // URL patterns that indicate successful login
  successUrlPatterns: RegExp[]
  // URL patterns that indicate still on login page
  loginUrlPatterns: RegExp[]
  // Cookie names that indicate authentication
  authCookieNames: string[]
  // Maximum time to wait for login success (in milliseconds)
  timeout: number
  // Check interval for polling (in milliseconds)
  checkInterval: number
  // Platform-specific configuration
  platform?: string
}

export interface LoginSuccessResult {
  success: boolean
  method: 'selector' | 'url_change' | 'cookie' | 'navigation' | 'timeout'
  detectedAt: number
  details: string
  error?: string
}

export interface DetectionMethod {
  name: string
  check: (page: Page, config: LoginSuccessConfig) => Promise<boolean>
  priority: number
}

class LoginSuccessDetector {
  private readonly defaultConfig: LoginSuccessConfig = {
    successSelectors: [
      'button[data-testid="logout"]',
      '.user-menu',
      '.profile-menu',
      '[data-testid="user-menu"]',
      '.authenticated',
      '.logged-in',
      '.user-dashboard',
      '.account-menu',
      '.logout-button',
      '.user-profile',
      '.dashboard',
      '.main-content',
      '.course-content',
      '.lecture-content',
      '.video-player',
      '.media-player',
    ],
    successUrlPatterns: [
      /\/dashboard/i,
      /\/home/i,
      /\/profile/i,
      /\/account/i,
      /\/course/i,
      /\/lecture/i,
      /\/video/i,
      /\/media/i,
      /\/content/i,
      /\/student/i,
      /\/portal/i,
      /\/lms/i,
    ],
    loginUrlPatterns: [
      /\/login/i,
      /\/signin/i,
      /\/auth/i,
      /\/oauth/i,
      /\/sso/i,
      /\/authenticate/i,
    ],
    authCookieNames: [
      'session',
      'auth',
      'token',
      'jwt',
      'login',
      'user',
      'access',
      'authentication',
      'authorization',
    ],
    timeout: 300000, // 5 minutes
    checkInterval: 1000, // 1 second
  }

  private readonly platformConfigs: Record<string, Partial<LoginSuccessConfig>> = {
    panopto: {
      successSelectors: [
        '.panopto-user-menu',
        '.panopto-logout',
        '.panopto-dashboard',
        '.panopto-video-player',
        '.panopto-content',
      ],
      successUrlPatterns: [
        /\/Panopto\/Pages\/Viewer\.aspx/i,
        /\/Panopto\/Pages\/Sessions\/List\.aspx/i,
        /\/Panopto\/Pages\/Dashboard\.aspx/i,
      ],
      authCookieNames: ['panopto_session', 'panopto_auth', 'panopto_token'],
    },
    moodle: {
      successSelectors: [
        '.user-menu',
        '.usermenu',
        '.dropdown-toggle',
        '.user-info',
        '.course-content',
        '.course-header',
      ],
      successUrlPatterns: [
        /\/course\/view\.php/i,
        /\/my\/index\.php/i,
        /\/user\/profile\.php/i,
      ],
      authCookieNames: ['MoodleSession', 'moodle_session', 'moodle_auth'],
    },
    canvas: {
      successSelectors: [
        '.ic-app-header__user-menu',
        '.ic-app-header__menu-list',
        '.dashboard-header',
        '.course-header',
      ],
      successUrlPatterns: [
        /\/dashboard/i,
        /\/courses/i,
        /\/profile/i,
      ],
      authCookieNames: ['canvas_session', 'canvas_auth', 'canvas_token'],
    },
    blackboard: {
      successSelectors: [
        '.user-menu',
        '.user-info',
        '.course-menu',
        '.course-content',
      ],
      successUrlPatterns: [
        /\/ultra\/course/i,
        /\/ultra\/dashboard/i,
        /\/ultra\/profile/i,
      ],
      authCookieNames: ['JSESSIONID', 'blackboard_session', 'bb_session'],
    },
    kaltura: {
      successSelectors: [
        '.kaltura-user-menu',
        '.kaltura-dashboard',
        '.kaltura-video-player',
        '.kaltura-content',
      ],
      successUrlPatterns: [
        /\/kaltura\/media/i,
        /\/kaltura\/dashboard/i,
        /\/kaltura\/content/i,
      ],
      authCookieNames: ['kaltura_session', 'kaltura_auth', 'kaltura_token'],
    },
  }

  /**
   * Detect login success using multiple methods
   */
  async detectLoginSuccess(
    page: Page,
    config: Partial<LoginSuccessConfig> = {}
  ): Promise<LoginSuccessResult> {
    const finalConfig = this.mergeConfig(config)
    const startTime = Date.now()

    // Get platform-specific configuration
    const platformConfig = this.getPlatformConfig(finalConfig.platform)
    const mergedConfig = { ...finalConfig, ...platformConfig }

    // Define detection methods in order of priority
    const detectionMethods: DetectionMethod[] = [
      {
        name: 'selector',
        check: (page, config) => this.checkSuccessSelectors(page, config),
        priority: 1,
      },
      {
        name: 'url_change',
        check: (page, config) => this.checkUrlChange(page, config),
        priority: 2,
      },
      {
        name: 'cookie',
        check: (page, config) => this.checkAuthCookies(page, config),
        priority: 3,
      },
      {
        name: 'navigation',
        check: (page, config) => this.checkNavigationSuccess(page, config),
        priority: 4,
      },
    ]

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        resolve({
          success: false,
          method: 'timeout',
          detectedAt: Date.now(),
          details: 'Login detection timed out',
          error: 'No login success indicators detected within timeout period',
        })
      }, mergedConfig.timeout)

      const checkLoginSuccess = async () => {
        try {
          // Check if we've exceeded the timeout
          if (Date.now() - startTime > mergedConfig.timeout) {
            clearTimeout(timeoutId)
            resolve({
              success: false,
              method: 'timeout',
              detectedAt: Date.now(),
              details: 'Login detection timed out',
              error: 'Timeout exceeded',
            })
            return
          }

          // Try each detection method in priority order
          for (const method of detectionMethods.sort((a, b) => a.priority - b.priority)) {
            try {
              const isSuccess = await method.check(page, mergedConfig)
              if (isSuccess) {
                clearTimeout(timeoutId)
                resolve({
                  success: true,
                  method: method.name as any,
                  detectedAt: Date.now(),
                  details: `Login success detected via ${method.name}`,
                })
                return
              }
            } catch (error) {
              logger.warn(`Detection method ${method.name} failed:`, error)
            }
          }

          // Continue checking
          setTimeout(checkLoginSuccess, mergedConfig.checkInterval)
        } catch (error) {
          clearTimeout(timeoutId)
          resolve({
            success: false,
            method: 'timeout',
            detectedAt: Date.now(),
            details: 'Error during login detection',
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      // Start checking
      checkLoginSuccess()
    })
  }

  /**
   * Check for success selectors (elements that only appear after login)
   */
  private async checkSuccessSelectors(page: Page, config: LoginSuccessConfig): Promise<boolean> {
    try {
      for (const selector of config.successSelectors) {
        try {
          const element = await page.$(selector)
          if (element) {
            // Verify the element is visible
            const isVisible = await element.isIntersectingViewport()
            if (isVisible) {
              return true
            }
          }
        } catch (error) {
          // Ignore selector errors and continue
        }
      }
      return false
    } catch (error) {
      return false
    }
  }

  /**
   * Check for URL changes that indicate successful login
   */
  private async checkUrlChange(page: Page, config: LoginSuccessConfig): Promise<boolean> {
    try {
      const currentUrl = page.url()
      
      // Check if URL matches success patterns
      for (const pattern of config.successUrlPatterns) {
        if (pattern.test(currentUrl)) {
          return true
        }
      }

      // Check if URL no longer contains login patterns
      let hasLoginPattern = false
      for (const pattern of config.loginUrlPatterns) {
        if (pattern.test(currentUrl)) {
          hasLoginPattern = true
          break
        }
      }

      // If no login patterns and URL has changed significantly, consider it success
      if (!hasLoginPattern && currentUrl !== 'about:blank') {
        // Additional check: ensure we're not on an error page
        const errorPatterns = [/\/error/i, /\/404/i, /\/500/i, /\/unauthorized/i, /\/forbidden/i]
        const hasErrorPattern = errorPatterns.some(pattern => pattern.test(currentUrl))
        
        if (!hasErrorPattern) {
          return true
        }
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * Check for authentication cookies
   */
  private async checkAuthCookies(page: Page, config: LoginSuccessConfig): Promise<boolean> {
    try {
      const cookies = await page.cookies()
      
      for (const cookie of cookies) {
        const cookieName = cookie.name.toLowerCase()
        
        // Check if cookie name matches auth patterns
        for (const authPattern of config.authCookieNames) {
          if (cookieName.includes(authPattern.toLowerCase())) {
            // Verify cookie has a meaningful value
            if (cookie.value && cookie.value.length > 0 && cookie.value !== 'null' && cookie.value !== 'undefined') {
              return true
            }
          }
        }
      }

      return false
    } catch (error) {
      return false
    }
  }

  /**
   * Check for navigation success (wait for network idle)
   */
  private async checkNavigationSuccess(page: Page, config: LoginSuccessConfig): Promise<boolean> {
    try {
      // Wait for network to be idle (no requests for 500ms)
      await page.waitForLoadState?.('networkidle') || 
            page.waitForFunction(() => {
              return new Promise(resolve => {
                setTimeout(() => {
                  resolve(true)
                }, 500)
              })
            }, { timeout: 2000 })

      // Check if we're on a success page
      return await this.checkUrlChange(page, config)
    } catch (error) {
      return false
    }
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(page: Page, options: { timeout?: number; waitUntil?: string } = {}): Promise<boolean> {
    try {
      await page.waitForNavigation({
        timeout: options.timeout || 30000,
        waitUntil: (options.waitUntil as any) || 'networkidle2',
      })
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Wait for specific selector to appear
   */
  async waitForSelector(page: Page, selector: string, timeout: number = 30000): Promise<boolean> {
    try {
      await page.waitForSelector(selector, { timeout })
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Get platform-specific configuration
   */
  private getPlatformConfig(platform?: string): Partial<LoginSuccessConfig> {
    if (!platform) return {}
    return this.platformConfigs[platform.toLowerCase()] || {}
  }

  /**
   * Merge user config with defaults
   */
  private mergeConfig(config: Partial<LoginSuccessConfig>): LoginSuccessConfig {
    return {
      ...this.defaultConfig,
      ...config,
      successSelectors: [...this.defaultConfig.successSelectors, ...(config.successSelectors || [])],
      successUrlPatterns: [...this.defaultConfig.successUrlPatterns, ...(config.successUrlPatterns || [])],
      loginUrlPatterns: [...this.defaultConfig.loginUrlPatterns, ...(config.loginUrlPatterns || [])],
      authCookieNames: [...this.defaultConfig.authCookieNames, ...(config.authCookieNames || [])],
    }
  }

  /**
   * Create configuration for a specific platform
   */
  createPlatformConfig(platform: string, customConfig: Partial<LoginSuccessConfig> = {}): LoginSuccessConfig {
    const platformConfig = this.getPlatformConfig(platform)
    const mergedConfig = this.mergeConfig(platformConfig)
    return this.mergeConfig({ ...mergedConfig, ...customConfig, platform })
  }

  /**
   * Get available platforms
   */
  getAvailablePlatforms(): string[] {
    return Object.keys(this.platformConfigs)
  }

  /**
   * Validate configuration
   */
  validateConfig(config: LoginSuccessConfig): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (config.timeout <= 0) {
      errors.push('Timeout must be greater than 0')
    }

    if (config.checkInterval <= 0) {
      errors.push('Check interval must be greater than 0')
    }

    if (config.successSelectors.length === 0) {
      errors.push('At least one success selector is required')
    }

    if (config.successUrlPatterns.length === 0) {
      errors.push('At least one success URL pattern is required')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Get detection statistics
   */
  getStats(): {
    availablePlatforms: number
    defaultSelectors: number
    defaultUrlPatterns: number
    defaultCookieNames: number
  } {
    return {
      availablePlatforms: Object.keys(this.platformConfigs).length,
      defaultSelectors: this.defaultConfig.successSelectors.length,
      defaultUrlPatterns: this.defaultConfig.successUrlPatterns.length,
      defaultCookieNames: this.defaultConfig.authCookieNames.length,
    }
  }
}

// Export singleton instance
export const loginSuccessDetector = new LoginSuccessDetector()
