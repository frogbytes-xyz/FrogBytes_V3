/**
 * Telegram Cloud Storage Integration
 *
 * Provides primary storage for uploaded files, transcriptions, and PDFs using Telegram bot API.
 * Uses a group with 2 topics:
 * - Topic 1 (Archive): ZIP file containing audio, transcription text, and PDF
 * - Topic 2 (PDFs): Quick access to PDF files only
 */

import { Telegraf } from 'telegraf'
import { createReadStream, createWriteStream, promises as fs } from 'fs'
import { join } from 'path'
import archiver from 'archiver'
import * as https from 'https'
import * as http from 'http'
import { logger } from '@/lib/utils/logger'

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const TELEGRAM_GROUP_ID = process.env.TELEGRAM_GROUP_ID || ''
const TELEGRAM_ARCHIVE_TOPIC_ID = process.env.TELEGRAM_ARCHIVE_TOPIC_ID || ''
const TELEGRAM_PDF_TOPIC_ID = process.env.TELEGRAM_PDF_TOPIC_ID || ''

export interface TelegramUploadResult {
  success: boolean
  fileId?: string
  messageId?: number
  messageThreadId?: number
  error?: string
}

export interface TelegramArchiveUploadResult {
  success: boolean
  archiveResult?: TelegramUploadResult
  pdfResult?: TelegramUploadResult
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

  // Configure API root and protocol-aware agent
  const botOptions: any = { telegram: {} }
  const apiRoot = process.env.TELEGRAM_API_ROOT || 'https://api.telegram.org'
  botOptions.telegram.apiRoot = apiRoot

  const apiUrl = new URL(apiRoot)
  let selectedAgent: https.Agent | http.Agent | undefined

  if (apiUrl.protocol === 'https:') {
    const agentOptions: https.AgentOptions = {}
    if (
      process.env.TELEGRAM_INSECURE_TLS === '1' ||
      process.env.TELEGRAM_INSECURE_TLS === 'true'
    ) {
      logger.warn(
        'Telegram: TLS verification disabled via TELEGRAM_INSECURE_TLS'
      )
      agentOptions.rejectUnauthorized = false
    }
    selectedAgent = new https.Agent(agentOptions)
  } else if (apiUrl.protocol === 'http:') {
    selectedAgent = new http.Agent()
  } else {
    throw new Error(
      `Unsupported protocol in TELEGRAM_API_ROOT: ${apiUrl.protocol}`
    )
  }

  if (selectedAgent) {
    botOptions.telegram.agent = selectedAgent
  }

  return new Telegraf(TELEGRAM_BOT_TOKEN, botOptions)
}

/**
 * Create a ZIP archive containing audio, transcription, and PDF
 */
export async function createArchive(
  audioPath: string,
  transcriptionPath: string,
  pdfPath: string,
  outputPath: string
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    })

    output.on('close', () => {
      logger.debug(`Archive created: ${archive.pointer()} bytes`)
      resolve(true)
    })

    archive.on('error', err => {
      reject(err)
    })

    archive.pipe(output)

    // Add files to archive
    archive.file(audioPath, { name: `audio/${audioPath.split('/').pop()}` })
    archive.file(transcriptionPath, { name: 'transcription.txt' })
    archive.file(pdfPath, { name: 'summary.pdf' })

    archive.finalize()
  })
}

/**
 * Upload file to Telegram topic
 */
