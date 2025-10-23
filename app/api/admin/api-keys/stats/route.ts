import { logger } from '@/lib/utils/logger'

/**
 * API Route: Get API key validation statistics
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getValidationStats } from '@/lib/api-keys/database'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(_request: NextRequest) {
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

    const stats = await getValidationStats()

    // Build a simple time-bucketed series for valid vs quota_exceeded (last 24h hourly)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: seriesRaw } = await supabase
      .from('system_status')
      .select('created_at, service_name, stats')
      .gte('created_at', since)
      .eq('service_name', 'revalidator')
      .order('created_at', { ascending: true })

    const buckets: Record<string, { valid: number; quota_exceeded: number }> =
      {}
    ;(seriesRaw || []).forEach((row: any) => {
      const hour = new Date(row.created_at)
      hour.setMinutes(0, 0, 0)
      const key = hour.toISOString()
      if (!buckets[key]) buckets[key] = { valid: 0, quota_exceeded: 0 }
      const s = row.stats || {}
      // Approximate: use stillValid as valid and quotaExceeded as quota_exceeded
      buckets[key].valid += s.stillValid || 0
      buckets[key].quota_exceeded += s.quotaExceeded || 0
    })

    const series = Object.entries(buckets).map(([t, v]) => ({
      timestamp: t,
      ...v
    }))

    return NextResponse.json({
      ...stats,
      series,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    logger.error('Failed to get API key stats', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}
