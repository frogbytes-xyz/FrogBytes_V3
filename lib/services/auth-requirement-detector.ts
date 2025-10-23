/**
 * Authentication Requirement Detection Service
 * Determines if a video URL requires authentication before attempting download
 */

import { isValidVideoUrl, detectPlatform } from '../video-download/validators'

export interface AuthRequirementResult {
  requiresAuth: boolean
  confidence: 'high' | 'medium' | 'low'
  platform?: string
  authType?: 'login' | 'oauth' | 'sso' | 'api_key'
  indicators: string[]
  reasoning: string
}

export interface AuthDetectionOptions {
  timeout?: number
  userAgent?: string
  followRedirects?: boolean
  maxRedirects?: number
}

class AuthRequirementDetector {
  private readonly authIndicators = {
    // URL patterns that typically require authentication
    urlPatterns: [
      /\/login/i,
      /\/signin/i,
      /\/auth/i,
      /\/oauth/i,
      /\/sso/i,
      /\/protected/i,
      /\/private/i,
      /\/members/i,
      /\/student/i,
      /\/university/i,
      /\/edu/i,
      /\/academic/i,
      /\/course/i,
      /\/lecture/i,
      /\/class/i,
      /\/institution/i,
      /\/campus/i,
      /\/portal/i,
      /\/lms/i,
      /\/moodle/i,
      /\/blackboard/i,
      /\/canvas/i,
      /\/sakai/i,
      /\/brightspace/i
    ],

    // Domain patterns that typically require authentication
    domainPatterns: [
      /\.edu$/i,
      /university/i,
      /college/i,
      /institute/i,
      /academy/i,
      /school/i,
      /campus/i,
      /portal/i,
      /lms/i,
      /moodle/i,
      /blackboard/i,
      /canvas/i,
      /sakai/i,
      /brightspace/i,
      /panopto/i,
      /kaltura/i,
      /echo360/i,
      /mediasite/i,
      /yuja/i,
      /screencast/i,
      /lecture/i,
      /uva\.nl/i, // University of Amsterdam
      /\.uva\./i // UvA subdomains
    ],

    // Platform-specific patterns
    platformPatterns: {
      panopto: [/panopto/i, /\.panopto\./i],
      kaltura: [/kaltura/i, /\.kaltura\./i],
      echo360: [/echo360/i, /\.echo360\./i],
      mediasite: [/mediasite/i, /\.mediasite\./i],
      yuja: [/yuja/i, /\.yuja\./i],
      screencast: [/screencast/i, /\.screencast\./i],
      moodle: [/moodle/i, /\.moodle\./i],
      blackboard: [/blackboard/i, /\.blackboard\./i],
      canvas: [/canvas/i, /\.canvas\./i],
      sakai: [/sakai/i, /\.sakai\./i],
      brightspace: [/brightspace/i, /\.brightspace\./i],
      uva: [/uva\.nl/i, /\.uva\./i, /video\.uva\.nl/i] // University of Amsterdam video platform
    },

    // HTTP response indicators
    responseIndicators: [
      'login',
      'signin',
      'authentication',
      'authorization',
      'oauth',
      'sso',
      'protected',
      'private',
      'members-only',
      'student-access',
      'university-login',
      'institutional-access',
      'campus-login',
      'portal-access',
      'lms-login',
      'moodle-login',
      'blackboard-login',
      'canvas-login',
      'sakai-login',
      'brightspace-login'
    ]
  }

