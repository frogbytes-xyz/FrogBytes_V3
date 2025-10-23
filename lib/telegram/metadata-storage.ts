import { logger } from '@/lib/utils/logger'

/**
 * Enhanced Telegram Storage with Metadata Management
 *
 * Provides organized file storage with comprehensive metadata tracking.
 * Topics:
 * - Topic 1 (Archive): Complete packages with metadata
 * - Topic 2 (PDFs): Quick access PDFs with detailed captions
 * - Topic 3 (Audio): Original audio files with metadata
 * - Topic 4 (Transcripts): Text transcriptions
 */

import { Telegraf } from 'telegraf'
import { createReadStream, createWriteStream, promises as fs } from 'fs'
import { join } from 'path'
import archiver from 'archiver'
import crypto from 'crypto'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID || ''
const TELEGRAM_ARCHIVE_TOPIC_ID = process.env.TELEGRAM_ARCHIVE_TOPIC_ID || ''
const TELEGRAM_PDF_TOPIC_ID = process.env.TELEGRAM_PDF_TOPIC_ID || ''
const TELEGRAM_AUDIO_TOPIC_ID = process.env.TELEGRAM_AUDIO_TOPIC_ID || ''
const TELEGRAM_TRANSCRIPT_TOPIC_ID =
  process.env.TELEGRAM_TRANSCRIPT_TOPIC_ID || ''

export interface DocumentMetadata {
  // Core identifiers
  uploadId: string
  userId: string
  summaryId: string

  // Document info
  title?: string
  documentType?: 'lecture' | 'tutorial' | 'seminar' | 'exam' | 'notes' | 'other'
  fileCategory?:
    | 'lecture'
    | 'notes'
    | 'slides'
    | 'handout'
    | 'assignment'
    | 'exam'
    | 'tutorial'
    | 'project'
    | 'other'

  // Educational metadata
  university?: string
  institutionId?: string
  courseCode?: string
  courseName?: string
  subject?: string
  professor?: string
  semester?: string
  academicYear?: string
  lectureNumber?: number
  lectureDate?: string

  // Classification
  language?: string
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced'
  tags?: string[]
  keywords?: string[]

  // File info
  originalFilename?: string
  fileSize?: number
  fileHash?: string
  duration?: number
}

export interface EnhancedUploadResult {
  success: boolean
  fileId?: string
  messageId?: number
  messageThreadId?: number
  messageLink?: string
  fileHash?: string
  error?: string
}

export interface CompletePackageResult {
  success: boolean
  archiveResult?: EnhancedUploadResult
  pdfResult?: EnhancedUploadResult
  audioResult?: EnhancedUploadResult
  transcriptResult?: EnhancedUploadResult
  totalSize?: number
  error?: string
}

/**
 * Initialize Telegram bot instance
 */
function createBot(): Telegraf | null {
  if (!TELEGRAM_BOT_TOKEN) {
    logger.warn('TELEGRAM_BOT_TOKEN not configured')
    return null
  }
  return new Telegraf(TELEGRAM_BOT_TOKEN)
}

/**
 * Calculate file hash for duplicate detection
 */
export async function calculateFileHash(filePath: string): Promise<string> {
  const hash = crypto.createHash('sha256')
  const stream = createReadStream(filePath)

  return new Promise((resolve, reject) => {
    stream.on('data', data => hash.update(data))
    stream.on('end', () => resolve(hash.digest('hex')))
    stream.on('error', reject)
  })
}

/**
 * Format metadata into a readable caption
 */
