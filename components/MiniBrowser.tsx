'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { X, RefreshCw, ArrowLeft, ArrowRight, Home, ExternalLink, Loader2 } from 'lucide-react'

interface MiniBrowserProps {
  url: string
  onClose: () => void
  onAuthenticationComplete?: (cookies: string) => void
  onAuthenticationError?: (error: string) => void
  title?: string
  height?: string
  width?: string
}

export default function MiniBrowser({
  url,
  onClose,
  onAuthenticationComplete,
  onAuthenticationError,
  title = 'Authentication Required',
  height = '600px',
  width = '800px'
}: MiniBrowserProps) {
  const [currentUrl, setCurrentUrl] = useState(url)
  const [isLoading, setIsLoading] = useState(true)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeKey, setIframeKey] = useState(0)

  // Check if user is authenticated by monitoring URL changes
  const checkAuthentication = useCallback(() => {
    try {
      const iframe = iframeRef.current
      if (!iframe || !iframe.contentWindow) return

      // Try to access iframe content (will fail if cross-origin)
      try {
        const iframeUrl = iframe.contentWindow.location.href
        console.log('Current iframe URL:', iframeUrl)
        
        // Check for authentication success indicators
        const successIndicators = [
          'dashboard',
          'profile',
          'account',
          'home',
          'welcome',
          'success',
          'authenticated'
        ]
        
        const isSuccess = successIndicators.some(indicator => 
          iframeUrl.toLowerCase().includes(indicator)
        )
        
        if (isSuccess && !isAuthenticated) {
          setIsAuthenticated(true)
          setShowSuccess(true)
          
          // Authentication successful - call success callback
          // The backend will handle authentication via browser session
          setTimeout(() => {
            if (onAuthenticationComplete) {
              onAuthenticationComplete('') // Empty cookies - backend will handle session
            }
          }, 1000)
        }
      } catch (e) {
        // Cross-origin access blocked, this is normal
        console.log('Cross-origin iframe access blocked (normal)')
      }
    } catch (error) {
      console.error('Error checking authentication:', error)
    }
  }, [isAuthenticated, onAuthenticationComplete])

  // Handle iframe load
  const handleIframeLoad = useCallback(() => {
    setIsLoading(false)
    setError(null)
    
    // Check authentication after a short delay
    setTimeout(checkAuthentication, 1000)
  }, [checkAuthentication])

  // Handle iframe error
  const handleIframeError = useCallback(() => {
    setIsLoading(false)
    setError('Failed to load the authentication page. Please try again.')
  }, [])

  // Navigation functions
  const goBack = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.back()
    } catch (e) {
      console.log('Cannot navigate back (cross-origin)')
    }
  }, [])

  const goForward = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.history.forward()
    } catch (e) {
      console.log('Cannot navigate forward (cross-origin)')
    }
  }, [])

  const refresh = useCallback(() => {
    setIframeKey(prev => prev + 1)
    setIsLoading(true)
    setError(null)
  }, [])

  const goHome = useCallback(() => {
    setCurrentUrl(url)
    setIframeKey(prev => prev + 1)
    setIsLoading(true)
    setError(null)
  }, [url])

  // Handle URL input
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentUrl(e.target.value)
  }, [])

  const handleUrlSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (currentUrl) {
      setIframeKey(prev => prev + 1)
      setIsLoading(true)
      setError(null)
    }
  }, [currentUrl])

  // Monitor for authentication success
  useEffect(() => {
    const interval = setInterval(checkAuthentication, 2000)
    return () => clearInterval(interval)
  }, [checkAuthentication])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-background rounded-lg shadow-2xl border border-border overflow-hidden"
        style={{ width, height: `calc(${height} + 60px)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <h3 className="font-medium text-foreground ml-2">{title}</h3>
            {isAuthenticated && (
              <Badge variant="default" className="ml-2">
                ✅ Authenticated
              </Badge>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center gap-2 p-3 border-b border-border bg-muted/10">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={goBack}
              disabled={!canGoBack}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goForward}
              disabled={!canGoForward}
              className="h-8 w-8 p-0"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goHome}
              className="h-8 w-8 p-0"
            >
              <Home className="h-4 w-4" />
            </Button>
          </div>
          
          <form onSubmit={handleUrlSubmit} className="flex-1 flex items-center gap-2">
            <Input
              value={currentUrl}
              onChange={handleUrlChange}
              placeholder="Enter URL..."
              className="h-8 text-sm"
            />
            <Button type="submit" size="sm" className="h-8">
              Go
            </Button>
          </form>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open(currentUrl, '_blank')}
            className="h-8 w-8 p-0"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        {/* Content Area */}
        <div className="relative" style={{ height }}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Loading authentication page...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center p-6">
                <div className="text-red-500 mb-2">⚠️</div>
                <p className="text-sm text-muted-foreground mb-4">{error}</p>
                <Button onClick={refresh} size="sm">
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {showSuccess && (
            <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
              <div className="text-center p-6">
                <div className="text-green-500 mb-2">✅</div>
                <h3 className="font-medium text-foreground mb-2">Authentication Successful!</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You have been successfully authenticated. The download will now proceed.
                </p>
                <Button onClick={onClose} size="sm">
                  Continue
                </Button>
              </div>
            </div>
          )}

          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={currentUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
            title="Authentication Browser"
          />
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/10">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>🔒 Secure authentication</span>
              <span>⏱️ Session timeout: 5 minutes</span>
            </div>
            <div className="flex items-center gap-2">
              {isLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>Mini Browser v1.0</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
