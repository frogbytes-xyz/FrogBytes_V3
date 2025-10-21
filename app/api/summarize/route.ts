import { createClient } from '@/services/supabase/server'
import { getAuthUser } from '@/lib/auth/helpers'
import { NextRequest, NextResponse } from 'next/server'
import { processSummarizationJob } from '@/lib/summarization/worker'
import { z } from 'zod'

const summarizeSchema = z.object({
  transcriptionId: z.string().uuid('Invalid transcription ID'),
  summaryType: z.enum(['compact', 'detailed', 'expanded'], {
    errorMap: () => ({ message: 'Summary type must be: compact, detailed, or expanded' }),
  }),
})

export interface SummarizeResponse {
  success: boolean
  message: string
  summary?: {
    id: string
    latexContent: string
    summaryType: string
    chunkCount: number
    title?: string
  }
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

/**
 * POST /api/summarize
 * 
 * Protected endpoint to generate AI summary of a transcription.
 * Requires authentication via middleware.
 * 
 * Body:
 * - transcriptionId: UUID of the transcription
 * - summaryType: 'compact', 'detailed', or 'expanded'
 * 
 * @returns Summary result
 */
export async function POST(request: NextRequest) {
import { logger } from '@/lib/utils/logger'
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

    // Parse and validate request body
    const body = await request.json()
    const validation = summarizeSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
        },
        { status: 400 }
      )
    }

    const { transcriptionId, summaryType } = validation.data

    // Get transcription details
    const supabase = await createClient()
    const { data: transcription, error: transcriptionError } = await supabase
      .from('transcriptions')
      .select('id, user_id')
      .eq('id', transcriptionId)
      .eq('user_id', user.id)
      .single()

    if (transcriptionError || !transcription) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Not found',
          details: ['Transcription not found or access denied'],
        },
        { status: 404 }
      )
    }

    // Check if summary already exists for this type
    const { data: existingSummary } = await supabase
      .from('summaries')
      .select('id, latex_content, summary_type, chunk_count, title')
      .eq('transcription_id', transcriptionId)
      .eq('summary_type', summaryType)
      .eq('status', 'completed')
      .single()

    if (existingSummary) {
      return NextResponse.json<SummarizeResponse>(
        {
          success: true,
          message: 'Summary already exists',
          summary: {
            id: (existingSummary as any).id,
            latexContent: (existingSummary as any).latex_content,
            summaryType: (existingSummary as any).summary_type,
            chunkCount: (existingSummary as any).chunk_count,
            title: (existingSummary as any).title,
          },
        },
        { status: 200 }
      )
    }

    // Start summarization job (synchronous for simplicity)
    // In production, this should be async/queued
    const result = await processSummarizationJob({
      transcriptionId: (transcription as any).id,
      userId: user.id,
      summaryType,
    })

    if (!result.success) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Summarization failed',
          details: [result.error || 'Unknown error'],
        },
        { status: 500 }
      )
    }

    // Get the summary result
    const { data: summary } = await supabase
      .from('summaries')
      .select('id, latex_content, summary_type, chunk_count, title')
      .eq('id', result.summaryId!)
      .single()

    return NextResponse.json<SummarizeResponse>(
      {
        success: true,
        message: 'Summary generated successfully',
        summary: {
          id: (summary as any)!.id,
          latexContent: (summary as any)!.latex_content,
          summaryType: (summary as any)!.summary_type,
          chunkCount: (summary as any)!.chunk_count,
          title: (summary as any)!.title,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Unexpected summarization error', error)
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: ['An unexpected error occurred during summarization'],
      },
      { status: 500 }
    )
  }
}