  /**
   * Detect if a video URL requires authentication
   */
  async detectAuthRequirement(
    url: string,
    options: AuthDetectionOptions = {}
  ): Promise<AuthRequirementResult> {
    const indicators: string[] = []
    let confidence: 'high' | 'medium' | 'low' = 'low'
    let reasoning = ''

    try {
      // Validate URL first
      if (!isValidVideoUrl(url)) {
        return {
          requiresAuth: false,
          confidence: 'high',
          indicators: ['Invalid URL format'],
          reasoning: 'URL is not a valid video URL format'
        }
      }

      // Method 1: URL pattern analysis
      const urlAnalysis = this.analyzeUrlPatterns(url)
      indicators.push(...urlAnalysis.indicators)
      if (urlAnalysis.requiresAuth) {
        confidence = 'high'
        reasoning += 'URL contains authentication-related patterns. '
      }

      // Method 2: Domain analysis
      const domainAnalysis = this.analyzeDomain(url)
      indicators.push(...domainAnalysis.indicators)
      if (domainAnalysis.requiresAuth && confidence === 'low') {
        confidence = 'medium'
        reasoning += 'Domain suggests educational/institutional content. '
      }

      // Method 3: Platform detection
      const platform = detectPlatform(url)
      const platformAnalysis = this.analyzePlatform(platform || 'unknown', url)
      indicators.push(...platformAnalysis.indicators)
      if (platformAnalysis.requiresAuth && confidence === 'low') {
        confidence = 'medium'
        reasoning += `Platform (${platform}) typically requires authentication. `
      }

      // Method 4: HTTP response analysis (if enabled)
      if (options.followRedirects !== false) {
        const responseAnalysis = await this.analyzeHttpResponse(url, options)
        indicators.push(...responseAnalysis.indicators)
        if (responseAnalysis.requiresAuth && confidence !== 'high') {
          confidence = responseAnalysis.confidence
          reasoning += responseAnalysis.reasoning
        }
      }

      // Determine final result
      const requiresAuth =
        confidence === 'high' ||
        (confidence === 'medium' && indicators.length >= 2) ||
        (confidence === 'low' && indicators.length >= 3)

      if (!requiresAuth) {
        reasoning = 'No strong indicators of authentication requirement found.'
        confidence = 'low'
      }

      return {
        requiresAuth,
        confidence,
        ...(platform ? { platform } : {}),
        authType: this.determineAuthType(indicators),
        indicators: [...new Set(indicators)], // Remove duplicates
        reasoning: reasoning.trim()
      }
    } catch (error) {
      return {
        requiresAuth: false,
        confidence: 'low',
        indicators: ['Error during analysis'],
        reasoning: `Error analyzing URL: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Analyze URL patterns for authentication indicators
   */
  private analyzeUrlPatterns(url: string): {
    requiresAuth: boolean
    indicators: string[]
  } {
    const indicators: string[] = []
    let requiresAuth = false

    for (const pattern of this.authIndicators.urlPatterns) {
      if (pattern.test(url)) {
        indicators.push(`URL pattern: ${pattern.source}`)
        requiresAuth = true
      }
    }

    return { requiresAuth, indicators }
  }

  /**
   * Analyze domain for authentication indicators
   */
  private analyzeDomain(url: string): {
    requiresAuth: boolean
    indicators: string[]
  } {
    const indicators: string[] = []
    let requiresAuth = false

    try {
      const domain = new URL(url).hostname.toLowerCase()

      // Check for known open platforms first (these should NOT require auth)
      const openPlatforms = [
        'youtube.com',
        'youtu.be',
        'vimeo.com',
        'dailymotion.com',
        'twitch.tv',
        'facebook.com',
        'instagram.com',
        'tiktok.com'
      ]

      if (openPlatforms.some(platform => domain.includes(platform))) {
        return { requiresAuth: false, indicators: ['Open platform detected'] }
      }

      // Check for specific authentication-required patterns
      for (const pattern of this.authIndicators.domainPatterns) {
        if (pattern.test(domain)) {
          indicators.push(`Domain pattern: ${pattern.source}`)
          requiresAuth = true
        }
      }

      // More specific educational domain checks
      if (domain.endsWith('.edu')) {
        indicators.push('Educational domain (.edu)')
        requiresAuth = true
      }

      // Check for institutional subdomains
      if (
        domain.includes('university') ||
        domain.includes('college') ||
        domain.includes('institute')
      ) {
        indicators.push('Institutional domain')
        requiresAuth = true
      }

      // Special handling for known educational video platforms
      if (domain.includes('video.uva.nl') || domain.includes('uva.nl')) {
        indicators.push('University of Amsterdam video platform')
        requiresAuth = true
      }
    } catch (error) {
      indicators.push('Invalid domain format')
    }

    return { requiresAuth, indicators }
  }

  /**
   * Analyze platform-specific authentication requirements
   */
  private analyzePlatform(
    platform: string,
    url: string
  ): { requiresAuth: boolean; indicators: string[] } {
    const indicators: string[] = []
    let requiresAuth = false

    // Check platform-specific patterns
    const platformPatterns =
      this.authIndicators.platformPatterns[
        platform as keyof typeof this.authIndicators.platformPatterns
      ]

    if (platformPatterns) {
      for (const pattern of platformPatterns) {
        if (pattern.test(url)) {
          indicators.push(`Platform pattern: ${platform}`)
          requiresAuth = true
        }
      }
    }

    // Platform-specific authentication requirements
    const authRequiredPlatforms = [
      'panopto',
      'kaltura',
      'echo360',
      'mediasite',
      'yuja',
      'screencast',
      'moodle',
      'blackboard',
      'canvas',
      'sakai',
      'brightspace',
      'uva'
    ]

    if (authRequiredPlatforms.includes(platform)) {
      indicators.push(`Platform typically requires auth: ${platform}`)
      requiresAuth = true
    }

    // Special case for UvA video platform
    if (url.includes('video.uva.nl') || url.includes('uva.nl')) {
      indicators.push('UvA video platform detected')
      requiresAuth = true
    }

    return { requiresAuth, indicators }
  }

  /**
   * Analyze HTTP response for authentication indicators
   */
  private async analyzeHttpResponse(
    url: string,
    options: AuthDetectionOptions
  ): Promise<{
    requiresAuth: boolean
    confidence: 'high' | 'medium' | 'low'
    indicators: string[]
    reasoning: string
  }> {
    const indicators: string[] = []
    let requiresAuth = false
    let confidence: 'high' | 'medium' | 'low' = 'low'
    let reasoning = ''

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(
        () => controller.abort(),
        options.timeout || 5000
      )

      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent':
            options.userAgent ||
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        redirect: options.followRedirects !== false ? 'follow' : 'manual'
      })

      clearTimeout(timeoutId)

      // Check status code
      if (response.status === 401) {
        indicators.push('HTTP 401 Unauthorized')
        requiresAuth = true
        confidence = 'high'
        reasoning = 'Server returned 401 Unauthorized. '
      } else if (response.status === 403) {
        indicators.push('HTTP 403 Forbidden')
        requiresAuth = true
        confidence = 'high'
        reasoning = 'Server returned 403 Forbidden. '
      } else if (response.status === 302 || response.status === 301) {
        const location = response.headers.get('location')
        if (location && this.containsAuthIndicators(location)) {
          indicators.push('Redirect to authentication page')
          requiresAuth = true
          confidence = 'medium'
          reasoning = 'Redirected to authentication page. '
        }
      }

      // Check response headers
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('text/html')) {
        // Try to get a small portion of the response body
        const textResponse = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent':
              options.userAgent ||
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            Range: 'bytes=0-1023' // Get first 1KB
          }
        })

        if (textResponse.ok) {
          const text = await textResponse.text()
          const authIndicators = this.findAuthIndicatorsInText(text)

          if (authIndicators.length > 0) {
            indicators.push(...authIndicators)
            requiresAuth = true
            if (confidence === 'low') {
              confidence = 'medium'
              reasoning =
                'Response content contains authentication indicators. '
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        indicators.push('Request timeout')
      } else {
        indicators.push('HTTP request failed')
      }
    }

    return { requiresAuth, confidence, indicators, reasoning }
  }

  /**
   * Find authentication indicators in text content
   */
  private findAuthIndicatorsInText(text: string): string[] {
    const indicators: string[] = []
    const lowerText = text.toLowerCase()

    for (const indicator of this.authIndicators.responseIndicators) {
      if (lowerText.includes(indicator.toLowerCase())) {
        indicators.push(`Content indicator: ${indicator}`)
      }
    }

    return indicators
  }

  /**
   * Check if a URL contains authentication indicators
   */
  private containsAuthIndicators(url: string): boolean {
    const lowerUrl = url.toLowerCase()

    return this.authIndicators.responseIndicators.some(indicator =>
      lowerUrl.includes(indicator.toLowerCase())
    )
  }

  /**
   * Determine authentication type based on indicators
   */
  private determineAuthType(
    indicators: string[]
  ): 'login' | 'oauth' | 'sso' | 'api_key' {
    const indicatorText = indicators.join(' ').toLowerCase()

    if (indicatorText.includes('oauth')) {
      return 'oauth'
    } else if (indicatorText.includes('sso')) {
      return 'sso'
    } else if (indicatorText.includes('api') || indicatorText.includes('key')) {
      return 'api_key'
    } else {
      return 'login'
    }
  }

  /**
   * Quick check for common authentication patterns
   */
  quickCheck(url: string): boolean {
    try {
      const domain = new URL(url).hostname.toLowerCase()

      // Quick domain checks
      if (domain.endsWith('.edu')) return true
      if (domain.includes('university') || domain.includes('college'))
        return true
      if (domain.includes('portal') || domain.includes('lms')) return true

      // Quick URL pattern checks
      const authPatterns = [
        /\/login/i,
        /\/signin/i,
        /\/auth/i,
        /\/protected/i,
        /\/private/i
      ]
      return authPatterns.some(pattern => pattern.test(url))
    } catch {
      return false
    }
  }

  /**
   * Get platform-specific authentication requirements
   */
  getPlatformAuthRequirements(platform: string): {
    requiresAuth: boolean
    authType: 'login' | 'oauth' | 'sso' | 'api_key'
    commonSelectors: string[]
    notes: string
  } {
    const requirements = {
      panopto: {
        requiresAuth: true,
        authType: 'sso' as const,
        commonSelectors: ['#loginForm', '.sso-login', '[data-testid="login"]'],
        notes: 'Panopto typically uses SSO with institutional authentication'
      },
      kaltura: {
        requiresAuth: true,
        authType: 'sso' as const,
        commonSelectors: ['#loginForm', '.kaltura-login', '.sso-button'],
        notes: 'Kaltura often integrates with institutional SSO systems'
      },
      echo360: {
        requiresAuth: true,
        authType: 'login' as const,
        commonSelectors: ['#loginForm', '.echo-login', '.institution-login'],
        notes:
          'Echo360 uses standard login forms with institutional credentials'
      },
      moodle: {
        requiresAuth: true,
        authType: 'login' as const,
        commonSelectors: ['#login', '.login-form', '#username', '#password'],
        notes: 'Moodle uses standard username/password authentication'
      },
      blackboard: {
        requiresAuth: true,
        authType: 'sso' as const,
        commonSelectors: ['#loginForm', '.sso-login', '.institution-login'],
        notes: 'Blackboard typically uses SSO for institutional access'
      },
      canvas: {
        requiresAuth: true,
        authType: 'sso' as const,
        commonSelectors: ['#loginForm', '.sso-login', '.canvas-login'],
        notes: 'Canvas uses SSO for institutional authentication'
      }
    }

    return (
      requirements[platform as keyof typeof requirements] || {
        requiresAuth: false,
        authType: 'login' as const,
        commonSelectors: [],
        notes: 'Unknown platform'
      }
    )
  }
}

// Export singleton instance
export const authRequirementDetector = new AuthRequirementDetector()
