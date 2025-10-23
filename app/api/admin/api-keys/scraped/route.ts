import { logger } from '@/lib/utils/logger'

/**
 * Admin API: Get scraped keys statistics
 *
 * Returns stats about keys in the scraped_keys table
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get stats from scraped_keys table
    const [totalResult, pendingResult, validatingResult, processedResult] =
      await Promise.all([
        supabase
          .from('scraped_keys')
          .select('id', { count: 'exact', head: true }),
        supabase
          .from('scraped_keys')
          .select('id', { count: 'exact', head: true })
          .eq('validation_status', 'pending'),
        supabase
          .from('scraped_keys')
          .select('id', { count: 'exact', head: true })
          .eq('validation_status', 'validating'),
        supabase
          .from('scraped_keys')
          .select('id', { count: 'exact', head: true })
          .eq('validation_status', 'processed')
      ])

    // Get recent keys (last 10)
    const { data: recentKeys } = await supabase
      .from('scraped_keys')
      .select('api_key, source, validation_status, scraped_at')
      .order('scraped_at', { ascending: false })
      .limit(10)

    return NextResponse.json({
      success: true,
      stats: {
        total: totalResult.count || 0,
        pending: pendingResult.count || 0,
        validating: validatingResult.count || 0,
        processed: processedResult.count || 0
      },
      recentKeys:
        recentKeys?.map(k => ({
          key: `...${k.api_key.slice(-8)}`,
          source: k.source,
          status: k.validation_status,
          scrapedAt: k.scraped_at
        })) || [],
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    logger.error('Scraped keys stats API error', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message
      },
      { status: 500 }
    )
  }
}
