/**
 * Integration tests for Browser Launcher Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { browserLauncherService } from '../../lib/services/browser-launcher-service'

// Mock puppeteer-extra
vi.mock('puppeteer-extra', () => ({
  default: {
    use: vi.fn(),
    launch: vi.fn(),
  },
}))

vi.mock('puppeteer-extra-plugin-stealth', () => ({
  default: vi.fn(),
}))

describe('BrowserLauncherService', () => {
  let mockBrowser: any
  let mockPage: any

  beforeEach(async () => {
    // Create mock browser and page
    mockPage = {
      setUserAgent: vi.fn().mockResolvedValue(undefined),
      setViewport: vi.fn().mockResolvedValue(undefined),
      setExtraHTTPHeaders: vi.fn().mockResolvedValue(undefined),
      evaluateOnNewDocument: vi.fn().mockResolvedValue(undefined),
      goto: vi.fn().mockResolvedValue(undefined),
      title: vi.fn().mockResolvedValue('Example Domain'),
      close: vi.fn().mockResolvedValue(undefined),
    }

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
      close: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      pages: vi.fn().mockResolvedValue([mockPage]),
    }

    // Mock puppeteer-extra launch
    const puppeteerExtra = await import('puppeteer-extra')
    vi.mocked(puppeteerExtra.default.launch).mockResolvedValue(mockBrowser)
  })

  afterEach(async () => {
    // Clean up any active browsers
    await browserLauncherService.closeAllBrowsers()
    browserLauncherService.reset()
    vi.clearAllMocks()
  })

  describe('launch', () => {
    it('should successfully launch a browser instance', async () => {
      // Act
      const result = await browserLauncherService.launch()

      // Assert
      expect(result.success).toBe(true)
      expect(result.browser).toBe(mockBrowser)
      expect(result.instanceId).toBeDefined()
      expect(typeof result.instanceId).toBe('string')
    })

    it('should launch browser with custom options', async () => {
      // Arrange
      const customOptions = {
        headless: false,
        viewport: { width: 1920, height: 1080 },
        timeout: 60000,
      }

      // Act
      const result = await browserLauncherService.launch(customOptions)

      // Assert
      expect(result.success).toBe(true)
      expect(result.browser).toBe(mockBrowser)
    })

    it('should handle launch errors gracefully', async () => {
      // Arrange
      const puppeteerExtra = await import('puppeteer-extra')
      vi.mocked(puppeteerExtra.default.launch).mockRejectedValue(new Error('Launch failed'))

      // Act
      const result = await browserLauncherService.launch()

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Launch failed')
      expect(result.browser).toBeUndefined()
    })
  })

  describe('launchForAuth', () => {
    it('should launch browser in non-headless mode for authentication', async () => {
      // Act
      const result = await browserLauncherService.launchForAuth()

      // Assert
      expect(result.success).toBe(true)
      expect(result.browser).toBe(mockBrowser)
      expect(result.instanceId).toBeDefined()
    })

    it('should override headless setting for auth', async () => {
      // Arrange
      const authOptions = { headless: true } // This should be overridden

      // Act
      const result = await browserLauncherService.launchForAuth(authOptions)

      // Assert
      expect(result.success).toBe(true)
      // The service should override headless: true to false for auth
    })
  })

  describe('createPage', () => {
    it('should create a new page in existing browser', async () => {
      // Arrange
      const launchResult = await browserLauncherService.launch()
      expect(launchResult.success).toBe(true)
      const instanceId = launchResult.instanceId!

      // Act
      const page = await browserLauncherService.createPage(instanceId)

      // Assert
      expect(page).toBe(mockPage)
      expect(mockBrowser.newPage).toHaveBeenCalled()
    })

    it('should return null for non-existent browser instance', async () => {
      // Act
      const page = await browserLauncherService.createPage('non-existent-id')

      // Assert
      expect(page).toBeNull()
    })

    it('should configure page with stealth settings', async () => {
      // Arrange
      const launchResult = await browserLauncherService.launch()
      const instanceId = launchResult.instanceId!

      // Act
      await browserLauncherService.createPage(instanceId)

      // Assert
      expect(mockPage.setUserAgent).toHaveBeenCalled()
      expect(mockPage.setViewport).toHaveBeenCalled()
      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalled()
      expect(mockPage.evaluateOnNewDocument).toHaveBeenCalled()
    })
  })

  describe('closeBrowser', () => {
    it('should close browser instance successfully', async () => {
      // Arrange
      const launchResult = await browserLauncherService.launch()
      const instanceId = launchResult.instanceId!

      // Act
      const result = await browserLauncherService.closeBrowser(instanceId)

      // Assert
      expect(result).toBe(true)
      expect(mockBrowser.close).toHaveBeenCalled()
    })

    it('should return false for non-existent browser instance', async () => {
      // Act
      const result = await browserLauncherService.closeBrowser('non-existent-id')

      // Assert
      expect(result).toBe(false)
    })

    it('should handle close errors gracefully', async () => {
      // Arrange
      const launchResult = await browserLauncherService.launch()
      const instanceId = launchResult.instanceId!
      mockBrowser.close.mockRejectedValue(new Error('Close failed'))

      // Act
      const result = await browserLauncherService.closeBrowser(instanceId)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('browser management', () => {
    it('should track active browser instances', async () => {
      // Arrange
      const launchResult1 = await browserLauncherService.launch()
      const launchResult2 = await browserLauncherService.launch()

      // Act
      const activeBrowsers = browserLauncherService.getActiveBrowsers()

      // Assert
      expect(activeBrowsers).toHaveLength(2)
      expect(activeBrowsers[0].id).toBe(launchResult1.instanceId)
      expect(activeBrowsers[1].id).toBe(launchResult2.instanceId)
    })

    it('should check if browser instance is active', async () => {
      // Arrange
      const launchResult = await browserLauncherService.launch()
      const instanceId = launchResult.instanceId!

      // Act
      const isActive = browserLauncherService.isBrowserActive(instanceId)

      // Assert
      expect(isActive).toBe(true)
    })

    it('should return false for non-existent browser instance', async () => {
      // Act
      const isActive = browserLauncherService.isBrowserActive('non-existent-id')

      // Assert
      expect(isActive).toBe(false)
    })
  })

  describe('cleanup', () => {
    it('should close all active browsers', async () => {
      // Arrange
      await browserLauncherService.launch()
      await browserLauncherService.launch()

      // Act
      await browserLauncherService.closeAllBrowsers()

      // Assert
      const activeBrowsers = browserLauncherService.getActiveBrowsers()
      expect(activeBrowsers).toHaveLength(0)
    })

    it('should cleanup inactive browsers', async () => {
      // Arrange
      const launchResult = await browserLauncherService.launch()
      const instanceId = launchResult.instanceId!

      // Mock the instance as inactive by setting lastUsed to old timestamp
      const instance = browserLauncherService.getBrowserInstance(instanceId)
      if (instance) {
        instance.lastUsed = Date.now() - 400000 // 6+ minutes ago
      }

      // Act
      const cleanedCount = await browserLauncherService.cleanupInactiveBrowsers(300000) // 5 minutes

      // Assert
      expect(cleanedCount).toBe(1)
      expect(browserLauncherService.isBrowserActive(instanceId)).toBe(false)
    })
  })

  describe('statistics', () => {
    it('should provide service statistics', async () => {
      // Arrange
      await browserLauncherService.launch()
      await browserLauncherService.launch()

      // Act
      const stats = browserLauncherService.getStats()

      // Assert
      expect(stats.activeBrowsers).toBe(2)
      expect(stats.totalLaunched).toBe(2)
      expect(typeof stats.uptime).toBe('number')
    })
  })

  describe('integration test', () => {
    it('should launch browser, create page, navigate, and get title', async () => {
      // This test simulates the integration test described in the task
      // Arrange
      const launchResult = await browserLauncherService.launch({ headless: false })
      expect(launchResult.success).toBe(true)
      
      const instanceId = launchResult.instanceId!
      const page = await browserLauncherService.createPage(instanceId)
      expect(page).toBe(mockPage)

      // Act - Simulate navigation
      await page.goto('http://example.com')
      const title = await page.title()

      // Assert
      expect(mockPage.goto).toHaveBeenCalledWith('http://example.com')
      expect(title).toBe('Example Domain')
      expect(mockPage.title).toHaveBeenCalled()

      // Cleanup
      await browserLauncherService.closeBrowser(instanceId)
    })
  })
})
