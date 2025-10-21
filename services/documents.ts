import { createClient } from '@/services/supabase/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

export interface DocumentUploadResult {
import { logger } from '@/lib/utils/logger'
  success: boolean
  fileId: string
  filePath: string
  error?: string
}

/**
 * Uploads a document file to the local filesystem
 * Handles directory creation and file writing
 *
 * @param file - The file to upload
 * @param userId - The ID of the user uploading the file
 * @returns Upload result with file ID and path
 */
export async function uploadDocumentToFilesystem(
  file: File,
  userId: string
): Promise<DocumentUploadResult> {
  try {
    // Generate unique file ID and path
    const fileId = randomUUID()
    const fileExtension = file.name.split('.').pop() || 'bin'
    const safeFilename = `${fileId}.${fileExtension}`
    const uploadDir = join(process.cwd(), 'tmp', 'uploads', userId)
    const filePath = join(uploadDir, safeFilename)

    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true })

    // Read file data and write to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    return {
      success: true,
      fileId,
      filePath,
    }
  } catch (error) {
    logger.error('Filesystem upload error', error)
    return {
      success: false,
      fileId: '',
      filePath: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Saves document upload metadata to the database
 *
 * @param fileId - Unique file identifier
 * @param userId - User who uploaded the file
 * @param filename - Original filename
 * @param fileSize - File size in bytes
 * @param mimeType - MIME type of the file
 * @param filePath - Path where the file is stored
 * @returns Success status and any error
 */
export async function saveUploadMetadata(
  fileId: string,
  userId: string,
  filename: string,
  fileSize: number,
  mimeType: string,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await (supabase.from('uploads') as any).insert({
      id: fileId,
      user_id: userId,
      filename,
      file_size: fileSize,
      mime_type: mimeType,
      file_path: filePath,
      status: 'uploaded',
    })

    if (error) {
      logger.error('Database error', error)
      return {
        success: false,
        error: 'Failed to save file metadata',
      }
    }

    return { success: true }
  } catch (error) {
    logger.error('Save metadata error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Updates the Telegram backup file ID for an upload
 *
 * @param fileId - The upload file ID
 * @param telegramFileId - The Telegram file ID
 */
export async function updateTelegramBackupId(
  fileId: string,
  telegramFileId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()
    const { error } = await (supabase.from('uploads') as any)
      .update({ telegram_backup_file_id: telegramFileId })
      .eq('id', fileId)

    if (error) {
      logger.error('Failed to update Telegram file ID', error)
      return {
        success: false,
        error: 'Failed to update Telegram backup ID',
      }
    }

    return { success: true }
  } catch (error) {
    logger.error('Update Telegram ID error', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
