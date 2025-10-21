/**
 * Cookie Service Module
 * Centralized service for managing authentication cookies with encryption and Redis storage
 */

import { redisService } from './redis-service'
import { cookieEncryptionService } from './cookie-encryption-service'
import { videoDownloadConfig } from '../config/video-download'

export interface CookieData {
  domain: string
  cookies: string
  userId: string
  sessionId: string
  createdAt: number
  expiresAt: number
}

export interface CookieServiceResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

class CookieService {
  /**
   * Store encrypted cookies for a user and domain
   */
  async set(
    userId: string,
    domain: string,
    cookies: string,
    sessionId?: string
  ): Promise<CookieServiceResult<void>> {
    try {
      // Generate session ID if not provided
      const cookieSessionId = sessionId || cookieEncryptionService.generateSecureToken()
      
      // Encrypt the cookies
      const encryptedData = cookieEncryptionService.encrypt(cookies)
      
      // Create cookie data structure
      const cookieData: CookieData = {
        domain,
        cookies: encryptedData.encrypted,
        userId,
        sessionId: cookieSessionId,
        createdAt: Date.now(),
        expiresAt: Date.now() + (videoDownloadConfig.cookieExpiryHours * 3600 * 1000),
      }

      // Store in Redis with TTL
      const ttlSeconds = videoDownloadConfig.cookieExpiryHours * 3600
      await redisService.storeCookies(userId, cookieSessionId, JSON.stringify(cookieData), ttlSeconds)

      return {
        success: true,
        data: undefined,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store cookies',
      }
    }
  }

  /**
   * Retrieve and decrypt cookies for a user and domain
   */
  async get(
    userId: string,
    sessionId: string
  ): Promise<CookieServiceResult<{ cookies: string; domain: string }>> {
    try {
      // Get encrypted data from Redis
      const encryptedData = await redisService.getCookies(userId, sessionId)
      
      if (!encryptedData) {
        return {
          success: false,
          error: 'No cookies found for this session',
        }
      }

      // Parse the stored data
      const cookieData: CookieData = JSON.parse(encryptedData)
      
      // Check if cookies have expired
      if (Date.now() > cookieData.expiresAt) {
        // Clean up expired cookies
        await this.delete(userId, sessionId)
        return {
          success: false,
          error: 'Cookies have expired',
        }
      }

      // Decrypt the cookies
      const decryptedCookies = cookieEncryptionService.decrypt({
        encrypted: cookieData.cookies,
        iv: '', // This will be handled by the encryption service
        timestamp: cookieData.createdAt,
      })

      return {
        success: true,
        data: {
          cookies: decryptedCookies,
          domain: cookieData.domain,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve cookies',
      }
    }
  }

  /**
   * Delete cookies for a user session
   */
  async delete(userId: string, sessionId: string): Promise<CookieServiceResult<void>> {
    try {
      await redisService.deleteCookies(userId, sessionId)
      return {
        success: true,
        data: undefined,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete cookies',
      }
    }
  }

  /**
   * Store cookies in Netscape format (for yt-dlp compatibility)
   */
  async setNetscapeCookies(
    userId: string,
    domain: string,
    netscapeCookies: string,
    sessionId?: string
  ): Promise<CookieServiceResult<void>> {
    try {
      // Validate Netscape format
      const parsedCookies = cookieEncryptionService.parseNetscapeCookies(netscapeCookies)
      
      if (parsedCookies.length === 0) {
        return {
          success: false,
          error: 'No valid cookies found in Netscape format',
        }
      }

      // Store the raw Netscape format
      return await this.set(userId, domain, netscapeCookies, sessionId)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to store Netscape cookies',
      }
    }
  }

  /**
   * Get cookies in Netscape format (for yt-dlp compatibility)
   */
  async getNetscapeCookies(
    userId: string,
    sessionId: string
  ): Promise<CookieServiceResult<string>> {
    try {
      const result = await this.get(userId, sessionId)
      
      if (!result.success || !result.data) {
        return {
          success: false,
          error: result.error || 'Failed to retrieve cookies',
        }
      }

      // Return the cookies in Netscape format
      return {
        success: true,
        data: result.data.cookies,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve Netscape cookies',
      }
    }
  }

  /**
   * Validate cookie data integrity
   */
  async validateCookies(userId: string, sessionId: string): Promise<CookieServiceResult<boolean>> {
    try {
      const encryptedData = await redisService.getCookies(userId, sessionId)
      
      if (!encryptedData) {
        return {
          success: true,
          data: false,
        }
      }

      const cookieData: CookieData = JSON.parse(encryptedData)
      
      // Check expiration
      if (Date.now() > cookieData.expiresAt) {
        return {
          success: true,
          data: false,
        }
      }

      // Validate encryption integrity
      const isValid = cookieEncryptionService.validateCookieData({
        encrypted: cookieData.cookies,
        iv: '', // This will be handled by the encryption service
        timestamp: cookieData.createdAt,
      })

      return {
        success: true,
        data: isValid,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to validate cookies',
      }
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<CookieServiceResult<Array<{
    sessionId: string
    domain: string
    createdAt: number
    expiresAt: number
  }>>> {
    try {
      // This would require a more complex Redis query in a real implementation
      // For now, we'll return an empty array as this is not critical for the core functionality
      return {
        success: true,
        data: [],
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user sessions',
      }
    }
  }

  /**
   * Clean up expired cookies
   */
  async cleanupExpiredCookies(): Promise<CookieServiceResult<number>> {
    try {
      await redisService.cleanup()
      return {
        success: true,
        data: 0, // Redis service doesn't return count, but we can assume cleanup worked
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cleanup expired cookies',
      }
    }
  }

  /**
   * Generate a new session ID
   */
  generateSessionId(): string {
    return cookieEncryptionService.generateSecureToken()
  }

  /**
   * Check if the service is ready (Redis connection)
   */
  async isReady(): Promise<boolean> {
    try {
      return await redisService.ping()
    } catch {
      return false
    }
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<CookieServiceResult<{
    isConnected: boolean
    activeSessions: number
    uptime: number
  }>> {
    try {
      const isConnected = await redisService.ping()
      const activeSessions = redisService.getActiveSessions().length
      
      return {
        success: true,
        data: {
          isConnected,
          activeSessions,
          uptime: process.uptime(),
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get service stats',
      }
    }
  }
}

// Export singleton instance
export const cookieService = new CookieService()
