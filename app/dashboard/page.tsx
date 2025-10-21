'use client'

import { logger } from '@/lib/utils/logger'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/services/supabase/client'
import { getUserSummaries, type SummaryListItem } from '@/services/summaries'
import Menubar from '@/components/layout/Menubar'
import Footer from '@/components/layout/Footer'
import CollectionCard from '@/components/ui/collection-card'
import LectureSelector from '@/components/features/lecture-selector'
import SummaryCard from '@/components/DraggableSummaryCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Folder,
  Plus
} from 'lucide-react'

type Summary = SummaryListItem

interface Collection {
  id: string
  name: string
  description: string | null
  is_public: boolean
  share_slug: string | null
  created_at: string
  updated_at: string
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [, setEditingCollection] = useState<Collection | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    summaryId: string | null
    isPublic: boolean
  }>({ open: false, summaryId: null, isPublic: false })
  const supabase = createClient()

  useEffect(() => {
    // Support auto-import of shared collections via ?importCollection=slug
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('importCollection')
    if (slug) {
      (async () => {
        try {
          const res = await fetch(`/api/collections/${encodeURIComponent(slug)}/accept`, { method: 'POST' })
          if (!res.ok) throw new Error('Failed to import collection')
        } catch (e) {
          logger.error('Import collection failed', e)
          setError('Failed to import shared folder')
        } finally {
          // Clean query param from URL
          const url = new URL(window.location.href)
          url.searchParams.delete('importCollection')
          window.history.replaceState({}, '', url.toString())
        }
      })()
    }

    checkAuth()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function checkAuth() {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        router.push('/login')
        return
      }

      setUser(user)
      await Promise.all([
        loadUserSummaries(user.id),
        loadUserCollections()
      ])
    } catch (err) {
      logger.error('Auth check failed', err)
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  async function loadUserCollections() {
    try {
      const response = await fetch('/api/collections')
      if (!response.ok) {
        // Gracefully handle cases where the table doesn't exist yet or returns 401/500
        // Treat as an empty state instead of crashing the UI
        try {
          const errData = await response.json().catch(() => null)
          logger.warn('Collections API returned non-OK', { error: response.status, errData })
        } catch {}
        setCollections([])
        return
      }
      const data = await response.json()
      setCollections(Array.isArray(data.collections) ? data.collections : [])
    } catch (err) {
      logger.error('Error loading collections', err)
      // Do not surface a blocking error; show empty state instead
      setCollections([])
    }
  }

  // Enhanced collection management functions
  const handleCreateCollection = async (formData: FormData): Promise<void> => {
    const name = formData.get('name') as string
    const description = formData.get('description') as string

    if (!name?.trim()) return

    setIsLoading(true)
    try {
      const success = await createCollection(name.trim(), description?.trim() || undefined)
      if (success) {
        setShowCreateDialog(false)
        await handleRefresh()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const createCollection = async (name: string, description?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Failed to create collection')
        return false
      }

      await loadUserCollections()
      return true
    } catch (e) {
      logger.error(e)
      setError(e instanceof Error ? e.message : 'Failed to create collection')
      return false
    }
  }

  const handleUpdateCollection = async (id: string, updates: Partial<Collection>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/collections/manage?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Failed to update collection')
        return false
      }

      await loadUserCollections()
      return true
    } catch (e) {
      logger.error(e)
      setError(e instanceof Error ? e.message : 'Failed to update collection')
      return false
    }
  }

  const handleDeleteCollection = async (id: string): Promise<boolean> => {
    if (!confirm('Are you sure you want to delete this collection? This action cannot be undone.')) {
      return false
    }

    try {
      const res = await fetch(`/api/collections/manage?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Failed to delete collection')
        return false
      }

      await loadUserCollections()
      return true
    } catch (e) {
      logger.error(e)
      setError(e instanceof Error ? e.message : 'Failed to delete collection')
      return false
    }
  }

  const handleAddItemsToCollection = async (collectionId: string, summaryIds: string[]): Promise<boolean> => {
    try {
      const res = await fetch(`/api/collections/manage/items?id=${encodeURIComponent(collectionId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryIds })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error || 'Failed to add items to collection')
        return false
      }

      return true
    } catch (e) {
      logger.error(e)
      setError(e instanceof Error ? e.message : 'Failed to add items to collection')
      return false
    }
  }

  const handleToggleCollectionVisibility = async (id: string, isPublic: boolean): Promise<boolean> => {
    return handleUpdateCollection(id, { is_public: isPublic })
  }

  const handleRefresh = async (): Promise<void> => {
    if (user?.id) {
      await Promise.all([
        loadUserSummaries(user.id),
        loadUserCollections()
      ])
    }
  }

  async function loadUserSummaries(userId: string) {
    const result = await getUserSummaries(userId)

    if (!result.success) {
      setError(result.error || 'Failed to load your summaries')
      return
    }

    setSummaries(result.summaries)
  }

  // sign out handled by Menubar; no local handler required

  async function togglePublishStatus(summaryId: string, currentStatus: boolean) {
    try {
      // Use raw SQL or type assertion to handle strict typing
      const updateData = { is_public: !currentStatus };
      const { error } = await (supabase as any)
        .from('summaries')
        .update(updateData)
        .eq('id', summaryId)

      if (error) throw error

      // Update local state
      setSummaries(summaries.map(s => 
        s.id === summaryId ? { ...s, is_public: !currentStatus } : s
      ))
    } catch (err) {
      logger.error('Error updating publish status', err)
      setError('Failed to update publish status')
    }
  }

  function showDeleteConfirmation(summaryId: string) {
    const summary = summaries.find(s => s.id === summaryId)
    if (!summary) return

    setConfirmDialog({
      open: true,
      summaryId,
      isPublic: summary.is_public
    })
  }

  async function deleteSummary(summaryId: string) {
    const summary = summaries.find(s => s.id === summaryId)
    if (!summary) return

    try {
      if (summary.is_public) {
        // If published: Use server-side function to orphan it safely
        // This bypasses RLS restrictions while maintaining security
        const { data, error } = await supabase.rpc('orphan_published_summary', {
          summary_id_param: summaryId
        })

        if (error) {
          logger.error('RPC error', error)
          throw new Error(error.message || 'Failed to orphan summary')
        }

        if (data && !data.success) {
          logger.error('Orphan function error', data.error)
          throw new Error(data.error || 'Failed to orphan summary')
        }

        logger.info('Summary successfully orphaned:', data)
      } else {
        // If not published: Completely delete it
        const { error } = await supabase
          .from('summaries')
          .delete()
          .eq('id', summaryId)

        if (error) {
          logger.error('Delete error details', {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code
          })
          throw error
        }
      }

      // Update local state to remove from dashboard
      setSummaries(summaries.filter(s => s.id !== summaryId))
    } catch (err) {
      logger.error('Error deleting summary', err)
      if (err && typeof err === 'object' && 'message' in err) {
        setError(`Failed to delete summary: ${(err as any).message}`)
      } else {
        setError('Failed to delete summary')
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Menubar />

      {/* Main Content */}
      <main className="flex-1 container max-w-7xl mx-auto px-4 pt-24 pb-16">
        <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold mb-2">My Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your lecture summaries and study materials
            </p>
          </div>
          <Button asChild>
            <Link href="/upload">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload New Lecture
            </Link>
          </Button>
        </div>

        {error && (
          <div className="mb-6 p-4 border border-destructive/20 bg-destructive/10 rounded-lg">
            <p className="text-destructive text-sm">{error}</p>
            <Button 
              variant="ghost" 
              size="sm" 
              className="mt-2 h-auto p-0 text-destructive hover:text-destructive"
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Collections and Summaries Layout */}
        <div className="space-y-8">
          {/* Collections Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Collections</h2>
                <p className="text-muted-foreground">
                  Organize your summaries into folders
                </p>
              </div>
              <div className="flex items-center gap-3">
                <LectureSelector
                  availableSummaries={summaries}
                  collections={collections}
                  onAddToCollection={handleAddItemsToCollection}
                  onRefresh={handleRefresh}
                />
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="w-4 h-4 mr-2" />
                      New Collection
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Collection</DialogTitle>
                    </DialogHeader>
                    <form action={handleCreateCollection}>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            name="name"
                            placeholder="e.g. Week 1 – Linear Algebra"
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="description">Description (optional)</Label>
                          <Textarea
                            id="description"
                            name="description"
                            placeholder="Brief description of this collection..."
                            rows={3}
                          />
                        </div>
                      </div>
                      <DialogFooter className="mt-6">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCreateDialog(false)}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                          {isLoading ? "Creating..." : "Create Collection"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {collections.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Folder className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">No collections yet</h3>
                  <p className="text-sm text-muted-foreground mb-4 text-center max-w-sm">
                    Create your first collection to organize your summaries into folders.
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    Create Collection
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {collections.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    onClick={() => router.push(`/dashboard/collections/${collection.id}`)}
                    onEdit={() => setEditingCollection(collection)}
                    onDelete={() => handleDeleteCollection(collection.id)}
                    onToggleVisibility={() => handleToggleCollectionVisibility(collection.id, !collection.is_public)}
                    isLoading={isLoading}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Recent Summaries Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-semibold mb-2">Recent Summaries</h2>
                <p className="text-muted-foreground">
                  Your latest lecture summaries and study materials
                </p>
              </div>
            </div>

            {summaries.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <svg
                    className="w-20 h-20 text-muted-foreground mb-6"
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
                  <h3 className="text-xl font-semibold mb-3">No summaries yet</h3>
                  <p className="text-muted-foreground mb-6 text-center max-w-md text-lg">
                    Upload your first lecture recording to generate AI-powered summaries and study materials.
                  </p>
                  <Button size="lg" asChild>
                    <Link href="/upload">
                      <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Upload Your First Lecture
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {summaries.map((summary) => (
                  <SummaryCard
                    key={summary.id}
                    summary={summary}
                    onTogglePublishStatus={togglePublishStatus}
                    onDeleteSummary={showDeleteConfirmation}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
      
      <Footer />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
        onConfirm={() => {
          if (confirmDialog.summaryId) {
            deleteSummary(confirmDialog.summaryId)
          }
        }}
        title={
          confirmDialog.isPublic
            ? "Remove from Dashboard?"
            : "Delete Summary?"
        }
        description={
          confirmDialog.isPublic
            ? "This document is published. Removing it from your dashboard will keep it available in the public library for others to view. Your authorship will be anonymized."
            : "Are you sure you want to delete this summary? This action cannot be undone and all data will be permanently removed."
        }
        confirmText={confirmDialog.isPublic ? "Remove from Dashboard" : "Delete Summary"}
        cancelText="Cancel"
        variant={confirmDialog.isPublic ? "warning" : "destructive"}
        icon={confirmDialog.isPublic ? "archive" : "delete"}
      />
    </div>
  )
}