function formatMetadataCaption(
  metadata: DocumentMetadata,
  fileType: string
): string {
  const lines: string[] = []

  // Header based on type
  const typeLabel =
    {
      lecture: 'LECTURE',
      tutorial: 'TUTORIAL',
      seminar: 'SEMINAR',
      exam: 'EXAM',
      notes: 'NOTES',
      other: 'DOCUMENT'
    }[metadata.documentType || 'other'] || 'DOCUMENT'

  lines.push(`[${typeLabel}] ${fileType.toUpperCase()}`)
  lines.push('')

  // Title and basic info
  if (metadata.title) lines.push(`Title: ${metadata.title}`)
  if (metadata.documentType) lines.push(`Type: ${metadata.documentType}`)

  // Course information
  if (metadata.courseCode || metadata.courseName) {
    const course = [metadata.courseCode, metadata.courseName]
      .filter(Boolean)
      .join(' - ')
    lines.push(`Course: ${course}`)
  }

  if (metadata.subject) lines.push(`Subject: ${metadata.subject}`)
  if (metadata.professor) lines.push(`Professor: ${metadata.professor}`)

  // Academic context
  if (metadata.university) lines.push(`University: ${metadata.university}`)
  if (metadata.semester) lines.push(`Semester: ${metadata.semester}`)
  if (metadata.academicYear)
    lines.push(`Academic Year: ${metadata.academicYear}`)
  if (metadata.lectureNumber) lines.push(`Lecture ${metadata.lectureNumber}`)
  if (metadata.lectureDate) lines.push(`Date: ${metadata.lectureDate}`)

  // Classification
  if (metadata.difficultyLevel) lines.push(`Level: ${metadata.difficultyLevel}`)
  if (metadata.language && metadata.language !== 'en')
    lines.push(`Language: ${metadata.language}`)

  // Tags
  if (metadata.tags && metadata.tags.length > 0) {
    lines.push(`Tags: ${metadata.tags.slice(0, 5).join(', ')}`)
  }

  // Technical details
  lines.push('')
  lines.push(`ID: ${metadata.summaryId}`)
  if (metadata.fileSize) {
    lines.push(`Size: ${(metadata.fileSize / 1024 / 1024).toFixed(2)}MB`)
  }
  if (metadata.fileHash) {
    lines.push(`Hash: ${metadata.fileHash.substring(0, 16)}...`)
  }

  return lines.join('\n')
}

/**
 * Create enhanced archive with metadata
 */
export async function createEnhancedArchive(
  audioPath: string,
  transcriptionPath: string,
  pdfPath: string,
  outputPath: string,
  metadata: DocumentMetadata
): Promise<boolean> {
  return new Promise(async (resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', {
      zlib: { level: 9 }
    })

    output.on('close', () => {
      logger.info(`Enhanced archive created: ${archive.pointer()} bytes`)
      resolve(true)
    })

    archive.on('error', err => {
      reject(err)
    })

    archive.pipe(output)

    // Add metadata file
    const metadataJson = JSON.stringify(metadata, null, 2)
    archive.append(metadataJson, { name: 'metadata.json' })

    // Add README with human-readable metadata
    const readmeContent = `# ${metadata.title || 'Lecture Summary'}

## Course Information
${metadata.courseCode ? `- Course Code: ${metadata.courseCode}` : ''}
${metadata.courseName ? `- Course Name: ${metadata.courseName}` : ''}
${metadata.subject ? `- Subject: ${metadata.subject}` : ''}
${metadata.professor ? `- Professor: ${metadata.professor}` : ''}

## Academic Context
${metadata.university ? `- University: ${metadata.university}` : ''}
${metadata.semester ? `- Semester: ${metadata.semester}` : ''}
${metadata.academicYear ? `- Academic Year: ${metadata.academicYear}` : ''}
${metadata.lectureNumber ? `- Lecture Number: ${metadata.lectureNumber}` : ''}
${metadata.lectureDate ? `- Date: ${metadata.lectureDate}` : ''}

## Document Details
${metadata.documentType ? `- Type: ${metadata.documentType}` : ''}
${metadata.fileCategory ? `- Category: ${metadata.fileCategory}` : ''}
${metadata.difficultyLevel ? `- Difficulty: ${metadata.difficultyLevel}` : ''}
${metadata.language ? `- Language: ${metadata.language}` : ''}

## Tags
${metadata.tags ? metadata.tags.map(t => `- ${t}`).join('\n') : 'None'}

## Files Included
- audio/ - Original audio recording
- transcription.txt - Full text transcription
- summary.pdf - Formatted summary document

## Identifiers
- Upload ID: ${metadata.uploadId}
- Summary ID: ${metadata.summaryId}
- User ID: ${metadata.userId}
${metadata.fileHash ? `- File Hash: ${metadata.fileHash}` : ''}

Generated by FrogBytes
`
    archive.append(readmeContent, { name: 'README.md' })

    // Add files
    archive.file(audioPath, { name: `audio/${audioPath.split('/').pop()}` })
    archive.file(transcriptionPath, { name: 'transcription.txt' })
    archive.file(pdfPath, { name: 'summary.pdf' })

    await archive.finalize()
  })
}

