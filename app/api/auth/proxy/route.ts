import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

/**
 * Comprehensive HTTP proxy that rewrites content and strips security headers
 *
 * This proxy handles:
 * 1. Main HTML page proxying with URL rewriting
 * 2. All resource requests (JS, CSS, images, etc.)
 * 3. X-Frame-Options and CSP header removal
 * 4. Base tag injection for proper resource loading
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const targetUrl = searchParams.get('url')
  const sessionId = searchParams.get('sessionId')

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: 'Session ID is required' },
      { status: 400 }
    )
  }

  try {
    logger.info('Proxying request', { targetUrl, sessionId })

    // Fetch the target URL with realistic browser headers
    const proxyHeaders = new Headers({
      'User-Agent':
        request.headers.get('user-agent') ||
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept:
        request.headers.get('accept') ||
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      DNT: '1',
      Connection: 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': request.headers.get('sec-fetch-dest') || 'document',
      'Sec-Fetch-Mode': request.headers.get('sec-fetch-mode') || 'navigate',
      'Sec-Fetch-Site': 'cross-site',
      'Cache-Control': 'no-cache'
    })

    // Forward cookies from client if any
    const clientCookies = request.headers.get('cookie')
    if (clientCookies) {
      proxyHeaders.set('Cookie', clientCookies)
    }

    // Forward referer
    const referer = request.headers.get('referer')
    if (referer) {
      // Rewrite referer to point to actual target domain
      try {
        const targetDomain = new URL(targetUrl)
        proxyHeaders.set(
          'Referer',
          `${targetDomain.protocol}//${targetDomain.host}/`
        )
      } catch {
        // Ignore invalid URLs
      }
    }

    logger.info('Fetching target URL', { targetUrl })

    const response = await fetch(targetUrl, {
      headers: proxyHeaders,
      redirect: 'follow',
      cache: 'no-store'
    })

    if (!response.ok) {
      logger.warn('Target URL returned error status', {
        status: response.status,
        statusText: response.statusText
      })
    }

    const contentType = response.headers.get('content-type') || ''

    // Build response headers, stripping security restrictions
    const responseHeaders = new Headers()

    // Copy safe headers from target response
    const headersToCopy = [
      'content-type',
      'content-language',
      'cache-control',
      'expires',
      'last-modified',
      'etag'
    ]

    for (const header of headersToCopy) {
      const value = response.headers.get(header)
      if (value) {
        responseHeaders.set(header, value)
      }
    }

    // CRITICAL: Do NOT copy these headers that block iframe:
    // - X-Frame-Options
    // - Content-Security-Policy (with frame-ancestors)
    // - X-Content-Type-Options (in some cases)

    // Set permissive headers
    responseHeaders.set('X-Frame-Options', 'ALLOWALL')
    responseHeaders.set('Access-Control-Allow-Origin', '*')
    responseHeaders.set('Access-Control-Allow-Credentials', 'true')
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    responseHeaders.set('Access-Control-Allow-Headers', '*')

    // For HTML content, inject base tag to fix relative URLs
    if (contentType.includes('text/html')) {
      let content = await response.text()

      const targetUrlObj = new URL(targetUrl)
      const baseUrl = `${targetUrlObj.protocol}//${targetUrlObj.host}`

      // Inject base tag right after <head> to make relative URLs work
      const baseTag = `<base href="${baseUrl}/">`

      if (content.includes('<head>')) {
        content = content.replace('<head>', `<head>${baseTag}`)
      } else if (content.includes('<HEAD>')) {
        content = content.replace('<HEAD>', `<HEAD>${baseTag}`)
      } else {
        // If no head tag, add it
        content = `<!DOCTYPE html><html><head>${baseTag}</head><body>${content}</body></html>`
      }

      logger.info('Injected base tag for HTML content', { baseUrl })

      return new NextResponse(content, {
        status: response.status,
        headers: responseHeaders
      })
    }

    // For non-HTML content (images, CSS, JS, etc.), return as-is
    const buffer = await response.arrayBuffer()

    logger.info('Proxy response prepared', {
      status: response.status,
      contentType,
      size: buffer.byteLength
    })

    return new NextResponse(buffer, {
      status: response.status,
      headers: responseHeaders
    })
  } catch (error) {
    logger.error('Proxy error', error)

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown proxy error'

    return new NextResponse(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Proxy Error</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .error {
              max-width: 600px;
              padding: 32px;
              background: white;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            h1 { color: #dc2626; margin-top: 0; }
            code { background: #f5f5f5; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Proxy Error</h1>
            <p>Failed to load the requested page:</p>
            <p><code>${targetUrl || 'unknown'}</code></p>
            <p><strong>Error:</strong> ${errorMessage}</p>
            <p>This usually happens when the site requires authentication or has special protections.</p>
            <p>Please try opening this page in a new tab instead.</p>
          </div>
        </body>
      </html>`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/html' }
      }
    )
  }
}