export async function uploadToTelegramTopic(
  filePath: string,
  fileName: string,
  fileSize: number,
  topicId: string,
  caption?: string
): Promise<TelegramUploadResult> {
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

  // Check file size limit (4GB = 4 * 1024 * 1024 * 1024 bytes for Telegram bots)
  const MAX_SIZE = 4 * 1024 * 1024 * 1024
  if (fileSize > MAX_SIZE) {
    return {
      success: false,
      error: `File size exceeds 4GB limit (${(fileSize / 1024 / 1024 / 1024).toFixed(2)}GB)`
    }
  }

  try {
    // Determine file type and upload accordingly
    const fileExt = fileName.split('.').pop()?.toLowerCase()
    const isVideo = ['mp4', 'mov', 'mpeg', 'avi', 'mkv'].includes(fileExt || '')
    const isAudio = ['mp3', 'wav', 'm4a', 'ogg'].includes(fileExt || '')

    const messageOptions: any = {
      caption:
        caption ||
        `${fileName}\nSize: ${(fileSize / 1024 / 1024).toFixed(2)}MB`,
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

    // Extract file_id from message
    let fileId: string | undefined
    if ('video' in message && message.video) {
      fileId = message.video.file_id
    } else if ('audio' in message && message.audio) {
      fileId = message.audio.file_id
    } else if ('document' in message && message.document) {
      fileId = message.document.file_id
    }

    const res: TelegramUploadResult = { success: true }
    if (fileId) res.fileId = fileId
    if (message.message_id) res.messageId = message.message_id
    if (message.message_thread_id)
      res.messageThreadId = message.message_thread_id
    return res
  } catch (error) {
    logger.error('Telegram upload error', error)
    return {
      success: false,
      error: (error as Error).message || 'Upload failed'
    }
  }
}

/**
 * Upload complete archive package to Telegram
 * - Uploads ZIP to Archive topic
 * - Uploads PDF to PDF topic for quick access
 */
export async function uploadCompletePackage(
  audioPath: string,
  transcriptionPath: string,
  pdfPath: string,
  metadata: {
    uploadId: string
    userId: string
    summaryId: string
    title?: string
  }
): Promise<TelegramArchiveUploadResult> {
  try {
    // Create temporary directory for archive
    const tmpDir = join(process.cwd(), 'tmp', 'archives')
    await fs.mkdir(tmpDir, { recursive: true })

    const archivePath = join(tmpDir, `${metadata.uploadId}.zip`)

    // Create ZIP archive
    logger.info('Creating archive...')
    await createArchive(audioPath, transcriptionPath, pdfPath, archivePath)

    // Get file stats
    const archiveStats = await fs.stat(archivePath)
    const pdfStats = await fs.stat(pdfPath)

    // Upload archive to Archive topic
    logger.info('Uploading archive to Topic 1 (Archive)...')
    const archiveCaption = [
      `📦 Complete Package`,
      `ID: ${metadata.uploadId}`,
      `Title: ${metadata.title || 'Untitled'}`,
      `User: ${metadata.userId}`,
      `Summary: ${metadata.summaryId}`,
      `Size: ${(archiveStats.size / 1024 / 1024).toFixed(2)}MB`
    ].join('\n')

    const archiveResult = await uploadToTelegramTopic(
      archivePath,
      `${metadata.uploadId}.zip`,
      archiveStats.size,
      TELEGRAM_ARCHIVE_TOPIC_ID,
      archiveCaption
    )

    if (!archiveResult.success) {
      throw new Error(
        `Failed to upload archive to storage: ${archiveResult.error}`
      )
    }

    // Upload PDF to PDF topic for quick access
    logger.info('Uploading PDF to Topic 2 (PDFs)...')
    const pdfCaption = [
      `${metadata.title || 'Untitled'}`,
      `ID: ${metadata.summaryId}`,
      `Upload: ${metadata.uploadId}`,
      `Size: ${(pdfStats.size / 1024 / 1024).toFixed(2)}MB`
    ].join('\n')

    const pdfResult = await uploadToTelegramTopic(
      pdfPath,
      `${metadata.summaryId}.pdf`,
      pdfStats.size,
      TELEGRAM_PDF_TOPIC_ID,
      pdfCaption
    )

    if (!pdfResult.success) {
      logger.warn('PDF upload failed, but archive was successful', {
        error: pdfResult.error
      })
    }

    // Clean up archive file
    await fs
      .unlink(archivePath)
      .catch(err => logger.warn('Failed to delete temporary archive', err))

    return {
      success: true,
      archiveResult,
      pdfResult
    }
  } catch (error) {
    logger.error('Complete package upload error', error)
    return {
      success: false,
      error: (error as Error).message || 'Package upload failed'
    }
  }
}

/**
 * Upload file to Telegram (legacy function for backward compatibility)
 */
export async function uploadToTelegram(
  filePath: string,
  fileName: string,
  fileSize: number,
  sourceUrl?: string
): Promise<TelegramUploadResult> {
  // Build caption with optional source URL
  const caption = sourceUrl
    ? `${fileName}\nSize: ${(fileSize / 1024 / 1024).toFixed(2)} MB\nSource: ${sourceUrl}`
    : `${fileName}\nSize: ${(fileSize / 1024 / 1024).toFixed(2)} MB`

  // Use archive topic as default
  return uploadToTelegramTopic(
    filePath,
    fileName,
    fileSize,
    TELEGRAM_ARCHIVE_TOPIC_ID,
    caption
  )
}

/**
 * Check if Telegram integration is fully configured
 */
export function isTelegramConfigured(): boolean {
  return !!(
    TELEGRAM_BOT_TOKEN &&
    TELEGRAM_GROUP_ID &&
    TELEGRAM_ARCHIVE_TOPIC_ID &&
    TELEGRAM_PDF_TOPIC_ID
  )
}

/**
 * Get file download link from Telegram
 * Returns a direct link that can be used to access the file
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

/**
 * Get direct message link to Telegram group topic
 * This creates a clickable link that opens the message in Telegram
 */
export function getTelegramMessageLink(
  messageId: number,
  topicId?: number
): string {
  const groupId = TELEGRAM_GROUP_ID.replace('-100', '')
  if (topicId) {
    return `https://t.me/c/${groupId}/${topicId}/${messageId}`
  }
  return `https://t.me/c/${groupId}/${messageId}`
}
