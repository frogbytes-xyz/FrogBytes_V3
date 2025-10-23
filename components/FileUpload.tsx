'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import LoginPromptDialog from '@/components/auth/LoginPromptDialog'
import MiniBrowser from '@/components/MiniBrowser'
import { logger } from '@/lib/utils/logger'

/**
 * Props for the FileUpload component
 */
interface FileUploadProps {
  /** Callback invoked when a file upload completes successfully with the file ID */
  onUploadComplete?: (fileId: string) => void
  /** Callback invoked when an upload error occurs with the error message */
  onUploadError?: (error: string) => void
  /** Optional initial file to auto-upload on mount */
  initialFile?: File | null
  /** Authenticated user object from Supabase auth, required for uploads */
  user?: any | null
}

/**
 * Upload mode type - file upload or URL download
 */
type UploadMode = 'file' | 'url'

/**
 * Detected platform metadata for URL uploads
 */
type DetectedPlatform = {
  name: string
  icon: string
  color: string
}

/**
 * FileUpload Component
 *
 * A comprehensive file upload component supporting both direct file uploads
 * and URL-based video downloads. Handles authentication flows via MiniBrowser
 * when video platforms require login.
 *
 * Features:
 * - Drag-and-drop file upload
 * - URL-based video download from 1000+ platforms
 * - Automatic authentication detection and handling
 * - Progress tracking and status updates
 * - Support for multiple media formats (MP3, WAV, MP4, M4A, MOV, MPEG)
 *
 * @param props - Component props
 * @returns JSX element for file upload interface
 *
 * @example
 * ```tsx
 * <FileUpload
 *   user={currentUser}
 *   onUploadComplete={(fileId) => handleSuccess(fileId)}
 *   onUploadError={(error) => handleError(error)}
 * />
 * ```
 */
