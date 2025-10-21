'use client'

import { logger } from '@/lib/utils/logger'

import { useState, useEffect, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// Dynamically import react-pdf to prevent SSR issues
const Document = dynamic(
  () => import('react-pdf').then((mod) => mod.Document),
  { ssr: false }
)

const Page = dynamic(
  () => import('react-pdf').then((mod) => mod.Page),
  { ssr: false }
)

// Configure PDF.js worker
let pdfVersion: string | null = null
if (typeof window !== 'undefined') {
  import('react-pdf')
    .then((mod) => {
      try {
        const pdfjs = (mod as any).pdfjs
        pdfVersion = pdfjs.version || pdfjs.pdfjs?.version || '4.0.379'
        // Use CDN with the correct version to avoid version mismatch
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfVersion}/build/pdf.worker.min.mjs`
      } catch (err) {
        logger.warn('Failed to configure PDF.js worker for react-pdf', { error: err })
      }
    })
    .catch((err) => {
      logger.warn('Failed to dynamically import react-pdf for worker setup', { error: err })
    })
}

interface PDFViewerProps {
  pdfUrl: string | null
  onLoadError?: (error: Error) => void
}

export default function PDFViewer({ pdfUrl, onLoadError }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [scale, setScale] = useState<number>(1.8)
  const [visualScale, setVisualScale] = useState<number>(1.0) // CSS transform scale
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<Error | null>(null)
  const [isMounted, setIsMounted] = useState(false)
  const [isZooming, setIsZooming] = useState(false) // Track if actively zooming
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const scaleUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const zoomingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Memoize file configuration to prevent unnecessary reloads
  const fileConfig = useMemo(() => {
    if (!pdfUrl) return null
    return {
      url: pdfUrl,
      httpHeaders: {
        'Access-Control-Allow-Origin': '*',
      },
      withCredentials: false,
    }
  }, [pdfUrl])

  // Memoize options to prevent unnecessary reloads
  const documentOptions = useMemo(() => {
    const version = pdfVersion || '4.0.379'
    return {
      cMapUrl: `https://unpkg.com/pdfjs-dist@${version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${version}/standard_fonts/`,
    }
  }, [])

  useEffect(() => {
    logger.info('PDFViewer: URL changed to:', pdfUrl)
    setLoading(true)
    setLoadError(null)
  }, [pdfUrl])

  // Add mouse wheel and touchpad pinch zoom support
  useEffect(() => {
    if (!isMounted) return undefined
    
    let currentVisualScale = visualScale
    
    const updateActualScale = (targetScale: number) => {
      // Mark as zooming
      setIsZooming(true)
      
      // Clear any pending updates
      if (scaleUpdateTimeoutRef.current) {
        clearTimeout(scaleUpdateTimeoutRef.current)
      }
      if (zoomingTimeoutRef.current) {
        clearTimeout(zoomingTimeoutRef.current)
      }
      
      // Debounce actual scale update to avoid re-rendering PDF too frequently
      scaleUpdateTimeoutRef.current = setTimeout(() => {
        const actualScale = scale * targetScale
        const clampedScale = Math.min(2.0, Math.max(0.5, actualScale))
        setScale(clampedScale)
        setVisualScale(1.0) // Reset visual scale after applying to actual scale
        currentVisualScale = 1.0
        
        // Clear zooming state after scale is applied
        zoomingTimeoutRef.current = setTimeout(() => {
          setIsZooming(false)
        }, 100)
      }, 150) // Wait 150ms after zoom stops
    }
    
    const handleWheel = (e: WheelEvent) => {
      // Detect pinch gesture: ctrlKey is automatically set by browsers for touchpad pinch
      const isPinch = e.ctrlKey || e.metaKey
      
      if (isPinch) {
        e.preventDefault()
        e.stopPropagation()
        
        // Use deltaY for zoom amount - negative is zoom in, positive is zoom out
        const delta = -e.deltaY
        const zoomIntensity = 0.003 // Reduced for smoother zoom
        const scaleFactor = 1 + delta * zoomIntensity
        
        // Update visual scale immediately for smooth feedback
        currentVisualScale *= scaleFactor
        currentVisualScale = Math.min(1.5, Math.max(0.5, currentVisualScale)) // Clamp visual scale
        
        setVisualScale(currentVisualScale)
        
        // Schedule actual scale update
        updateActualScale(currentVisualScale)
      }
    }

    const pdfContainer = containerRef.current
    if (pdfContainer) {
      logger.info('Adding wheel event listener to PDF container')
      pdfContainer.addEventListener('wheel', handleWheel, { passive: false, capture: true })
      return () => {
        logger.info('Removing wheel event listener from PDF container')
        if (scaleUpdateTimeoutRef.current) {
          clearTimeout(scaleUpdateTimeoutRef.current)
        }
        pdfContainer.removeEventListener('wheel', handleWheel, { capture: true })
      }
    }
    return undefined
  }, [isMounted, scale, visualScale])

  // Add touch gesture zoom support for mobile/tablet devices
  useEffect(() => {
    if (!isMounted) return undefined
    
    let initialDistance = 0
    let initialVisualScale = visualScale
    let currentVisualScale = visualScale

    const getDistance = (touches: TouchList) => {
      if (touches.length < 2) return 0
      const touch1 = touches[0]
      const touch2 = touches[1]
      if (!touch1 || !touch2) return 0
      const dx = touch1.clientX - touch2.clientX
      const dy = touch1.clientY - touch2.clientY
      return Math.sqrt(dx * dx + dy * dy)
    }
    
    const updateActualScale = (targetScale: number) => {
      setIsZooming(true)
      
      if (scaleUpdateTimeoutRef.current) {
        clearTimeout(scaleUpdateTimeoutRef.current)
      }
      if (zoomingTimeoutRef.current) {
        clearTimeout(zoomingTimeoutRef.current)
      }
      
      scaleUpdateTimeoutRef.current = setTimeout(() => {
        const actualScale = scale * targetScale
        const clampedScale = Math.min(2.0, Math.max(0.5, actualScale))
        setScale(clampedScale)
        setVisualScale(1.0)
        currentVisualScale = 1.0
        
        zoomingTimeoutRef.current = setTimeout(() => {
          setIsZooming(false)
        }, 100)
      }, 150)
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        logger.info('Touch start with 2 fingers detected')
        e.preventDefault()
        e.stopPropagation()
        initialDistance = getDistance(e.touches)
        initialVisualScale = visualScale
        currentVisualScale = visualScale
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance > 0) {
        e.preventDefault()
        e.stopPropagation()
        
        const currentDistance = getDistance(e.touches)
        const distanceRatio = currentDistance / initialDistance
        currentVisualScale = initialVisualScale * distanceRatio
        currentVisualScale = Math.min(1.5, Math.max(0.5, currentVisualScale))
        
        setVisualScale(currentVisualScale)
        updateActualScale(currentVisualScale)
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialDistance = 0
        initialVisualScale = 1.0
      }
    }

    const pdfContainer = containerRef.current
    if (pdfContainer) {
      logger.info('Adding touch event listeners to PDF container')
      pdfContainer.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true })
      pdfContainer.addEventListener('touchmove', handleTouchMove, { passive: false, capture: true })
      pdfContainer.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true })
      return () => {
        logger.info('Removing touch event listeners from PDF container')
        if (scaleUpdateTimeoutRef.current) {
          clearTimeout(scaleUpdateTimeoutRef.current)
        }
        pdfContainer.removeEventListener('touchstart', handleTouchStart, { capture: true })
        pdfContainer.removeEventListener('touchmove', handleTouchMove, { capture: true })
        pdfContainer.removeEventListener('touchend', handleTouchEnd, { capture: true })
      }
    }
    return undefined
  }, [scale, visualScale, isMounted])

  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    logger.info('PDFViewer: Document loaded successfully with', numPages, 'pages')
    setNumPages(numPages)
    setLoading(false)
    setLoadError(null)
  }

  function onDocumentLoadError(error: Error) {
    logger.error('PDFViewer: Failed to load document', error)
    setLoading(false)
    setLoadError(error)
    onLoadError?.(error)
  }

  const zoomIn = () => {
    setScale((prev) => {
      const newScale = Math.min(2.0, prev + 0.2)
      return newScale
    })
    setVisualScale(1.0)
  }
  
  const zoomOut = () => {
    setScale((prev) => {
      const newScale = Math.max(0.5, prev - 0.2)
      return newScale
    })
    setVisualScale(1.0)
  }
  
  const resetZoom = () => {
    setScale(1.8)
    setVisualScale(1.0)
  }

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg border">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-full bg-muted rounded-lg border">
        <div className="text-center p-8">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="font-medium text-foreground mb-2">No PDF Available</h3>
          <p className="text-sm text-muted-foreground">
            Generate a summary to view the PDF document here.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex flex-col h-full bg-card rounded-lg border">
      {/* Page Count Badge and Zoom Controls */}
      <div className="flex items-center justify-between p-4 border-b bg-card rounded-t-lg">
        <Badge variant="outline" className="min-w-[100px] justify-center">
          {loading ? 'Loading...' : `${numPages} ${numPages === 1 ? 'page' : 'pages'}`}
        </Badge>
        
        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <Button
            onClick={zoomOut}
            disabled={scale <= 0.5 || loading}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label="Zoom out"
          >
            −
          </Button>
          <Button
            onClick={resetZoom}
            disabled={loading}
            size="sm"
            variant="ghost"
            className="min-w-[60px] h-8 px-2"
            aria-label="Reset zoom"
          >
            {Math.round(scale * visualScale * 100)}%
          </Button>
          <Button
            onClick={zoomIn}
            disabled={scale >= 2.0 || loading}
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
            aria-label="Zoom in"
          >
            +
          </Button>
        </div>
      </div>

      {/* PDF Document */}
      <div 
        ref={containerRef}
        className="pdf-viewer-container flex-1 overflow-y-auto overflow-x-hidden p-4 bg-muted/30 relative"
        style={{ 
          touchAction: 'manipulation',
          willChange: 'transform',
        }}
      >
        <div 
          ref={contentRef}
          className="flex flex-col items-center justify-start gap-4 w-full"
          style={{
            transform: `scale(${visualScale})`,
            transformOrigin: 'center top',
            transition: 'none',
            willChange: 'transform',
            minWidth: '100%',
          }}
        >
          <Document
            file={fileConfig}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            options={documentOptions}
            loading={
              <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            }
            error={
              <div className="text-center p-8">
                <div className="mb-4">
                  <svg
                    className="mx-auto h-12 w-12 text-destructive mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <p className="text-destructive font-medium mb-2">
                    Failed to load PDF document
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {loadError?.message || 'Unable to display the PDF in the viewer'}
                  </p>
                </div>
                {pdfUrl && (
                  <div className="space-y-2">
                    <Button asChild variant="default">
                      <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                        Open PDF in New Tab
                      </a>
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      You can view the PDF directly in your browser
                    </p>
                  </div>
                )}
              </div>
            }
          >
              {!loading && numPages > 0 ? (
                Array.from(new Array(numPages), (_, index) => (
                  <Page
                    key={`page_${index + 1}`}
                    pageNumber={index + 1}
                    scale={scale}
                    renderTextLayer={!isZooming}
                    renderAnnotationLayer={!isZooming}
                    className="shadow-lg rounded-lg overflow-hidden mb-4"
                  />
                ))
              ) : (
                <div className="p-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
                </div>
              )}
          </Document>
        </div>
      </div>
    </div>
  )
}
