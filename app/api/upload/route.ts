import { getAuthUser } from '@/lib/auth/helpers'
import { uploadToTelegram, isTelegramConfigured } from '@/lib/telegram/storage'
import {
  uploadDocumentToFilesystem,
  saveUploadMetadata,
  updateTelegramBackupId,
} from '@/services/documents'
import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

// Supported file types
const SUPPORTED_MIME_TYPES = [
  'audio/mpeg', // .mp3
  'audio/wav', // .wav
  'audio/wave', // .wav alternative
  'audio/x-wav', // .wav alternative
  'audio/mp4', // .m4a
  'video/mp4', // .mp4
  'video/mpeg', // .mpeg
  'video/quicktime', // .mov
] as const

// No file size limit for audio uploads since they will be compressed into ZIP archives
// Telegram supports up to 4GB per file, which is more than sufficient for compressed archives

export interface UploadResponse {
  success: boolean
  message: string
  file?: {
    id: string
    filename: string
    size: number
    mimeType: string
    path: string
  }
}

export interface ErrorResponse {
  success: false
  error: string
  details?: string[]
}

/**
 * POST /api/upload
 * 
 * Protected endpoint for uploading audio/video files for transcription.
 * Requires authentication via middleware.
 * 
 * Accepts multipart/form-data with:
 * - file: Audio or video file (mp3, wav, mp4, etc.)
 * 
 * @returns Upload confirmation with file metadata
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
          details: ['Authentication required'],
        },
        { status: 401 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: ['No file provided'],
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size === 0) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: ['File is empty'],
        },
        { status: 400 }
      )
    }

    // Note: No file size limit imposed here since files will be compressed into ZIP archives
    // Telegram supports up to 4GB per file, which is more than sufficient for compressed archives

    // Validate MIME type
    if (!SUPPORTED_MIME_TYPES.includes(file.type as any)) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: [
            `Unsupported file type: ${file.type}`,
            `Supported types: ${SUPPORTED_MIME_TYPES.join(', ')}`,
          ],
        },
        { status: 400 }
      )
    }

    // Upload file to filesystem
    const uploadResult = await uploadDocumentToFilesystem(file, user.id)

    if (!uploadResult.success) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Upload failed',
          details: ['Failed to write file to disk'],
        },
        { status: 500 }
      )
    }

    const { fileId, filePath } = uploadResult

    // Store file metadata in database
    const metadataResult = await saveUploadMetadata(
      fileId,
      user.id,
      file.name,
      file.size,
      file.type,
      filePath
    )

    if (!metadataResult.success) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Upload failed',
          details: ['Failed to save file metadata'],
        },
        { status: 500 }
      )
    }

    // Upload to Telegram as backup (non-blocking)
    if (isTelegramConfigured()) {
      uploadToTelegram(filePath, file.name, file.size)
        .then(async (result) => {
          if (result.success && result.fileId) {
            // Update database with Telegram file ID
            const updateResult = await updateTelegramBackupId(fileId, result.fileId)
            if (!updateResult.success) {
              logger.error('Failed to update Telegram file ID', updateResult.error, { fileId })
            }
          } else {
            logger.warn('Telegram backup failed', { error: result.error })
          }
        })
        .catch((error) => {
          logger.error('Telegram upload error', error)
        })
    }

    // Return success response
    return NextResponse.json<UploadResponse>(
      {
        success: true,
        message: 'File uploaded successfully',
        file: {
          id: fileId,
          filename: file.name,
          size: file.size,
          mimeType: file.type,
          path: filePath,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Unexpected upload error', error)
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: ['An unexpected error occurred during upload'],
      },
      { status: 500 }
    )
  }
}