/**
 * Upload file to Telegram with enhanced metadata
 */
export async function uploadWithMetadata(
  filePath: string,
  fileName: string,
  fileSize: number,
  topicId: string,
  metadata: DocumentMetadata,
  fileType: string
): Promise<EnhancedUploadResult> {
  const bot = createBot()

  if (!bot) {
    return {
      success: false,
      error: 'Telegram bot not configured'
    }
  }

  if (!TELEGRAM_GROUP_ID) {
    return {
      success: false,
      error: 'Telegram group ID not configured'
    }
  }

  // Check file size limit
  const MAX_SIZE = 4 * 1024 * 1024 * 1024 // 4GB
  if (fileSize > MAX_SIZE) {
    return {
      success: false,
      error: `File size exceeds 4GB limit (${(fileSize / 1024 / 1024 / 1024).toFixed(2)}GB)`
    }
  }

  try {
    // Determine file type
    const fileExt = fileName.split('.').pop()?.toLowerCase()
    const isVideo = ['mp4', 'mov', 'mpeg', 'avi', 'mkv'].includes(fileExt || '')
    const isAudio = ['mp3', 'wav', 'm4a', 'ogg'].includes(fileExt || '')

    const caption = formatMetadataCaption(metadata, fileType)
    const messageOptions: any = {
      caption,
      message_thread_id: parseInt(topicId)
    }

    let message
    if (isVideo) {
      message = await bot.telegram.sendVideo(
        TELEGRAM_GROUP_ID,
        { source: createReadStream(filePath) },
        messageOptions
      )
    } else if (isAudio) {
      message = await bot.telegram.sendAudio(
        TELEGRAM_GROUP_ID,
        { source: createReadStream(filePath) },
        messageOptions
      )
    } else {
      message = await bot.telegram.sendDocument(
        TELEGRAM_GROUP_ID,
        { source: createReadStream(filePath) },
        messageOptions
      )
    }

    // Extract file_id
    let fileId: string | undefined
    if ('video' in message && message.video) {
      fileId = message.video.file_id
    } else if ('audio' in message && message.audio) {
      fileId = message.audio.file_id
    } else if ('document' in message && message.document) {
      fileId = message.document.file_id
    }

    // Generate message link
    const groupId = TELEGRAM_GROUP_ID.replace('-100', '')
    const messageLink = `https://t.me/c/${groupId}/${topicId}/${message.message_id}`

    const uploadResult: EnhancedUploadResult = { success: true }
    if (fileId) uploadResult.fileId = fileId
    if (message.message_id) uploadResult.messageId = message.message_id
    if (message.message_thread_id)
      uploadResult.messageThreadId = message.message_thread_id
    uploadResult.messageLink = messageLink
    return uploadResult
  } catch (error) {
    logger.error('Telegram upload error', error)
    return {
      success: false,
      error: (error as Error).message || 'Upload failed'
    }
  }
}

/**
 * Upload complete package with enhanced metadata tracking
 */
