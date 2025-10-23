import { logger } from '@/lib/utils/logger'

/**
 * API Route: List API keys with filtering and pagination
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getEnrichedScrapedKeys } from '@/lib/api-keys/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Check if required environment variables are available
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return NextResponse.json(
        { error: 'Database configuration missing' },
        { status: 503 }
      )
    }

    const { searchParams } = new URL(request.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const status = searchParams.get('status') // 'valid', 'invalid', 'pending'
    const source = searchParams.get('source') // 'github', 'gist'
    const search = searchParams.get('search') // search term

    const keys = await getEnrichedScrapedKeys(limit, offset)

    // Apply filters (this would be done in the database query in a real implementation)
    let filteredKeys = keys

    if (status) {
      if (status === 'valid') {
        filteredKeys = filteredKeys.filter(k => k.is_valid === true)
      } else if (status === 'invalid') {
        filteredKeys = filteredKeys.filter(k => k.is_valid === false)
      } else if (status === 'pending') {
        filteredKeys = filteredKeys.filter(
          k => k.validation_status === 'pending'
        )
      }
    }

    if (source) {
      filteredKeys = filteredKeys.filter(k => k.source === source)
    }

    if (search) {
      filteredKeys = filteredKeys.filter(
        k =>
          k.api_key.toLowerCase().includes(search.toLowerCase()) ||
          k.source_url?.toLowerCase().includes(search.toLowerCase())
      )
    }

    return NextResponse.json({
      keys: filteredKeys,
      pagination: {
        page,
        limit,
        total: filteredKeys.length, // This would be the total count from DB
        hasMore: filteredKeys.length === limit
      }
    })
  } catch (error: any) {
    logger.error('Failed to list API keys', error)
    return NextResponse.json(
      { error: 'Failed to fetch API keys' },
      { status: 500 }
    )
  }
}
