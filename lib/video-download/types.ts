/**
 * Type definitions for video download functionality
 */

export interface DownloadResult {
  success: boolean
  fileId: string
  filename: string
  size: number
  mimeType: string
  path: string
  metadata?: VideoMetadata
  error?: string
  errorType?: 'auth' | 'network' | 'format' | 'timeout' | 'unknown'
}

export interface VideoMetadata {
  title?: string
  description?: string
  duration?: number
  uploader?: string
  uploadDate?: string
  thumbnail?: string
  platform?: string
  sourceUrl?: string
}

export interface DownloadProgress {
  percentage: number
  downloaded: number
  total: number
  speed?: string
  eta?: string
}

export interface ValidationResult {
  isValid: boolean
  error?: string
  platform?: string
}

export interface DownloadOptions {
  maxFileSize?: number
  onProgress?: (progress: DownloadProgress) => void
  cookies?: string // Browser name for yt-dlp --cookies-from-browser (e.g., 'chrome', 'firefox')
  cookieText?: string // Manual cookie text in Netscape or header format
}
