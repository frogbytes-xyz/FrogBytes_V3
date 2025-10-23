import { createClient } from '@/services/supabase/server'
import { getAuthUser } from '@/lib/auth/helpers'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { transcriptionQueue } from '@/lib/transcription/queue'
import { logger } from '@/lib/utils/logger'

export interface TranscribeResponse {
  success: boolean
  message: string
  transcription?: {
    id: string
    text: string
    wordCount: number
  }
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

/**
 * POST /api/transcribe
 *
 * Protected endpoint to start transcription of an uploaded file.
 * Requires authentication via middleware.
 *
 * Body:
 * - uploadId: UUID of the uploaded file
 *
 * @returns Transcription result
 */
export async function POST(request: NextRequest) {
  let uploadId: string | undefined

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

    // Parse request body
    const body = await request.json()
    uploadId = body.uploadId

    if (!uploadId) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: ['uploadId is required']
        },
        { status: 400 }
      )
    }

    // Get upload details
    const supabase = await createClient()
    const { data: uploadData, error: uploadError } = await supabase
      .from('uploads')
      .select('*')
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

    // Type assertion after null check
    const upload = uploadData as {
      id: string
      user_id: string
      file_path: string
      filename: string
      status: string
      [key: string]: any
    }

    // Check if already transcribed
    const { data: existingTranscription } = await supabase
      .from('transcriptions')
      .select('id, raw_text, word_count')
      .eq('upload_id', uploadId)
      .eq('status', 'completed')
      .single()

    if (existingTranscription) {
      return NextResponse.json<TranscribeResponse>(
        {
          success: true,
          message: 'File already transcribed',
          transcription: {
            id: (existingTranscription as any).id,
            text: (existingTranscription as any).raw_text,
            wordCount: (existingTranscription as any).word_count
          }
        },
        { status: 200 }
      )
    }

    // Check if currently processing
    if (upload.status === 'processing') {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Processing',
          details: ['Transcription already in progress']
        },
        { status: 409 }
      )
    }

    // Start transcription job asynchronously
    try {
      const jobId = await transcriptionQueue.enqueue({
        uploadId: upload.id,
        filePath: upload.file_path,
        fileName: upload.filename,
        userId: user.id
      })

      logger.info('[TranscribeAPI] Transcription job queued', {
        jobId,
        uploadId: upload.id
      })

      return NextResponse.json<TranscribeResponse>(
        {
          success: true,
          message: 'Transcription job started successfully',
          transcription: {
            id: jobId,
            text: '',
            wordCount: 0
          }
        },
        { status: 202 } // Accepted - processing started
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      logger.error('[TranscribeAPI] Failed to queue transcription job', {
        error: errorMessage
      })

      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Failed to start transcription',
          details: [errorMessage]
        },
        { status: 500 }
      )
    }
  } catch (error) {
    logger.error('[TranscribeAPI] Unexpected transcription error', { error })

    // Extract detailed error information
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined

    logger.error('[TranscribeAPI] Error details', {
      message: errorMessage,
      stack: errorStack,
      uploadId
    })

    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: [
          'An unexpected error occurred during transcription',
          `Error: ${errorMessage}`
        ]
      },
      { status: 500 }
    )
  }
}
