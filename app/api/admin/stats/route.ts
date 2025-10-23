import { createClient } from '@/services/supabase/server'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import {
  requireAdmin,
  logAdminAction,
  createAuditLogEntry
} from '@/lib/auth/admin-auth'

/**
 * GET /api/admin/stats
 *
 * Retrieve platform statistics (admin only)
 *
 * Returns comprehensive statistics including:
 * - User counts (total, active, new)
 * - File counts (uploads, transcriptions, summaries, PDFs)
 * - Storage usage metrics
 *
 * Returns:
 * - 200: Platform statistics object
 * - 401: User not authenticated
 * - 403: User lacks admin privileges
 * - 500: Server error
 *
 * Security: Requires admin role
 */
export const GET = requireAdmin(async (request: NextRequest, user) => {
  try {
    const supabase = await createClient()

    // Get user statistics
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { count: activeUsers24h } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', oneDayAgo)

    const sevenDaysAgo = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000
    ).toISOString()
    const { count: activeUsers7d } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('updated_at', sevenDaysAgo)

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const { count: newUsersToday } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())

    // Get file statistics
    const { count: totalTranscriptions } = await supabase
      .from('transcriptions')
      .select('*', { count: 'exact', head: true })

    const { count: totalSummaries } = await supabase
      .from('summaries')
      .select('*', { count: 'exact', head: true })

    const { count: summariesToday } = await supabase
      .from('summaries')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayStart.toISOString())

    // Count PDFs (summaries with pdf_url)
    const { count: totalPdfs } = await supabase
      .from('summaries')
      .select('*', { count: 'exact', head: true })
      .not('pdf_url', 'is', null)

    // Get storage statistics (if available)
    // Note: This requires database functions or aggregations
    // For now, we&apos;ll return mock data or 0
    const storageStats = {
      total_size_mb: 0,
      audio_files_mb: 0,
      pdf_files_mb: 0
    }

    const stats = {
      users: {
        total: totalUsers || 0,
        active_last_24h: activeUsers24h || 0,
        active_last_7d: activeUsers7d || 0,
        new_today: newUsersToday || 0
      },
      files: {
        total_uploads: totalTranscriptions || 0,
        total_transcriptions: totalTranscriptions || 0,
        total_summaries: totalSummaries || 0,
        total_pdfs: totalPdfs || 0,
        uploads_today: summariesToday || 0
      },
      storage: storageStats
    }

    // Log admin action
    await logAdminAction(
      createAuditLogEntry(
        request,
        user,
        'view_stats',
        'platform_statistics'
      )
    )

    return NextResponse.json({
      success: true,
      stats
    })
  } catch (error) {
    logger.error('Error fetching platform stats', { error })
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch platform statistics',
        stats: {
          users: {
            total: 0,
            active_last_24h: 0,
            active_last_7d: 0,
            new_today: 0
          },
          files: {
            total_uploads: 0,
            total_transcriptions: 0,
            total_summaries: 0,
            total_pdfs: 0,
            uploads_today: 0
          },
          storage: { total_size_mb: 0, audio_files_mb: 0, pdf_files_mb: 0 }
        }
      },
      { status: 500 }
    )
  }
})
