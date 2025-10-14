/**
 * Video downloader service using yt-dlp
 */

import { spawn } from 'child_process'
import { randomUUID } from 'crypto'
import { mkdir, stat, unlink, writeFile } from 'fs/promises'
import { join } from 'path'
import type { DownloadResult, VideoMetadata, DownloadProgress, DownloadOptions } from './types'
import { isValidVideoUrl } from './validators'

const UPLOAD_BASE_DIR = '/tmp/uploads'

/**
 * Download video from URL using yt-dlp
 */
export async function downloadVideo(
  url: string,
  userId: string,
  options: DownloadOptions = {}
): Promise<DownloadResult> {
  // Validate URL
  const validation = isValidVideoUrl(url)
  if (!validation.isValid) {
    return {
      success: false,
      fileId: '',
      filename: '',
      size: 0,
      mimeType: '',
      path: '',
      error: validation.error || 'Invalid URL'
    }
  }

  const fileId = randomUUID()
  const uploadDir = join(UPLOAD_BASE_DIR, userId)
  let cookieFilePath: string | undefined
  
  try {
    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true })
    
    // Handle manual cookie text by creating a temp file
    if (options.cookieText) {
      cookieFilePath = join(uploadDir, `${fileId}-cookies.txt`)
      await writeFile(cookieFilePath, options.cookieText, 'utf-8')
    }
    
    // First, get video metadata without downloading
    const metadata = await getVideoMetadata(url, options.cookies, cookieFilePath)
    
    if (!metadata) {
      // Clean up cookie file if it exists
      if (cookieFilePath) {
        await unlink(cookieFilePath).catch(() => {})
      }
      return {
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: 'Failed to retrieve video information. The video may be private or require authentication.'
      }
    }

    // Download the video
    const outputTemplate = join(uploadDir, `${fileId}.%(ext)s`)
        const downloadedPath = await downloadWithProgress(
          url,
          outputTemplate,
          options.onProgress,
          options.cookies,
          cookieFilePath ?? undefined
        )
    
    // Clean up cookie file after download attempt
    if (cookieFilePath) {
      await unlink(cookieFilePath).catch(() => {})
    }

    if (!downloadedPath) {
      return {
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: 'Download failed. Please try again.'
      }
    }

    // Get file stats
    const stats = await stat(downloadedPath)
    
    // Check file size if maxFileSize is specified
    if (options.maxFileSize && stats.size > options.maxFileSize) {
      // Clean up downloaded file
      await unlink(downloadedPath).catch(() => {})
      return {
        success: false,
        fileId: '',
        filename: '',
        size: 0,
        mimeType: '',
        path: '',
        error: `Video is too large (${(stats.size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${(options.maxFileSize / 1024 / 1024).toFixed(0)}MB.`
      }
    }

    // Determine MIME type from extension
    const extension = downloadedPath.split('.').pop()?.toLowerCase() || 'mp4'
    const mimeType = getMimeType(extension)
    
    // Generate filename from metadata or use generic name
    const filename = metadata.title 
      ? sanitizeFilename(metadata.title) + '.' + extension
      : `video-${fileId}.${extension}`

    return {
      success: true,
      fileId,
      filename,
      size: stats.size,
      mimeType,
      path: downloadedPath,
      metadata: {
        ...metadata,
        sourceUrl: url
      }
    }
  } catch (error) {
    return {
      success: false,
      fileId: '',
      filename: '',
      size: 0,
      mimeType: '',
      path: '',
      error: error instanceof Error ? error.message : 'An unexpected error occurred during download'
    }
  }
}

/**
 * Get video metadata using yt-dlp
 */
async function getVideoMetadata(url: string, cookies?: string, cookieFile?: string): Promise<VideoMetadata | null> {
  return new Promise((resolve) => {
    const args = [
      '--dump-json',
      '--no-warnings',
      '--no-playlist'
    ]

    // Add cookie support if provided
    if (cookieFile) {
      // Use manual cookie file (higher priority)
      args.push('--cookies', cookieFile)
    } else if (cookies) {
      // Use browser cookie extraction
      args.push('--cookies-from-browser', cookies)
    }

    args.push(url)
    
    const ytdlp = spawn('yt-dlp', args)

    let jsonData = ''
    
    ytdlp.stdout.on('data', (data: Buffer) => {
      jsonData += data.toString()
    })

    ytdlp.on('close', (code) => {
      if (code !== 0 || !jsonData) {
        resolve(null)
        return
      }

      try {
        const data = JSON.parse(jsonData) as {
          title?: string
          description?: string
          duration?: number
          uploader?: string
          channel?: string
          upload_date?: string
          thumbnail?: string
          extractor?: string
        }
        const metadata: VideoMetadata = {}
        if (data.title) metadata.title = data.title
        if (data.description) metadata.description = data.description
        if (data.duration) metadata.duration = data.duration
        const uploader = data.uploader ?? data.channel
        if (uploader) metadata.uploader = uploader
        if (data.upload_date) metadata.uploadDate = data.upload_date
        if (data.thumbnail) metadata.thumbnail = data.thumbnail
        if (data.extractor) metadata.platform = data.extractor
        resolve(metadata)
      } catch {
        resolve(null)
      }
    })

    ytdlp.on('error', () => {
      resolve(null)
    })
  })
}

