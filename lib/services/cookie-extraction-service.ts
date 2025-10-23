import { logger } from '@/lib/utils/logger'

/**
 * Cookie Extraction Service
 * Extracts cookies from Puppeteer and formats them for yt-dlp
 */

import type { Page } from 'puppeteer'
import type { NetscapeCookie } from './cookie-encryption-service'
import { cookieEncryptionService } from './cookie-encryption-service'
import { cookieService } from './cookie-service'

export interface PuppeteerCookie {
  name: string
  value: string
  domain: string
  path: string
  expires: number
  httpOnly?: boolean
  secure: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

export interface CookieExtractionResult {
  success: boolean
  cookies?: string // Netscape format string
  cookieCount?: number
  error?: string
}

export interface CookieExtractionOptions {
  // Filter cookies by domain
  domainFilter?: string | RegExp
  // Filter cookies by name pattern
  nameFilter?: string | RegExp
  // Include only secure cookies
  secureOnly?: boolean
  // Include only session cookies (no expiration)
  sessionOnly?: boolean
  // Include only persistent cookies (with expiration)
  persistentOnly?: boolean
  // Maximum number of cookies to extract
  maxCookies?: number
  // Custom cookie validation function
  validateCookie?: (cookie: PuppeteerCookie) => boolean
}

class CookieExtractionService {
  /**
   * Extract cookies from a Puppeteer page and convert to Netscape format
   */
  async extractCookies(
    page: Page,
    options: CookieExtractionOptions = {}
  ): Promise<CookieExtractionResult> {
    try {
      // Get all cookies from the page
      const puppeteerCookies = await page.cookies()

      if (puppeteerCookies.length === 0) {
        return {
          success: false,
          error: 'No cookies found on the page'
        }
      }

      // Filter cookies based on options
      const filteredCookies = this.filterCookies(puppeteerCookies, options)

      if (filteredCookies.length === 0) {
        return {
          success: false,
          error: 'No cookies match the specified filters'
        }
      }

      // Convert to Netscape format
      const netscapeCookies = this.convertToNetscapeFormat(filteredCookies)
      const netscapeString =
        cookieEncryptionService.formatNetscapeCookies(netscapeCookies)

      return {
        success: true,
        cookies: netscapeString,
        cookieCount: filteredCookies.length
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during cookie extraction'
      }
    }
  }

  /**
   * Extract cookies and store them securely
   */
  async extractAndStoreCookies(
    page: Page,
    userId: string,
    sessionId: string,
    options: CookieExtractionOptions = {}
  ): Promise<CookieExtractionResult> {
    try {
      // Extract cookies
      const extractionResult = await this.extractCookies(page, options)

      if (!extractionResult.success || !extractionResult.cookies) {
        return extractionResult
      }

      // Store cookies securely
      const storeResult = await cookieService.set(
        userId,
        'extracted',
        extractionResult.cookies,
        sessionId
      )

      if (!storeResult.success) {
        return {
          success: false,
          error: `Failed to store cookies: ${storeResult.error}`
        }
      }

      return {
        success: true,
        cookies: extractionResult.cookies,
        ...(extractionResult.cookieCount
          ? { cookieCount: extractionResult.cookieCount }
          : {})
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error during cookie extraction and storage'
      }
    }
  }

  /**
   * Extract cookies for a specific domain
   */
  async extractCookiesForDomain(
    page: Page,
    domain: string,
    options: Omit<CookieExtractionOptions, 'domainFilter'> = {}
  ): Promise<CookieExtractionResult> {
    return this.extractCookies(page, {
      ...options,
      domainFilter: domain
    })
  }

  /**
   * Extract authentication cookies only
   */
  async extractAuthCookies(
    page: Page,
    options: Omit<CookieExtractionOptions, 'nameFilter'> = {}
  ): Promise<CookieExtractionResult> {
    const authPatterns = [
      'session',
      'auth',
      'token',
      'jwt',
      'login',
      'user',
      'access',
      'authentication',
      'authorization',
      'sso',
      'oauth'
    ]

    return this.extractCookies(page, {
      ...options,
      nameFilter: new RegExp(`(${authPatterns.join('|')})`, 'i')
    })
  }

