/**
 * Cookie Encryption Service
 * Provides secure encryption and decryption of authentication cookies
 */

import CryptoJS from 'crypto-js'
import { videoDownloadConfig } from '../config/video-download'

export interface EncryptedCookieData {
  encrypted: string
  iv: string
  timestamp: number
}

class CookieEncryptionService {
  private readonly key: string

  constructor() {
    this.key = videoDownloadConfig.cookieEncryptionKey
  }

  /**
   * Encrypt cookie data
   */
  encrypt(cookies: string): EncryptedCookieData {
    try {
      // Generate a random IV for each encryption
      const iv = CryptoJS.lib.WordArray.random(16)
      
      // Encrypt the cookies
      const encrypted = CryptoJS.AES.encrypt(cookies, this.key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      })

      return {
        encrypted: encrypted.toString(),
        iv: iv.toString(CryptoJS.enc.Hex),
        timestamp: Date.now(),
      }
    } catch (error) {
      throw new Error(`Failed to encrypt cookies: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Decrypt cookie data
   */
  decrypt(encryptedData: EncryptedCookieData): string {
    try {
      // Convert IV from hex string back to WordArray
      const iv = CryptoJS.enc.Hex.parse(encryptedData.iv)
      
      // Decrypt the cookies
      const decrypted = CryptoJS.AES.decrypt(encryptedData.encrypted, this.key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      })

      const decryptedString = decrypted.toString(CryptoJS.enc.Utf8)
      
      if (!decryptedString) {
        throw new Error('Failed to decrypt cookies - invalid key or corrupted data')
      }

      return decryptedString
    } catch (error) {
      throw new Error(`Failed to decrypt cookies: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Convert Netscape cookie format to a more structured format
   */
  parseNetscapeCookies(cookieText: string): Array<{
    domain: string
    flag: boolean
    path: string
    secure: boolean
    expiration: number
    name: string
    value: string
  }> {
    const cookies: Array<{
      domain: string
      flag: boolean
      path: string
      secure: boolean
      expiration: number
      name: string
      value: string
    }> = []

    const lines = cookieText.split('\n')
    
    for (const line of lines) {
      const trimmedLine = line.trim()
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue
      }

      // Parse Netscape cookie format
      // Format: domain, flag, path, secure, expiration, name, value
      const parts = trimmedLine.split('\t')
      
      if (parts.length >= 7) {
        cookies.push({
          domain: parts[0] || '',
          flag: parts[1] === 'TRUE',
          path: parts[2] || '/',
          secure: parts[3] === 'TRUE',
          expiration: parseInt(parts[4] || '0', 10),
          name: parts[5] || '',
          value: parts[6] || '',
        })
      }
    }

    return cookies
  }

  /**
   * Convert structured cookies back to Netscape format
   */
  formatNetscapeCookies(cookies: Array<{
    domain: string
    flag: boolean
    path: string
    secure: boolean
    expiration: number
    name: string
    value: string
  }>): string {
    const lines = [
      '# Netscape HTTP Cookie File',
      '# This is a generated file! Do not edit.',
      '',
    ]

    for (const cookie of cookies) {
      const line = [
        cookie.domain || '',
        cookie.flag ? 'TRUE' : 'FALSE',
        cookie.path || '/',
        cookie.secure ? 'TRUE' : 'FALSE',
        cookie.expiration.toString(),
        cookie.name || '',
        cookie.value || '',
      ].join('\t')
      
      lines.push(line)
    }

    return lines.join('\n')
  }

  /**
   * Validate cookie data integrity
   */
  validateCookieData(encryptedData: EncryptedCookieData): boolean {
    try {
      // Check if required fields are present
      if (!encryptedData.encrypted || !encryptedData.iv || !encryptedData.timestamp) {
        return false
      }

      // Check if timestamp is reasonable (not too old, not in the future)
      const now = Date.now()
      const maxAge = 24 * 60 * 60 * 1000 // 24 hours
      
      if (encryptedData.timestamp > now || (now - encryptedData.timestamp) > maxAge) {
        return false
      }

      // Try to decrypt to validate the data
      this.decrypt(encryptedData)
      return true
    } catch {
      return false
    }
  }

  /**
   * Generate a secure random string for session IDs
   */
  generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    
    return result
  }

  /**
   * Hash a string for comparison (one-way)
   */
  hash(data: string): string {
    return CryptoJS.SHA256(data).toString()
  }

  /**
   * Verify a hash
   */
  verifyHash(data: string, hash: string): boolean {
    return this.hash(data) === hash
  }
}

// Export singleton instance
export const cookieEncryptionService = new CookieEncryptionService()