/**
 * Download video with progress tracking
 */
async function downloadWithProgress(
  url: string,
  outputTemplate: string,
  onProgress?: (progress: DownloadProgress) => void,
  cookies?: string,
  cookieFile?: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const args = [
      '--format', 'best[ext=mp4]/best',
      '--output', outputTemplate,
      '--no-playlist',
      '--no-warnings',
      '--newline',
      '--progress'
    ]

    // Add cookie support if provided
    if (cookieFile) {
      // Use manual cookie file (higher priority)
      args.push('--cookies', cookieFile)
    } else if (cookies) {
      // Use browser cookie extraction
      args.push('--cookies-from-browser', cookies)
    }

    args.push(url)

    const ytdlp = spawn('yt-dlp', args)

    let finalPath: string | null = null

    ytdlp.stdout.on('data', (data: Buffer) => {
      const output = data.toString()
      
      // Parse progress from yt-dlp output
      const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%/)
      const sizeMatch = output.match(/\[download\]\s+(\d+\.?\d*)(Ki|Mi|Gi)?B of\s+(\d+\.?\d*)(Ki|Mi|Gi)?B/)
      const speedMatch = output.match(/at\s+(\S+\/s)/)
      const etaMatch = output.match(/ETA\s+(\S+)/)

      if (progressMatch?.[1] && onProgress) {
        const percentage = parseFloat(progressMatch[1])
        const progress: DownloadProgress = {
          percentage,
          downloaded: 0,
          total: 0
        }

        if (sizeMatch?.[1] && sizeMatch[3]) {
          progress.downloaded = parseSize(sizeMatch[1], sizeMatch[2])
          progress.total = parseSize(sizeMatch[3], sizeMatch[4])
        }

        if (speedMatch?.[1]) {
          progress.speed = speedMatch[1]
        }

        if (etaMatch?.[1]) {
          progress.eta = etaMatch[1]
        }

        onProgress(progress)
      }

      // Check for final destination message
      const destMatch = output.match(/\[download\] Destination: (.+)/)
      if (destMatch?.[1]) {
        finalPath = destMatch[1].trim()
      }

      // Also check for "already downloaded" message
      const alreadyMatch = output.match(/\[download\] (.+) has already been downloaded/)
      if (alreadyMatch?.[1]) {
        finalPath = alreadyMatch[1].trim()
      }
    })

    ytdlp.on('close', (code) => {
      if (code !== 0) {
        resolve(null)
        return
      }

      // If we captured the path, use it
      if (finalPath) {
        resolve(finalPath)
        return
      }

      // Otherwise, try to find the downloaded file
      const dir = outputTemplate.substring(0, outputTemplate.lastIndexOf('/'))
      const filePattern = outputTemplate.substring(outputTemplate.lastIndexOf('/') + 1)
      const fileId = filePattern.split('.')[0]
      
      // Common video extensions
      const extensions = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'flv']
      for (const ext of extensions) {
        const path = join(dir, `${fileId}.${ext}`)
        stat(path)
          .then(() => resolve(path))
          .catch(() => {})
      }

      // If we still haven't found it, return null
      setTimeout(() => resolve(null), 1000)
    })

    ytdlp.on('error', () => {
      resolve(null)
    })
  })
}

/**
 * Parse size string to bytes
 */
function parseSize(value: string, unit?: string): number {
  const num = parseFloat(value)
  if (!unit) return num
  
  const multipliers: Record<string, number> = {
    'Ki': 1024,
    'Mi': 1024 * 1024,
    'Gi': 1024 * 1024 * 1024
  }
  
  return num * (multipliers[unit] ?? 1)
}

/**
 * Get MIME type from file extension
 */
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    mp4: 'video/mp4',
    webm: 'video/webm',
    mkv: 'video/x-matroska',
    avi: 'video/x-msvideo',
    mov: 'video/quicktime',
    flv: 'video/x-flv',
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav'
  }
  
  return mimeTypes[extension] ?? 'video/mp4'
}

/**
 * Sanitize filename for safe filesystem usage
 */
function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9-_\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 100)
}