  /**
   * Filter cookies based on extraction options
   */
  private filterCookies(
    cookies: PuppeteerCookie[],
    options: CookieExtractionOptions
  ): PuppeteerCookie[] {
    let filteredCookies = [...cookies]

    // Filter by domain
    if (options.domainFilter) {
      if (typeof options.domainFilter === 'string') {
        filteredCookies = filteredCookies.filter(
          cookie =>
            cookie.domain === options.domainFilter ||
            cookie.domain.endsWith(`.${options.domainFilter}`)
        )
      } else {
        filteredCookies = filteredCookies.filter(cookie =>
          (options.domainFilter as RegExp).test(cookie.domain)
        )
      }
    }

    // Filter by name pattern
    if (options.nameFilter) {
      if (typeof options.nameFilter === 'string') {
        filteredCookies = filteredCookies.filter(cookie =>
          cookie.name
            .toLowerCase()
            .includes((options.nameFilter as string).toLowerCase())
        )
      } else {
        filteredCookies = filteredCookies.filter(cookie =>
          (options.nameFilter as RegExp).test(cookie.name)
        )
      }
    }

    // Filter by security
    if (options.secureOnly) {
      filteredCookies = filteredCookies.filter(cookie => cookie.secure)
    }

    // Filter by session/persistent
    if (options.sessionOnly) {
      filteredCookies = filteredCookies.filter(cookie => cookie.expires === -1)
    }

    if (options.persistentOnly) {
      filteredCookies = filteredCookies.filter(cookie => cookie.expires > 0)
    }

    // Custom validation
    if (options.validateCookie) {
      filteredCookies = filteredCookies.filter(options.validateCookie)
    }

    // Limit number of cookies
    if (options.maxCookies && filteredCookies.length > options.maxCookies) {
      filteredCookies = filteredCookies.slice(0, options.maxCookies)
    }

    return filteredCookies
  }

  /**
   * Convert Puppeteer cookies to Netscape format
   */
  private convertToNetscapeFormat(
    cookies: PuppeteerCookie[]
  ): NetscapeCookie[] {
    return cookies.map(cookie => {
      // Handle domain format (remove leading dot if present)
      const domain = cookie.domain.startsWith('.')
        ? cookie.domain.substring(1)
        : cookie.domain

      // Determine if cookie is accessible by subdomains
      const flag = cookie.domain.startsWith('.')

      // Handle path
      const path = cookie.path || '/'

      // Handle expiration
      const expiration = cookie.expires === -1 ? 0 : Math.floor(cookie.expires)

      return {
        domain,
        flag,
        path,
        secure: cookie.secure,
        expiration,
        name: cookie.name,
        value: cookie.value
      }
    })
  }

  /**
   * Validate cookie extraction result
   */
  validateExtractionResult(result: CookieExtractionResult): {
    isValid: boolean
    issues: string[]
  } {
    const issues: string[] = []

    if (!result.success) {
      issues.push('Cookie extraction failed')
      if (result.error) {
        issues.push(`Error: ${result.error}`)
      }
    } else {
      if (!result.cookies) {
        issues.push('No cookies returned despite successful extraction')
      }

      if (result.cookieCount === 0) {
        issues.push('No cookies were extracted')
      }

      if (result.cookies && result.cookies.length < 100) {
        issues.push(
          'Very few cookies extracted - may indicate incomplete authentication'
        )
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    }
  }

  /**
   * Get cookie statistics
   */
  async getCookieStats(page: Page): Promise<{
    totalCookies: number
    secureCookies: number
    sessionCookies: number
    persistentCookies: number
    domains: string[]
    authCookies: number
  }> {
    try {
      const cookies = await page.cookies()

      const secureCookies = cookies.filter(c => c.secure).length
      const sessionCookies = cookies.filter(c => c.expires === -1).length
      const persistentCookies = cookies.filter(c => c.expires > 0).length

      const domains = [...new Set(cookies.map(c => c.domain))]

      const authPatterns = [
        'session',
        'auth',
        'token',
        'jwt',
        'login',
        'user',
        'access'
      ]
      const authCookies = cookies.filter(c =>
        authPatterns.some(pattern => c.name.toLowerCase().includes(pattern))
      ).length

      return {
        totalCookies: cookies.length,
        secureCookies,
        sessionCookies,
        persistentCookies,
        domains,
        authCookies
      }
    } catch (error) {
      throw new Error(
        `Failed to get cookie statistics: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Create a temporary cookie file for yt-dlp
   */
  async createTempCookieFile(
    page: Page,
    options: CookieExtractionOptions = {}
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const extractionResult = await this.extractCookies(page, options)

      if (!extractionResult.success || !extractionResult.cookies) {
        return {
          success: false,
          error: extractionResult.error || 'Failed to extract cookies'
        }
      }

      // Create temporary file
      const fs = await import('fs/promises')
      const path = await import('path')
      const os = await import('os')

      const tempDir = os.tmpdir()
      const fileName = `cookies_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.txt`
      const filePath = path.join(tempDir, fileName)

      await fs.writeFile(filePath, extractionResult.cookies, 'utf8')

      return {
        success: true,
        filePath
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error creating temp file'
      }
    }
  }

  /**
   * Clean up temporary cookie file
   */
  async cleanupTempCookieFile(filePath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises')
      await fs.unlink(filePath)
      return true
    } catch (error) {
      logger.warn(`Failed to cleanup temp cookie file ${filePath}:`, { error })
      return false
    }
  }
}

// Export singleton instance
export const cookieExtractionService = new CookieExtractionService()
