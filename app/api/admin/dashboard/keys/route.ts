import { logger } from '@/lib/utils/logger'

/**
 * Admin Dashboard API: Scraped Keys
 * GET - Fetch all scraped keys with pagination and filtering
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

// Helper to format enriched key record to UI shape
function toUiRecord(p: any, working?: any) {
  const total_models_accessible = Array.isArray(working?.models_accessible)
    ? working.models_accessible.length
    : 0
  return {
    id: p.id,
    api_key: p.api_key,
    source: p.source,
    source_url: p.source_url,
    scraped_at: p.found_at || p.created_at,
    validation_status: p.validated ? 'processed' : 'pending',
    is_valid: working ? working.status === 'valid' : null,
    working_status: working?.status || null,
    last_validated_at: working?.last_validated_at || null,
    total_models_accessible,
    total_models_tested: total_models_accessible
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const status = searchParams.get('status') // pending, validating, processed
    const source = searchParams.get('source') // github, gist
    const isValid = searchParams.get('isValid') // true, false

    const supabase = getSupabaseClient()
    const offset = (page - 1) * limit

    // Optional filter by validity using working_gemini_keys
    let validKeys: string[] | null = null
    if (isValid === 'true' || isValid === 'false') {
      const { data: wk } = await supabase
        .from('working_gemini_keys')
        .select('api_key, status')
      const onlyValid = (wk || [])
        .filter(w => w.status === 'valid')
        .map(w => w.api_key)
      validKeys = onlyValid
    }

    // Build base query against potential_keys
    let potentialQuery = supabase
      .from('potential_keys')
      .select('*', { count: 'exact' })
      .order('found_at', { ascending: false })

    if (source) potentialQuery = potentialQuery.eq('source', source)

    if (status === 'pending' || status === 'validating') {
      potentialQuery = potentialQuery.eq('validated', false)
    } else if (status === 'processed') {
      potentialQuery = potentialQuery.eq('validated', true)
    }

    if (isValid === 'true' && validKeys) {
      potentialQuery = potentialQuery.in('api_key', validKeys)
    }
    if (isValid === 'false' && validKeys) {
      // processed but not valid (either invalid or quota_exceeded)
      // First ensure processed
      potentialQuery = potentialQuery
        .eq('validated', true)
        .not(
          'api_key',
          'in',
          `(${validKeys.map(v => `'${v}'`).join(',') || "''"})`
        )
    }

    // Apply range after filters
    potentialQuery = potentialQuery.range(offset, offset + limit - 1)

    const { data: potentialData, error, count } = await potentialQuery
    if (error) throw new Error(error.message)

    const apiKeys = (potentialData || []).map((k: any) => k.api_key)

    // Fetch working rows for keys on this page
    const workingMap = new Map<string, any>()
    if (apiKeys.length > 0) {
      const { data: workingRows } = await supabase
        .from('working_gemini_keys')
        .select('*')
        .in('api_key', apiKeys)
      ;(workingRows || []).forEach((w: any) => workingMap.set(w.api_key, w))
    }

    // Fetch recent revalidation outcomes per key (last 3) from logs
    const historyMap = new Map<string, any[]>()
    if (apiKeys.length > 0) {
      const { data: logs } = await supabase
        .from('api_key_logs')
        .select('api_key, details, created_at')
        .in('api_key', apiKeys)
        .in('log_type', ['validator', 'revalidator'])
        .order('created_at', { ascending: false })
        .limit(300)
      ;(logs || []).forEach((log: any) => {
        const arr = historyMap.get(log.api_key) || []
        const details = log.details || {}
        const outcome = details.outcome || details.newStatus || null
        if (outcome) {
          arr.push({
            outcome,
            at: log.created_at,
            prev: details.previousStatus || null,
            next: details.newStatus || null
          })
          if (arr.length > 3) arr.length = 3
          historyMap.set(log.api_key, arr)
        }
      })
    }

    const enriched = (potentialData || []).map((p: any) => {
      const working = workingMap.get(p.api_key)
      const ui = toUiRecord(p, working)
      return { ...ui, history: historyMap.get(p.api_key) || [] }
    })

    // Summary statistics
    const [pendingCountRes, processedCountRes, validCountRes, quotaCountRes] =
      await Promise.all([
        supabase
          .from('potential_keys')
          .select('id', { count: 'exact', head: true })
          .eq('validated', false),
        supabase
          .from('potential_keys')
          .select('id', { count: 'exact', head: true })
          .eq('validated', true),
        supabase
          .from('working_gemini_keys')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'valid'),
        supabase
          .from('working_gemini_keys')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'quota_exceeded')
      ])

    const total = (pendingCountRes.count || 0) + (processedCountRes.count || 0)
    const valid = validCountRes.count || 0
    const quota = quotaCountRes.count || 0
    const processed = processedCountRes.count || 0
    const invalid = Math.max(processed - valid - quota, 0)

    return NextResponse.json({
      success: true,
      data: enriched,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      },
      summary: {
        total,
        pending: pendingCountRes.count || 0,
        validating: 0,
        processed,
        valid,
        invalid
      }
    })
  } catch (error: any) {
    logger.error('Dashboard keys API error', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
