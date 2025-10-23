'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { setPendingFile } from '@/lib/pendingFileStore'

export default function HeroFileUpload() {
  const router = useRouter()
  const [_file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

      if (e.dataTransfer.files?.[0]) {
        const droppedFile = e.dataTransfer.files[0]
        const validationError = validateFile(droppedFile)

        if (validationError) {
          setError(validationError)
          return
        }

        setFile(droppedFile)
        handleFileReady(droppedFile)
      }
    },
    [validateFile, handleFileReady]
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)

    if (e.target.files?.[0]) {
      const selectedFile = e.target.files[0]
      const validationError = validateFile(selectedFile)

      if (validationError) {
        setError(validationError)
        return
      }

      setFile(selectedFile)
      handleFileReady(selectedFile)
    }
  }

  const handleFileReady = (file: File) => {
    // Store file in memory for the next page
    setPendingFile(file)

    // Redirect to upload page
    router.push('/upload')
  }

  // formatFileSize helper removed (unused in current UI)

  return (
    <div className="w-full">
      <div
        className={`relative border rounded-2xl p-12 text-center transition-all duration-300 ${
          dragActive
            ? 'border-primary/30 bg-primary/[0.03]'
            : 'border-border hover:border-primary/20 bg-card/50'
        }`}
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
        />

        <div className="space-y-6">
          <div className="mx-auto w-16 h-16 text-muted-foreground transition-colors">
            <svg
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>

          <div className="space-y-3">
            <h3 className="text-lg font-normal text-foreground">
              Drop your lecture file here
            </h3>
            <p className="text-sm text-muted-foreground">or click to browse</p>
          </div>

          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="border-border hover:bg-accent text-foreground h-10 px-6 font-normal"
          >
            Select File
          </Button>

          <div className="pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Supported: MP3, WAV, MP4, M4A, MOV • Maximum 500MB
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}
