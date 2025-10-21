'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import LoginPromptDialog from '@/components/auth/LoginPromptDialog'
import MiniBrowser from '@/components/MiniBrowser'
import { useMiniBrowserAuth } from '@/hooks/useMiniBrowserAuth'
import { logger } from '@/lib/utils/logger'

interface FileUploadProps {
  onUploadComplete?: (fileId: string) => void
  onUploadError?: (error: string) => void
  initialFile?: File | null
  user?: any | null // User object from Supabase auth
}

type UploadMode = 'file' | 'url'
// Removed URL validation - accept all URLs
type DetectedPlatform = {
  name: string
  icon: string
  color: string
}

export default function FileUpload({ onUploadComplete, onUploadError, initialFile, user }: FileUploadProps) {
  const [mode, setMode] = useState<UploadMode>('file')
  const [file, setFile] = useState<File | null>(initialFile || null)
  const [url, setUrl] = useState<string>('')
  // Removed URL validation state
  const [detectedPlatform, setDetectedPlatform] = useState<DetectedPlatform | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [showLoginPrompt, setShowLoginPrompt] = useState(false)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [browserForCookies, setBrowserForCookies] = useState<string>('chrome')
  const [cookieText, setCookieText] = useState<string>('')
  const [useManualCookies, setUseManualCookies] = useState(false)
  const [extensionInstalled, setExtensionInstalled] = useState(false)
  const [extractingCookies, setExtractingCookies] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasAutoUploaded = useRef(false)
  const urlInputRef = useRef<HTMLInputElement>(null)

  // Mini-browser authentication
  const miniBrowserAuth = useMiniBrowserAuth()

  const supportedFormats = ['.mp3', '.wav', '.mp4', '.m4a', '.mov', '.mpeg']
  
  // Detect if browser extension is installed
  useEffect(() => {
    const checkExtension = () => {
      if (typeof window !== 'undefined' && (window as any).FROGBYTES_EXTENSION_INSTALLED) {
        setExtensionInstalled(true)
      }
    }
    
    // Check immediately
    checkExtension()
    
    // Check again after a short delay (extension might load after page)
    const timer = setTimeout(checkExtension, 1000)
    
    return () => clearTimeout(timer)
  }, [])
  
  // Function to extract cookies using browser extension
  const extractCookiesWithExtension = useCallback(async (targetUrl: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const requestId = Math.random().toString(36)
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler)
        resolve(null)
      }, 5000) // 5 second timeout
      
      const handler = (event: MessageEvent) => {
        if (event.data.type === 'FROGBYTES_COOKIES_RESPONSE' && event.data.requestId === requestId) {
          clearTimeout(timeout)
          window.removeEventListener('message', handler)
          if (event.data.success) {
            resolve(event.data.cookies)
          } else {
            resolve(null)
          }
        }
      }
      
      window.addEventListener('message', handler)
      window.postMessage({
        type: 'FROGBYTES_REQUEST_COOKIES',
        url: targetUrl,
        requestId
      }, window.location.origin)
    })
  }, [])
  
  // Removed platform patterns - accept all URLs

  // Removed URL validation - accept all URLs

  // Auto-paste from clipboard
  const handlePasteFromClipboard = useCallback(async () => {
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

  // Handle URL input change
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value
    setUrl(newUrl)
    setError(null)
  }, [])

  // Cleanup mini-browser auth
  useEffect(() => {
    return () => {
      miniBrowserAuth.cleanup()
    }
  }, [miniBrowserAuth])

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
      'video/quicktime',
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    setError(null)
    setSuccess(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      const validationError = validateFile(droppedFile)

      if (validationError) {
        setError(validationError)
        return
      }

      setFile(droppedFile)
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setSuccess(false)

    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0]
      const validationError = validateFile(selectedFile)

      if (validationError) {
        setError(validationError)
        return
      }

      setFile(selectedFile)
    }
  }

  const handleUrlUpload = useCallback(async (useCookies = false) => {
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
    setNeedsAuth(false) // Reset auth flag

    try {
      // Use the enhanced endpoint for automatic authentication
      const response = await fetch('/api/upload/from-url/enhanced', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({ url }),
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
          const firstDetail = Array.isArray(details) && details.length > 0 ? details[0] : undefined
          message = String(firstDetail ?? errorData.error ?? errorData.message ?? message)
        } else if (raw) {
          message = raw
        }
        
        // Check if this is an authentication error
        const isAuthError = message.toLowerCase().includes('authentication') || 
                            message.toLowerCase().includes('require authentication') ||
                            message.toLowerCase().includes('private or require')
        
        if (isAuthError) {
          // Authentication error - this should be handled by the job polling
          // The enhanced endpoint will return authentication_required status
          throw new Error(message)
        }
        
        throw new Error(message)
      }

      if (!data) {
        try {
          data = JSON.parse(raw)
        } catch {
          throw new Error('Server returned an unexpected response. Please try again')
        }
      }

      const result = data as { success: boolean; jobId: string; message: string; status: string }
      if (!result.success || !result.jobId) {
        throw new Error(result.message || 'Upload failed. Please check your file and try again')
      }

      // Start polling for job status
      await pollJobStatus(result.jobId)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed'
      setError(errorMessage)
      onUploadError?.(errorMessage)
    } finally {
      setUploading(false)
    }
  }, [url, user, onUploadComplete, onUploadError, miniBrowserAuth])

  // Poll job status for enhanced downloads
  const pollJobStatus = useCallback(async (jobId: string) => {
    const maxAttempts = 60 // 5 minutes with 5-second intervals
    let attempts = 0

    const poll = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/upload/from-url/enhanced/${jobId}`, {
          credentials: 'include', // Include cookies for authentication
        })
        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || 'Failed to check download status. Please try again')
        }

        const jobData = data as {
          success: boolean
          status: string
          message: string
          progress?: { percentage: number }
          file?: { id: string }
          error?: string
        }

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
            // Show mini-browser for authentication
            setUploading(false)
            setNeedsAuth(true)
            
            // Start mini-browser authentication
            miniBrowserAuth.startAuth({
              url,
              userId: user.id,
              onSuccess: (cookies) => {
                logger.info('Authentication successful, retrying upload...')
                setNeedsAuth(false)
                // Retry upload after authentication
                setTimeout(() => {
                  void handleUrlUpload(true) // Retry with authentication
                }, 1000)
              },
              onError: (error) => {
                logger.error('Authentication failed', error)
                setError(`Authentication failed: ${error}`)
                setNeedsAuth(false)
                onUploadError?.(error)
              },
              onClose: () => {
                setNeedsAuth(false)
                setUploading(false)
              }
            })
            return // Stop polling completely, mini-browser will handle the rest
          case 'authentication_successful':
            setProgress(40)
            setError(null) // Clear auth message
            break
          case 'download_started':
            setProgress(60)
            break
          case 'completed':
            setProgress(100)
            setSuccess(true)
            if (jobData.file?.id) {
              onUploadComplete(jobData.file.id)
            } else {
              throw new Error('Download completed but file information is missing. Please try again')
            }
            return
          case 'failed':
            throw new Error(jobData.error || 'Download failed. Please check the URL and try again')
          default:
            // Continue polling for unknown statuses
            break
        }

        // Continue polling if not completed or failed
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000) // Poll every 5 seconds
        } else {
          throw new Error('Download is taking longer than expected. Please try again or contact support')
        }
      } catch (error) {
        logger.error('Job polling error', error)
        setError(error instanceof Error ? error.message : 'Failed to check download status. Please try again')
        onUploadError?.(error instanceof Error ? error.message : 'Failed to check download status. Please try again')
      }
    }

    // Start polling
    poll()
  }, [onUploadComplete, onUploadError])

  // Function to automatically extract and use cookies with extension
  const handleAutoExtractCookies = useCallback(async () => {
    if (!url || !extensionInstalled) return
    
    setExtractingCookies(true)
    setError(null)
    
    try {
      // First, open the URL in new tab so user can login
      window.open(url, '_blank')
      
      // Wait a bit for user to potentially login
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Extract cookies using extension
      const cookies = await extractCookiesWithExtension(url)
      
      if (cookies) {
        // Automatically set cookies and retry
        setCookieText(cookies)
        setUseManualCookies(true)
        setExtractingCookies(false)
        
        // Automatically retry the upload
        await handleUrlUpload(true)
      } else {
        setExtractingCookies(false)
        setError('Failed to extract cookies from extension. Please try manual method.')
      }
    } catch (err) {
      setExtractingCookies(false)
      setError('Cookie extraction failed. Please use manual method.')
    }
  }, [url, extensionInstalled, extractCookiesWithExtension, handleUrlUpload])

  const handleUpload = useCallback(async () => {
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
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return 90
          }
          return prev + 10
        })
      }, 200)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
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
          // Fall through with null data; we'll handle below
        }
      }

      // Handle non-OK responses using best available message
      if (!response.ok) {
        let message = 'Upload failed'
        if (data && typeof data === 'object' && data !== null) {
          const errorData = data as Record<string, unknown>
          const details = errorData.details
          const firstDetail = Array.isArray(details) && details.length > 0 ? details[0] : undefined
          message = String(firstDetail ?? errorData.error ?? errorData.message ?? message)
        } else if (raw) {
          message = raw
        }
        throw new Error(message)
      }

      // If OK but we still don't have JSON, try parsing now; otherwise accept text
      if (!data) {
        try {
          data = JSON.parse(raw)
        } catch {
          throw new Error('Server returned an unexpected response. Please try again')
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
          📁 Upload File
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
          🔗 Paste URL
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
                    <span className="font-medium text-foreground">Supported formats:</span> {supportedFormats.join(', ')}
                  </div>
                  <div className="w-px h-4 bg-border/50" />
                  <div>
                    <span className="font-medium text-foreground">Max size:</span> 500MB
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
                <h3 className="font-normal text-sm text-muted-foreground mb-2">Selected file</h3>
                <p className="font-mono text-base text-foreground">{file.name}</p>
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
                  <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
                      📋 Paste
                    </button>
                  </div>
                  
                  {/* Platform Detection Badge */}
                  {detectedPlatform && (
                    <div className="mt-3 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <Badge variant="outline" className="flex items-center gap-1.5 px-3 py-1.5" style={{ borderColor: detectedPlatform.color + '40', color: detectedPlatform.color }}>
                        <span className="text-base">{detectedPlatform.icon}</span>
                        <span className="font-medium">{detectedPlatform.name}</span>
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
                  <div className="text-5xl" style={{ color: detectedPlatform.color }}>
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
                  <h3 className="font-normal text-sm text-muted-foreground">Video URL</h3>
                  {detectedPlatform && (
                    <Badge variant="outline" className="flex items-center gap-1" style={{ borderColor: detectedPlatform.color + '40', color: detectedPlatform.color }}>
                      <span className="text-xs">{detectedPlatform.name}</span>
                    </Badge>
                  )}
                </div>
                <p className="font-mono text-sm text-foreground break-all px-4 max-w-2xl mx-auto">{url}</p>
              </div>

              {!uploading && !success && (
                <div className="flex gap-3 justify-center pt-2">
                  <Button 
                    onClick={(e) => {
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
            <div className="mt-6 space-y-4">
              <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                <p className="text-destructive text-sm">{error}</p>
              </div>

              {/* Authentication Helper */}
              {needsAuth && (
                <div className="p-5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-lg space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">🔐</div>
                    <div className="flex-1 space-y-2">
                      <h4 className="font-medium text-sm text-amber-900 dark:text-amber-100">
                        Authentication Required
                      </h4>
                      <p className="text-xs text-amber-800 dark:text-amber-200/90">
                        This video requires you to be logged in. Choose a method below:
                      </p>
                      <div className="text-xs text-amber-800 dark:text-amber-200/90 space-y-2 bg-amber-100 dark:bg-amber-900/20 p-3 rounded-md">
                        <p className="font-semibold">📋 Method 1: Paste Cookies (Recommended)</p>
                        <ol className="list-decimal list-inside space-y-1 pl-2">
                          <li>Click "Open & Login" below</li>
                          <li>Sign in to the platform</li>
                          <li>Press F12 → Application → Cookies</li>
                          <li>Copy all cookies (or use extension)</li>
                          <li>Switch to "Paste Cookies" tab</li>
                          <li>Paste and click "Retry with Cookies"</li>
                        </ol>
                        
                        <p className="font-semibold pt-2">🤖 Method 2: Auto Extract</p>
                        <p className="pl-2">Works only if the browser is installed on the server (may fail on remote servers)</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 pt-2">
                    {/* Extension-based auto-extract (if installed) */}
                    {extensionInstalled ? (
                      <Button
                        onClick={handleAutoExtractCookies}
                        size="sm"
                        className="w-full justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        disabled={extractingCookies || uploading}
                      >
                        {extractingCookies ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            Extracting cookies...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            🚀 Auto Extract with Extension
                          </>
                        )}
                      </Button>
                    ) : (
                      <a 
                        href="/extension-install.html" 
                        target="_blank"
                        className="block"
                      >
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-2 border-blue-500 hover:border-blue-600"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Install Extension (One-Click Solution)
                        </Button>
                      </a>
                    )}
                    
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-amber-300 dark:border-amber-800"></div>
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="px-2 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300">
                          or manually
                        </span>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => window.open(url, '_blank')}
                      variant="outline"
                      size="sm"
                      className="w-full justify-center gap-2 bg-white dark:bg-background hover:bg-amber-50 dark:hover:bg-amber-950/30 border-amber-300 dark:border-amber-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Open & Login
                    </Button>

                    {/* Cookie Method Toggle */}
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => setUseManualCookies(false)}
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                          !useManualCookies
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100'
                        }`}
                      >
                        Auto Extract
                      </button>
                      <button
                        onClick={() => setUseManualCookies(true)}
                        className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                          useManualCookies
                            ? 'bg-amber-600 text-white'
                            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100'
                        }`}
                      >
                        Paste Cookies
                      </button>
                    </div>

                    {!useManualCookies ? (
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-medium text-amber-900 dark:text-amber-100 whitespace-nowrap">
                          Your Browser:
                        </label>
                        <select
                          value={browserForCookies}
                          onChange={(e) => setBrowserForCookies(e.target.value)}
                          className="flex-1 px-3 py-1.5 text-xs rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-background text-foreground"
                        >
                          <option value="chrome">Chrome</option>
                          <option value="firefox">Firefox</option>
                          <option value="edge">Edge</option>
                          <option value="safari">Safari</option>
                          <option value="brave">Brave</option>
                          <option value="opera">Opera</option>
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-xs font-medium text-amber-900 dark:text-amber-100">
                          Paste Cookies (Netscape format or Header format):
                        </label>
                        <textarea
                          value={cookieText}
                          onChange={(e) => setCookieText(e.target.value)}
                          placeholder="Paste cookies here..."
                          className="w-full px-3 py-2 text-xs rounded-md border border-amber-300 dark:border-amber-800 bg-white dark:bg-background text-foreground font-mono h-24 resize-none"
                        />
                        <p className="text-xs text-amber-700 dark:text-amber-300/80">
                          Copy from DevTools → Application → Cookies, or use browser extension
                        </p>
                      </div>
                    )}

                        <Button
                          onClick={(e) => {
                            e.preventDefault()
                            void handleUrlUpload(true)
                          }}
                          size="sm"
                          className="w-full justify-center gap-2"
                          disabled={uploading}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Retry with Cookies
                        </Button>
                  </div>

                  <div className="pt-2 border-t border-amber-200 dark:border-amber-900/50">
                    <p className="text-xs text-amber-700 dark:text-amber-300/80">
                      <strong>How it works:</strong> {useManualCookies 
                        ? 'Paste your browser cookies to authenticate with the video platform. Cookies are used once and never stored.'
                        : 'yt-dlp extracts cookies from your browser to authenticate. Only works if browser is installed on the server.'
                      }
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">
                      🔒 Your credentials are never transmitted - cookies stay secure.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {success && (
            <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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

      {/* Mini Browser for Authentication */}
      {miniBrowserAuth.isOpen && miniBrowserAuth.authUrl && (
        <MiniBrowser
          url={miniBrowserAuth.authUrl}
          onClose={miniBrowserAuth.closeAuth}
          onAuthenticationComplete={(cookies) => {
            logger.info('Mini-browser authentication completed')
            miniBrowserAuth.closeAuth()
          }}
          onAuthenticationError={(error) => {
            logger.error('Mini-browser authentication failed', error)
            setError(`Authentication failed: ${error}`)
            miniBrowserAuth.closeAuth()
          }}
          title="🔐 Authentication Required"
          height="600px"
          width="900px"
        />
      )}
    </div>
  )
}
