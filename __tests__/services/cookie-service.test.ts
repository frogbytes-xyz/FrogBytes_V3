/**
 * Unit tests for Cookie Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { cookieService } from '../../lib/services/cookie-service'
import { redisService } from '../../lib/services/redis-service'
import { cookieEncryptionService } from '../../lib/services/cookie-encryption-service'

// Mock the dependencies
vi.mock('../../lib/services/redis-service', () => ({
  redisService: {
    storeCookies: vi.fn(),
    getCookies: vi.fn(),
    deleteCookies: vi.fn(),
    cleanup: vi.fn(),
    ping: vi.fn(),
    getActiveSessions: vi.fn(),
  },
}))

vi.mock('../../lib/services/cookie-encryption-service', () => ({
  cookieEncryptionService: {
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    generateSecureToken: vi.fn(),
    parseNetscapeCookies: vi.fn(),
    validateCookieData: vi.fn(),
  },
}))

describe('CookieService', () => {
  const mockUserId = 'test-user-123'
  const mockSessionId = 'test-session-456'
  const mockDomain = 'example.com'
  const mockCookies = 'test-cookie-data'
  const mockEncryptedData = {
    encrypted: 'encrypted-data',
    iv: 'test-iv',
    timestamp: Date.now(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('set', () => {
    it('should successfully store cookies', async () => {
      // Arrange
      const mockGeneratedSessionId = 'generated-session-123'
      vi.mocked(cookieEncryptionService.generateSecureToken).mockReturnValue(mockGeneratedSessionId)
      vi.mocked(cookieEncryptionService.encrypt).mockReturnValue(mockEncryptedData)
      vi.mocked(redisService.storeCookies).mockResolvedValue(undefined)

      // Act
      const result = await cookieService.set(mockUserId, mockDomain, mockCookies)

      // Assert
      expect(result.success).toBe(true)
      expect(cookieEncryptionService.encrypt).toHaveBeenCalledWith(mockCookies)
      expect(redisService.storeCookies).toHaveBeenCalledWith(
        mockUserId,
        mockGeneratedSessionId,
        expect.stringContaining('"domain":"example.com"'),
        86400 // 24 hours in seconds
      )
    })

    it('should handle encryption errors', async () => {
      // Arrange
      vi.mocked(cookieEncryptionService.encrypt).mockImplementation(() => {
        throw new Error('Encryption failed')
      })

      // Act
      const result = await cookieService.set(mockUserId, mockDomain, mockCookies)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Encryption failed')
    })

    it('should handle Redis storage errors', async () => {
      // Arrange
      vi.mocked(cookieEncryptionService.encrypt).mockReturnValue(mockEncryptedData)
      vi.mocked(redisService.storeCookies).mockRejectedValue(new Error('Redis connection failed'))

      // Act
      const result = await cookieService.set(mockUserId, mockDomain, mockCookies)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Redis connection failed')
    })
  })

  describe('get', () => {
    it('should successfully retrieve and decrypt cookies', async () => {
      // Arrange
      const mockCookieData = {
        domain: mockDomain,
        cookies: mockEncryptedData.encrypted,
        userId: mockUserId,
        sessionId: mockSessionId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000, // 24 hours from now
      }

      vi.mocked(redisService.getCookies).mockResolvedValue(JSON.stringify(mockCookieData))
      vi.mocked(cookieEncryptionService.decrypt).mockReturnValue(mockCookies)

      // Act
      const result = await cookieService.get(mockUserId, mockSessionId)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        cookies: mockCookies,
        domain: mockDomain,
      })
      expect(cookieEncryptionService.decrypt).toHaveBeenCalled()
    })

    it('should return error when no cookies found', async () => {
      // Arrange
      vi.mocked(redisService.getCookies).mockResolvedValue(null)

      // Act
      const result = await cookieService.get(mockUserId, mockSessionId)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('No cookies found for this session')
    })

    it('should handle expired cookies', async () => {
      // Arrange
      const expiredCookieData = {
        domain: mockDomain,
        cookies: mockEncryptedData.encrypted,
        userId: mockUserId,
        sessionId: mockSessionId,
        createdAt: Date.now() - 86400000, // 24 hours ago
        expiresAt: Date.now() - 3600000, // 1 hour ago (expired)
      }

      vi.mocked(redisService.getCookies).mockResolvedValue(JSON.stringify(expiredCookieData))
      vi.mocked(redisService.deleteCookies).mockResolvedValue(undefined)

      // Act
      const result = await cookieService.get(mockUserId, mockSessionId)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Cookies have expired')
      expect(redisService.deleteCookies).toHaveBeenCalledWith(mockUserId, mockSessionId)
    })
  })

  describe('delete', () => {
    it('should successfully delete cookies', async () => {
      // Arrange
      vi.mocked(redisService.deleteCookies).mockResolvedValue(undefined)

      // Act
      const result = await cookieService.delete(mockUserId, mockSessionId)

      // Assert
      expect(result.success).toBe(true)
      expect(redisService.deleteCookies).toHaveBeenCalledWith(mockUserId, mockSessionId)
    })

    it('should handle deletion errors', async () => {
      // Arrange
      vi.mocked(redisService.deleteCookies).mockRejectedValue(new Error('Redis error'))

      // Act
      const result = await cookieService.delete(mockUserId, mockSessionId)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('Redis error')
    })
  })

  describe('setNetscapeCookies', () => {
    it('should successfully store Netscape format cookies', async () => {
      // Arrange
      const netscapeCookies = '# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t1234567890\ttest\tvalue'
      const mockParsedCookies = [
        {
          domain: '.example.com',
          flag: true,
          path: '/',
          secure: false,
          expiration: 1234567890,
          name: 'test',
          value: 'value',
        },
      ]

      vi.mocked(cookieEncryptionService.parseNetscapeCookies).mockReturnValue(mockParsedCookies)
      vi.mocked(cookieEncryptionService.encrypt).mockReturnValue(mockEncryptedData)
      vi.mocked(redisService.storeCookies).mockResolvedValue(undefined)

      // Act
      const result = await cookieService.setNetscapeCookies(mockUserId, mockDomain, netscapeCookies)

      // Assert
      expect(result.success).toBe(true)
      expect(cookieEncryptionService.parseNetscapeCookies).toHaveBeenCalledWith(netscapeCookies)
      expect(cookieEncryptionService.encrypt).toHaveBeenCalledWith(netscapeCookies)
    })

    it('should return error for invalid Netscape format', async () => {
      // Arrange
      const invalidCookies = 'invalid cookie format'
      vi.mocked(cookieEncryptionService.parseNetscapeCookies).mockReturnValue([])

      // Act
      const result = await cookieService.setNetscapeCookies(mockUserId, mockDomain, invalidCookies)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error).toBe('No valid cookies found in Netscape format')
    })
  })

  describe('validateCookies', () => {
    it('should return true for valid cookies', async () => {
      // Arrange
      const mockCookieData = {
        domain: mockDomain,
        cookies: mockEncryptedData.encrypted,
        userId: mockUserId,
        sessionId: mockSessionId,
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      }

      vi.mocked(redisService.getCookies).mockResolvedValue(JSON.stringify(mockCookieData))
      vi.mocked(cookieEncryptionService.validateCookieData).mockReturnValue(true)

      // Act
      const result = await cookieService.validateCookies(mockUserId, mockSessionId)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toBe(true)
    })

    it('should return false for expired cookies', async () => {
      // Arrange
      const expiredCookieData = {
        domain: mockDomain,
        cookies: mockEncryptedData.encrypted,
        userId: mockUserId,
        sessionId: mockSessionId,
        createdAt: Date.now() - 86400000,
        expiresAt: Date.now() - 3600000, // Expired
      }

      vi.mocked(redisService.getCookies).mockResolvedValue(JSON.stringify(expiredCookieData))

      // Act
      const result = await cookieService.validateCookies(mockUserId, mockSessionId)

      // Assert
      expect(result.success).toBe(true)
      expect(result.data).toBe(false)
    })
  })

  describe('isReady', () => {
    it('should return true when Redis is connected', async () => {
      // Arrange
      vi.mocked(redisService.ping).mockResolvedValue(true)

      // Act
      const result = await cookieService.isReady()

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when Redis is not connected', async () => {
      // Arrange
      vi.mocked(redisService.ping).mockResolvedValue(false)

      // Act
      const result = await cookieService.isReady()

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('generateSessionId', () => {
    it('should generate a secure session ID', () => {
      // Arrange
      const mockToken = 'generated-token-123'
      vi.mocked(cookieEncryptionService.generateSecureToken).mockReturnValue(mockToken)

      // Act
      const result = cookieService.generateSessionId()

      // Assert
      expect(result).toBe(mockToken)
      expect(cookieEncryptionService.generateSecureToken).toHaveBeenCalled()
    })
  })
})
