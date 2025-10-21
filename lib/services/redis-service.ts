/**
 * Redis Service for Cookie Storage and Session Management
 * Provides secure, temporary storage for authentication cookies
 */

import { createClient, RedisClientType } from 'redis'
import { videoDownloadConfig } from '../config/video-download'
import { randomUUID } from 'crypto'

export interface CookieData {
  cookies: string
  userId: string
  sessionId: string
  expiresAt: number
  createdAt: number
}

export interface SessionData {
  userId: string
  sessionId: string
  status: 'pending' | 'authenticated' | 'expired' | 'failed'
  expiresAt: number
  createdAt: number
}

class RedisService {
  private client: RedisClientType | null = null
  private isConnected = false

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (this.isConnected && this.client) {
      return
    }

    try {
      this.client = createClient({
        url: videoDownloadConfig.redisUrl,
        ...(videoDownloadConfig.redisPassword && { password: videoDownloadConfig.redisPassword }),
        database: videoDownloadConfig.redisDb,
        socket: {
          connectTimeout: 5000,
        },
      })

      this.client.on('error', (error) => {
        console.error('Redis connection error:', error)
        this.isConnected = false
      })

      this.client.on('connect', () => {
        console.log('Connected to Redis')
        this.isConnected = true
      })

      this.client.on('disconnect', () => {
        console.log('Disconnected from Redis')
        this.isConnected = false
      })

      await this.client.connect()
    } catch (error) {
      console.error('Failed to connect to Redis:', error)
      throw new Error('Redis connection failed')
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.disconnect()
      this.client = null
      this.isConnected = false
    }
  }

  /**
   * Store authentication cookies for a user session
   */
  async storeCookies(
    userId: string,
    sessionId: string,
    cookies: string,
    ttlSeconds: number = videoDownloadConfig.cookieExpiryHours * 3600
  ): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected')
    }

    const cookieData: CookieData = {
      cookies,
      userId,
      sessionId,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      createdAt: Date.now(),
    }

    const key = `cookies:${userId}:${sessionId}`
    await this.client.setEx(key, ttlSeconds, JSON.stringify(cookieData))
  }

  /**
   * Retrieve authentication cookies for a user session
   */
  async getCookies(userId: string, sessionId: string): Promise<string | null> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected')
    }

    const key = `cookies:${userId}:${sessionId}`
    const data = await this.client.get(key)

    if (!data) {
      return null
    }

    try {
      const cookieData: CookieData = JSON.parse(data)
      
      // Check if cookies have expired
      if (Date.now() > cookieData.expiresAt) {
        await this.deleteCookies(userId, sessionId)
        return null
      }

      return cookieData.cookies
    } catch (error) {
      console.error('Failed to parse cookie data:', error)
      await this.deleteCookies(userId, sessionId)
      return null
    }
  }

  /**
   * Delete authentication cookies for a user session
   */
  async deleteCookies(userId: string, sessionId: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return
    }

    const key = `cookies:${userId}:${sessionId}`
    await this.client.del(key)
  }

  /**
   * Store session status
   */
  async storeSession(
    userId: string,
    sessionId: string,
    status: SessionData['status'],
    ttlSeconds: number = videoDownloadConfig.cookieExpiryHours * 3600
  ): Promise<void> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected')
    }

    const sessionData: SessionData = {
      userId,
      sessionId,
      status,
      expiresAt: Date.now() + (ttlSeconds * 1000),
      createdAt: Date.now(),
    }

    const key = `session:${userId}:${sessionId}`
    await this.client.setEx(key, ttlSeconds, JSON.stringify(sessionData))
  }

  /**
   * Get session status
   */
  async getSession(userId: string, sessionId: string): Promise<SessionData | null> {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis not connected')
    }

    const key = `session:${userId}:${sessionId}`
    const data = await this.client.get(key)

    if (!data) {
      return null
    }

    try {
      const sessionData: SessionData = JSON.parse(data)
      
      // Check if session has expired
      if (Date.now() > sessionData.expiresAt) {
        await this.deleteSession(userId, sessionId)
        return null
      }

      return sessionData
    } catch (error) {
      console.error('Failed to parse session data:', error)
      await this.deleteSession(userId, sessionId)
      return null
    }
  }

  /**
   * Delete session data
   */
  async deleteSession(userId: string, sessionId: string): Promise<void> {
    if (!this.client || !this.isConnected) {
      return
    }

    const key = `session:${userId}:${sessionId}`
    await this.client.del(key)
  }

  /**
   * Clean up expired sessions and cookies
   */
  async cleanup(): Promise<void> {
    if (!this.client || !this.isConnected) {
      return
    }

    try {
      // Get all cookie keys
      const cookieKeys = await this.client.keys('cookies:*')
      const sessionKeys = await this.client.keys('session:*')

      const now = Date.now()
      let cleanedCount = 0

      // Check and delete expired cookies
      for (const key of cookieKeys) {
        const data = await this.client.get(key)
        if (data) {
          try {
            const cookieData: CookieData = JSON.parse(data)
            if (now > cookieData.expiresAt) {
              await this.client.del(key)
              cleanedCount++
            }
          } catch {
            // Invalid data, delete it
            await this.client.del(key)
            cleanedCount++
          }
        }
      }

      // Check and delete expired sessions
      for (const key of sessionKeys) {
        const data = await this.client.get(key)
        if (data) {
          try {
            const sessionData: SessionData = JSON.parse(data)
            if (now > sessionData.expiresAt) {
              await this.client.del(key)
              cleanedCount++
            }
          } catch {
            // Invalid data, delete it
            await this.client.del(key)
            cleanedCount++
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired entries from Redis`)
      }
    } catch (error) {
      console.error('Failed to cleanup Redis:', error)
    }
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId(): string {
    return randomUUID()
  }

  /**
   * Check if Redis is connected
   */
  isRedisConnected(): boolean {
    return this.isConnected && this.client !== null
  }

  /**
   * Get Redis connection status
   */
  async ping(): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false
    }

    try {
      const result = await this.client.ping()
      return result === 'PONG'
    } catch {
      return false
    }
  }
}

// Export singleton instance
export const redisService = new RedisService()
