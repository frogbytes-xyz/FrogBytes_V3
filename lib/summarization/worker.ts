import { logger } from '@/lib/utils/logger'

/**
 * Summarization Worker Logic
 * 
 * Handles the summarization process for transcriptions.
 * After summarization, automatically generates PDF and uploads to Telegram storage.
 */

import { createClient } from '@/services/supabase/server'
import { summarizeWithGemini, mockSummarization, isConfigured, type SummaryType } from './gemini'
import { generateAndStorePdf } from '@/lib/pdf/service'

export interface SummarizationJob {
  transcriptionId: string
  userId: string
  summaryType: SummaryType
}

export interface SummarizationJobResult {
  success: boolean
  summaryId?: string
  pdfUrl?: string
  telegramArchiveLink?: string
  telegramPdfLink?: string
  error?: string
}

/**
 * Process a summarization job
 * 
 * @param job - Summarization job details
 * @returns Result of the summarization process
 */
export async function processSummarizationJob(
  job: SummarizationJob
): Promise<SummarizationJobResult> {
  const supabase = await createClient()
  const startTime = Date.now()

  try {
    // Get transcription text and upload info
    const { data: transcriptionData, error: fetchError } = await supabase
      .from('transcriptions')
      .select('raw_text, upload_id, uploads(file_path)')
      .eq('id', job.transcriptionId)
      .maybeSingle()

    if (fetchError || !transcriptionData) {
      throw new Error('Transcription not found. It may have been deleted or does not exist')
    }

    const transcription = transcriptionData as { 
      raw_text: string
      upload_id: string
      uploads: { file_path: string }
    }

    // Perform summarization (use mock if API key not configured)
    let summResult: any
    const configured = await isConfigured()
    if (configured) {
      logger.info('[Worker] Using Gemini for summarization')
      summResult = await summarizeWithGemini({
        text: transcription.raw_text,
        summaryType: job.summaryType,
      })
    } else {
      logger.warn('[Worker] Gemini API key not configured, using mock summarization')
      summResult = await mockSummarization({
        text: transcription.raw_text,
        summaryType: job.summaryType,
      })
    }

    const processingTime = (Date.now() - startTime) / 1000

    // Extract title from LaTeX content (first section or chapter title)
    const titleMatch = summResult.latexContent.match(/\\(?:section|chapter)\{([^}]+)\}/)
    const extractedTitle = titleMatch ? titleMatch[1] : `Summary ${job.summaryType}`

    // Save summary to database
    const { data: summary, error: insertError } = await (supabase
      .from('summaries') as any)
      .insert({
        transcription_id: job.transcriptionId,
        user_id: job.userId,
        latex_content: summResult.latexContent,
        summary_type: job.summaryType,
        title: extractedTitle,
        chunk_count: summResult.chunkCount,
        total_tokens: summResult.totalTokens,
        processing_time_seconds: processingTime,
        status: 'completed',
      })
      .select()
      .single()

    if (insertError) {
      throw new Error(`Failed to save summary to database: ${insertError.message}`)
    }

    logger.info('[Worker] Summary saved successfully:', summary.id)

    // Generate PDF and upload to Telegram storage
    logger.info('[Worker] Generating PDF and uploading to Telegram...')
    const pdfResult = await generateAndStorePdf({
      summaryId: summary.id,
      uploadId: transcription.upload_id,
      userId: job.userId,
      latexContent: summResult.latexContent,
      title: String(extractedTitle),
      audioPath: transcription.uploads.file_path,
      transcriptionText: transcription.raw_text,
    })

    if (!pdfResult.success) {
      logger.error('[Worker] PDF generation/upload failed', pdfResult.error)
      // Don't fail the entire job - summary was created successfully
    } else {
      logger.info('[Worker] PDF generation and upload successful')
      logger.info('[Worker] PDF URL:', pdfResult.pdfUrl)
      logger.info('[Worker] Archive link:', pdfResult.telegramArchiveLink)
      logger.info('[Worker] PDF link:', pdfResult.telegramPdfLink)
    }

    const result: SummarizationJobResult = { success: true, summaryId: summary.id }
    if (pdfResult.pdfUrl) result.pdfUrl = pdfResult.pdfUrl
    if (pdfResult.telegramArchiveLink) result.telegramArchiveLink = pdfResult.telegramArchiveLink
    if (pdfResult.telegramPdfLink) result.telegramPdfLink = pdfResult.telegramPdfLink
    return result
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    logger.error('[Worker] Summarization job failed', errorMessage)

    // Try to save error in summaries table
    try {
      await (supabase.from('summaries') as any).insert({
        transcription_id: job.transcriptionId,
        user_id: job.userId,
        latex_content: '',
        summary_type: job.summaryType,
        chunk_count: 0,
        status: 'failed',
        error_message: errorMessage,
      })
    } catch {
      // Ignore error saving error state
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}
