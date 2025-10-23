import { getAuthUser } from '@/lib/auth/helpers'
import { downloadVideo } from '@/lib/video-download/downloader'
import { isValidVideoUrl } from '@/lib/video-download/validators'
import { uploadToTelegram, isTelegramConfigured } from '@/lib/telegram/storage'
import {
  saveUploadMetadata,
  updateTelegramBackupId
} from '@/services/documents'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import type { UploadResponse, ErrorResponse } from '../route'
import { logger } from '@/lib/utils/logger'

const MAX_FILE_SIZE = 500 * 1024 * 1024 // 500MB

/**
 * POST /api/upload/from-url
 *
 * Protected endpoint for downloading videos from URLs.
 * Downloads video using yt-dlp and processes it like a file upload.
 *
 * Accepts JSON with:
 * - url: Video URL (YouTube, Vimeo, etc.)
 *
 * @returns Upload confirmation with file metadata (same format as /api/upload)
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

    // Parse request body
    const body = await request.json()
    const url = body.url as string | undefined
    const cookies = body.cookies as string | undefined // Optional browser name for cookies (e.g., 'chrome', 'firefox')
    const cookieText = body.cookieText as string | undefined // Optional manual cookie text

    if (!url) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: ['No URL provided']
        },
        { status: 400 }
      )
    }

    // Validate URL
    const validation = isValidVideoUrl(url)
    if (!validation.isValid) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: [validation.error || 'Invalid video URL']
        },
        { status: 400 }
      )
    }

    // Download video
    const downloadOptions: {
      maxFileSize: number
      cookies?: string
      cookieText?: string
    } = {
      maxFileSize: MAX_FILE_SIZE
    }
    if (cookies) {
      downloadOptions.cookies = cookies
    }
    if (cookieText) {
      downloadOptions.cookieText = cookieText
    }

    const downloadResult = await downloadVideo(url, user.id, downloadOptions)

    if (!downloadResult.success) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Download failed',
          details: [downloadResult.error || 'Failed to download video']
        },
        { status: 500 }
      )
    }

    // Store file metadata in database (same as file upload)
    const metadataResult = await saveUploadMetadata(
      downloadResult.fileId,
      user.id,
      downloadResult.filename,
      downloadResult.size,
      downloadResult.mimeType,
      downloadResult.path
    )

    if (!metadataResult.success) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Upload failed',
          details: ['Failed to save file metadata']
        },
        { status: 500 }
      )
    }

    // Upload to Telegram as backup (non-blocking)
    if (isTelegramConfigured()) {
      uploadToTelegram(
        downloadResult.path,
        downloadResult.filename,
        downloadResult.size,
        downloadResult.metadata?.sourceUrl // Include source URL in caption
      )
        .then(async result => {
          if (result.success && result.fileId) {
            const updateResult = await updateTelegramBackupId(
              downloadResult.fileId,
              result.fileId
            )
            if (!updateResult.success) {
              logger.error(
                'Failed to update Telegram file ID',
                updateResult.error
              )
            }
          } else {
            logger.warn('Telegram backup failed', { error: result.error })
          }
        })
        .catch(error => {
          logger.error('Telegram upload error', error)
        })
    }

    // Return success response (same format as /api/upload)
    return NextResponse.json<UploadResponse>(
      {
        success: true,
        message: 'Video downloaded successfully',
        file: {
          id: downloadResult.fileId,
          filename: downloadResult.filename,
          size: downloadResult.size,
          mimeType: downloadResult.mimeType,
          path: downloadResult.path
        }
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error('Unexpected download error', error)
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Internal server error',
        details: ['An unexpected error occurred during download']
      },
      { status: 500 }
    )
  }
}
