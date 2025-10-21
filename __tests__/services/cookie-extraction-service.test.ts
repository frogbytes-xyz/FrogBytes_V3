/**
 * Unit tests for Cookie Extraction Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cookieExtractionService } from '../../lib/services/cookie-extraction-service'
import { cookieEncryptionService } from '../../lib/services/cookie-encryption-service'
import { cookieService } from '../../lib/services/cookie-service'

// Mock dependencies
vi.mock('../../lib/services/cookie-encryption-service', () => ({
  cookieEncryptionService: {
    convertToNetscapeFormat: vi.fn(),
  },
}))

vi.mock('../../lib/services/cookie-service', () => ({
  cookieService: {
    set: vi.fn(),
  },
}))

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn(),
  unlink: vi.fn(),
}))

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
}))

// Mock os
vi.mock('os', () => ({
  tmpdir: vi.fn(() => '/tmp'),
}))

describe('CookieExtractionService', () => {
  let mockPage: any
  let mockCookies: any[]

  beforeEach(() => {
    mockCookies = [
      {
        name: 'session_token',
        value: 'abc123',
        domain: 'example.com',
        path: '/',
        expires: Date.now() + 86400000,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
      {
        name: 'auth_cookie',
        value: 'def456',
        domain: '.example.com',
        path: '/api',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Strict',
      },
      {
        name: 'user_preference',
        value: 'theme=dark',
        domain: 'example.com',
        path: '/',
        expires: Date.now() + 2592000000,
        httpOnly: false,
        secure: false,
        sameSite: 'None',
      },
    ]

    mockPage = {
      cookies: vi.fn().mockResolvedValue(mockCookies),
    }

    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('extractCookies', () => {
    it('should extract all cookies successfully', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage)

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookies).toBe(mockNetscapeString)
      expect(result.cookieCount).toBe(3)
      expect(mockPage.cookies).toHaveBeenCalledTimes(1)
    })

    it('should handle empty cookie list', async () => {
      // Arrange
      mockPage.cookies.mockResolvedValue([])

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('No cookies found on the page')
    })

    it('should filter cookies by domain', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage, {
        domainFilter: 'example.com',
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(3) // All cookies are returned, filtering happens in the service
    })

    it('should filter cookies by domain regex', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage, {
        domainFilter: /\.example\.com$/,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(1) // Only .example.com cookies
    })

    it('should filter cookies by name pattern', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage, {
        nameFilter: 'session',
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(1) // Only session_token
    })

    it('should filter cookies by name regex', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage, {
        nameFilter: /^(session|auth)_/,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(2) // session_token and auth_cookie
    })

    it('should filter secure cookies only', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage, {
        secureOnly: true,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(1) // Only secure cookies
    })

    it('should filter session cookies only', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage, {
        sessionOnly: true,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(1) // Only session cookies (expires: -1)
    })

    it('should filter persistent cookies only', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage, {
        persistentOnly: true,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(2) // Only persistent cookies
    })

    it('should limit number of cookies', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage, {
        maxCookies: 2,
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(2)
    })

    it('should use custom validation function', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage, {
        validateCookie: (cookie) => cookie.name.includes('session'),
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(1) // Only session_token
    })

    it('should handle no cookies matching filters', async () => {
      // Arrange
      mockPage.cookies.mockResolvedValue(mockCookies)

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage, {
        nameFilter: 'nonexistent',
      })

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('No cookies match the specified filters')
    })

    it('should handle page errors', async () => {
      // Arrange
      mockPage.cookies.mockRejectedValue(new Error('Page error'))

      // Act
      const result = await cookieExtractionService.extractCookies(mockPage)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Page error')
    })
  })

  describe('extractAndStoreCookies', () => {
    it('should extract and store cookies successfully', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)
      vi.mocked(cookieService.set).mockResolvedValue({ success: true })

      // Act
      const result = await cookieExtractionService.extractAndStoreCookies(
        mockPage,
        'user123',
        'session456'
      )

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookies).toBe(mockNetscapeString)
      expect(result.cookieCount).toBe(3)
      expect(cookieService.set).toHaveBeenCalledWith('user123', 'extracted', mockNetscapeString, 'session456')
    })

    it('should handle storage failure', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)
      vi.mocked(cookieService.set).mockResolvedValue({ success: false, error: 'Storage failed' })

      // Act
      const result = await cookieExtractionService.extractAndStoreCookies(
        mockPage,
        'user123',
        'session456'
      )

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to store cookies: Storage failed')
    })
  })

  describe('extractCookiesForDomain', () => {
    it('should extract cookies for specific domain', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractCookiesForDomain(mockPage, 'example.com')

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(3) // All cookies are returned, filtering happens in the service
    })
  })

  describe('extractAuthCookies', () => {
    it('should extract authentication cookies only', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)

      // Act
      const result = await cookieExtractionService.extractAuthCookies(mockPage)

      // Assert
      expect(result.success).toBe(true)
      expect(result.cookieCount).toBe(3) // All cookies are returned, filtering happens in the service
    })
  })

  describe('getCookieStats', () => {
    it('should return cookie statistics', async () => {
      // Act
      const stats = await cookieExtractionService.getCookieStats(mockPage)

      // Assert
      expect(stats.totalCookies).toBe(3)
      expect(stats.secureCookies).toBe(1)
      expect(stats.sessionCookies).toBe(1)
      expect(stats.persistentCookies).toBe(2)
      expect(stats.domains).toEqual(['example.com', '.example.com'])
      expect(stats.authCookies).toBe(3) // session_token, auth_cookie, and user_preference (contains 'user')
    })

    it('should handle page errors', async () => {
      // Arrange
      mockPage.cookies.mockRejectedValue(new Error('Page error'))

      // Act & Assert
      await expect(cookieExtractionService.getCookieStats(mockPage)).rejects.toThrow('Failed to get cookie statistics: Page error')
    })
  })

  describe('createTempCookieFile', () => {
    it('should create temporary cookie file', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)
      
      const fs = await import('fs/promises')
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)

      // Act
      const result = await cookieExtractionService.createTempCookieFile(mockPage)

      // Assert
      expect(result.success).toBe(true)
      expect(result.filePath).toMatch(/\/tmp\/cookies_\d+_[a-z0-9]+\.txt/)
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\/tmp\/cookies_\d+_[a-z0-9]+\.txt/),
        mockNetscapeString,
        'utf8'
      )
    })

    it('should handle extraction failure', async () => {
      // Arrange
      mockPage.cookies.mockResolvedValue([])

      // Act
      const result = await cookieExtractionService.createTempCookieFile(mockPage)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('No cookies found on the page')
    })

    it('should handle file creation failure', async () => {
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)
      
      const fs = await import('fs/promises')
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('File write failed'))

      // Act
      const result = await cookieExtractionService.createTempCookieFile(mockPage)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('File write failed')
    })
  })

  describe('cleanupTempCookieFile', () => {
    it('should cleanup temporary file successfully', async () => {
      // Arrange
      const fs = await import('fs/promises')
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      // Act
      const result = await cookieExtractionService.cleanupTempCookieFile('/tmp/test.txt')

      // Assert
      expect(result).toBe(true)
      expect(fs.unlink).toHaveBeenCalledWith('/tmp/test.txt')
    })

    it('should handle cleanup failure gracefully', async () => {
      // Arrange
      const fs = await import('fs/promises')
      vi.mocked(fs.unlink).mockRejectedValue(new Error('File not found'))

      // Act
      const result = await cookieExtractionService.cleanupTempCookieFile('/tmp/test.txt')

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('validateExtractionResult', () => {
    it('should validate successful extraction', () => {
      // Act
      const validation = cookieExtractionService.validateExtractionResult({
        success: true,
        cookies: '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123',
        cookieCount: 3,
      })

      // Assert
      expect(validation.isValid).toBe(true)
      expect(validation.issues).toHaveLength(0)
    })

    it('should identify issues in failed extraction', () => {
      // Act
      const validation = cookieExtractionService.validateExtractionResult({
        success: false,
        error: 'No cookies found',
      })

      // Assert
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Cookie extraction failed')
      expect(validation.issues).toContain('Error: No cookies found')
    })

    it('should identify issues in successful but empty extraction', () => {
      // Act
      const validation = cookieExtractionService.validateExtractionResult({
        success: true,
        cookies: '',
        cookieCount: 0,
      })

      // Assert
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('No cookies were extracted')
    })

    it('should warn about very few cookies', () => {
      // Act
      const validation = cookieExtractionService.validateExtractionResult({
        success: true,
        cookies: 'short',
        cookieCount: 1,
      })

      // Assert
      expect(validation.isValid).toBe(false)
      expect(validation.issues).toContain('Very few cookies extracted - may indicate incomplete authentication')
    })
  })

  describe('integration test', () => {
    it('should perform complete cookie extraction workflow', async () => {
      // This test simulates the integration test described in the task
      // Arrange
      const mockNetscapeString = '# Netscape HTTP Cookie File\n# This is a generated file! Do not edit.\n\nexample.com\tTRUE\t/\tTRUE\t1234567890\tsession_token\tabc123'
      vi.mocked(cookieEncryptionService.convertToNetscapeFormat).mockReturnValue(mockNetscapeString)
      vi.mocked(cookieService.set).mockResolvedValue({ success: true })
      
      const fs = await import('fs/promises')
      vi.mocked(fs.writeFile).mockResolvedValue(undefined)
      vi.mocked(fs.unlink).mockResolvedValue(undefined)

      // Act - Extract cookies
      const extractionResult = await cookieExtractionService.extractCookies(mockPage)
      
      // Act - Store cookies
      const storageResult = await cookieExtractionService.extractAndStoreCookies(
        mockPage,
        'user123',
        'session456'
      )
      
      // Act - Create temp file
      const tempFileResult = await cookieExtractionService.createTempCookieFile(mockPage)
      
      // Act - Cleanup temp file
      const cleanupResult = await cookieExtractionService.cleanupTempCookieFile(tempFileResult.filePath!)

      // Assert
      expect(extractionResult.success).toBe(true)
      expect(extractionResult.cookies).toBe(mockNetscapeString)
      expect(extractionResult.cookieCount).toBe(3)
      
      expect(storageResult.success).toBe(true)
      expect(cookieService.set).toHaveBeenCalled()
      
      expect(tempFileResult.success).toBe(true)
      expect(tempFileResult.filePath).toBeDefined()
      
      expect(cleanupResult).toBe(true)
      expect(fs.unlink).toHaveBeenCalled()
    })
  })
})
