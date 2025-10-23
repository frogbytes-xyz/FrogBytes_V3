'use client'

import { logger } from '@/lib/utils/logger'

import { useState, useEffect, useRef, useMemo, memo } from 'react'
import dynamic from 'next/dynamic'

// Dynamically import react-pdf to prevent SSR issues
const Document = dynamic(() => import('react-pdf').then(mod => mod.Document), {
  ssr: false
})

const Page = dynamic(() => import('react-pdf').then(mod => mod.Page), {
  ssr: false
})

// Configure PDF.js worker with better error handling
let pdfVersion: string | null = null
if (typeof window !== 'undefined') {
  let workerConfigured = false

  const configureWorker = async () => {
    if (workerConfigured) return

    try {
      const mod = await import('react-pdf')
      const pdfjs = (mod as any).pdfjs

      if (!pdfjs) {
        logger.warn('PDF.js not available in react-pdf module')
        return
      }

      // Use CDN with the correct version to avoid version mismatch
      pdfVersion = pdfjs.version || '4.0.379'
      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfVersion}/build/pdf.worker.min.mjs`

      workerConfigured = true
      logger.info(`PDF.js worker configured with version ${pdfVersion}`)
    } catch (err) {
      logger.error('Failed to configure PDF.js worker', err)
    }
  }

  // Configure worker immediately
  configureWorker()
}

interface PDFThumbnailProps {
  pdfUrl: string
  width?: number
  height?: number
  className?: string
  fallback?: React.ReactNode
  onClick?: () => void
  pageCountPosition?: 'right-3' | 'right-11' // Control page count badge position
}

/**
 * Wrapper component for PDF Page with error boundary
 */
function PageWrapper({
  pdfUrl,
  pageNumber,
  width,
  onRenderError
}: {
  pdfUrl: string
  pageNumber: number
  width: number
  onRenderError: (error: Error) => void
}) {
  const [hasError, setHasError] = useState(false)

  if (hasError) {
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-muted-foreground text-xs">Preview unavailable</div>
      </div>
    )
  }

  try {
    return (
      <Page
        key={`pdf-page-${pdfUrl}-${pageNumber}`}
        pageNumber={pageNumber}
        width={width}
        renderTextLayer={false}
        renderAnnotationLayer={false}
        loading=""
        className="shadow-sm mx-auto"
        onRenderError={error => {
          setHasError(true)
          onRenderError(error)
        }}
      />
    )
  } catch (error) {
    setHasError(true)
    return (
      <div className="flex items-center justify-center w-full h-full">
        <div className="text-muted-foreground text-xs">Preview error</div>
      </div>
    )
  }
}

/**
 * Displays the first page of a PDF as a thumbnail preview
 * Optimized for card displays in library and dashboard
 * Memoized to prevent unnecessary re-renders
 */
const PDFThumbnail = memo(function PDFThumbnail({
  pdfUrl,
  width = 200,
  height = 280,
  className = '',
  fallback,
  onClick,
  pageCountPosition = 'right-11' // Default to original position for backward compatibility
}: PDFThumbnailProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [numPages, setNumPages] = useState<number>(0)
  const [isMounted, setIsMounted] = useState(false)
  const [pageReady, setPageReady] = useState(false)
  const [renderAttempts, setRenderAttempts] = useState(0)
  const workerTimerRef = useRef<NodeJS.Timeout | null>(null)
  const documentRef = useRef<any>(null)
  const isUnmountingRef = useRef(false)

  useEffect(() => {
    setIsMounted(true)
    isUnmountingRef.current = false

    return () => {
      setIsMounted(false)
      isUnmountingRef.current = true
      // Clean up any pending timer
      if (workerTimerRef.current) {
        clearTimeout(workerTimerRef.current)
        workerTimerRef.current = null
      }
      // Clean up document reference
      documentRef.current = null
    }
  }, [])

  // Check for Telegram URLs immediately (not in useEffect)
  const isTelegramUrl =
    pdfUrl && (pdfUrl.includes('telegram') || pdfUrl.includes('t.me'))

  // Reset states when pdfUrl changes (unless it's a Telegram URL)
  useEffect(() => {
    if (!isTelegramUrl) {
      setLoading(true)
      setError(false)
      setNumPages(0)
      setPageReady(false)
      setRenderAttempts(0)
      documentRef.current = null
    } else {
      // For Telegram URLs, set error state
      setError(true)
      setLoading(false)
      setNumPages(0)
      setPageReady(false)
      setRenderAttempts(0)
      documentRef.current = null
    }
  }, [pdfUrl, isTelegramUrl])

  // Memoize file configuration to prevent unnecessary reloads
  const fileConfig = useMemo(() => {
    if (!pdfUrl || typeof pdfUrl !== 'string' || pdfUrl.trim() === '')
      return null

    // Block Telegram URLs immediately to prevent fetch attempts
    if (pdfUrl.includes('telegram') || pdfUrl.includes('t.me')) {
      return null
    }

    // Validate URL format
    try {
      new URL(pdfUrl)
    } catch {
      logger.error('Invalid PDF URL format', pdfUrl)
      return null
    }

    return {
      url: pdfUrl,
      withCredentials: false
    }
  }, [pdfUrl])

  // Memoize options to prevent unnecessary reloads
  const documentOptions = useMemo(() => {
    const version = pdfVersion || '4.0.379'
    return {
      cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${version}/standard_fonts/`
    }
  }, [])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    if (isUnmountingRef.current) return

    setNumPages(numPages)
    setLoading(false)
    setError(false)

    // Clear any existing timer
    if (workerTimerRef.current) {
      clearTimeout(workerTimerRef.current)
      workerTimerRef.current = null
    }

    // Add a small delay to ensure the PDF.js worker is fully initialized
    // before attempting to render the Page component
    workerTimerRef.current = setTimeout(() => {
      if (isMounted && !isUnmountingRef.current) {
        setPageReady(true)
      }
    }, 200)
  }

  function onDocumentLoadError(error: Error) {
    if (isUnmountingRef.current) return

    logger.error('PDF thumbnail load error', {
      error: error.message,
      pdfUrl,
      errorStack: error.stack
    })
    setLoading(false)
    setError(true)
    setPageReady(false)
  }

  function onPageRenderError(error: Error) {
    if (isUnmountingRef.current) return

    logger.error('PDF page render error', {
      error: error.message,
      pdfUrl,
      attempts: renderAttempts
    })

    // Try to recover by resetting pageReady and retrying (max 2 attempts)
    if (renderAttempts < 2) {
      setPageReady(false)
      setRenderAttempts(prev => prev + 1)

      // Wait a bit longer before retry
      if (workerTimerRef.current) {
        clearTimeout(workerTimerRef.current)
      }
      workerTimerRef.current = setTimeout(() => {
        if (isMounted && !isUnmountingRef.current && numPages > 0) {
          setPageReady(true)
        }
      }, 300)
    } else {
      // Give up after 2 attempts
      setError(true)
      setPageReady(false)
    }
  }

  if (!isMounted) {
    return (
      <div
        className={`flex items-center justify-center bg-accent border-2 border-dashed border-border rounded-lg ${className}`}
        style={{ width, height }}
      >
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Block Telegram URLs early (before Document component renders)
  if (isTelegramUrl) {
    logger.warn('Telegram PDF URL blocked (no CORS support)', { error: pdfUrl })
    return (
      <div
        className={`flex items-center justify-center bg-accent border-2 border-dashed border-border rounded-lg ${className}`}
        style={{ width, height }}
        onClick={onClick}
      >
        {fallback || (
          <div className="text-center p-4">
            <svg
              className="w-12 h-12 text-muted-foreground mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-xs text-muted-foreground">PDF Preview</p>
            <p className="text-xs text-muted-foreground mt-1">
              (Telegram storage not supported)
            </p>
          </div>
        )}
      </div>
    )
  }

  // If fileConfig is null, treat it as an error (invalid URL)
  if (!fileConfig) {
    return (
      <div
        className={`flex items-center justify-center bg-accent border-2 border-dashed border-border rounded-lg ${className}`}
        style={{ width, height }}
        onClick={onClick}
      >
        {fallback || (
          <div className="text-center p-4">
            <svg
              className="w-12 h-12 text-muted-foreground mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-xs text-muted-foreground">PDF Preview</p>
          </div>
        )}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-accent border-2 border-dashed border-border rounded-lg ${className}`}
        style={{ width, height }}
        onClick={onClick}
      >
        {fallback || (
          <div className="text-center p-4">
            <svg
              className="w-12 h-12 text-muted-foreground mx-auto mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-xs text-muted-foreground">PDF Preview</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg border bg-white flex items-center justify-center ${className}`}
      style={{ width, height, minWidth: width, minHeight: height }}
      onClick={onClick}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-accent z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      <Document
        file={fileConfig}
        options={documentOptions}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={onDocumentLoadError}
        loading=""
        className="flex items-center justify-center w-full h-full"
      >
        {/* Render the Page only when document is loaded AND worker is ready */}
        {!loading && numPages > 0 && pageReady && !isUnmountingRef.current ? (
          <PageWrapper
            pdfUrl={pdfUrl}
            pageNumber={1}
            width={width}
            onRenderError={onPageRenderError}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            {/* Placeholder until the page can be safely rendered */}
            <div className="text-muted-foreground text-sm">
              Preview loading...
            </div>
          </div>
        )}
      </Document>

      {numPages > 1 && (
        <div
          className={`absolute bottom-3 ${pageCountPosition} bg-black text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg z-20`}
        >
          {numPages} pages
        </div>
      )}
    </div>
  )
})

export default PDFThumbnail
