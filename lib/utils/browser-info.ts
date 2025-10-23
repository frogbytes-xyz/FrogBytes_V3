/**
 * Browser Information Utility
 *
 * Captures the user's actual browser headers, device information, and user-agent
 * for use in server-side browser automation. This ensures the Puppeteer session
 * mimics the user's actual browser environment, improving authentication success rates.
 */

/**
 * Comprehensive browser and device information
 */
export interface BrowserInfo {
  userAgent: string
  platform: string
  language: string
  languages: readonly string[]
  vendor: string
  deviceMemory?: number
  hardwareConcurrency: number
  screenResolution: {
    width: number
    height: number
    colorDepth: number
    pixelRatio: number
  }
  timezone: string
  cookieEnabled: boolean
  doNotTrack: string | null
  headers: Record<string, string>
}

/**
 * Captures comprehensive browser and device information from the user's browser
 *
 * This function collects real browser characteristics that can be used to configure
 * Puppeteer sessions to match the user's actual environment, reducing detection
 * by anti-bot systems.
 *
 * @returns Promise resolving to BrowserInfo object containing all captured information
 *
 * @example
 * ```typescript
 * const browserInfo = await captureBrowserInfo()
 * console.log(browserInfo.userAgent) // "Mozilla/5.0 (Windows NT 10.0; Win64; x64)..."
 * console.log(browserInfo.screenResolution) // { width: 1920, height: 1080, ... }
 * ```
 */
export async function captureBrowserInfo(): Promise<BrowserInfo> {
  const nav = window.navigator
  const screen = window.screen

  // Capture basic navigator properties
  const userAgent = nav.userAgent
  const platform = nav.platform
  const language = nav.language
  const languages = nav.languages
  const vendor = nav.vendor
  const hardwareConcurrency = nav.hardwareConcurrency
  const cookieEnabled = nav.cookieEnabled
  const doNotTrack = nav.doNotTrack

  // Capture screen information
  const screenResolution = {
    width: screen.width,
    height: screen.height,
    colorDepth: screen.colorDepth,
    pixelRatio: window.devicePixelRatio
  }

  // Capture timezone
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Capture device memory if available
  const deviceMemory =
    'deviceMemory' in nav
      ? (nav as Navigator & { deviceMemory?: number }).deviceMemory
      : undefined

  // Build headers that would be sent by this browser
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept-Language': language,
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'max-age=0',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1'
  }

  // Add DNT header if enabled
  if (doNotTrack === '1') {
    headers['DNT'] = '1'
  }

  const result: BrowserInfo = {
    userAgent,
    platform,
    language,
    languages: Array.from(languages),
    vendor,
    hardwareConcurrency,
    screenResolution,
    timezone,
    cookieEnabled,
    doNotTrack,
    headers,
    ...(deviceMemory !== undefined ? { deviceMemory } : {})
  }

  return result
}

/**
 * Gets a simplified browser fingerprint string for logging purposes
 *
 * @param info - The browser info object
 * @returns A human-readable fingerprint string
 *
 * @example
 * ```typescript
 * const info = await captureBrowserInfo()
 * const fingerprint = getBrowserFingerprint(info)
 * // "Chrome 120.0 on Windows (1920x1080)"
 * ```
 */
export function getBrowserFingerprint(info: BrowserInfo): string {
  const browserMatch = info.userAgent.match(
    /(Chrome|Firefox|Safari|Edge)\/(\d+)/
  )
  const browser = browserMatch
    ? `${browserMatch[1]} ${browserMatch[2]}`
    : 'Unknown Browser'

  const osMatch = info.userAgent.match(
    /(Windows NT|Mac OS X|Linux|Android|iOS)/
  )
  const os = osMatch ? osMatch[1] : info.platform

  const resolution = `${info.screenResolution.width}x${info.screenResolution.height}`

  return `${browser} on ${os} (${resolution})`
}

/**
 * Converts BrowserInfo to Puppeteer-compatible configuration
 *
 * @param info - The browser info object
 * @returns Configuration object for Puppeteer page setup
 *
 * @example
 * ```typescript
 * const info = await captureBrowserInfo()
 * const config = browserInfoToPuppeteerConfig(info)
 * await page.setUserAgent(config.userAgent)
 * await page.setViewport(config.viewport)
 * ```
 */
export function browserInfoToPuppeteerConfig(info: BrowserInfo): {
  userAgent: string
  viewport: {
    width: number
    height: number
    deviceScaleFactor: number
  }
  extraHTTPHeaders: Record<string, string>
  timezone: string
} {
  return {
    userAgent: info.userAgent,
    viewport: {
      width: info.screenResolution.width,
      height: info.screenResolution.height,
      deviceScaleFactor: info.screenResolution.pixelRatio
    },
    extraHTTPHeaders: info.headers,
    timezone: info.timezone
  }
}
