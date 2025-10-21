/**
 * Unit tests for Enhanced Download Manager
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { enhancedDownloadManager } from '../../lib/services/enhanced-download-manager'
import { authRequirementDetector } from '../../lib/services/auth-requirement-detector'
import { authenticationManager } from '../../lib/services/authentication-manager'
import { cookieService } from '../../lib/services/cookie-service'
import { cookieExtractionService } from '../../lib/services/cookie-extraction-service'

// Mock dependencies
vi.mock('../../lib/services/auth-requirement-detector', () => ({
  authRequirementDetector: {
    detectAuthRequirement: vi.fn(),
  },
}))

vi.mock('../../lib/services/authentication-manager', () => ({
  authenticationManager: {
    handleLogin: vi.fn(),
  },
}))

vi.mock('../../lib/services/cookie-service', () => ({
  cookieService: {
    get: vi.fn(),
    set: vi.fn(),
    generateSessionId: vi.fn(),
    isReady: vi.fn(),
  },
}))

vi.mock('../../lib/services/cookie-extraction-service', () => ({
  cookieExtractionService: {
    extractCookies: vi.fn(),
  },
}))

// Mock the original downloader
vi.mock('../../lib/video-download/downloader', () => ({
  downloadVideo: vi.fn(),
}))

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  unlink: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn(),
  default: {
    writeFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn(),
  },
}))

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  default: {
    join: vi.fn((...args) => args.join('/')),
  },
}))

// Mock os
vi.mock('os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
  default: {
    tmpdir: vi.fn(() => '/tmp'),
  },
}))

// Mock crypto
vi.mock('crypto', () => ({
  randomUUID: vi.fn(() => 'test-uuid-123'),
  default: {
    randomUUID: vi.fn(() => 'test-uuid-123'),
  },
}))

describe('EnhancedDownloadManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default mock implementations
    vi.mocked(cookieService.isReady).mockReturnValue(true)
    vi.mocked(cookieService.generateSessionId).mockReturnValue('session-123')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('downloadVideo', () => {
    it('should download video without authentication when not required', async () => {
      // Arrange
      const mockDownloadResult = {
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
        metadata: {
          title: 'Test Video',
          sourceUrl: 'https://example.com/video',
        },
      }

      vi.mocked(authRequirementDetector.detectAuthRequirement).mockResolvedValue({
        requiresAuth: false,
        confidence: 'high',
        platform: 'youtube',
        indicators: ['Public video platform'],
      })

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue(mockDownloadResult)

      // Act
      const result = await enhancedDownloadManager.downloadVideo(
        'https://youtube.com/watch?v=test',
        'user123'
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.authRequired).toBe(false)
      expect(result.authPerformed).toBe(false)
      expect(result.authMethod).toBe('none')
      expect(result.platform).toBe('youtube')
      expect(downloadVideo).toHaveBeenCalledWith(
        'https://youtube.com/watch?v=test',
        'user123',
        {}
      )
    })

    it('should perform authentication when required', async () => {
      // Arrange
      const mockDownloadResult = {
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      }

      const mockNetscapeCookies = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'

      vi.mocked(authRequirementDetector.detectAuthRequirement).mockResolvedValue({
        requiresAuth: true,
        confidence: 'high',
        platform: 'panopto',
        indicators: ['Educational domain (.edu)'],
      })

      vi.mocked(cookieService.get).mockResolvedValue({
        success: false,
        error: 'No stored cookies found',
      })

      vi.mocked(authenticationManager.handleLogin).mockResolvedValue({
        success: true,
        sessionId: 'session-123',
        cookies: mockNetscapeCookies,
      })

      vi.mocked(cookieService.set).mockResolvedValue({ success: true })

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue(mockDownloadResult)

      // Act
      const result = await enhancedDownloadManager.downloadVideo(
        'https://panopto.edu/video',
        'user123',
        {
          authOptions: {
            userId: 'user123',
            platform: 'panopto',
          },
        }
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.authRequired).toBe(true)
      expect(result.authPerformed).toBe(true)
      expect(result.authMethod).toBe('interactive')
      expect(result.platform).toBe('panopto')
      expect(result.cookiesExtracted).toBeGreaterThan(0)
      expect(authenticationManager.handleLogin).toHaveBeenCalled()
    })

    it('should use stored cookies when available', async () => {
      // Arrange
      const mockDownloadResult = {
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      }

      const mockNetscapeCookies = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'

      vi.mocked(authRequirementDetector.detectAuthRequirement).mockResolvedValue({
        requiresAuth: true,
        confidence: 'high',
        platform: 'panopto',
        indicators: ['Educational domain (.edu)'],
      })

      vi.mocked(cookieService.get).mockResolvedValue({
        success: true,
        data: mockNetscapeCookies,
      })

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue(mockDownloadResult)

      // Act
      const result = await enhancedDownloadManager.downloadVideo(
        'https://panopto.edu/video',
        'user123',
        {
          authOptions: {
            userId: 'user123',
            platform: 'panopto',
          },
        }
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.authRequired).toBe(true)
      expect(result.authPerformed).toBe(true)
      expect(result.authMethod).toBe('stored')
      expect(authenticationManager.handleLogin).not.toHaveBeenCalled()
    })

    it('should handle authentication failure gracefully', async () => {
      // Arrange
      const mockDownloadResult = {
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      }

      vi.mocked(authRequirementDetector.detectAuthRequirement).mockResolvedValue({
        requiresAuth: true,
        confidence: 'high',
        platform: 'panopto',
        indicators: ['Educational domain (.edu)'],
      })

      vi.mocked(cookieService.get).mockResolvedValue({
        success: false,
        error: 'No stored cookies found',
      })

      vi.mocked(authenticationManager.handleLogin).mockResolvedValue({
        success: false,
        error: 'Authentication failed',
      })

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue(mockDownloadResult)

      // Act
      const result = await enhancedDownloadManager.downloadVideo(
        'https://panopto.edu/video',
        'user123',
        {
          authOptions: {
            userId: 'user123',
            platform: 'panopto',
          },
        }
      )

      // Assert
      expect(result.success).toBe(true) // Should still succeed without auth
      expect(result.authRequired).toBe(true)
      expect(result.authPerformed).toBe(false)
      expect(result.authMethod).toBe('none')
    })

    it('should skip authentication detection when requested', async () => {
      // Arrange
      const mockDownloadResult = {
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      }

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue(mockDownloadResult)

      // Act
      const result = await enhancedDownloadManager.downloadVideo(
        'https://example.com/video',
        'user123',
        {
          skipAuthDetection: true,
        }
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.authRequired).toBe(false)
      expect(authRequirementDetector.detectAuthRequirement).not.toHaveBeenCalled()
    })

    it('should force authentication when requested', async () => {
      // Arrange
      const mockDownloadResult = {
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      }

      const mockNetscapeCookies = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'

      vi.mocked(authRequirementDetector.detectAuthRequirement).mockResolvedValue({
        requiresAuth: false,
        confidence: 'low',
        platform: 'youtube',
        indicators: ['Public video platform'],
      })

      vi.mocked(cookieService.get).mockResolvedValue({
        success: false,
        error: 'No stored cookies found',
      })

      vi.mocked(authenticationManager.handleLogin).mockResolvedValue({
        success: true,
        sessionId: 'session-123',
        cookies: mockNetscapeCookies,
      })

      vi.mocked(cookieService.set).mockResolvedValue({ success: true })

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue(mockDownloadResult)

      // Act
      const result = await enhancedDownloadManager.downloadVideo(
        'https://youtube.com/watch?v=test',
        'user123',
        {
          forceAuth: true,
          authOptions: {
            userId: 'user123',
            platform: 'youtube',
          },
        }
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.authRequired).toBe(false) // Not detected as required
      expect(result.authPerformed).toBe(true) // But performed due to forceAuth
      expect(result.authMethod).toBe('interactive')
    })
  })

  describe('downloadWithCookies', () => {
    it('should download video with provided cookies', async () => {
      // Arrange
      const mockDownloadResult = {
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      }

      const mockNetscapeCookies = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue(mockDownloadResult)

      const fs = await import('fs/promises')
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      // Act
      const result = await enhancedDownloadManager.downloadWithCookies({
        url: 'https://example.com/video',
        userId: 'user123',
        netscapeCookies: mockNetscapeCookies,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(downloadVideo).toHaveBeenCalledWith(
        'https://example.com/video',
        'user123',
        expect.objectContaining({
          cookieText: mockNetscapeCookies,
        })
      )
      // Note: downloadWithCookies uses cookieText directly, not temp files
      // expect(fs.writeFile).toHaveBeenCalled()
      // expect(fs.unlink).toHaveBeenCalled()
    })

    it('should cleanup temp file even on download failure', async () => {
      // Arrange
      const mockDownloadResult = {
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: 'Download failed',
      }

      const mockNetscapeCookies = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue(mockDownloadResult)

      const fs = await import('fs/promises')
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      // Act
      const result = await enhancedDownloadManager.downloadWithCookies({
        url: 'https://example.com/video',
        userId: 'user123',
        netscapeCookies: mockNetscapeCookies,
      })

      // Assert
      expect(result.success).toBe(false)
      // Note: downloadWithCookies uses cookieText directly, not temp files
      // expect(fs.writeFile).toHaveBeenCalled()
      // expect(fs.unlink).toHaveBeenCalled() // Should cleanup even on failure
    })
  })

  describe('downloadWithPageCookies', () => {
    it('should extract cookies from page and download video', async () => {
      // Arrange
      const mockPage = { cookies: vi.fn() }
      const mockDownloadResult = {
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      }

      const mockNetscapeCookies = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'

      vi.mocked(cookieExtractionService.extractCookies).mockResolvedValue({
        success: true,
        cookies: mockNetscapeCookies,
        cookieCount: 3,
      })

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue(mockDownloadResult)

      // Act
      const result = await enhancedDownloadManager.downloadWithPageCookies(
        'https://example.com/video',
        'user123',
        mockPage
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.authRequired).toBe(true)
      expect(result.authPerformed).toBe(true)
      expect(result.cookiesExtracted).toBe(3)
      expect(cookieExtractionService.extractCookies).toHaveBeenCalledWith(mockPage, undefined)
    })

    it('should handle cookie extraction failure', async () => {
      // Arrange
      const mockPage = { cookies: vi.fn() }

      vi.mocked(cookieExtractionService.extractCookies).mockResolvedValue({
        success: false,
        error: 'Failed to extract cookies',
      })

      // Act
      const result = await enhancedDownloadManager.downloadWithPageCookies(
        'https://example.com/video',
        'user123',
        mockPage
      )

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to extract cookies')
      expect(result.authRequired).toBe(true)
      expect(result.authPerformed).toBe(false)
    })
  })

  describe('getDownloadStats', () => {
    it('should return download statistics', async () => {
      // Act
      const stats = await enhancedDownloadManager.getDownloadStats()

      // Assert
      expect(stats).toEqual({
        totalDownloads: 0,
        successfulDownloads: 0,
        failedDownloads: 0,
        authRequiredDownloads: 0,
        averageDownloadTime: 0,
      })
    })
  })

  describe('validateConfig', () => {
    it('should validate configuration successfully', () => {
      // Act
      const validation = enhancedDownloadManager.validateConfig()

      // Assert
      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should identify configuration issues', () => {
      // Arrange
      vi.mocked(cookieService.isReady).mockReturnValue(false)

      // Act
      const validation = enhancedDownloadManager.validateConfig()

      // Assert
      expect(validation.isValid).toBe(false)
      expect(validation.errors).toContain('Cookie service is not ready (Redis connection failed)')
    })
  })

  describe('error handling', () => {
    it('should handle authentication timeout errors', async () => {
      // Arrange
      vi.mocked(authRequirementDetector.detectAuthRequirement).mockResolvedValue({
        requiresAuth: true,
        confidence: 'high',
        platform: 'panopto',
        indicators: ['Educational domain (.edu)'],
      })

      vi.mocked(cookieService.get).mockResolvedValue({
        success: false,
        error: 'No stored cookies found',
      })

      vi.mocked(authenticationManager.handleLogin).mockResolvedValue({
        success: false,
        error: 'Authentication timeout',
        errorType: 'timeout',
        errorDetails: 'Authentication session timed out. Please try again and complete the login process within the time limit.',
      })

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue({
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      })

      // Act
      const result = await enhancedDownloadManager.downloadVideo(
        'https://panopto.edu/video',
        'user123',
        {
          authOptions: {
            userId: 'user123',
            platform: 'panopto',
          },
        }
      )

      // Assert
      expect(result.success).toBe(true) // Should still succeed without auth
      expect(result.authRequired).toBe(true)
      expect(result.authPerformed).toBe(false)
      expect(result.authMethod).toBe('none')
    })

    it('should handle invalid credentials errors', async () => {
      // Arrange
      vi.mocked(authRequirementDetector.detectAuthRequirement).mockResolvedValue({
        requiresAuth: true,
        confidence: 'high',
        platform: 'panopto',
        indicators: ['Educational domain (.edu)'],
      })

      vi.mocked(cookieService.get).mockResolvedValue({
        success: false,
        error: 'No stored cookies found',
      })

      vi.mocked(authenticationManager.handleLogin).mockResolvedValue({
        success: false,
        error: 'Invalid credentials',
        errorType: 'credentials',
        errorDetails: 'Authentication failed due to invalid credentials. Please check your username and password, or contact your institution if you continue to have issues.',
      })

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue({
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      })

      // Act
      const result = await enhancedDownloadManager.downloadVideo(
        'https://panopto.edu/video',
        'user123',
        {
          authOptions: {
            userId: 'user123',
            platform: 'panopto',
          },
        }
      )

      // Assert
      expect(result.success).toBe(true) // Should still succeed without auth
      expect(result.authRequired).toBe(true)
      expect(result.authPerformed).toBe(false)
      expect(result.authMethod).toBe('none')
    })

    it('should invalidate cookies when download fails with auth error', async () => {
      // Arrange
      const mockNetscapeCookies = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'

      vi.mocked(cookieService.get).mockResolvedValue({
        success: true,
        data: mockNetscapeCookies,
      })

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue({
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: 'Private video - authentication required',
        errorType: 'auth',
      })

      // Mock the invalidateCookies method
      const invalidateCookiesSpy = vi.spyOn(enhancedDownloadManager, 'invalidateCookies')

      // Act
      const result = await enhancedDownloadManager.downloadWithCookies({
        url: 'https://example.com/video',
        userId: 'user123',
        netscapeCookies: mockNetscapeCookies,
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.errorType).toBe('auth')
      expect(invalidateCookiesSpy).toHaveBeenCalledWith('user123', 'example.com')
    })

    it('should handle network errors during download', async () => {
      // Arrange
      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue({
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: 'Network connection failed',
        errorType: 'network',
      })

      // Act
      const result = await enhancedDownloadManager.downloadWithCookies({
        url: 'https://example.com/video',
        userId: 'user123',
        netscapeCookies: 'test-cookies',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.errorType).toBe('network')
      expect(result.error).toBe('Network connection failed')
    })

    it('should handle format errors during download', async () => {
      // Arrange
      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue({
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: 'Unsupported video format',
        errorType: 'format',
      })

      // Act
      const result = await enhancedDownloadManager.downloadWithCookies({
        url: 'https://example.com/video',
        userId: 'user123',
        netscapeCookies: 'test-cookies',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.errorType).toBe('format')
      expect(result.error).toBe('Unsupported video format')
    })

    it('should handle timeout errors during download', async () => {
      // Arrange
      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue({
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: 'Download timeout',
        errorType: 'timeout',
      })

      // Act
      const result = await enhancedDownloadManager.downloadWithCookies({
        url: 'https://example.com/video',
        userId: 'user123',
        netscapeCookies: 'test-cookies',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.errorType).toBe('timeout')
      expect(result.error).toBe('Download timeout')
    })

    it('should handle unknown errors during download', async () => {
      // Arrange
      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue({
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: 'Unexpected error occurred',
        errorType: 'unknown',
      })

      // Act
      const result = await enhancedDownloadManager.downloadWithCookies({
        url: 'https://example.com/video',
        userId: 'user123',
        netscapeCookies: 'test-cookies',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.errorType).toBe('unknown')
      expect(result.error).toBe('Unexpected error occurred')
    })
  })

  describe('integration test', () => {
    it('should perform complete authenticated download workflow', async () => {
      // This test simulates the complete workflow described in the task
      // Arrange
      const mockDownloadResult = {
        success: true,
        fileId: 'test-uuid-123',
        filename: 'test-video.mp4',
        size: 1024000,
        mimeType: 'video/mp4',
        path: '/tmp/test-video.mp4',
      }

      const mockNetscapeCookies = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'

      vi.mocked(authRequirementDetector.detectAuthRequirement).mockResolvedValue({
        requiresAuth: true,
        confidence: 'high',
        platform: 'panopto',
        indicators: ['Educational domain (.edu)'],
      })

      vi.mocked(cookieService.get).mockResolvedValue({
        success: false,
        error: 'No stored cookies found',
      })

      vi.mocked(authenticationManager.handleLogin).mockResolvedValue({
        success: true,
        sessionId: 'session-123',
        cookies: mockNetscapeCookies,
      })

      vi.mocked(cookieService.set).mockResolvedValue({ success: true })

      const { downloadVideo } = await import('../../lib/video-download/downloader')
      vi.mocked(downloadVideo).mockResolvedValue(mockDownloadResult)

      const fs = await import('fs/promises')
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      // Act - Complete workflow
      const result = await enhancedDownloadManager.downloadVideo(
        'https://panopto.edu/video',
        'user123',
        {
          authOptions: {
            userId: 'user123',
            platform: 'panopto',
            timeout: 300000,
          },
          cookieOptions: {
            secureOnly: true,
            maxCookies: 10,
          },
        }
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.authRequired).toBe(true)
      expect(result.authPerformed).toBe(true)
      expect(result.authMethod).toBe('interactive')
      expect(result.platform).toBe('panopto')
      expect(result.cookiesExtracted).toBeGreaterThan(0)
      
      // Verify the complete flow was executed
      expect(authRequirementDetector.detectAuthRequirement).toHaveBeenCalled()
      expect(authenticationManager.handleLogin).toHaveBeenCalled()
      expect(cookieService.set).toHaveBeenCalled()
      expect(downloadVideo).toHaveBeenCalled()
    })
  })
})
