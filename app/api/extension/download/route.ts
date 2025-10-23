import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/utils/logger'

/**
 * GET /api/extension/download?browser=chrome|firefox
 *
 * Downloads the FrogBytes Cookie Helper browser extension
 * for the specified browser (Chrome or Firefox).
 *
 * @param request - Next.js request with browser query parameter
 * @returns Extension file as download or error response
 *
 * @example
 * GET /api/extension/download?browser=chrome
 * Response: frogbytes-extension-chrome.zip file download
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const browser = searchParams.get('browser') || 'chrome'

    // Validate browser parameter
    if (browser !== 'chrome' && browser !== 'firefox') {
      return NextResponse.json(
        { error: 'Invalid browser. Use "chrome" or "firefox".' },
        { status: 400 }
      )
    }

    // Determine file path
    const fileName =
      browser === 'chrome'
        ? 'frogbytes-extension-chrome.zip'
        : 'frogbytes-extension-firefox.xpi'

    const filePath = join(process.cwd(), 'public', 'downloads', fileName)

    logger.info(`Serving extension download: ${fileName}`)

    // Read the file
    const fileBuffer = await readFile(filePath)

    // Determine content type
    const contentType =
      browser === 'chrome' ? 'application/zip' : 'application/x-xpinstall'

    // Return file as download
    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour
      }
    })
  } catch (error) {
    logger.error('Failed to serve extension download', error)

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to download extension'
      },
      { status: 500 }
    )
  }
}

/**
 * HEAD /api/extension/download
 *
 * Check if extension files are available
 *
 * @param request - Next.js request
 * @returns Empty response with status code
 */
export async function HEAD(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const browser = searchParams.get('browser') || 'chrome'

    const fileName =
      browser === 'chrome'
        ? 'frogbytes-extension-chrome.zip'
        : 'frogbytes-extension-firefox.xpi'

    const filePath = join(process.cwd(), 'public', 'downloads', fileName)

    // Check if file exists
    await readFile(filePath)

    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
