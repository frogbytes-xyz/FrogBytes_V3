'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Share2,
  Copy,
  Check,
  Eye,
  Users,
  Globe,
  Lock,
  ExternalLink,
  AlertTriangle
} from 'lucide-react'

interface DocumentShareInfo {
  id: string
  title: string
  shareSlug: string | null
  isPublic: boolean
  viewCount: number
  shareUrl: string | null
}

interface DocumentShareButtonProps {
  documentId: string
  documentTitle: string
  className?: string
}

export function DocumentShareButton({
  documentId,
  documentTitle,
  className = ''
}: DocumentShareButtonProps): JSX.Element {
  const [shareInfo, setShareInfo] = useState<DocumentShareInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [copying, setCopying] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    if (isDialogOpen) {
      fetchShareInfo()
    }
  }, [isDialogOpen, documentId])

  const fetchShareInfo = async (): Promise<void> => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/documents/${documentId}/share`)
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch share information')
      }

      setShareInfo(result.data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load sharing information'
      )
    } finally {
      setLoading(false)
    }
  }

  const toggleSharing = async (makePublic: boolean): Promise<void> => {
    try {
      setLoading(true)
      setError(null)
      setSuccess(null)

      const response = await fetch(`/api/documents/${documentId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ makePublic })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update sharing status')
      }

      setShareInfo(result.data)
      setSuccess(result.message)

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update sharing status'
      )
    } finally {
      setLoading(false)
    }
  }

  const copyShareLink = async (): Promise<void> => {
    if (!shareInfo?.shareUrl) return

    try {
      setCopying(true)
      await navigator.clipboard.writeText(shareInfo.shareUrl)

      // Show success feedback
      setSuccess('Link copied to clipboard!')
      setTimeout(() => setSuccess(null), 2000)
    } catch (err) {
      setError('Failed to copy link to clipboard')
    } finally {
      setCopying(false)
    }
  }

  const openSharedDocument = (): void => {
    if (shareInfo?.shareUrl) {
      window.open(shareInfo.shareUrl, '_blank')
    }
  }

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Share Document
          </DialogTitle>
          <DialogDescription>
            Share "{documentTitle}" with others so they can view and learn from
            it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {success && (
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription className="text-green-700">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {/* Share Info */}
          {shareInfo && !loading && (
            <div className="space-y-4">
              {/* Current Status */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  {shareInfo.isPublic ? (
                    <>
                      <Globe className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">Public</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4 text-gray-600" />
                      <span className="text-sm font-medium">Private</span>
                    </>
                  )}
                </div>
                <Badge variant={shareInfo.isPublic ? 'default' : 'secondary'}>
                  {shareInfo.isPublic ? 'Shared' : 'Not Shared'}
                </Badge>
              </div>

              {/* View Count */}
              {shareInfo.isPublic && shareInfo.viewCount > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Eye className="h-4 w-4" />
                  <span>{shareInfo.viewCount} views</span>
                </div>
              )}

              {/* Share Link */}
              {shareInfo.isPublic && shareInfo.shareUrl && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Share Link
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareInfo.shareUrl}
                      readOnly
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyShareLink}
                      disabled={copying}
                    >
                      {copying ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={openSharedDocument}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <Separator />

              {/* Actions */}
              <div className="space-y-3">
                {shareInfo.isPublic ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 bg-green-50 rounded-lg">
                      <Users className="h-4 w-4 text-green-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-green-800">
                          Document is publicly shared
                        </p>
                        <p className="text-green-700">
                          Anyone with the link can view this document and must
                          login to access it.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => toggleSharing(false)}
                      disabled={loading}
                      className="w-full"
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      Make Private
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                      <Globe className="h-4 w-4 text-blue-600 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-blue-800">
                          Share with friends
                        </p>
                        <p className="text-blue-700">
                          Generate a public link that requires login to view.
                          Perfect for sharing with study groups!
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => toggleSharing(true)}
                      disabled={loading}
                      className="w-full"
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share Document
                    </Button>
                  </div>
                )}
              </div>

              {/* Important Note */}
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Authentication Required</p>
                    <p>
                      Viewers must be logged in to FrogBytes to access shared
                      documents. This helps build our learning community!
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
