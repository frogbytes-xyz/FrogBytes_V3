import { logger } from '@/lib/utils/logger'

/**
 * Admin Dashboard API: Service Control
 * POST - Start/restart/stop scraper or validator
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

function verifyAdminAuth(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.ADMIN_API_KEY
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { service, action, limit, concurrency } = body

    if (!service || !action) {
      return NextResponse.json(
        { success: false, error: 'service and action are required' },
        { status: 400 }
      )
    }

    if (!['scraper', 'validator', 'revalidator'].includes(service)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid service. Must be "scraper" or "validator"'
        },
        { status: 400 }
      )
    }

    if (!['start', 'restart'].includes(action)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid action. Must be "start" or "restart"'
        },
        { status: 400 }
      )
    }

    // Trigger the appropriate cron job endpoint
    const endpoint =
      service === 'scraper'
        ? '/api/cron/scrape-keys'
        : service === 'validator'
          ? '/api/cron/validate-keys'
          : '/api/cron/revalidate-keys'

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ADMIN_API_KEY || '',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ limit: limit || 50, concurrency })
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Failed to trigger service')
    }

    return NextResponse.json({
      success: true,
      message: `${service} ${action}ed successfully`,
      data: result
    })
  } catch (error: any) {
    logger.error('Service control error', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
