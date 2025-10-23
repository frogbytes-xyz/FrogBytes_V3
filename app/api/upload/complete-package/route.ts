/**
 * Complete Package Upload API Endpoint
 * POST /api/upload/complete-package
 *
 * Uploads the complete package (audio, transcription, PDF) to Telegram after
 * summary generation is complete. This is more efficient than uploading
 * individual files and avoids Telegram file size limits.
 */

import { getAuthUser } from '@/lib/auth/helpers'
import { createClient } from '@/services/supabase/server'
import { uploadCompletePackageWithMetadata } from '@/lib/telegram/metadata-storage'
import { isTelegramConfigured } from '@/lib/telegram/storage'
import { logger } from '@/lib/utils/logger'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

// Telegram configuration
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID || ''

const completePackageSchema = z.object({
  summaryId: z.string().uuid('Invalid summary ID'),
  uploadId: z.string().uuid('Invalid upload ID')
})

export interface CompletePackageResponse {
  success: boolean
  message: string
  telegramResult?: {
    archiveUploaded: boolean
    pdfUploaded: boolean
    archiveMessageId?: number
    pdfMessageId?: number
  }
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

/**
 * POST /api/upload/complete-package
 *
 * Uploads complete package to Telegram after summary completion
 */
export async function POST(request: NextRequest) {
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

    // Parse and validate request body
    const body = await request.json()
    const validation = completePackageSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: validation.error.errors.map(
            e => `${e.path.join('.')}: ${e.message}`
          )
        },
        { status: 400 }
      )
    }

    const { summaryId, uploadId } = validation.data

    // Check if Telegram is configured
    if (!isTelegramConfigured()) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Telegram not configured',
          details: ['Telegram backup is not available']
        },
        { status: 503 }
      )
    }

    // Get summary details
    const supabase = await createClient()
    const { data: summary, error: summaryError } = await supabase
      .from('summaries')
      .select(
        `
        id,
        title,
        upload_id,
        transcription_id,
        latex_content,
        summary_type,
        pdf_url,
        document_type,
        file_category,
        university,
        course_code,
        course_name,
        subject,
        professor,
        semester,
        academic_year,
        lecture_number,
        lecture_date,
        language,
        difficulty_level,
        tags,
        is_public,
        created_at
      `
      )
      .eq('id', summaryId)
      .eq('upload_id', uploadId)
      .single()

    if (summaryError || !summary) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Not found',
          details: ['Summary not found or access denied']
        },
        { status: 404 }
      )
    }

    // Get transcription details
    const { data: transcription, error: transcriptionError } = await supabase
      .from('transcriptions')
      .select(
        `
        id,
        upload_id,
        raw_text,
        word_count,
        duration_seconds,
        language,
        created_at
      `
      )
      .eq('id', (summary as any).transcription_id)
      .single()

    if (transcriptionError || !transcription) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Transcription not found',
          details: ['Associated transcription not found']
        },
        { status: 404 }
      )
    }

    // Get upload details
    const { data: upload, error: uploadError } = await supabase
      .from('uploads')
      .select(
        `
        id,
        user_id,
        filename,
        file_size,
        mime_type,
        file_path,
        created_at
      `
      )
      .eq('id', uploadId)
      .eq('user_id', user.id)
      .single()

    if (uploadError || !upload) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Upload not found',
          details: ['Associated upload not found']
        },
        { status: 404 }
      )
    }

    // Prepare metadata for Telegram upload
    const summaryData = summary as any
    const transcriptionData = transcription as any
    const uploadData = upload as any

    const metadata = {
      uploadId: uploadData.id,
      userId: user.id,
      summaryId: summaryData.id,
      title: summaryData.title || 'Untitled',
      originalFilename: uploadData.filename,
      documentType: summaryData.document_type || 'lecture',
      fileCategory: summaryData.file_category || 'lecture',
      university: summaryData.university,
      courseCode: summaryData.course_code,
      courseName: summaryData.course_name,
      subject: summaryData.subject,
      professor: summaryData.professor,
      semester: summaryData.semester,
      academicYear: summaryData.academic_year,
      lectureNumber: summaryData.lecture_number,
      lectureDate: summaryData.lecture_date,
      language: summaryData.language || 'en',
      difficultyLevel: summaryData.difficulty_level,
      tags: summaryData.tags || [],
      isPublic: summaryData.is_public || false,
      createdAt: summaryData.created_at
    }

    // File paths
    const audioPath = uploadData.file_path
    const transcriptionPath = `${process.cwd()}/tmp/transcriptions/${summaryData.transcription_id}.txt`
    const pdfPath = `${process.cwd()}/tmp/pdfs/${summaryData.id}.pdf`

    // Ensure transcription file exists
    const { promises: fs } = require('fs')
    try {
      await fs.access(transcriptionPath)
    } catch {
      // Create transcription file if it doesn't exist
      await fs.writeFile(transcriptionPath, transcriptionData.raw_text, 'utf8')
    }

    // Ensure PDF file exists
    try {
      await fs.access(pdfPath)
    } catch {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'PDF not found',
          details: ['PDF file not found on disk']
        },
        { status: 404 }
      )
    }

    // Upload complete package to Telegram
    logger.info('Starting complete package upload to Telegram', {
      summaryId: summaryData.id,
      uploadId: uploadData.id,
      audioPath,
      transcriptionPath,
      pdfPath
    })

    const uploadResult = await uploadCompletePackageWithMetadata(
      audioPath,
      transcriptionPath,
      pdfPath,
      metadata
    )

    if (!uploadResult.success) {
      logger.error('Complete package upload failed', uploadResult.error)
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Upload failed',
          details: [uploadResult.error || 'Unknown upload error']
        },
        { status: 500 }
      )
    }

    // Update database with Telegram file IDs and links
    const updateData: any = {
      telegram_archive_file_id: uploadResult.archiveResult?.fileId,
      telegram_archive_message_id: uploadResult.archiveResult?.messageId,
      telegram_pdf_file_id: uploadResult.pdfResult?.fileId,
      telegram_pdf_message_id: uploadResult.pdfResult?.messageId,
      telegram_backup_complete: true
    }

    // Create direct Telegram links if we have message IDs
    if (uploadResult.archiveResult?.messageId) {
      updateData.telegram_link = `https://t.me/c/${TELEGRAM_GROUP_ID?.replace('-100', '')}/${uploadResult.archiveResult.messageId}`
    }

    if (uploadResult.pdfResult?.messageId) {
      updateData.telegram_pdf_link = `https://t.me/c/${TELEGRAM_GROUP_ID?.replace('-100', '')}/${uploadResult.pdfResult.messageId}`
    }

    const { error: updateError } = await (supabase.from('summaries') as any)
      .update(updateData)
      .eq('id', summaryId)

    if (updateError) {
      logger.warn('Failed to update summary with Telegram IDs', {
        error: String(updateError)
      })
    }

    logger.info('Complete package uploaded successfully', {
      summaryId: summaryData.id,
      uploadId: uploadData.id,
      archiveUploaded: uploadResult.archiveResult?.success,
      pdfUploaded: uploadResult.pdfResult?.success
    })

    // Clean up local files after successful Telegram upload
    if (uploadResult.success && uploadResult.archiveResult?.success) {
      try {
        const { promises: fs } = require('fs')

        // Clean up local files
        const filesToCleanup = [audioPath, transcriptionPath, pdfPath]

        for (const filePath of filesToCleanup) {
          try {
            await fs.unlink(filePath)
            logger.info('Cleaned up local file', { filePath })
          } catch (error) {
            logger.warn('Failed to clean up local file', {
              filePath,
              error: String(error)
            })
          }
        }

        // Also clean up any temporary ZIP files if they exist
        const zipPath = `${process.cwd()}/tmp/archives/${summaryData.id}.zip`
        try {
          await fs.unlink(zipPath)
          logger.info('Cleaned up temporary ZIP file', { zipPath })
        } catch (error) {
          // ZIP file might not exist, which is fine
        }

        logger.info('Local file cleanup completed', {
          summaryId: summaryData.id,
          uploadId: uploadData.id
        })
      } catch (error) {
        logger.error('Error during local file cleanup', {
          error: String(error)
        })
        // Don't fail the request if cleanup fails
      }
    }

    return NextResponse.json<CompletePackageResponse>(
      {
        success: true,
        message: 'Complete package uploaded successfully',
        telegramResult: {
          archiveUploaded: uploadResult.archiveResult?.success || false,
          pdfUploaded: uploadResult.pdfResult?.success || false,
          ...(uploadResult.archiveResult?.messageId && {
            archiveMessageId: uploadResult.archiveResult.messageId
          }),
          ...(uploadResult.pdfResult?.messageId && {
            pdfMessageId: uploadResult.pdfResult.messageId
          })
        }
      },
      { status: 200 }
    )
  } catch (error) {
    logger.error('Complete package upload error', error)
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: ['An unexpected error occurred']
      },
      { status: 500 }
    )
  }
}
