/**
 * Browser Mimicking Service
 *
 * Uses stored user browser information to make HTTP requests that appear to come
 * from the user's actual browser. This is essential for services like linkedapi.io
 * that validate browser fingerprints.
 */

import { logger } from '@/lib/utils/logger'
import type { BrowserInfo } from '@/lib/utils/browser-info'

interface MimickedRequestOptions {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: string | FormData | URLSearchParams
  browserInfo: BrowserInfo
  timeout?: number
}

interface MimickedResponse {
  success: boolean
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  error?: string
}

/**
 * Makes an HTTP request using the user's actual browser headers and info
 *
 * This function creates a request that mimics the user's browser as closely as possible,
 * including their user-agent, screen resolution, language, and other fingerprint data.
 *
 * @param options - Request options including URL, method, and user's browser info
 * @returns Promise resolving to the response
 *
 * @example
 * ```typescript
 * const response = await makeRequestWithUserBrowser({
 *   url: 'https://linkedapi.io/download/video',
 *   method: 'POST',
 *   browserInfo: userBrowserInfo,
 *   body: JSON.stringify({ videoId: '123' })
 * })
 * ```
 */
export async function makeRequestWithUserBrowser(
  options: MimickedRequestOptions
): Promise<MimickedResponse> {
  try {
    logger.info('Making request with user browser fingerprint', {
      url: options.url,
      method: options.method ?? 'GET',
      userAgent: options.browserInfo.userAgent.substring(0, 50)
    })

    // Build headers that match the user's browser
    const headers: Record<string, string> = {
      ...options.browserInfo.headers,
      ...options.headers
    }

    // Add additional browser-specific headers
    headers['sec-ch-ua-platform'] = `"${options.browserInfo.platform}"`
    headers['sec-ch-ua-mobile'] = '?0'
    headers['viewport-width'] =
      options.browserInfo.screenResolution.width.toString()

    // Make the request with user's browser fingerprint
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, options.timeout ?? 30000)

    try {
      const fetchOptions: RequestInit = {
        method: options.method ?? 'GET',
        headers,
        signal: controller.signal
      }

      // Only include body if it's not a GET request
      if (options.body && options.method !== 'GET') {
        fetchOptions.body = options.body
      }

      const response = await fetch(options.url, fetchOptions)

      clearTimeout(timeoutId)

      // Convert response headers to object
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const body = await response.text()

      logger.info('Request completed successfully', {
        url: options.url,
        status: response.status
      })

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body
      }
    } catch (fetchError) {
      clearTimeout(timeoutId)

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Request timeout')
      }

      throw fetchError
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'

    logger.error('Request failed', error, {
      url: options.url,
      method: options.method ?? 'GET'
    })

    return {
      success: false,
      status: 0,
      statusText: 'Request Failed',
      headers: {},
      body: '',
      error: errorMessage
    }
  }
}

/**
 * Retrieves stored browser info for a session
 *
 * Browser info is stored when the mini-browser session is created and can be
 * retrieved later for use in API requests.
 *
 * @param sessionId - The mini-browser session ID
 * @returns The stored browser info, or null if not found
 */
export function getStoredBrowserInfo(sessionId: string): BrowserInfo | null {
  // In a real implementation, this would retrieve from Redis or database
  // For now, we&apos;ll store in memory (note: this won&apos;t persist across server restarts)
  const stored = browserInfoStore.get(sessionId)
  return stored ?? null
}

/**
 * Stores browser info for a session
 *
 * @param sessionId - The mini-browser session ID
 * @param browserInfo - The user's browser information
 */
export function storeBrowserInfo(
  sessionId: string,
  browserInfo: BrowserInfo
): void {
  browserInfoStore.set(sessionId, browserInfo)

  // Clean up after 1 hour
  setTimeout(
    () => {
      browserInfoStore.delete(sessionId)
    },
    60 * 60 * 1000
  )
}

// In-memory storage (replace with Redis in production)
const browserInfoStore = new Map<string, BrowserInfo>()

/**
 * Clears stored browser info for a session
 *
 * @param sessionId - The mini-browser session ID
 */
export function clearBrowserInfo(sessionId: string): void {
  browserInfoStore.delete(sessionId)
}

/**
 * Makes a POST request to linkedapi.io-style services with user's browser fingerprint
 *
 * This is a convenience function specifically for services that require browser
 * fingerprint validation like linkedapi.io.
 *
 * @param url - The API endpoint URL
 * @param data - The POST data
 * @param sessionId - The mini-browser session ID (to retrieve browser info)
 * @returns Promise resolving to the response
 *
 * @example
 * ```typescript
 * const response = await makeLinkedApiRequest(
 *   'https://linkedapi.io/api/download',
 *   { videoUrl: 'https://example.com/video.mp4' },
 *   sessionId
 * )
 * ```
 */
export async function makeLinkedApiRequest(
  url: string,
  data: Record<string, unknown>,
  sessionId: string
): Promise<MimickedResponse> {
  const browserInfo = getStoredBrowserInfo(sessionId)

  if (!browserInfo) {
    throw new Error(`No browser info found for session ${sessionId}`)
  }

  return makeRequestWithUserBrowser({
    url,
    method: 'POST',
    browserInfo,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })
}
