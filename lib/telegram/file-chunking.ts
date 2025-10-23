/**
 * Telegram File Chunking Utility
 *
 * Handles large file uploads to Telegram by splitting files into chunks
 * and uploading them as separate messages, then reconstructing them.
 *
 * Telegram Bot API limits:
 * - Videos: 50MB (bots), 2GB (users)
 * - Audio: 50MB (bots), 200MB (users)
 * - Documents: 50MB (bots), 2GB (users)
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import archiver from 'archiver'
import { logger } from '@/lib/utils/logger'

// Telegram Bot API file size limits (in bytes)
export const TELEGRAM_BOT_LIMITS = {
  VIDEO: 50 * 1024 * 1024, // 50MB
  AUDIO: 50 * 1024 * 1024, // 50MB
  DOCUMENT: 50 * 1024 * 1024, // 50MB
  PHOTO: 10 * 1024 * 1024 // 10MB
} as const

// Safe chunk size (slightly smaller than limit for safety)
export const SAFE_CHUNK_SIZE = 45 * 1024 * 1024 // 45MB

export interface ChunkInfo {
  chunkPath: string
  chunkIndex: number
  totalChunks: number
  chunkSize: number
  isLastChunk: boolean
}

export interface ChunkedUploadResult {
  success: boolean
  chunkResults: Array<{
    chunkIndex: number
    success: boolean
    messageId?: number
    fileId?: string
    error?: string
  }>
  error?: string
}

/**
 * Check if a file exceeds Telegram Bot API limits
 */
export function exceedsTelegramLimit(
  fileSize: number,
  fileType: 'video' | 'audio' | 'document'
): boolean {
  const limit =
    TELEGRAM_BOT_LIMITS[
      fileType.toUpperCase() as keyof typeof TELEGRAM_BOT_LIMITS
    ]
  return fileSize > limit
}

/**
 * Calculate the number of chunks needed for a file
 */
export function calculateChunkCount(
  fileSize: number,
  chunkSize: number = SAFE_CHUNK_SIZE
): number {
  return Math.ceil(fileSize / chunkSize)
}

/**
 * Split a file into chunks for Telegram upload
 */
export async function splitFileIntoChunks(
  filePath: string,
  chunkSize: number = SAFE_CHUNK_SIZE
): Promise<ChunkInfo[]> {
  const fileStats = await fs.stat(filePath)
  const totalSize = fileStats.size
  const totalChunks = calculateChunkCount(totalSize, chunkSize)

  const chunks: ChunkInfo[] = []
  const tmpDir = join(process.cwd(), 'tmp', 'chunks')
  await fs.mkdir(tmpDir, { recursive: true })

  const fileName = filePath.split('/').pop() || 'file'
  const baseName = fileName.split('.').slice(0, -1).join('.')
  const extension = fileName.split('.').pop() || ''

  for (let i = 0; i < totalChunks; i++) {
    const startByte = i * chunkSize
    const endByte = Math.min(startByte + chunkSize, totalSize)
    const actualChunkSize = endByte - startByte

    const chunkPath = join(
      tmpDir,
      `${baseName}_chunk_${i + 1}_of_${totalChunks}.${extension}`
    )

    // Read and write chunk
    const buffer = Buffer.alloc(actualChunkSize)
    const fileHandle = await fs.open(filePath, 'r')

    try {
      await fileHandle.read(buffer, 0, actualChunkSize, startByte)
      await fs.writeFile(chunkPath, buffer)
    } finally {
      await fileHandle.close()
    }

    chunks.push({
      chunkPath,
      chunkIndex: i,
      totalChunks,
      chunkSize: actualChunkSize,
      isLastChunk: i === totalChunks - 1
    })
  }

  logger.info(`Split file into ${totalChunks} chunks`, {
    filePath,
    totalSize,
    chunkSize,
    totalChunks
  })

  return chunks
}

/**
 * Create a manifest file describing the chunked upload
 */
export async function createChunkManifest(
  originalFilePath: string,
  chunks: ChunkInfo[],
  metadata: {
    uploadId: string
    userId: string
    summaryId: string
    title?: string
    originalSize: number
    chunkSize: number
  }
): Promise<string> {
  const manifest = {
    type: 'chunked_upload',
    version: '1.0',
    metadata: {
      uploadId: metadata.uploadId,
      userId: metadata.userId,
      summaryId: metadata.summaryId,
      title: metadata.title || 'Untitled',
      originalFileName: originalFilePath.split('/').pop(),
      originalSize: metadata.originalSize,
      chunkSize: metadata.chunkSize,
      totalChunks: chunks.length,
      createdAt: new Date().toISOString()
    },
    chunks: chunks.map(chunk => ({
      index: chunk.chunkIndex,
      path: chunk.chunkPath,
      size: chunk.chunkSize,
      isLastChunk: chunk.isLastChunk
    }))
  }

  const tmpDir = join(process.cwd(), 'tmp', 'manifests')
  await fs.mkdir(tmpDir, { recursive: true })

  const manifestPath = join(tmpDir, `${metadata.uploadId}_manifest.json`)
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

  return manifestPath
}

/**
 * Clean up chunk files and manifest
 */
export async function cleanupChunks(
  chunks: ChunkInfo[],
  manifestPath?: string
): Promise<void> {
  try {
    // Clean up chunk files
    for (const chunk of chunks) {
      try {
        await fs.unlink(chunk.chunkPath)
      } catch (error) {
        logger.warn('Failed to delete chunk file', {
          chunkPath: chunk.chunkPath,
          error
        })
      }
    }

    // Clean up manifest file
    if (manifestPath) {
      try {
        await fs.unlink(manifestPath)
      } catch (error) {
        logger.warn('Failed to delete manifest file', { manifestPath, error })
      }
    }
  } catch (error) {
    logger.warn('Error during chunk cleanup', { error: String(error) })
  }
}

/**
 * Compress file to reduce size before chunking
 */
export async function compressFileForTelegram(
  filePath: string,
  outputPath: string,
  compressionLevel: number = 9
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const output = require('fs').createWriteStream(outputPath)
    const archive = archiver('zip', {
      zlib: { level: compressionLevel }
    })

    output.on('close', () => {
      logger.debug(`Compressed file: ${archive.pointer()} bytes`)
      resolve(true)
    })

    archive.on('error', err => {
      reject(err)
    })

    archive.pipe(output)
    archive.file(filePath, { name: filePath.split('/').pop() || 'file' })
    archive.finalize()
  })
}
