'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/services/supabase/client'
import Menubar from '@/components/layout/Menubar'
import PDFThumbnail from '@/components/PDFThumbnail'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/hooks/use-toast'
import { 
  ArrowLeft, 
  Share, 
  Users, 
  Lock, 
  Trash2,
  Copy,
  Eye,
} from 'lucide-react'

interface Summary {
  id: string
  title: string
  lecture_name: string
  university: string
  subject: string
  is_public: boolean
  reputation_score: number
  created_at: string
  updated_at: string
  pdf_url: string | null
}

interface Collection {
  id: string
  name: string
  description: string | null
  is_public: boolean
  share_slug: string | null
  created_at: string
  updated_at: string
}

interface CollectionDetailPageProps {
  params: Promise<{ id: string }>
}

export default function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [collection, setCollection] = useState<Collection | null>(null)
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [error, setError] = useState<string | null>(null)
  const [collectionId, setCollectionId] = useState<string>('')
  const supabase = createClient()

  useEffect(() => {
    const initPage = async () => {
      const resolvedParams = await params
      setCollectionId(resolvedParams.id)
      await checkAuth(resolvedParams.id)
    }
    initPage()
  }, [params])

  async function checkAuth(passedId?: string) {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      if (error || !user) {
        // Guest mode: allow viewing but with restrictions
        setUser(null)
        const idToLoad = passedId || collectionId
        if (idToLoad) {
          await loadCollectionData(idToLoad, true) // true = guest mode
        }
      } else {
        // Authenticated user
        setUser(user)
        const idToLoad = passedId || collectionId
        if (idToLoad) {
          await loadCollectionData(idToLoad, false)
        }
      }
    } catch (err) {
      console.error('Auth check failed:', err)
      // Still allow viewing in guest mode
      setUser(null)
      const idToLoad = passedId || collectionId
      if (idToLoad) {
        await loadCollectionData(idToLoad, true)
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadCollectionData(id: string, isGuest: boolean = false) {
    if (!id) return

    try {
      // First, get the collection details
      const collectionResponse = await fetch(`/api/collections/manage?id=${encodeURIComponent(id)}`)
      if (!collectionResponse.ok) {
        if (collectionResponse.status === 404) {
          setError('Collection not found')
          return
        }
        // For guests, try to load public collection data differently if the auth endpoint fails
        if (isGuest) {
          // Try to fetch public collection data via alternative means
          const { data: publicCollection, error: publicError } = await supabase
            .from('collections')
            .select('*')
            .eq('id', id)
            .eq('is_public', true)
            .single()
          
          if (publicError || !publicCollection) {
            setError('Collection not found or not public')
            return
          }
          
          setCollection(publicCollection)
          // Load summaries from collection_items
          const { data: items } = await supabase
            .from('collection_items')
            .select('summary_id')
            .eq('collection_id', id)
          
          if (items && items.length > 0) {
            const summaryIds = items.map((item: any) => item.summary_id)
            const { data: publicSummaries } = await supabase
              .from('summaries')
              .select('*')
              .in('id', summaryIds)
              .eq('is_public', true)
            
            setSummaries(publicSummaries || [])
          }
          return
        }
        throw new Error('Failed to load collection')
      }

      const collectionData = await collectionResponse.json()
      setCollection(collectionData.collection)

      // Then get the collection items
      const itemsResponse = await fetch(`/api/collections/manage/items?id=${encodeURIComponent(id)}`)
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json()
        setSummaries(itemsData.summaries || [])
      } else if (!isGuest) {
        // If items endpoint fails for auth users, still show the collection (it might be empty)
        setSummaries([])
      } else {
        // For guests, try direct DB query
        const { data: items } = await supabase
          .from('collection_items')
          .select('summary_id')
          .eq('collection_id', id)
        
        if (items && items.length > 0) {
          const summaryIds = items.map((item: any) => item.summary_id)
          const { data: publicSummaries } = await supabase
            .from('summaries')
            .select('*')
            .in('id', summaryIds)
            .eq('is_public', true)
          
          setSummaries(publicSummaries || [])
        }
      }
    } catch (err) {
      console.error('Error loading collection:', err)
      setError('Failed to load collection')
    }
  }

  async function togglePublishStatus(summaryId: string, currentStatus: boolean) {
    if (!user) {
      toast.error('Please log in to perform this action')
      return
    }
    
    try {
      const updateData = { is_public: !currentStatus }
      const { error } = await (supabase as any)
        .from('summaries')
        .update(updateData)
        .eq('id', summaryId)

      if (error) throw error

      setSummaries(summaries.map(s => 
        s.id === summaryId ? { ...s, is_public: !currentStatus } : s
      ))
      toast.success(currentStatus ? 'Made private' : 'Published to library')
    } catch (err) {
      console.error('Error updating publish status:', err)
      toast.error('Failed to update publish status')
    }
  }

  async function deleteSummary(summaryId: string) {
    if (!user) {
      toast.error('Please log in to perform this action')
      return
    }
    
    if (!confirm('Are you sure you want to remove this summary from the collection?')) {
      return
    }

    try {
      const response = await fetch(`/api/collections/manage/items?id=${encodeURIComponent(collectionId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summaryIds: [summaryId] })
      })

      if (!response.ok) throw new Error('Failed to remove summary')

      setSummaries(summaries.filter(s => s.id !== summaryId))
      toast.success('Summary removed from collection')
    } catch (err) {
      console.error('Error removing summary:', err)
      toast.error('Failed to remove summary')
    }
  }

  async function shareCollection() {
    if (!collection || !user) {
      toast.error('Please log in to perform this action')
      return
    }

    try {
      const response = await fetch(`/api/collections/manage?id=${encodeURIComponent(collection.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: true })
      })

      if (!response.ok) throw new Error('Failed to share collection')

      const data = await response.json()
      const shareUrl = `${window.location.origin}/collections/${data.collection.share_slug}`
      
      navigator.clipboard.writeText(shareUrl)
      toast.success('Share link copied to clipboard!')
      
      // Refresh collection data to get the share_slug
      await loadCollectionData(collectionId, false)
    } catch (err) {
      console.error('Error sharing collection:', err)
      toast.error('Failed to share collection')
    }
  }

  async function copyShareLink() {
    if (!collection?.share_slug) return

    const shareUrl = `${window.location.origin}/collections/${collection.share_slug}`
    navigator.clipboard.writeText(shareUrl)
    toast.success('Share link copied to clipboard!')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading collection...</p>
        </div>
      </div>
    )
  }

  if (error || !collection) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Menubar />
        <main className="flex-1 container max-w-7xl mx-auto px-4 py-8 pt-24">
          <div className="flex flex-col items-center justify-center py-20">
            <h1 className="text-2xl font-bold mb-2">Collection Not Found</h1>
            <p className="text-muted-foreground mb-6">{error || 'The collection you\'re looking for doesn\'t exist.'}</p>
            <Button asChild>
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Menubar />

      {/* Main content wrapper with conditional blur */}
      <div className="relative flex-1">
        <main className={`container max-w-7xl mx-auto px-4 py-8 pt-24 ${!user ? 'filter blur-sm pointer-events-none' : ''}`}>
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href={user ? "/dashboard" : "/"}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to {user ? "Dashboard" : "Home"}
                </Link>
              </Button>
            </div>

            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{collection.name}</h1>
                {collection.description && (
                  <p className="text-muted-foreground mb-2">{collection.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Created {new Date(collection.created_at).toLocaleDateString()}</span>
                  <Badge variant={collection.is_public ? 'default' : 'secondary'}>
                    {collection.is_public ? (
                      <>
                        <Users className="w-3 h-3 mr-1" />
                        Shared
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3 mr-1" />
                        Private
                      </>
                    )}
                  </Badge>
                  <span>{summaries.length} summaries</span>
                </div>
              </div>

              {user && (
                <div className="flex gap-2">
                  {collection.is_public && collection.share_slug ? (
                    <Button variant="outline" onClick={copyShareLink}>
                      <Copy className="w-4 h-4 mr-2" />
                      Copy Link
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={shareCollection}>
                      <Share className="w-4 h-4 mr-2" />
                      Share Collection
                    </Button>
                  )}
                </div>
              )}
            </div>
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

          {/* Summaries */}
          <section>
            {summaries.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Eye className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">No summaries in this collection</h3>
                  <p className="text-muted-foreground mb-4 text-center max-w-md">
                    {user 
                      ? "Start organizing by dragging summaries into this collection from your dashboard."
                      : "This collection is empty or contains only private summaries."}
                  </p>
                  {user && (
                    <Button asChild>
                      <Link href="/dashboard">Go to Dashboard</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {summaries.map((summary) => (
                  <Card key={summary.id} className="hover:shadow-lg transition-all overflow-hidden group">
                    {/* PDF Thumbnail Preview */}
                    {summary.pdf_url && (
                      <Link href={`/learn/${summary.id}`} className="block relative overflow-hidden bg-gradient-to-br from-accent to-muted" style={{ height: '300px' }}>
                        <PDFThumbnail
                          pdfUrl={summary.pdf_url}
                          width={450}
                          height={300}
                          className="cursor-pointer transition-transform group-hover:scale-105"
                        />
                        <div className="absolute top-2 right-2">
                          <Badge variant={summary.is_public ? 'default' : 'secondary'} className="shadow-lg">
                            {summary.is_public ? 'Published' : 'Private'}
                          </Badge>
                        </div>
                      </Link>
                    )}

                    <CardHeader className={!summary.pdf_url ? 'pt-6' : ''}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <CardTitle className="text-lg font-medium leading-tight line-clamp-2">
                          {summary.title || summary.lecture_name || 'Untitled'}
                        </CardTitle>
                        {!summary.pdf_url && (
                          <Badge variant={summary.is_public ? 'default' : 'secondary'} className="flex-shrink-0">
                            {summary.is_public ? 'Published' : 'Private'}
                          </Badge>
                        )}
                      </div>
                      {(summary.university || summary.subject) && (
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {summary.university && (
                            <p className="font-mono text-xs">{summary.university}</p>
                          )}
                          {summary.subject && <p>{summary.subject}</p>}
                        </div>
                      )}
                    </CardHeader>

                    <CardContent>
                      <div className="space-y-3">
                        {summary.is_public && (
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                            <span className="font-medium">{summary.reputation_score}</span>
                            <span className="text-muted-foreground">upvotes</span>
                          </div>
                        )}

                        <div className="text-xs text-muted-foreground">
                          <p>Created {new Date(summary.created_at).toLocaleDateString()}</p>
                          {summary.updated_at !== summary.created_at && (
                            <p>Updated {new Date(summary.updated_at).toLocaleDateString()}</p>
                          )}
                        </div>

                        <div className="pt-3 border-t flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="default" className="flex-1">
                            <Link href={`/learn/${summary.id}`}>
                              <Eye className="w-4 h-4 mr-1" />
                              Study
                            </Link>
                          </Button>

                          {user && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => togglePublishStatus(summary.id, summary.is_public)}
                                title={summary.is_public ? 'Make private' : 'Publish to library'}
                              >
                                {summary.is_public ? (
                                  <Lock className="w-4 h-4" />
                                ) : (
                                  <Share className="w-4 h-4" />
                                )}
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => deleteSummary(summary.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Remove from collection"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </main>

        {/* Guest CTA overlay - similar to learn page */}
        {!user && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/80 backdrop-blur-md border rounded-lg p-6 text-center shadow-lg max-w-md mx-4">
              <h2 className="text-xl font-semibold mb-2">Create an account to access this collection</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Log in or register to view all summaries, import this collection, and access the full features.
              </p>
              <div className="flex gap-3 justify-center">
                <Button onClick={() => router.push(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`)}>
                  Log in
                </Button>
                <Button variant="outline" onClick={() => router.push(`/register?returnUrl=${encodeURIComponent(window.location.pathname)}`)}>
                  Register
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}