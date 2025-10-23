import { createClient } from '@/services/supabase/server'
import { getAuthUser } from '@/lib/auth/helpers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { transcriptionQueue } from '@/lib/transcription/queue'
import { logger } from '@/lib/utils/logger'

export interface TranscriptionStatusResponse {
  success: boolean
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'not_found'
  transcription?: {
    id: string
    text: string
    wordCount: number
  }
  error?: string
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

/**
 * GET /api/transcribe/status?uploadId=xxx
 *
 * Check the status of a transcription job
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
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

    // Get uploadId from query params
    const { searchParams } = new URL(request.url)
    const uploadId = searchParams.get('uploadId')

    if (!uploadId) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: ['uploadId query parameter is required']
        },
        { status: 400 }
      )
    }

    // Verify user owns this upload
    const supabase = await createClient()
    const { data: uploadData, error: uploadError } = await supabase
      .from('uploads')
      .select('id, user_id')
      .eq('id', uploadId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (uploadError || !uploadData) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Not found',
          details: ['Upload not found or access denied']
        },
        { status: 404 }
      )
    }

    // Check queue status
    const status = transcriptionQueue.getStatus(uploadId)

    if (status === 'not_found') {
      // Check if transcription exists in database
      const { data: transcriptionData } = await supabase
        .from('transcriptions')
        .select('id, raw_text, word_count, status')
        .eq('upload_id', uploadId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (transcriptionData) {
        if (transcriptionData.status === 'completed') {
          return NextResponse.json<TranscriptionStatusResponse>({
            success: true,
            status: 'completed',
            transcription: {
              id: transcriptionData.id,
              text: transcriptionData.raw_text,
              wordCount: transcriptionData.word_count
            }
          })
        } else if (transcriptionData.status === 'failed') {
          return NextResponse.json<TranscriptionStatusResponse>({
            success: true,
            status: 'failed',
            error: 'Transcription failed'
          })
        }
      }

      return NextResponse.json<TranscriptionStatusResponse>({
        success: true,
        status: 'not_found'
      })
    }

    if (status === 'completed') {
      const result = transcriptionQueue.getResult(uploadId)
      return NextResponse.json<TranscriptionStatusResponse>({
        success: true,
        status: 'completed',
        transcription: {
          id: result.transcriptionId,
          text: result.text || '',
          wordCount: result.wordCount || 0
        }
      })
    }

    if (status === 'failed') {
      const error = transcriptionQueue.getError(uploadId)
      return NextResponse.json<TranscriptionStatusResponse>({
        success: true,
        status: 'failed',
        error: error || 'Unknown error'
      })
    }

    // Return current status
    return NextResponse.json<TranscriptionStatusResponse>({
      success: true,
      status
    })
  } catch (error) {
    logger.error('[TranscribeStatusAPI] Unexpected error', { error })

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: [errorMessage]
      },
      { status: 500 }
    )
  }
}