export default function FileUpload({
  onUploadComplete,
  onUploadError,
  initialFile,
  user
}: FileUploadProps): JSX.Element {
  const [mode, setMode] = useState<UploadMode>('file')
  const [file, setFile] = useState<File | null>(initialFile || null)
  const [url, setUrl] = useState<string>('')
  const [detectedPlatform, setDetectedPlatform] =
    useState<DetectedPlatform | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)

  // MiniBrowser state for authentication
  const [showMiniBrowser, setShowMiniBrowser] = useState(false)
  const [authUrl, setAuthUrl] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasAutoUploaded = useRef(false)
  const urlInputRef = useRef<HTMLInputElement>(null)

  const supportedFormats = ['.mp3', '.wav', '.mp4', '.m4a', '.mov', '.mpeg']

  /**
   * Auto-paste URL from clipboard
   * Attempts to read clipboard content and populate the URL input field
   */
  const handlePasteFromClipboard = useCallback(async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setUrl(text)
        urlInputRef.current?.focus()
      }
    } catch (err) {
      logger.error('Failed to read clipboard', err)
    }
  }, [])

  /**
   * Handle URL input changes
   * Clears any existing errors when user types a new URL
   */
  const handleUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const newUrl = e.target.value
      setUrl(newUrl)
      setError(null)
    },
    []
  )

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const validateFile = (file: File): string | null => {
    const maxSize = 500 * 1024 * 1024 // 500MB
    const supportedTypes = [
      'audio/mpeg',
      'audio/wav',
      'audio/wave',
      'audio/x-wav',
      'audio/mp4',
      'video/mp4',
      'video/mpeg',
      'video/quicktime'
    ]

    if (file.size === 0) {
      return 'File is empty'
    }

    if (file.size > maxSize) {
      return `File size exceeds maximum of ${maxSize / 1024 / 1024}MB`
    }

    if (!supportedTypes.includes(file.type)) {
      return `Unsupported file type: ${file.type}. Supported formats: ${supportedFormats.join(', ')}`
    }

    return null
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)
      setError(null)
      setSuccess(false)

      if (e.dataTransfer.files?.[0]) {
        const droppedFile = e.dataTransfer.files[0]
        const validationError = validateFile(droppedFile)

        if (validationError) {
          setError(validationError)
          return
        }

        setFile(droppedFile)
      }
    },
    [validateFile]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSuccess(false)

    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0]
      const validationError = validateFile(selectedFile)

      if (validationError) {
        setError(validationError)
        return
      }

      setFile(selectedFile)
    }
  }

  /**
   * Handle MiniBrowser authentication errors
   * Called when authentication fails or user cancels
   * @param error - Error message from authentication failure
   */
  const handleAuthError = useCallback(
    (error: string): void => {
      logger.error('Authentication failed in MiniBrowser', new Error(error))
      setShowMiniBrowser(false)
      setError(
        `Authentication failed: ${error}. Please try again or contact support.`
      )
      setUploading(false)
      onUploadError?.(error)
    },
    [onUploadError]
  )

  /**
   * Handle URL upload initiation
   * Starts the video download process from the provided URL
   * Automatically handles authentication if required
   */
  const handleUrlUpload = useCallback(async (): Promise<void> => {
    // Check authentication first
    if (!user) {
      setShowLoginPrompt(true)
      return
    }

    if (!url) {
      setError('Please enter a video URL')
      return
    }

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      // Use the enhanced endpoint for automatic authentication
      const response = await fetch('/api/upload/from-url/enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ url })
      })

      const contentType = response.headers.get('content-type') || ''
      const raw = await response.text()
      let data: unknown = null

      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(raw)
        } catch {
          // Fall through with null data
        }
      }

      if (!response.ok) {
        let message = 'Download failed'
        if (data && typeof data === 'object' && data !== null) {
          const errorData = data as Record<string, unknown>
          const details = errorData.details
          const firstDetail =
            Array.isArray(details) && details.length > 0
              ? details[0]
              : undefined
          message = String(
            firstDetail ?? errorData.error ?? errorData.message ?? message
          )
        } else if (raw) {
          message = raw
        }

        throw new Error(message)
      }

      if (!data) {
        try {
          data = JSON.parse(raw)
        } catch {
          throw new Error(
            'Server returned an unexpected response. Please try again'
          )
        }
      }

      const result = data as {
        success: boolean
        jobId: string
        message: string
        status: string
      }
      if (!result.success || !result.jobId) {
        throw new Error(
          result.message ||
            'Upload failed. Please check your file and try again'
        )
      }

      // Start polling for job status
      await pollJobStatus(result.jobId)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Download failed'
      setError(errorMessage)
      onUploadError?.(errorMessage)
      setUploading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, user, onUploadComplete, onUploadError])

  /**
   * Handle MiniBrowser authentication completion
   * Called when user successfully authenticates via MiniBrowser
   * Retries the upload with captured cookies
   * @param _cookies - Captured authentication cookies (stored on backend)
   */
  const handleAuthComplete = useCallback(
    async (_cookies: string): Promise<void> => {
      logger.info('Authentication completed, retrying upload with cookies')
      setShowMiniBrowser(false)
      setError(null)

      // Use the authUrl that was stored when authentication was required
      if (authUrl) {
        logger.info('Retrying download with authenticated URL', {
          url: authUrl
        })
        setUrl(authUrl) // Set the URL state for the retry

        // The MiniBrowser authentication success triggers automatic retry
        // The backend session will have the cookies, so we just wait a moment
        // and retry the upload
        setTimeout(() => {
          void handleUrlUpload()
        }, 1000)
      } else {
        setError(
          'Authentication completed but URL is missing. Please try the download again.'
        )
        setUploading(false)
      }
    },
    [authUrl, handleUrlUpload]
  )

  /**
   * Poll job status for enhanced downloads
   * Monitors the backend download job and handles various statuses including authentication
   * @param jobId - Unique identifier for the download job
   */
  const pollJobStatus = useCallback(
    async (jobId: string): Promise<void> => {
      const maxAttempts = 60
      let attempts = 0

      const poll = async (): Promise<void> => {
        try {
          const response = await fetch(
            `/api/upload/from-url/enhanced/${jobId}`,
            {
              credentials: 'include'
            }
          )
          const data = await response.json()

          if (!response.ok) {
            throw new Error(
              data.error || 'Failed to check download status. Please try again'
            )
          }

          const jobData = data as {
            success: boolean
            status: string
            message: string
            progress?: { percentage: number }
            file?: { id: string }
            error?: string
          }

          logger.info(`Job status update for ${jobId}:`, {
            status: jobData.status,
            message: jobData.message,
            progress: jobData.progress,
            error: jobData.error
          })

          // Update progress if available
          if (jobData.progress) {
            setProgress(jobData.progress.percentage)
          }

          // Handle different statuses
          switch (jobData.status) {
            case 'processing':
              setProgress(10)
              break
            case 'authentication_required':
              setProgress(20)
              setUploading(false)

              // Show MiniBrowser for authentication
              logger.info('Authentication required, showing MiniBrowser')
              setAuthUrl(url)
              setShowMiniBrowser(true)
              return
            case 'authentication_successful':
              setProgress(40)
              setError(null)
              break
            case 'download_started':
              setProgress(60)
              break
            case 'completed':
              setProgress(100)
              setSuccess(true)
              setUploading(false)
              if (jobData.file?.id) {
                onUploadComplete?.(jobData.file.id)
              } else {
                throw new Error(
                  'Download completed but file information is missing. Please try again'
                )
              }
              return
            case 'failed':
              setUploading(false)

              // Check if the failure is due to authentication requirements
              const errorMessage =
                jobData.error ||
                'Download failed. Please check the URL and try again'
              const isAuthError =
                errorMessage.includes('authentication') ||
                errorMessage.includes('login') ||
                errorMessage.includes('private') ||
                errorMessage.includes('unauthorized') ||
                errorMessage.includes('forbidden') ||
                errorMessage.includes('signin') ||
                errorMessage.includes('auth') ||
                errorMessage.includes('Authentication required')

              if (isAuthError) {
                logger.info(
                  'Authentication error detected - triggering MiniBrowser'
                )
                setAuthUrl(url)
                setShowMiniBrowser(true)
                return
              }

              throw new Error(errorMessage)
            default:
              break
          }

          // Continue polling if not completed or failed
          attempts++
          if (attempts < maxAttempts) {
            setTimeout(() => void poll(), 5000)
          } else {
            setUploading(false)
            throw new Error(
              'Download is taking longer than expected. Please try again or contact support'
            )
          }
        } catch (error) {
          logger.error('Job polling error', error)
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to check download status. Please try again'
          setError(errorMessage)
          setUploading(false)
          onUploadError?.(errorMessage)
        }
      }

      void poll()
    },
    [url, onUploadComplete, onUploadError]
  )

  /**
   * Handle direct file upload
   * Uploads a selected file to the server
   */
  const handleUpload = useCallback(async (): Promise<void> => {
    // Check authentication first
    if (!user) {
      setShowLoginPrompt(true)
      return
    }

    if (!file) {
      setError('Please select a file')
      return
    }

    setUploading(true)
    setProgress(0)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Simulate progress (real progress tracking would require more complex setup)
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      clearInterval(progressInterval)
      setProgress(100)

      const contentType = response.headers.get('content-type') || ''
      const raw = await response.text()
      let data: unknown = null

      // Try to parse JSON safely regardless of header accuracy
      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(raw)
        } catch {
          // Fall through with null data; we&apos;ll handle below
        }
      }

      // Handle non-OK responses using best available message
      if (!response.ok) {
        let message = 'Upload failed'
        if (data && typeof data === 'object' && data !== null) {
          const errorData = data as Record<string, unknown>
          const details = errorData.details
          const firstDetail =
            Array.isArray(details) && details.length > 0
              ? details[0]
              : undefined
          message = String(
            firstDetail ?? errorData.error ?? errorData.message ?? message
          )
        } else if (raw) {
          message = raw
        }
        throw new Error(message)
      }

      // If OK but we still don&apos;t have JSON, try parsing now; otherwise accept text
      if (!data) {
        try {
          data = JSON.parse(raw)
        } catch {
          throw new Error(
            'Server returned an unexpected response. Please try again'
          )
        }
      }

      setSuccess(true)
      // Type guard for data structure
      if (data && typeof data === 'object' && data !== null && 'file' in data) {
        const fileData = data as { file: { id: string } }
        onUploadComplete?.(fileData.file.id)
      }

      // Reset after 3 seconds
      setTimeout(() => {
        setFile(null)
        setSuccess(false)
        setProgress(0)
      }, 3000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMessage)
      onUploadError?.(errorMessage)
    } finally {
      setUploading(false)
    }
  }, [file, user, onUploadComplete, onUploadError])

  // Auto-upload if initialFile is provided
  useEffect(() => {
    if (initialFile && !hasAutoUploaded.current && file && user) {
      hasAutoUploaded.current = true
      handleUpload()
    }
  }, [initialFile, file, user, handleUpload])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="w-full">
      {/* Mode Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => {
            setMode('file')
            setUrl('')
            setError(null)
          }}
          className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
            mode === 'file'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
          }`}
        >
          Upload File
        </button>
        <button
          onClick={() => {
            setMode('url')
            setFile(null)
            setError(null)
          }}
          className={`flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 ${
            mode === 'url'
              ? 'bg-primary text-primary-foreground shadow-md'
              : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
          }`}
        >
          Paste URL
        </button>
      </div>

      {/* File Upload Mode */}
      {mode === 'file' && (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 ${
            dragActive
              ? 'border-primary bg-primary/5 scale-[1.02]'
              : 'border-border/50 hover:border-primary/30 bg-gradient-to-b from-muted/5 to-background'
          } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept={supportedFormats.join(',')}
            className="hidden"
            disabled={uploading}
          />

          {!file ? (
            <div className="space-y-6">
              <div className="mx-auto w-20 h-20 text-muted-foreground/60">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-normal mb-2 text-foreground">
                  Drag and drop your audio or video file here
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  or click to browse files
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  size="lg"
                  className="px-8"
                >
                  Browse Files
                </Button>
              </div>
              <div className="pt-6 border-t border-border/30">
                <div className="flex items-center justify-center gap-8 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">
                      Supported formats:
                    </span>{' '}
                    {supportedFormats.join(', ')}
                  </div>
                  <div className="w-px h-4 bg-border/50" />
                  <div>
                    <span className="font-medium text-foreground">
                      Max size:
                    </span>{' '}
                    500MB
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mx-auto w-16 h-16 text-primary">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="font-normal text-sm text-muted-foreground mb-2">
                  Selected file
                </h3>
                <p className="font-mono text-base text-foreground">
                  {file.name}
                </p>
                <Badge variant="outline" className="mt-3">
                  {formatFileSize(file.size)}
                </Badge>
              </div>

              {!uploading && !success && (
                <div className="flex gap-3 justify-center pt-2">
                  <Button onClick={handleUpload} size="lg" className="px-8">
                    Upload File
                  </Button>
                  <Button
                    onClick={() => {
                      setFile(null)
                      setError(null)
                    }}
                    variant="outline"
                    size="lg"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {uploading && (
            <div className="mt-8 space-y-3">
              <div className="w-full bg-muted/50 rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-muted-foreground">
                Uploading... {progress}%
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-primary text-sm font-normal">
                  File uploaded successfully
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* URL Download Mode */}
      {mode === 'url' && (
        <div
          className={`relative border-2 border-dashed rounded-2xl p-16 text-center transition-all duration-300 ${
            uploading
              ? 'opacity-50 pointer-events-none border-border/50'
              : 'border-border/50 hover:border-primary/30 bg-gradient-to-b from-muted/5 to-background'
          }`}
        >
          {!url ? (
            <div className="space-y-6">
              <div className="mx-auto w-20 h-20 text-muted-foreground/60">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-normal mb-2 text-foreground">
                  Paste a video URL to download
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Enter a link from YouTube, Vimeo, or other supported platforms
                </p>

                {/* URL Input with Validation */}
                <div className="max-w-2xl mx-auto mb-6">
                  <div className="relative">
                    <Input
                      ref={urlInputRef}
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={url}
                      onChange={handleUrlChange}
                      disabled={uploading}
                      className="text-base h-12 pr-24"
                    />

                    {/* Removed validation indicators */}

                    {/* Paste Button */}
                    <button
                      onClick={handlePasteFromClipboard}
                      disabled={uploading}
                      className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
                      title="Paste from clipboard"
                    >
                      Paste
                    </button>
                  </div>

                  {/* Platform Detection Badge */}
                  {detectedPlatform && (
                    <div className="mt-3 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Badge
                        variant="outline"
                        className="flex items-center gap-1.5 px-3 py-1.5"
                        style={{
                          borderColor: detectedPlatform.color + '40',
                          color: detectedPlatform.color
                        }}
                      >
                        <span className="text-base">
                          {detectedPlatform.icon}
                        </span>
                        <span className="font-medium">
                          {detectedPlatform.name}
                        </span>
                      </Badge>
                    </div>
                  )}

                  {/* Removed invalid URL helper */}
                </div>
              </div>
              <div className="pt-6 border-t border-border/30">
                <div className="text-xs text-muted-foreground text-center">
                  <p>Supports 1000+ video platforms via yt-dlp</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="mx-auto w-16 h-16 text-primary">
                {detectedPlatform ? (
                  <div
                    className="text-5xl"
                    style={{ color: detectedPlatform.color }}
                  >
                    {detectedPlatform.icon}
                  </div>
                ) : (
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                )}
              </div>
              <div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <h3 className="font-normal text-sm text-muted-foreground">
                    Video URL
                  </h3>
                  {detectedPlatform && (
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1"
                      style={{
                        borderColor: detectedPlatform.color + '40',
                        color: detectedPlatform.color
                      }}
                    >
                      <span className="text-xs">{detectedPlatform.name}</span>
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-sm text-foreground break-all px-4 max-w-2xl mx-auto">
                  {url}
                </p>
              </div>

              {!uploading && !success && (
                <div className="flex gap-3 justify-center pt-2">
                  <Button
                    onClick={e => {
                      e.preventDefault()
                      void handleUrlUpload()
                    }}
                    size="lg"
                    className="px-8"
                    disabled={!url.trim()}
                  >
                    Download Video
                  </Button>
                  <Button
                    onClick={() => {
                      setUrl('')
                      setError(null)
                      setDetectedPlatform(null)
                    }}
                    variant="outline"
                    size="lg"
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}

          {uploading && (
            <div className="mt-8 space-y-3">
              <div className="w-full bg-muted/50 rounded-full h-2.5">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-sm text-muted-foreground">
                Downloading video... {progress}%
              </p>
            </div>
          )}

          {error && (
            <div className="mt-6 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <svg
                    className="w-3 h-3 text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-primary text-sm font-normal">
                  Video downloaded successfully
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Login Prompt Dialog */}
      <LoginPromptDialog
        isOpen={showLoginPrompt}
        onClose={() => setShowLoginPrompt(false)}
      />

      {/* MiniBrowser for Authentication */}
      {showMiniBrowser && authUrl && (
        <MiniBrowser
          url={authUrl}
          onClose={() => {
            setShowMiniBrowser(false)
            setUploading(false)
          }}
          onAuthenticationComplete={handleAuthComplete}
          onAuthenticationError={handleAuthError}
          title="Authentication Required"
          height="600px"
          width="900px"
          userId={user?.id}
        />
      )}
    </div>
  )
}
