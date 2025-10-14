'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface FileUploadProps {
  onUploadComplete?: (fileId: string) => void
  onUploadError?: (error: string) => void
  initialFile?: File | null
}

export default function FileUpload({ onUploadComplete, onUploadError, initialFile }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(initialFile || null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasAutoUploaded = useRef(false)

  const supportedFormats = ['.mp3', '.wav', '.mp4', '.m4a', '.mov', '.mpeg']

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

  const handleUpload = useCallback(async () => {
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
          throw new Error('Upload succeeded but server returned unexpected response')
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
  }, [file, onUploadComplete, onUploadError])

  // Auto-upload if initialFile is provided
  useEffect(() => {
    if (initialFile && !hasAutoUploaded.current && file) {
      hasAutoUploaded.current = true
      handleUpload()
    }
  }, [initialFile, file, handleUpload])

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="w-full">
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
    </div>
  )
}
