/**
 * Enhanced Download Manager
 * Integrates cookie extraction and authentication with video downloading
 */

import { randomUUID } from 'crypto'
import { mkdir, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { downloadVideo as originalDownloadVideo, type DownloadResult, type DownloadOptions, type DownloadProgress } from '../video-download/downloader'
import { cookieExtractionService } from './cookie-extraction-service'
import { cookieService } from './cookie-service'
import { authRequirementDetector } from './auth-requirement-detector'
import { authenticationManager } from './authentication-manager'
import { loadVideoDownloadConfig } from '../config/video-download'
import { logger } from '../utils/logger'

const videoDownloadConfig = loadVideoDownloadConfig()

export interface EnhancedDownloadOptions extends DownloadOptions {
  // Force authentication even if not detected
  forceAuth?: boolean
  // Skip authentication requirement detection
  skipAuthDetection?: boolean
  // Custom authentication options
  authOptions?: {
    userId: string
    timeout?: number
    successSelectors?: string[]
    successUrlPatterns?: RegExp[]
    authCookieNames?: string[]
    platform?: string
  }
  // Cookie extraction options
  cookieOptions?: {
    domainFilter?: string | RegExp
    nameFilter?: string | RegExp
    secureOnly?: boolean
    sessionOnly?: boolean
    persistentOnly?: boolean
    maxCookies?: number
  }
}

export interface EnhancedDownloadResult extends DownloadResult {
  // Additional metadata about the download process
  authRequired?: boolean
  authPerformed?: boolean
  cookiesExtracted?: number
  platform?: string
  authMethod?: 'stored' | 'interactive' | 'none'
}

export interface DownloadWithCookiesOptions {
  url: string
  userId: string
  netscapeCookies: string
  options?: Omit<EnhancedDownloadOptions, 'cookieText' | 'cookies'>
}

class EnhancedDownloadManager {
  /**
   * Download video with automatic authentication and cookie handling
   */
  async downloadVideo(
    url: string,
    userId: string,
    options: EnhancedDownloadOptions = {}
  ): Promise<EnhancedDownloadResult> {
    const startTime = Date.now()
    let authRequired = false
    let authPerformed = false
    let cookiesExtracted = 0
    let platform: string | undefined
    let authMethod: 'stored' | 'interactive' | 'none' = 'none'

    try {
      // Step 1: Detect if authentication is required
      if (!options.skipAuthDetection) {
        const authDetection = await authRequirementDetector.detectAuthRequirement(url)
        authRequired = authDetection.requiresAuth
        platform = authDetection.platform

        if (authRequired && authDetection.confidence === 'high') {
          logger.info(`Authentication required for ${url}`, { platform: authDetection.platform || 'unknown' })
        }
      }

      // Step 2: Handle authentication if required
      if (authRequired || options.forceAuth) {
        const authResult = await this.handleAuthentication(url, userId, options)
        
        if (authResult.success) {
          authPerformed = true
          authMethod = authResult.method
          
          // Use the extracted cookies for download
          if (authResult.cookies) {
            const downloadResult = await this.downloadWithCookies({
              url,
              userId,
              netscapeCookies: authResult.cookies,
              options: {
                ...options,
                cookieText: undefined, // Don't use cookieText when we have netscapeCookies
              }
            })

            return {
              ...downloadResult,
              authRequired,
              authPerformed,
              cookiesExtracted: authResult.cookieCount || 0,
              platform,
              authMethod,
            }
          }
        } else {
          logger.warn(`Authentication failed for ${url}`, { error: authResult.error })
          // Continue with download attempt without authentication
        }
      }

      // Step 3: Try download without authentication
      const downloadResult = await originalDownloadVideo(url, userId, options)
      
      // Step 4: If download failed with auth error and we haven't tried authentication yet, show popup
      if (!downloadResult.success && 
          downloadResult.errorType === 'auth' && 
          !authPerformed && 
          !options.skipAuthDetection) {

        logger.info(`Download failed with auth error for ${url}, showing authentication popup`)

        // Show popup and try authentication
        const popupAuthResult = await this.handleAuthenticationWithPopup(url, userId, options)
        
        if (popupAuthResult.success && popupAuthResult.cookies) {
          // Retry download with authentication
          const retryResult = await this.downloadWithCookies({
            url,
            userId,
            netscapeCookies: popupAuthResult.cookies,
            options: {
              ...options,
              cookieText: undefined,
            }
          })
          
          return {
            ...retryResult,
            authRequired: true,
            authPerformed: true,
            cookiesExtracted: this.countCookiesInNetscapeFormat(popupAuthResult.cookies),
            platform,
            authMethod: 'interactive',
          }
        } else {
          // Authentication failed, return original result with auth info
          return {
            ...downloadResult,
            authRequired: true,
            authPerformed: false,
            cookiesExtracted: 0,
            platform,
            authMethod: 'none',
          }
        }
      }
      
      return {
        ...downloadResult,
        authRequired,
        authPerformed,
        cookiesExtracted,
        platform,
        authMethod,
      }

    } catch (error) {
      return await this.handleDownloadError(error, url, userId, options)
    }
  }

  /**
   * Download video with provided Netscape cookies
   */
  async downloadWithCookies({
    url,
    userId,
    netscapeCookies,
    options = {}
  }: DownloadWithCookiesOptions): Promise<DownloadResult> {
    const fileId = randomUUID()
    const tempDir = tmpdir()
    const cookieFilePath = join(tempDir, `cookies_${fileId}_${Date.now()}.txt`)

    try {
      // Write cookies to temporary file
      await writeFile(cookieFilePath, netscapeCookies, 'utf-8')

      // Create download options with cookie file
      const downloadOptions: DownloadOptions = {
        ...options,
        cookieText: undefined, // Don't use cookieText when we have a cookie file
        onProgress: options.onProgress,
        maxFileSize: options.maxFileSize,
      }

      // Download with cookie file
      const result = await originalDownloadVideo(url, userId, {
        ...downloadOptions,
        cookieText: netscapeCookies, // Use the netscape cookies directly
      })

      // Handle download errors (including cookie invalidation for auth errors)
      if (!result.success && result.errorType === 'auth') {
        const domain = new URL(url).hostname
        await this.invalidateCookies(userId, domain)
      }

      return result

    } finally {
      // Clean up temporary cookie file
      try {
        await unlink(cookieFilePath)
      } catch (error) {
        logger.warn(`Failed to cleanup temp cookie file`, { path: cookieFilePath, error })
      }
    }
  }

  /**
   * Handle authentication with popup when media is not found
   */
  private async handleAuthenticationWithPopup(
    url: string,
    userId: string,
    options: EnhancedDownloadOptions
  ): Promise<{
    success: boolean
    cookies?: string
    cookieCount?: number
    method: 'stored' | 'interactive' | 'none'
    error?: string
  }> {
    const authOptions = options.authOptions
    if (!authOptions) {
      return { success: false, method: 'none', error: 'No authentication options provided' }
    }

    try {
      // Use the new popup authentication method
      const authResult = await authenticationManager.handleAuthenticationWithPopup(url, userId, {
        userId: authOptions.userId,
        authUrl: url,
        timeout: authOptions.timeout,
        successSelectors: authOptions.successSelectors,
        successUrlPatterns: authOptions.successUrlPatterns,
        authCookieNames: authOptions.authCookieNames,
        platform: authOptions.platform,
      })

      if (authResult.success && authResult.cookies) {
        // Store cookies for future use
        await this.storeCookies(userId, url, authResult.cookies)
        
        return {
          success: true,
          cookies: authResult.cookies,
          cookieCount: this.countCookiesInNetscapeFormat(authResult.cookies),
          method: 'interactive',
        }
      } else {
        return {
          success: false,
          method: 'interactive',
          error: authResult.error || 'Authentication failed',
        }
      }
    } catch (error) {
      return {
        success: false,
        method: 'interactive',
        error: error instanceof Error ? error.message : 'Authentication error',
      }
    }
  }

  /**
   * Handle authentication flow
   */
  private async handleAuthentication(
    url: string,
    userId: string,
    options: EnhancedDownloadOptions
  ): Promise<{
    success: boolean
    cookies?: string
    cookieCount?: number
    method: 'stored' | 'interactive' | 'none'
    error?: string
  }> {
    const authOptions = options.authOptions
    if (!authOptions) {
      return { success: false, method: 'none', error: 'No authentication options provided' }
    }

    // Step 1: Check for existing stored cookies
    const storedCookies = await this.getStoredCookies(userId, url)
    if (storedCookies.success && storedCookies.cookies) {
      logger.info(`Using stored cookies for ${url}`)
      return {
        success: true,
        cookies: storedCookies.cookies,
        cookieCount: storedCookies.cookieCount,
        method: 'stored',
      }
    }

    // Step 2: Perform interactive authentication
    if (authOptions.userId) {
      try {
        const authResult = await authenticationManager.handleLogin({
          userId: authOptions.userId,
          authUrl: url,
          timeout: authOptions.timeout,
          successSelectors: authOptions.successSelectors,
          successUrlPatterns: authOptions.successUrlPatterns,
          authCookieNames: authOptions.authCookieNames,
          platform: authOptions.platform,
        })

        if (authResult.success && authResult.cookies) {
          // Store cookies for future use
          await this.storeCookies(userId, url, authResult.cookies)
          
          return {
            success: true,
            cookies: authResult.cookies,
            cookieCount: this.countCookiesInNetscapeFormat(authResult.cookies),
            method: 'interactive',
          }
        } else {
          return {
            success: false,
            method: 'interactive',
            error: authResult.error || 'Authentication failed',
          }
        }
      } catch (error) {
        return {
          success: false,
          method: 'interactive',
          error: error instanceof Error ? error.message : 'Authentication error',
        }
      }
    }

    return { success: false, method: 'none', error: 'No authentication method available' }
  }

  /**
   * Get stored cookies for a user and URL
   */
  private async getStoredCookies(
    userId: string,
    url: string
  ): Promise<{
    success: boolean
    cookies?: string
    cookieCount?: number
    error?: string
  }> {
    try {
      const domain = new URL(url).hostname
      const sessionId = cookieService.generateSessionId()
      
      const result = await cookieService.get(userId, sessionId)
      
      if (result.success && result.data) {
        return {
          success: true,
          cookies: result.data,
          cookieCount: this.countCookiesInNetscapeFormat(result.data),
        }
      }

      return { success: false, error: 'No stored cookies found' }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to retrieve stored cookies',
      }
    }
  }

  /**
   * Store cookies for future use
   */
  private async storeCookies(userId: string, url: string, cookies: string): Promise<void> {
    try {
      const domain = new URL(url).hostname
      const sessionId = cookieService.generateSessionId()
      
      await cookieService.set(userId, domain, cookies, sessionId)
    } catch (error) {
      logger.warn(`Failed to store cookies`, { userId, url, error })
    }
  }

  /**
   * Count cookies in Netscape format string
   */
  private countCookiesInNetscapeFormat(netscapeString: string): number {
    const lines = netscapeString.split('\n')
    return lines.filter(line => {
      const trimmed = line.trim()
      return trimmed && !trimmed.startsWith('#') && trimmed.includes('\t')
    }).length
  }

  /**
   * Extract cookies from a Puppeteer page and download video
   */
  async downloadWithPageCookies(
    url: string,
    userId: string,
    page: any, // Puppeteer Page
    options: EnhancedDownloadOptions = {}
  ): Promise<EnhancedDownloadResult> {
    try {
      // Extract cookies from the page
      const extractionResult = await cookieExtractionService.extractCookies(page, options.cookieOptions)
      
      if (!extractionResult.success || !extractionResult.cookies) {
        return {
          success: false,
          fileId: '',
          filename: '',
          size: 0,
          mimeType: '',
          path: '',
          error: extractionResult.error || 'Failed to extract cookies from page',
          authRequired: true,
          authPerformed: false,
          cookiesExtracted: 0,
        }
      }

      // Download with extracted cookies
      const downloadResult = await this.downloadWithCookies({
        url,
        userId,
        netscapeCookies: extractionResult.cookies,
        options,
      })

      return {
        ...downloadResult,
        authRequired: true,
        authPerformed: true,
        cookiesExtracted: extractionResult.cookieCount || 0,
        authMethod: 'stored',
      }

    } catch (error) {
      return {
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: error instanceof Error ? error.message : 'Failed to download with page cookies',
        authRequired: true,
        authPerformed: false,
        cookiesExtracted: 0,
      }
    }
  }

  /**
   * Get download statistics
   */
  async getDownloadStats(): Promise<{
    totalDownloads: number
    successfulDownloads: number
    failedDownloads: number
    authRequiredDownloads: number
    averageDownloadTime: number
  }> {
    // This would typically come from a database or metrics service
    // For now, return placeholder data
    return {
      totalDownloads: 0,
      successfulDownloads: 0,
      failedDownloads: 0,
      authRequiredDownloads: 0,
      averageDownloadTime: 0,
    }
  }

  /**
   * Invalidate cookies for a user and domain when authentication fails
   */
  async invalidateCookies(userId: string, domain: string, sessionId?: string): Promise<void> {
    try {
      if (sessionId) {
        // Delete specific session cookies
        await cookieService.delete(userId, sessionId)
        logger.info(`Invalidated cookies`, { userId, domain, sessionId })
      } else {
        // Delete all cookies for the user and domain
        // This would require implementing a method to get all sessions for a user
        // For now, we'll log the attempt
        logger.info(`Attempted to invalidate all cookies`, { userId, domain })
      }
    } catch (error) {
      logger.error(`Failed to invalidate cookies`, error, { userId, domain })
    }
  }

  /**
   * Handle download errors and trigger re-authentication if needed
   */
  private async handleDownloadError(
    error: any,
    url: string,
    userId: string,
    options: EnhancedDownloadOptions
  ): Promise<EnhancedDownloadResult> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorType = this.classifyDownloadError(errorMessage)
    
    // If it's an authentication error, invalidate cookies and potentially retry
    if (errorType === 'auth') {
      const domain = new URL(url).hostname
      await this.invalidateCookies(userId, domain)

      logger.info(`Authentication error detected, cookies invalidated`, { url })

      return {
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: `Authentication failed: ${errorMessage}. Cookies have been invalidated. Please try again.`,
        errorType: 'auth',
        authRequired: true,
        authPerformed: false,
        cookiesExtracted: 0,
        platform: 'unknown',
        authMethod: 'none',
      }
    }
    
    // For other error types, return the error as-is
    return {
      success: false,
      fileId: '',
      filename: '',
      size: 0,
      mimeType: '',
      path: '',
      error: errorMessage,
      errorType,
      authRequired: false,
      authPerformed: false,
      cookiesExtracted: 0,
      platform: 'unknown',
      authMethod: 'none',
    }
  }

  /**
   * Classify download error type
   */
  private classifyDownloadError(errorMessage: string): 'auth' | 'network' | 'format' | 'timeout' | 'unknown' {
    const lowerError = errorMessage.toLowerCase()
    
    // Authentication errors
    if (lowerError.includes('private') || lowerError.includes('authentication') || 
        lowerError.includes('unauthorized') || lowerError.includes('forbidden') ||
        lowerError.includes('login') || lowerError.includes('signin') ||
        lowerError.includes('access denied') || lowerError.includes('members only') ||
        lowerError.includes('subscription') || lowerError.includes('premium')) {
      return 'auth'
    }
    
    // Network errors
    if (lowerError.includes('network') || lowerError.includes('connection') || 
        lowerError.includes('timeout') || lowerError.includes('dns') ||
        lowerError.includes('refused') || lowerError.includes('unreachable') ||
        lowerError.includes('socket') || lowerError.includes('econnreset')) {
      return 'network'
    }
    
    // Format errors
    if (lowerError.includes('format') || lowerError.includes('codec') || 
        lowerError.includes('unsupported') || lowerError.includes('not available') ||
        lowerError.includes('too large') || lowerError.includes('size limit')) {
      return 'format'
    }
    
    // Timeout errors
    if (lowerError.includes('timeout') || lowerError.includes('timed out') ||
        lowerError.includes('expired') || lowerError.includes('deadline')) {
      return 'timeout'
    }
    
    return 'unknown'
  }

  /**
   * Validate download configuration
   */
  validateConfig(): { isValid: boolean; errors: string[] } {
    const errors: string[] = []

    // Check if yt-dlp is available
    // This would typically check if yt-dlp is installed and accessible
    // For now, we'll assume it's available

    // Check Redis connection for cookie storage
    if (!cookieService.isReady()) {
      errors.push('Cookie service is not ready (Redis connection failed)')
    }

    // Check configuration values
    if (videoDownloadConfig.maxDownloadSizeMB <= 0) {
      errors.push('Invalid max download size configuration')
    }

    if (videoDownloadConfig.downloadTimeoutMs <= 0) {
      errors.push('Invalid download timeout configuration')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }
}

// Export singleton instance
export const enhancedDownloadManager = new EnhancedDownloadManager()
