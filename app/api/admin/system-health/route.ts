import { getAuthUser } from '@/lib/auth/helpers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { fileSystemMonitor } from '@/lib/utils/file-system-monitor'
import { cleanupManager } from '@/lib/utils/cleanup-manager'
import { logger } from '@/lib/utils/logger'

export interface SystemHealthResponse {
  success: boolean
  fileSystem: {
    activeOperations: number
    recentErrors: number
  }
  cleanup: {
    totalFiles: number
    totalSize: number
    status: string
  }
  timestamp: string
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

/**
 * GET /api/admin/system-health
 *
 * Get system health information for monitoring
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

    // Get file system monitoring stats
    const activeOperations = fileSystemMonitor.getActiveOperations()
    const recentErrors = activeOperations.filter(op => op.error).length

    // Get cleanup stats
    const cleanupStats = cleanupManager.getCleanupStats()

    const response: SystemHealthResponse = {
      success: true,
      fileSystem: {
        activeOperations: activeOperations.length,
        recentErrors
      },
      cleanup: {
        totalFiles: cleanupStats.totalFiles,
        totalSize: cleanupStats.totalSize,
        status: cleanupStats.lastCleanup
      },
      timestamp: new Date().toISOString()
    }

    logger.info('[SystemHealthAPI] Health check completed', response)

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    logger.error('[SystemHealthAPI] Health check failed', { error })

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Health check failed',
        details: [errorMessage]
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/system-health/cleanup
 *
 * Trigger manual cleanup
 */
export async function POST(request: NextRequest) {
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

    // Trigger manual cleanup
    const cleanupResult = await cleanupManager.performCleanup()

    logger.info('[SystemHealthAPI] Manual cleanup completed', cleanupResult)

    return NextResponse.json(
      {
        success: true,
        message: 'Cleanup completed',
        result: cleanupResult
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('[SystemHealthAPI] Manual cleanup failed', { error })

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Cleanup failed',
        details: [errorMessage]
      },
      { status: 500 }
    )
  }
}
