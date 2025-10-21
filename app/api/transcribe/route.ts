import { createClient } from '@/services/supabase/server'
import { getAuthUser } from '@/lib/auth/helpers'
import { NextRequest, NextResponse } from 'next/server'
import { processTranscriptionJob } from '@/lib/transcription/worker'

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
import { logger } from '@/lib/utils/logger'
  let uploadId: string | undefined
  
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

    // Parse request body
    const body = await request.json()
    uploadId = body.uploadId

    if (!uploadId) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: ['uploadId is required'],
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
          details: ['Upload not found or access denied'],
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
            wordCount: (existingTranscription as any).word_count,
          },
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
          details: ['Transcription already in progress'],
        },
        { status: 409 }
      )
    }

    // Start transcription job (synchronous for simplicity)
    // In production, this should be async/queued
    const result = await processTranscriptionJob({
      uploadId: upload.id,
      filePath: upload.file_path,
      fileName: upload.filename,
      userId: user.id,
    })

    if (!result.success) {
      logger.error('[TranscribeAPI] Transcription worker failed', result.error)
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Transcription failed',
          details: [result.error || 'Unknown error'],
        },
        { status: 500 }
      )
    }

    logger.info('[TranscribeAPI] Transcription completed, fetching result...')
    logger.info('[TranscribeAPI] Transcription ID:', result.transcriptionId)

    // Get the transcription result
    const { data: transcriptionData, error: fetchError } = await supabase
      .from('transcriptions')
      .select('id, raw_text, word_count')
      .eq('id', result.transcriptionId!)
      .eq('user_id', user.id)  // Add explicit user_id filter for RLS
      .maybeSingle()

    logger.info('[TranscribeAPI] Fetch result:', {
      hasData: !!transcriptionData,
      error: fetchError,
    })

    if (fetchError) {
      logger.error('[TranscribeAPI] Error fetching transcription', fetchError)
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Failed to fetch transcription',
          details: [fetchError.message],
        },
        { status: 500 }
      )
    }

    if (!transcriptionData) {
      logger.error('[TranscribeAPI] Transcription not found in database')
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Transcription not found',
          details: ['Transcription completed but record not found'],
        },
        { status: 500 }
      )
    }

    const transcription = transcriptionData as {
      id: string
      raw_text: string
      word_count: number
    }

    return NextResponse.json<TranscribeResponse>(
      {
        success: true,
        message: 'Transcription completed successfully',
        transcription: {
          id: transcription.id,
          text: transcription.raw_text,
          wordCount: transcription.word_count,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('[TranscribeAPI] Unexpected transcription error', error)
    
    // Extract detailed error information
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    logger.error('[TranscribeAPI] Error details', {
      message: errorMessage,
      stack: errorStack,
      uploadId,
    })
    
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: [
          'An unexpected error occurred during transcription',
          `Error: ${errorMessage}`,
        ],
      },
      { status: 500 }
    )
  }
}
