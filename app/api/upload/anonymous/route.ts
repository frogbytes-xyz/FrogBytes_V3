import { createClient } from '@/services/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

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

export interface AnonymousUploadResponse {
  success: boolean
  message: string
  uploadId: string
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
 * POST /api/upload/anonymous
 *
 * Public endpoint for uploading audio/video files for transcription.
 * No authentication required - creates anonymous uploads that can be claimed later.
 *
 * Accepts multipart/form-data with:
 * - file: Audio or video file (mp3, wav, mp4, etc.)
 *
 * @returns Upload confirmation with anonymous upload ID
 */
export async function POST(request: NextRequest) {
import { logger } from '@/lib/utils/logger'
  try {
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

    // Validate file size (500MB limit)
    const maxSize = 500 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Validation failed',
          details: [`File size exceeds maximum of ${maxSize / 1024 / 1024}MB`],
        },
        { status: 400 }
      )
    }

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

    // Generate unique upload ID and file ID
    const uploadId = randomUUID()
    const fileId = randomUUID()
    const fileExtension = file.name.split('.').pop() || 'bin'
    const safeFilename = `${fileId}.${fileExtension}`

    // Use anonymous directory for temporary storage
    const uploadDir = join(process.cwd(), 'tmp', 'uploads', 'anonymous', uploadId)
    const filePath = join(uploadDir, safeFilename)

    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true })

    // Read file data and write to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Store anonymous upload metadata in database
    const supabase = await createClient()
    const { error: dbError } = await (supabase.from('anonymous_uploads') as any).insert({
      id: uploadId,
      file_id: fileId,
      filename: file.name,
      file_size: file.size,
      mime_type: file.type,
      file_path: filePath,
      status: 'uploaded',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
    })

    if (dbError) {
      logger.error('Database error', dbError)
      return NextResponse.json<ErrorResponse>(
        {
          success: false,
          error: 'Upload failed',
          details: ['Failed to save file metadata'],
        },
        { status: 500 }
      )
    }

    return NextResponse.json<AnonymousUploadResponse>({
      success: true,
      message: 'File uploaded successfully',
      uploadId,
      file: {
        id: fileId,
        filename: file.name,
        size: file.size,
        mimeType: file.type,
        path: filePath,
      },
    })

  } catch (error) {
    logger.error('Anonymous upload error', error)
    return NextResponse.json<ErrorResponse>(
      {
        success: false,
        error: 'Upload failed',
        details: ['Internal server error'],
      },
      { status: 500 }
    )
  }
}