import { logger } from '@/lib/utils/logger'

/**
 * Admin Dashboard API: Working Keys (valid/quota_exceeded)
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function verifyAdminAuth(request: NextRequest): boolean {
  const apiKey = request.headers.get('x-api-key')
  return apiKey === process.env.ADMIN_API_KEY
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = getSupabaseClient()
    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status') as
      | 'valid'
      | 'quota_exceeded'
      | null
    const minQuotaCount = parseInt(searchParams.get('minQuotaCount') || '0')
    const minTokens = parseInt(searchParams.get('minTokens') || '0')

    const offset = (page - 1) * limit

    let query = supabase
      .from('working_gemini_keys')
      .select('*', { count: 'exact' })
      .order('last_validated_at', { ascending: false })

    if (status === 'valid' || status === 'quota_exceeded') {
      query = query.eq('status', status)
    }

    if (!isNaN(minQuotaCount) && minQuotaCount > 0) {
      query = query.gte('quota_count', minQuotaCount)
    }

    if (!isNaN(minTokens) && minTokens > 0) {
      query = query.gte('max_tokens', minTokens)
    }

    query = query.range(offset, offset + limit - 1)

    const { data, error, count } = await query
    if (error) throw new Error(error.message)

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    })
  } catch (error: any) {
    logger.error('Working keys API error', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
