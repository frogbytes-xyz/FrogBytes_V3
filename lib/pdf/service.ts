/**
 * PDF Generation and Storage Service
 * 
 * Handles the complete workflow:
 * 1. Compile LaTeX to PDF
 * 2. Create archive package (audio + transcription + PDF)
 * 3. Upload to Telegram storage (2 topics)
 * 4. Update database with Telegram links
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import { compileToPDF, type CompilationResult } from '@/lib/pdf/compiler'
import { uploadCompletePackage, getTelegramMessageLink, getTelegramFileLink } from '@/lib/telegram/storage'
import { createClient } from '@/services/supabase/server'

export interface PdfGenerationOptions {
  summaryId: string
  uploadId: string
  userId: string
  latexContent: string
  title?: string
  audioPath: string
  transcriptionText: string
}

export interface PdfGenerationResult {
  success: boolean
  pdfUrl?: string
  telegramArchiveLink?: string
  telegramPdfLink?: string
  error?: string
}

/**
 * Generate PDF and upload complete package to Telegram storage
 */
export async function generateAndStorePdf(
  options: PdfGenerationOptions
): Promise<PdfGenerationResult> {
  const supabase = await createClient()
  
  try {
    console.log('[PDF Service] Starting PDF generation for summary:', options.summaryId)
    
    // Create temporary directory for PDF generation
    const tmpDir = join(process.cwd(), 'tmp', 'pdfs', options.userId)
    await fs.mkdir(tmpDir, { recursive: true })
    
    const pdfPath = join(tmpDir, `${options.summaryId}.pdf`)
    const txtPath = join(tmpDir, `${options.summaryId}.txt`)
    
    // Compile LaTeX to PDF
    console.log('[PDF Service] Compiling LaTeX to PDF...')
    const compilationResult: CompilationResult = await compileToPDF(
      options.latexContent,
      { title: options.title ?? 'Document' }
    )
    
    if (!compilationResult.success || !compilationResult.pdf) {
      throw new Error(`PDF compilation failed: ${compilationResult.error}`)
    }
    
    // Save PDF to temporary file
    await fs.writeFile(pdfPath, compilationResult.pdf)
    console.log('[PDF Service] PDF saved to:', pdfPath)
    
    // Save transcription text to temporary file
    await fs.writeFile(txtPath, options.transcriptionText, 'utf-8')
    console.log('[PDF Service] Transcription saved to:', txtPath)
    
    // Upload complete package to Telegram
    console.log('[PDF Service] Uploading to Telegram storage...')
    const uploadResult = await uploadCompletePackage(
      options.audioPath,
      txtPath,
      pdfPath,
      {
        uploadId: options.uploadId,
        userId: options.userId,
        summaryId: options.summaryId,
        title: options.title ?? 'Document',
      }
    )
    
    if (!uploadResult.success) {
      console.warn('[PDF Service] Telegram upload failed, continuing without Telegram links:', uploadResult.error)
    } else {
      console.log('[PDF Service] Upload successful!')
    }
    console.log('[PDF Service] Archive result:', uploadResult.archiveResult)
    console.log('[PDF Service] PDF result:', uploadResult.pdfResult)
    
    // Generate Telegram links
    const archiveLink = uploadResult.archiveResult?.messageId
      ? getTelegramMessageLink(
          uploadResult.archiveResult.messageId,
          uploadResult.archiveResult.messageThreadId
        )
      : undefined
    
    const pdfLink = uploadResult.pdfResult?.messageId
      ? getTelegramMessageLink(
          uploadResult.pdfResult.messageId,
          uploadResult.pdfResult.messageThreadId
        )
      : undefined
    
    // Get direct file link for PDF (for display in app)
    let pdfFileUrl: string | undefined
    if (uploadResult.pdfResult?.fileId) {
      pdfFileUrl = await getTelegramFileLink(uploadResult.pdfResult.fileId) || undefined
    }
    
    // Update database with Telegram information
    console.log('[PDF Service] Updating database with Telegram links...')
    const { error: updateError } = await (supabase
      .from('summaries') as any)
      .update({
        telegram_archive_message_id: uploadResult.archiveResult?.messageId,
        telegram_archive_file_id: uploadResult.archiveResult?.fileId,
        telegram_pdf_message_id: uploadResult.pdfResult?.messageId,
        telegram_pdf_file_id: uploadResult.pdfResult?.fileId,
        telegram_link: archiveLink,
        telegram_pdf_link: pdfLink,
        pdf_url: pdfFileUrl || pdfLink, // Use direct file link if available, otherwise message link
        file_size_bytes: compilationResult.pdf.length,
      })
      .eq('id', options.summaryId)
    
    if (updateError) {
      console.error('[PDF Service] Database update error:', updateError)
      // Don't throw - upload was successful, just logging failed
    }
    
    // Clean up temporary files
    await fs.unlink(pdfPath).catch(err => 
      console.warn('[PDF Service] Failed to delete temporary PDF:', err)
    )
    await fs.unlink(txtPath).catch(err => 
      console.warn('[PDF Service] Failed to delete temporary text file:', err)
    )
    
    console.log('[PDF Service] Process complete!')
    
    const result: PdfGenerationResult = { success: true }

    const pdfUrlResult = pdfFileUrl || pdfLink
    if (pdfUrlResult) {
      result.pdfUrl = pdfUrlResult
    }

    if (archiveLink) {
      result.telegramArchiveLink = archiveLink
    }

    if (pdfLink) {
      result.telegramPdfLink = pdfLink
    }

    return result
  } catch (error) {
    console.error('[PDF Service] Error:', error)
    
    // Update summary with error status
    try {
      await (supabase
        .from('summaries') as any)
        .update({
          error_message: (error as Error).message,
        })
        .eq('id', options.summaryId)
    } catch {
      // Ignore errors updating error message
    }
    
    return {
      success: false,
      error: (error as Error).message || 'Unknown error during PDF generation',
    }
  }
}

/**
 * Get PDF URL from summary
 * Prioritizes direct file link over message link
 */
export async function getPdfUrl(summaryId: string): Promise<string | null> {
  const supabase = await createClient()
  
  try {
    const { data, error } = await (supabase
      .from('summaries') as any)
      .select('pdf_url, telegram_pdf_link, telegram_pdf_file_id')
      .eq('id', summaryId)
      .single()
    
    if (error || !data) {
      return null
    }
    
    // Return direct file URL if available
    if (data.pdf_url) {
      return data.pdf_url
    }
    
    // Try to get direct file link from Telegram
    if (data.telegram_pdf_file_id) {
      const fileLink = await getTelegramFileLink(data.telegram_pdf_file_id)
      if (fileLink) {
        // Cache the file link in database for future use
        await (supabase
          .from('summaries') as any)
          .update({ pdf_url: fileLink })
          .eq('id', summaryId)
          .catch(() => {}) // Ignore cache update errors
        
        return fileLink
      }
    }
    
    // Fall back to message link
    return data.telegram_pdf_link || null
  } catch (error) {
    console.error('[PDF Service] Error getting PDF URL:', error)
    return null
  }
}
