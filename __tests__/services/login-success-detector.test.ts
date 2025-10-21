/**
 * Unit tests for Login Success Detector
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loginSuccessDetector } from '../../lib/services/login-success-detector'

// Mock puppeteer Page
const createMockPage = () => ({
  url: vi.fn(),
  $: vi.fn(),
  cookies: vi.fn(),
  waitForNavigation: vi.fn(),
  waitForSelector: vi.fn(),
  waitForLoadState: vi.fn(),
  waitForFunction: vi.fn(),
})

describe('LoginSuccessDetector', () => {
  let mockPage: any

  beforeEach(() => {
    mockPage = createMockPage()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('detectLoginSuccess', () => {
    it('should detect login success via selector', async () => {
      // Arrange
      const mockElement = { isIntersectingViewport: vi.fn().mockResolvedValue(true) }
      mockPage.$.mockResolvedValue(mockElement)
      mockPage.url.mockReturnValue('https://example.com/dashboard')

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        timeout: 1000,
        checkInterval: 100,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.method).toBe('selector')
      expect(result.details).toContain('selector')
    })

    it('should detect login success via URL change', async () => {
      // Arrange
      mockPage.$.mockResolvedValue(null) // No success selectors found
      mockPage.url.mockReturnValue('https://example.com/dashboard')
      mockPage.cookies.mockResolvedValue([]) // No auth cookies

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        timeout: 1000,
        checkInterval: 100,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.method).toBe('url_change')
      expect(result.details).toContain('url_change')
    })

    it('should detect login success via cookies', async () => {
      // Arrange
      mockPage.$.mockResolvedValue(null) // No success selectors found
      mockPage.url.mockReturnValue('https://example.com/login') // Still on login page
      mockPage.cookies.mockResolvedValue([
        {
          name: 'session_token',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          secure: true,
          expires: Date.now() + 86400000,
        },
      ])

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        timeout: 1000,
        checkInterval: 100,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.method).toBe('cookie')
      expect(result.details).toContain('cookie')
    })

    it('should timeout when no success indicators are found', async () => {
      // Arrange
      mockPage.$.mockResolvedValue(null) // No success selectors found
      mockPage.url.mockReturnValue('https://example.com/login') // Still on login page
      mockPage.cookies.mockResolvedValue([]) // No auth cookies

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        timeout: 100,
        checkInterval: 50,
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.method).toBe('timeout')
      expect(result.details).toContain('timed out')
    })

    it('should handle page errors gracefully', async () => {
      // Arrange
      mockPage.$.mockRejectedValue(new Error('Page error'))
      mockPage.url.mockImplementation(() => {
        throw new Error('URL error')
      })
      mockPage.cookies.mockRejectedValue(new Error('Cookie error'))

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        timeout: 100,
        checkInterval: 50,
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.method).toBe('timeout')
      expect(result.error).toBeDefined()
    })
  })

  describe('platform-specific detection', () => {
    it('should use Panopto-specific configuration', async () => {
      // Arrange
      const mockElement = { isIntersectingViewport: vi.fn().mockResolvedValue(true) }
      mockPage.$.mockResolvedValue(mockElement)
      mockPage.url.mockReturnValue('https://university.panopto.com/Panopto/Pages/Viewer.aspx?id=123')

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        platform: 'panopto',
        timeout: 1000,
        checkInterval: 100,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.method).toBe('selector')
    })

    it('should use Moodle-specific configuration', async () => {
      // Arrange
      const mockElement = { isIntersectingViewport: vi.fn().mockResolvedValue(true) }
      mockPage.$.mockResolvedValue(mockElement)
      mockPage.url.mockReturnValue('https://moodle.university.edu/course/view.php?id=123')

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        platform: 'moodle',
        timeout: 1000,
        checkInterval: 100,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.method).toBe('selector')
    })

    it('should use Canvas-specific configuration', async () => {
      // Arrange
      const mockElement = { isIntersectingViewport: vi.fn().mockResolvedValue(true) }
      mockPage.$.mockResolvedValue(mockElement)
      mockPage.url.mockReturnValue('https://university.instructure.com/courses/123')

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        platform: 'canvas',
        timeout: 1000,
        checkInterval: 100,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.method).toBe('selector')
    })
  })

  describe('custom configuration', () => {
    it('should use custom success selectors', async () => {
      // Arrange
      const mockElement = { isIntersectingViewport: vi.fn().mockResolvedValue(true) }
      mockPage.$.mockImplementation((selector: string) => {
        if (selector === '.custom-success-element') {
          return Promise.resolve(mockElement)
        }
        return Promise.resolve(null)
      })

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        successSelectors: ['.custom-success-element'],
        timeout: 1000,
        checkInterval: 100,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.method).toBe('selector')
    })

    it('should use custom URL patterns', async () => {
      // Arrange
      mockPage.$.mockResolvedValue(null) // No success selectors found
      mockPage.url.mockReturnValue('https://example.com/custom-success-page')
      mockPage.cookies.mockResolvedValue([]) // No auth cookies

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        successUrlPatterns: [/\/custom-success-page/i],
        timeout: 1000,
        checkInterval: 100,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.method).toBe('url_change')
    })

    it('should use custom cookie names', async () => {
      // Arrange
      mockPage.$.mockResolvedValue(null) // No success selectors found
      mockPage.url.mockReturnValue('https://example.com/login') // Still on login page
      mockPage.cookies.mockResolvedValue([
        {
          name: 'custom_auth_token',
          value: 'abc123',
          domain: 'example.com',
          path: '/',
          secure: true,
          expires: Date.now() + 86400000,
        },
      ])

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        authCookieNames: ['custom_auth_token'],
        timeout: 1000,
        checkInterval: 100,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.method).toBe('cookie')
    })
  })

  describe('utility methods', () => {
    it('should wait for navigation', async () => {
      // Arrange
      mockPage.waitForNavigation.mockResolvedValue(undefined)

      // Act
      const result = await loginSuccessDetector.waitForNavigation(mockPage, {
        timeout: 5000,
        waitUntil: 'networkidle2',
      })

      // Assert
      expect(result).toBe(true)
      expect(mockPage.waitForNavigation).toHaveBeenCalledWith({
        timeout: 5000,
        waitUntil: 'networkidle2',
      })
    })

    it('should wait for selector', async () => {
      // Arrange
      mockPage.waitForSelector.mockResolvedValue(undefined)

      // Act
      const result = await loginSuccessDetector.waitForSelector(mockPage, '.test-selector', 5000)

      // Assert
      expect(result).toBe(true)
      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.test-selector', { timeout: 5000 })
    })

    it('should handle navigation timeout', async () => {
      // Arrange
      mockPage.waitForNavigation.mockRejectedValue(new Error('Navigation timeout'))

      // Act
      const result = await loginSuccessDetector.waitForNavigation(mockPage, { timeout: 100 })

      // Assert
      expect(result).toBe(false)
    })

    it('should handle selector timeout', async () => {
      // Arrange
      mockPage.waitForSelector.mockRejectedValue(new Error('Selector timeout'))

      // Act
      const result = await loginSuccessDetector.waitForSelector(mockPage, '.test-selector', 100)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('configuration management', () => {
    it('should create platform configuration', () => {
      // Act
      const config = loginSuccessDetector.createPlatformConfig('panopto', {
        timeout: 60000,
        successSelectors: ['.custom-selector'],
      })

      // Assert
      expect(config.platform).toBe('panopto')
      expect(config.timeout).toBe(60000)
      expect(config.successSelectors).toContain('.custom-selector')
      // The platform-specific selectors should be merged with default selectors
      expect(config.successSelectors.length).toBeGreaterThanOrEqual(17) // Default + custom
    })

    it('should get available platforms', () => {
      // Act
      const platforms = loginSuccessDetector.getAvailablePlatforms()

      // Assert
      expect(platforms).toContain('panopto')
      expect(platforms).toContain('moodle')
      expect(platforms).toContain('canvas')
      expect(platforms).toContain('blackboard')
      expect(platforms).toContain('kaltura')
    })

    it('should validate configuration', () => {
      // Act
      const validResult = loginSuccessDetector.validateConfig({
        successSelectors: ['.test'],
        successUrlPatterns: [/test/i],
        loginUrlPatterns: [/login/i],
        authCookieNames: ['test'],
        timeout: 5000,
        checkInterval: 1000,
      })

      const invalidResult = loginSuccessDetector.validateConfig({
        successSelectors: [],
        successUrlPatterns: [],
        loginUrlPatterns: [/login/i],
        authCookieNames: ['test'],
        timeout: -1,
        checkInterval: 0,
      })

      // Assert
      expect(validResult.valid).toBe(true)
      expect(validResult.errors).toHaveLength(0)

      expect(invalidResult.valid).toBe(false)
      expect(invalidResult.errors).toContain('Timeout must be greater than 0')
      expect(invalidResult.errors).toContain('Check interval must be greater than 0')
      expect(invalidResult.errors).toContain('At least one success selector is required')
      expect(invalidResult.errors).toContain('At least one success URL pattern is required')
    })

    it('should get statistics', () => {
      // Act
      const stats = loginSuccessDetector.getStats()

      // Assert
      expect(stats.availablePlatforms).toBeGreaterThan(0)
      expect(stats.defaultSelectors).toBeGreaterThan(0)
      expect(stats.defaultUrlPatterns).toBeGreaterThan(0)
      expect(stats.defaultCookieNames).toBeGreaterThan(0)
    })
  })

  describe('integration test', () => {
    it('should simulate complete login flow', async () => {
      // This test simulates the integration test described in the task
      // Arrange
      let callCount = 0
      const mockElement = { isIntersectingViewport: vi.fn().mockResolvedValue(true) }
      
      // Simulate page state changes during login
      mockPage.url.mockImplementation(() => {
        callCount++
        if (callCount === 1) return 'https://example.com/login'
        if (callCount === 2) return 'https://example.com/login'
        return 'https://example.com/dashboard'
      })

      mockPage.$.mockImplementation((selector: string) => {
        if (selector === 'button[data-testid="logout"]' && callCount > 2) {
          return Promise.resolve(mockElement)
        }
        return Promise.resolve(null)
      })

      mockPage.cookies.mockResolvedValue([])

      // Act
      const result = await loginSuccessDetector.detectLoginSuccess(mockPage, {
        timeout: 2000,
        checkInterval: 100,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(['selector', 'url_change']).toContain(result.method)
      expect(result.details).toContain(result.method)
    })
  })
})
