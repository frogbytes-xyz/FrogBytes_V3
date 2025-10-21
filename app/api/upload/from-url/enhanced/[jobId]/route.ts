/**
 * GET /api/upload/from-url/enhanced/[jobId]
 * 
 * Get the status of a video download job
 */

import { getAuthUser } from '@/lib/auth/helpers'
import { NextRequest, NextResponse } from 'next/server'

export interface JobStatusResponse {
  success: boolean
  message: string
  jobId: string
  status: 'processing' | 'authentication_required' | 'authentication_successful' | 'download_started' | 'completed' | 'failed'
  authRequired?: boolean
  authPerformed?: boolean
  platform?: string
  authMethod?: 'stored' | 'interactive' | 'none'
  cookiesExtracted?: number
  file?: {
    id: string
    filename: string
    size: number
    mimeType: string
    path: string
  }
  error?: string
  details?: string[]
  progress?: {
    percentage: number
    downloaded: number
    total: number
    speed?: string
    eta?: string
  }
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

// Import job status from the main route (in production, use Redis or database)
// For now, we'll create a simple in-memory store
const jobStatus = new Map<string, {
  status: JobStatusResponse['status']
  userId: string
  url: string
  startTime: number
  result?: any
  error?: string
  progress?: {
    percentage: number
    downloaded: number
    total: number
    speed?: string
    eta?: string
  }
}>()

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    // Get authenticated user
    const user = await getAuthUser(request)

    if (!user) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Unauthorized',
          details: ['Authentication required'],
        },
        { status: 401 }
      )
    }

    const { jobId } = await params

    if (!jobId) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: ['No job ID provided'],
        },
        { status: 400 }
      )
    }

    // Get job status
    const job = jobStatus.get(jobId)

    if (!job) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Job not found',
          details: ['Invalid job ID'],
        },
        { status: 404 }
      )
    }

    // Verify job belongs to user
    if (job.userId !== user.id) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Forbidden',
          details: ['Job does not belong to user'],
        },
        { status: 403 }
      )
    }

    // Prepare response
    const response: JobStatusResponse = {
      success: job.status === 'completed',
      message: getStatusMessage(job.status),
      jobId,
      status: job.status,
    }

    if (job.error) {
      response.error = job.error
    }

    if (job.progress) {
      response.progress = job.progress
    }

    if (job.result) {
      response.file = {
        id: job.result.fileId,
        filename: job.result.filename,
        size: job.result.size,
        mimeType: job.result.mimeType,
        path: job.result.path,
      }
      response.authRequired = job.result.authRequired
      response.authPerformed = job.result.authPerformed
      response.platform = job.result.platform
      response.authMethod = job.result.authMethod
      response.cookiesExtracted = job.result.cookiesExtracted
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Unexpected job status error:', error)
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: ['An unexpected error occurred while checking job status'],
      },
      { status: 500 }
    )
  }
}

/**
 * Get human-readable status message
 */
function getStatusMessage(status: JobStatusResponse['status']): string {
  switch (status) {
    case 'processing':
      return 'Processing video download request'
    case 'authentication_required':
      return 'Authentication required for this video'
    case 'authentication_successful':
      return 'Authentication completed successfully'
    case 'download_started':
      return 'Video download in progress'
    case 'completed':
      return 'Video download completed successfully'
    case 'failed':
      return 'Video download failed'
    default:
      return 'Unknown status'
  }
}

// Export job status map for use in the main route
export { jobStatus }
