import { getAuthUser } from '@/lib/auth/helpers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { transcriptionMonitor } from '@/lib/monitoring/transcription-monitor'
import { logger } from '@/lib/utils/logger'

export interface TranscriptionMonitoringResponse {
  success: boolean
  activeJobs: any[]
  performanceStats: any
  recentAlerts: any[]
  timestamp: string
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

/**
 * GET /api/admin/transcription-monitoring
 *
 * Get transcription monitoring information
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user (admin only)
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Unauthorized',
          details: ['Authentication required']
        },
        { status: 401 }
      )
    }

    // TODO: Add admin role check
    // For now, allow any authenticated user

    // Get monitoring data
    const activeJobs = transcriptionMonitor.getActiveJobs()
    const performanceStats = transcriptionMonitor.getPerformanceStats()
    const recentAlerts = transcriptionMonitor.getRecentAlerts(20)

    const response: TranscriptionMonitoringResponse = {
      success: true,
      activeJobs: activeJobs.map(job => ({
        uploadId: job.uploadId,
        userId: job.userId,
        fileName: job.fileName,
        status: job.status,
        startTime: job.startTime,
        events: job.events.length,
        errors: job.errors.length
      })),
      performanceStats,
      recentAlerts: recentAlerts.map(alert => ({
        id: alert.id,
        uploadId: alert.uploadId,
        type: alert.type,
        message: alert.message,
        timestamp: alert.timestamp
      })),
      timestamp: new Date().toISOString()
    }

    logger.info('[TranscriptionMonitoringAPI] Monitoring data retrieved', {
      activeJobs: activeJobs.length,
      performanceStats
    })

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    logger.error('[TranscriptionMonitoringAPI] Failed to get monitoring data', {
      error
    })

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Failed to get monitoring data',
        details: [errorMessage]
      },
      { status: 500 }
    )
  }
}
