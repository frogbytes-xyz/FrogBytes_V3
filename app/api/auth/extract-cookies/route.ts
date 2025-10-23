/**
 * API Route: Extract Cookies After Authentication
 *
 * This endpoint is called after the user completes authentication in the frontend iframe.
 * It uses Puppeteer to visit the URL with the user's browser context and extract cookies.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
// Import authenticationManager dynamically inside handler to avoid pulling
// puppeteer-related modules into Next's build analysis.
import { logger } from '@/lib/utils/logger'

/**
 * POST /api/auth/extract-cookies
 *
 * Extracts cookies after user completes authentication in the frontend iframe
 *
 * @param request - The incoming request containing sessionId, url, and userId
 * @returns JSON response with extracted cookies or error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      sessionId: string
      url: string
      userId: string
    }

    const { sessionId, url, userId } = body

    if (!sessionId || !url || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: sessionId, url, userId' },
        { status: 400 }
      )
    }

    logger.info('Extracting cookies after frontend authentication', {
      sessionId,
      url,
      userId
    })

    // Use the authentication manager to visit the URL and extract cookies.
    // Import dynamically so server-only puppeteer deps aren't analyzed at build time.
    const { authenticationManager } = await import(
      '@/lib/services/authentication-manager'
    )
    const result = await authenticationManager.visitUrlWithUserContext(
      sessionId,
      url
    )

    if (!result.success) {
      logger.error('Failed to extract cookies', {
        sessionId,
        url,
        error: result.error
      })

      return NextResponse.json(
        { error: result.error || 'Failed to extract cookies' },
        { status: 500 }
      )
    }

    if (!result.cookies) {
      logger.warn('No cookies found after authentication', { sessionId, url })

      return NextResponse.json(
        {
          error:
            'No cookies found after authentication. Please ensure you are logged in.'
        },
        { status: 404 }
      )
    }

    // Cookies are returned as semicolon-separated string, convert to Netscape format
    // Format: name=value; name2=value2
    const cookiePairs = result.cookies.split(';').map(c => c.trim())
    const netscapeCookies = cookiePairs
      .map(pair => {
        const [name, value] = pair.split('=')
        const domain = new URL(url).hostname
        // Netscape format: domain, flag, path, secure, expiration, name, value
        return `${domain}\tFALSE\t/\tFALSE\t0\t${name}\t${value ?? ''}`
      })
      .join('\n')

    const netscapeFormat = [
      '# Netscape HTTP Cookie File',
      '# This is a generated file! Do not edit.',
      '',
      netscapeCookies
    ].join('\n')

    logger.info('Cookies extracted successfully', {
      sessionId,
      url,
      cookieCount: cookiePairs.length
    })

    return NextResponse.json({
      success: true,
      cookies: netscapeFormat,
      sessionId
    })
  } catch (error) {
    logger.error('Error in extract-cookies endpoint', error)

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