export async function uploadCompletePackageWithMetadata(
  audioPath: string,
  transcriptionPath: string,
  pdfPath: string,
  metadata: DocumentMetadata
): Promise<CompletePackageResult> {
  try {
    // Calculate file hash for audio
    const fileHash = await calculateFileHash(audioPath)
    metadata.fileHash = fileHash

    // Create temporary directory for archive
    const tmpDir = join(process.cwd(), 'tmp', 'archives')
    await fs.mkdir(tmpDir, { recursive: true })

    const archivePath = join(tmpDir, `${metadata.uploadId}.zip`)

    // Create enhanced archive with metadata
    logger.info('Creating enhanced archive with metadata...')
    await createEnhancedArchive(
      audioPath,
      transcriptionPath,
      pdfPath,
      archivePath,
      metadata
    )

    // Get file stats
    const archiveStats = await fs.stat(archivePath)
    const pdfStats = await fs.stat(pdfPath)
    const audioStats = await fs.stat(audioPath)
    const transcriptStats = await fs.stat(transcriptionPath)

    const totalSize =
      archiveStats.size + pdfStats.size + audioStats.size + transcriptStats.size

    // Upload archive to Archive topic
    logger.info('Uploading archive to Topic 1 (Archive)...')
    const archiveResult = await uploadWithMetadata(
      archivePath,
      `${metadata.uploadId}.zip`,
      archiveStats.size,
      TELEGRAM_ARCHIVE_TOPIC_ID,
      metadata,
      'Archive'
    )

    if (!archiveResult.success) {
      throw new Error(
        `Failed to upload archive to storage: ${archiveResult.error}`
      )
    }

    // Upload PDF to PDF topic
    logger.info('Uploading PDF to Topic 2 (PDFs)...')
    const pdfResult = await uploadWithMetadata(
      pdfPath,
      `${metadata.summaryId}.pdf`,
      pdfStats.size,
      TELEGRAM_PDF_TOPIC_ID,
      metadata,
      'PDF'
    )

    if (!pdfResult.success) {
      logger.warn('PDF upload failed', { error: pdfResult.error })
    }

    // Upload audio to Audio topic if configured
    let audioResult: EnhancedUploadResult | undefined
    if (TELEGRAM_AUDIO_TOPIC_ID) {
      logger.info('Uploading audio to Topic 3 (Audio)...')
      audioResult = await uploadWithMetadata(
        audioPath,
        metadata.originalFilename || `${metadata.uploadId}.mp3`,
        audioStats.size,
        TELEGRAM_AUDIO_TOPIC_ID,
        metadata,
        'Audio'
      )

      if (!audioResult.success) {
        logger.warn('Audio upload failed', { error: audioResult.error })
      }
    }

    // Upload transcript to Transcript topic if configured
    let transcriptResult: EnhancedUploadResult | undefined
    if (TELEGRAM_TRANSCRIPT_TOPIC_ID) {
      logger.info('Uploading transcript to Topic 4 (Transcripts)...')
      transcriptResult = await uploadWithMetadata(
        transcriptionPath,
        `${metadata.summaryId}.txt`,
        transcriptStats.size,
        TELEGRAM_TRANSCRIPT_TOPIC_ID,
        metadata,
        'Transcript'
      )

      if (!transcriptResult.success) {
        logger.warn('Transcript upload failed', {
          error: transcriptResult.error
        })
      }
    }

    // Clean up archive file
    await fs
      .unlink(archivePath)
      .catch(err =>
        logger.warn('Failed to delete temporary archive', { error: err })
      )

    const result: CompletePackageResult = { success: true }
    result.totalSize = totalSize
    if (archiveResult) result.archiveResult = archiveResult
    if (pdfResult) result.pdfResult = pdfResult
    if (audioResult) result.audioResult = audioResult
    if (transcriptResult) result.transcriptResult = transcriptResult
    return result
  } catch (error) {
    logger.error('Complete package upload error', error)
    return {
      success: false,
      error: (error as Error).message || 'Package upload failed'
    }
  }
}

/**
 * Check if enhanced Telegram storage is configured
 */
export function isEnhancedStorageConfigured(): boolean {
  return !!(
    TELEGRAM_BOT_TOKEN &&
    TELEGRAM_GROUP_ID &&
    TELEGRAM_ARCHIVE_TOPIC_ID &&
    TELEGRAM_PDF_TOPIC_ID
  )
}

/**
 * Get file download link from Telegram
 */
export async function getTelegramFileLink(
  fileId: string
): Promise<string | null> {
  const bot = createBot()

  if (!bot) {
    return null
  }

  try {
    const file = await bot.telegram.getFile(fileId)
    if (file.file_path) {
      return `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${file.file_path}`
    }
    return null
  } catch (error) {
    logger.error('Error getting Telegram file link', error)
    return null
  }
}
