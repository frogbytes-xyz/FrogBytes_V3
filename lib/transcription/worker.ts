/**
 * Transcription Worker Logic
 * 
 * Handles the transcription process for uploaded files.
 */

import { createClient } from '@/services/supabase/server'
import { transcribeAudio, mockTranscription, isConfigured, isFreeEndpointAvailable, getEndpointInfo } from './elevenlabs'

export interface TranscriptionJob {
  uploadId: string
  filePath: string
  fileName: string
  userId: string
}

export interface TranscriptionJobResult {
  success: boolean
  transcriptionId?: string
  error?: string
}

/**
 * Process a transcription job
 * 
 * @param job - Transcription job details
 * @returns Result of the transcription process
 */
export async function processTranscriptionJob(
  job: TranscriptionJob
): Promise<TranscriptionJobResult> {
  const supabase = await createClient()

  try {
    // Update upload status to processing
    await (supabase
      .from('uploads') as any)
      .update({ status: 'processing' })
      .eq('id', job.uploadId)

    // Perform transcription
    // Priority: Authenticated API > Free API > Mock
    let result
    const endpointInfo = getEndpointInfo()
    
    if (isConfigured() || isFreeEndpointAvailable()) {
      console.log(`Using ElevenLabs ${endpointInfo.mode} endpoint for transcription`)
      try {
        result = await transcribeAudio(job.filePath, job.fileName)
      } catch (err: any) {
        const message = err?.message || String(err)
        console.warn('[Worker] ElevenLabs transcription failed, falling back to mock:', message)
        result = await mockTranscription(job.filePath, job.fileName)
      }
    } else {
      console.warn('ElevenLabs API not available, using mock transcription')
      result = await mockTranscription(job.filePath, job.fileName)
    }

    // Save transcription to database
    console.log('[Worker] Saving transcription to database...')
    console.log('[Worker] Transcription data:', {
      upload_id: job.uploadId,
      user_id: job.userId,
      text_length: result.text.length,
      language: result.language,
      duration_seconds: result.durationSeconds,
      word_count: result.wordCount,
    })
    
    const { data: transcription, error: insertError } = await (supabase
      .from('transcriptions') as any)
      .insert({
        upload_id: job.uploadId,
        user_id: job.userId,
        raw_text: result.text,
        language: result.language,
        duration_seconds: result.durationSeconds,
        word_count: result.wordCount,
        status: 'completed',
      })
      .select()
      .single()

    if (insertError) {
      console.error('[Worker] Database insert error:', insertError)
      throw new Error(`Failed to save transcription: ${insertError.message}`)
    }
    
    console.log('[Worker] Transcription saved successfully:', transcription.id)

    // Update upload status to transcribed
    await (supabase
      .from('uploads') as any)
      .update({ status: 'transcribed' })
      .eq('id', job.uploadId)

    return {
      success: true,
      transcriptionId: transcription.id,
    }
  } catch (error) {
    console.error('[Worker] Transcription job failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Worker] Error message:', errorMessage)

    // Update upload status to failed
    await (supabase
      .from('uploads') as any)
      .update({ status: 'failed' })
      .eq('id', job.uploadId)

    // Try to save error in transcriptions table
    try {
      await (supabase.from('transcriptions') as any).insert({
        upload_id: job.uploadId,
        user_id: job.userId,
        raw_text: '',
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
