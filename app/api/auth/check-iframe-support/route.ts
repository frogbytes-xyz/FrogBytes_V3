import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

/**
 * Response structure for iframe support check
 */
interface IframeSupportResponse {
  canEmbed: boolean
  reason?: string
  xFrameOptions?: string
  cspFrameAncestors?: string
}

/**
 * GET /api/auth/check-iframe-support?url=<encoded-url>
 *
 * Checks if a URL can be embedded in an iframe by examining response headers.
 * This endpoint makes a HEAD request to detect X-Frame-Options and CSP headers
 * before attempting to load the URL in an iframe.
 *
 * @param request - Next.js request containing the URL to check
 * @returns JSON response indicating whether the URL can be embedded
 *
 * @example
 * GET /api/auth/check-iframe-support?url=https://video.uva.nl/media/test
 * Response: { canEmbed: false, reason: "X-Frame-Options: DENY", xFrameOptions: "DENY" }
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<IframeSupportResponse>> {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')

  if (!targetUrl) {
    return NextResponse.json(
      {
        canEmbed: false,
        reason: 'URL parameter is required'
      },
      { status: 400 }
    )
  }

  try {
    logger.info(`Checking iframe support for: ${targetUrl}`)

    // Make a HEAD request to check headers without downloading content
    const response = await fetch(targetUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    })

    const xFrameOptions = response.headers.get('x-frame-options')?.toLowerCase()
    const csp = response.headers.get('content-security-policy')?.toLowerCase()

    // Extract frame-ancestors directive from CSP
    let cspFrameAncestors: string | undefined
    if (csp) {
      const match = csp.match(/frame-ancestors\s+([^;]+)/)
      if (match?.[1]) {
        cspFrameAncestors = match[1].trim()
      }
    }

    // Determine if embedding is possible
    let canEmbed = true
    let reason: string | undefined

    // Check X-Frame-Options
    if (xFrameOptions === 'deny') {
      canEmbed = false
      reason = 'Site blocks all iframe embedding (X-Frame-Options: DENY)'
    } else if (xFrameOptions === 'sameorigin') {
      canEmbed = false
      reason =
        'Site only allows same-origin iframe embedding (X-Frame-Options: SAMEORIGIN)'
    }

    // Check CSP frame-ancestors (overrides X-Frame-Options)
    if (cspFrameAncestors) {
      if (cspFrameAncestors.includes("'none'")) {
        canEmbed = false
        reason = 'Site blocks all iframe embedding (CSP: frame-ancestors none)'
      } else if (
        cspFrameAncestors.includes("'self'") &&
        !cspFrameAncestors.includes('*')
      ) {
        canEmbed = false
        reason =
          'Site only allows same-origin iframe embedding (CSP: frame-ancestors self)'
      }
    }

    logger.info(`Iframe support check result for ${targetUrl}:`, {
      canEmbed,
      xFrameOptions,
      cspFrameAncestors,
      reason
    })

    return NextResponse.json<IframeSupportResponse>({
      canEmbed,
      ...(reason ? { reason } : {}),
      ...(xFrameOptions ? { xFrameOptions } : {}),
      ...(cspFrameAncestors ? { cspFrameAncestors } : {})
    })
  } catch (error) {
    logger.error('Error checking iframe support:', error)

    return NextResponse.json<IframeSupportResponse>(
      {
        canEmbed: false,
        reason:
          error instanceof Error
            ? error.message
            : 'Failed to check iframe support'
      },
      { status: 500 }
    )
  }
}
