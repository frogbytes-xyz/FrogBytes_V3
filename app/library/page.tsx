'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/services/supabase/client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ForYouSection from '@/components/ForYouSection'
import PDFThumbnail from '@/components/PDFThumbnail'
import Menubar from '@/components/layout/Menubar'
import Footer from '@/components/layout/Footer'
import { enhancedSearch } from '@/lib/recommendations/similarity'
import type { EnhancedSummary } from '@/lib/types/library'
import { useVoting } from '@/lib/hooks/useVoting'

interface Summary {
  id: string
  title: string
  university: string
  subject: string
  lecture_name: string
  tags: string[]
  keywords: string[]
  reputation_score: number
  pdf_url: string
  telegram_link: string
  created_at: string
  user: {
    full_name: string
    reputation_score: number
  }
  user_vote?: number | null
}

export default function LibraryPage() {
  const router = useRouter()
  const supabase = createClient()
  const [summaries, setSummaries] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  // Voting hook with anti-spam protection
  const { handleVote: handleVoteWithDebounce, voteStates, clearPendingVotes } = useVoting({
    onVoteChange: (summaryId, newScore, newVote) => {
      setSummaries(prev =>
        prev.map(s =>
          s.id === summaryId
            ? { ...s, reputation_score: newScore, user_vote: newVote }
            : s
        )
      )
    },
    debounceMs: 500
  })
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUniversity, setSelectedUniversity] = useState<string>('all')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('all')
  const [selectedDifficultyLevel, setSelectedDifficultyLevel] = useState<string>('all')
  const [minReputation, setMinReputation] = useState<number>(0)
  const [sortBy, setSortBy] = useState<'reputation' | 'recent'>('reputation')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  
  // Filter options
  const [universities, setUniversities] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>([])

  useEffect(() => {
    async function init() {
      await loadUser()
      await loadSummaries()
      await loadFilterOptions()
    }

    init()

    // Cleanup pending votes on unmount
    return () => {
      clearPendingVotes()
    }
  }, [sortBy, clearPendingVotes])

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const loadSummaries = async () => {
    try {
      setLoading(true)
      
      // Query summaries with user info
      // Note: tags and keywords columns removed as they don't exist in current schema
      const { data, error: fetchError } = await supabase
        .from('summaries')
        .select(`
          id,
          title,
          university,
          subject,
          lecture_name,
          reputation_score,
          pdf_url,
          telegram_link,
          created_at,
          user_id,
          users (
            full_name,
            reputation_score
          )
        `)
        .eq('is_public', true)
        .not('pdf_url', 'is', null)
        .order(sortBy === 'reputation' ? 'reputation_score' : 'created_at', { ascending: false })
        .limit(100)

      if (fetchError) {
        console.error('Fetch error:', {
          message: fetchError.message || 'No error message',
          details: fetchError.details || 'No details',
          hint: fetchError.hint || 'No hint',
          code: fetchError.code || 'No error code',
          fullError: fetchError
        })
        throw fetchError
      }

      // Transform data to match interface
      const transformedData = (data || []).map((item: any) => ({
        id: item.id,
        title: item.title || item.lecture_name || 'Untitled',
        university: item.university || '',
        subject: item.subject || '',
        lecture_name: item.lecture_name || '',
        tags: item.tags || [],
        keywords: item.keywords || [],
        reputation_score: Number(item.reputation_score) || 0,
        pdf_url: item.pdf_url,
        telegram_link: item.telegram_link || '',
        created_at: item.created_at,
        user: {
          full_name: item.users?.full_name || 'Anonymous',
          reputation_score: item.users?.reputation_score || 0
        }
      }))

      if (currentUser) {
        const summaryIds = transformedData.map((s: any) => s.id)
        if (summaryIds.length > 0) {
          const { data: votesData } = await supabase
            .from('votes')
            .select('summary_id, vote')
            .eq('user_id', currentUser.id)
            .in('summary_id', summaryIds)

          const votesMap = new Map(
            (votesData || []).map((v: any) => [v.summary_id, v.vote])
          )

          setSummaries(
            transformedData.map((s: any) => ({
              ...s,
              user_vote: votesMap.get(s.id) || null
            }))
          )
        } else {
          setSummaries([])
        }
      } else {
        setSummaries(transformedData)
      }
    } catch (err) {
      console.error('Error loading summaries:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        error: err,
        errorType: typeof err,
        errorConstructor: err?.constructor?.name
      })
      setError(err instanceof Error ? err.message : 'Failed to load library')
    } finally {
      setLoading(false)
    }
  }

  const loadFilterOptions = async () => {
    try {
      const { data } = await supabase
        .from('summaries')
        .select('university, subject')
        .eq('is_public', true)
        .not('university', 'is', null)
        .not('subject', 'is', null)

      if (data) {
        const uniqueUniversities = [...new Set(data.map((d: any) => d.university).filter(Boolean))] as string[]
        const uniqueSubjects = [...new Set(data.map((d: any) => d.subject).filter(Boolean))] as string[]
        setUniversities(uniqueUniversities.sort())
        setSubjects(uniqueSubjects.sort())
      }
    } catch (err) {
      console.error('Error loading filter options:', err)
      // Set empty arrays on error
      setUniversities([])
      setSubjects([])
    }
  }

  const handleVote = useCallback(
    (summaryId: string, vote: 1 | -1) => {
      if (!currentUser) {
        router.push('/login')
        return
      }

      const summary = summaries.find(s => s.id === summaryId)
      if (!summary) return

      // Normalize user_vote to match VoteValue type (1 | -1 | null)
      const currentVote: 1 | -1 | null = 
        summary.user_vote === 1 ? 1 : 
        summary.user_vote === -1 ? -1 : 
        null

      handleVoteWithDebounce(
        summaryId,
        currentVote,
        summary.reputation_score,
        vote,
        currentUser.id
      )
    },
    [currentUser, summaries, router, handleVoteWithDebounce]
  )

  const transformToEnhancedSummary = (summary: Summary): EnhancedSummary => ({
    id: summary.id,
    user_id: '',
    upload_id: '',
    transcription_id: '',
    title: summary.title,
    lecture_name: summary.lecture_name,
    summary_text: '',
    latex_content: '',
    keywords: summary.keywords || [],
    tags: summary.tags || [],
    university: summary.university,
    subject: summary.subject,
    course_code: '',
    course_name: '',
    professor: '',
    semester: '',
    academic_year: '',
    document_type: 'lecture' as any,
    file_category: 'academic' as any,
    difficulty_level: 'intermediate' as any,
    language: 'en',
    content_verified: false,
    metadata_complete: false,
    pdf_url: summary.pdf_url,
    telegram_link: summary.telegram_link,
    is_public: true,
    reputation_score: summary.reputation_score,
    created_at: summary.created_at,
    updated_at: summary.created_at
  })

  const filteredSummaries = (() => {
    const enhancedSummaries = summaries.map(transformToEnhancedSummary)

    const filters: any = {}
    if (selectedUniversity !== 'all') filters.university = selectedUniversity
    if (selectedSubject !== 'all') filters.subject = selectedSubject
    if (selectedDocumentType !== 'all') filters.documentType = selectedDocumentType
    if (selectedDifficultyLevel !== 'all') filters.difficultyLevel = selectedDifficultyLevel
    if (minReputation > 0) filters.minReputation = minReputation

    const results = enhancedSearch(enhancedSummaries, searchQuery, filters)

    // Convert back to Summary format
    return results.map(enhanced => {
      const original = summaries.find(s => s.id === enhanced.id)!
      return original
    })
  })()

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedUniversity('all')
    setSelectedSubject('all')
    setSelectedDocumentType('all')
    setSelectedDifficultyLevel('all')
    setMinReputation(0)
  }

  return (
    <main className="min-h-screen">
      <Menubar />
      
      {/* Page Header */}
      <div className="pt-28 pb-16 px-4 bg-gradient-to-b from-muted/5 to-background">
        <div className="container max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-normal mb-4 text-foreground">Public Library</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Browse and discover study materials from students worldwide
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-gradient-to-b from-muted/5 to-background border-b border-border/30">
        <div className="container max-w-6xl mx-auto px-4 py-8">
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="flex gap-3">
              <Input
                type="text"
                placeholder="Search by title, subject, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 h-12 text-base"
              />
              {(searchQuery || selectedUniversity !== 'all' || selectedSubject !== 'all') && (
                <Button variant="ghost" size="lg" onClick={clearFilters}>
                  Clear
                </Button>
              )}
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-4">
              {/* University Filter */}
              <select
                value={selectedUniversity}
                onChange={(e) => setSelectedUniversity(e.target.value)}
                className="h-10 px-4 py-2 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All Universities</option>
                {universities.map(uni => (
                  <option key={uni} value={uni}>{uni}</option>
                ))}
              </select>

              {/* Subject Filter */}
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="h-10 px-4 py-2 text-sm border border-border rounded-lg bg-background hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All Subjects</option>
                {subjects.map(subj => (
                  <option key={subj} value={subj}>{subj}</option>
                ))}
              </select>

              <div className="h-6 w-px bg-border/50" />

              {/* Sort Options */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium">Sort:</span>
                <Button
                  variant={sortBy === 'reputation' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('reputation')}
                  className="h-10 px-4"
                >
                  Top Rated
                </Button>
                <Button
                  variant={sortBy === 'recent' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSortBy('recent')}
                  className="h-10 px-4"
                >
                  Recent
                </Button>
              </div>

              <div className="h-6 w-px bg-border/50" />

              {/* View Mode */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium">View:</span>
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-10 w-10 p-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-10 w-10 p-0"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </Button>
              </div>

              {/* Results Count */}
              <span className="text-sm text-muted-foreground ml-auto font-medium">
                {filteredSummaries.length} {filteredSummaries.length === 1 ? 'result' : 'results'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container max-w-6xl mx-auto px-4 py-12">
        {/* For You Section */}
        <ForYouSection currentUser={currentUser} onVote={handleVote} />

        {/* Main Library Content */}
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-normal text-foreground">All Documents</h2>
            <div className="h-px bg-border/30 flex-1"></div>
          </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-sm text-muted-foreground">Loading library...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 border border-destructive/20 bg-destructive/10">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : filteredSummaries.length === 0 ? (
          <div className="text-center py-20 space-y-4">
            {summaries.length === 0 ? (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <p className="text-lg font-medium text-foreground">
                  No public summaries available yet
                </p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Be the first to contribute! Upload your lecture notes and share them with the community.
                </p>
                {currentUser && (
                  <Button asChild className="mt-4">
                    <Link href="/upload">Upload First Lecture</Link>
                  </Button>
                )}
                {!currentUser && (
                  <Button asChild className="mt-4">
                    <Link href="/login">Sign In to Upload</Link>
                  </Button>
                )}
              </>
            ) : (
              <>
                <div className="mx-auto w-16 h-16 rounded-full bg-accent flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <p className="text-base text-muted-foreground">
                  No summaries match your filters
                </p>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear All Filters
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className={viewMode === 'grid'
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-6'
          }>
            {filteredSummaries.map((summary) => (
              viewMode === 'grid' ? (
                <Card key={summary.id} className="hover:shadow-lg transition-all overflow-hidden group">
                  {/* PDF Thumbnail Preview */}
                  {summary.pdf_url && (
                    <Link href={`/learn/${summary.id}`} className="block relative overflow-hidden bg-gradient-to-br from-accent to-muted flex items-center justify-center" style={{ height: '300px' }}>
                      <PDFThumbnail
                        pdfUrl={summary.pdf_url}
                        width={450}
                        height={300}
                        className="cursor-pointer transition-transform group-hover:scale-105"
                        pageCountPosition="right-3"
                      />
                    </Link>
                  )}

                  <CardHeader className={!summary.pdf_url ? 'pt-6' : ''}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <CardTitle className="text-lg font-medium leading-tight line-clamp-2">
                        {summary.lecture_name || 'Untitled'}
                      </CardTitle>
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
                      {/* Tags */}
                      {summary.tags && summary.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {summary.tags.slice(0, 4).map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {summary.tags.length > 4 && (
                            <Badge variant="secondary" className="text-xs">
                              +{summary.tags.length - 4}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Date and Author */}
                      <div className="text-xs text-muted-foreground">
                        <p>By {summary.user?.full_name || 'Anonymous'}</p>
                        <p>{new Date(summary.created_at).toLocaleDateString()}</p>
                      </div>

                      {/* Action Buttons */}
                      <div className="pt-3 border-t flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleVote(summary.id, 1)}
                            disabled={!currentUser || voteStates[summary.id]?.isVoting}
                            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                              summary.user_vote === 1
                                ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950'
                                : 'text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={!currentUser ? 'Sign in to vote' : 'Upvote'}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                            </svg>
                          </button>
                          <span className="text-sm font-mono font-medium px-2 min-w-[2.5rem] text-center">
                            {summary.reputation_score > 0 ? '+' : ''}{summary.reputation_score}
                          </span>
                          <button
                            onClick={() => handleVote(summary.id, -1)}
                            disabled={!currentUser || voteStates[summary.id]?.isVoting}
                            className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                              summary.user_vote === -1
                                ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950'
                                : 'text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={!currentUser ? 'Sign in to vote' : 'Downvote'}
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        </div>

                        <Button asChild size="sm" variant="default" className="flex-1">
                          <Link href={`/learn/${summary.id}`}>
                            Study
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card key={summary.id} className="hover:shadow-lg transition-all">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-6">
                      {/* Voting Column */}
                      <div className="flex flex-col items-center gap-2 pt-1">
                        <button
                          onClick={() => handleVote(summary.id, 1)}
                          disabled={!currentUser || voteStates[summary.id]?.isVoting}
                          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                            summary.user_vote === 1
                              ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950'
                              : 'text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={!currentUser ? 'Sign in to vote' : 'Upvote'}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <span className="text-sm font-mono font-medium">
                          {Number(summary.reputation_score) || 0}
                        </span>
                        <button
                          onClick={() => handleVote(summary.id, -1)}
                          disabled={!currentUser || voteStates[summary.id]?.isVoting}
                          className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                            summary.user_vote === -1
                              ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950'
                              : 'text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                          title={!currentUser ? 'Sign in to vote' : 'Downvote'}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      {/* Content Column */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0 space-y-3">
                            <h3 className="text-lg font-medium leading-tight">
                              {summary.title || summary.lecture_name || 'Untitled'}
                            </h3>
                            <div className="flex items-center flex-wrap gap-2 text-sm text-muted-foreground">
                              {summary.university && (
                                <span className="font-mono text-xs">{summary.university}</span>
                              )}
                              {summary.subject && (
                                <>
                                  <span>•</span>
                                  <span>{summary.subject}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>By {summary.user?.full_name || 'Anonymous'}</span>
                              <span>•</span>
                              <span>{new Date(summary.created_at).toLocaleDateString()}</span>
                            </div>
                            {summary.tags && summary.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {summary.tags.slice(0, 6).map((tag, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {summary.tags.length > 6 && (
                                  <Badge variant="secondary" className="text-xs">
                                    +{summary.tags.length - 6}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>

                          <Button asChild size="sm" variant="default" className="flex-shrink-0">
                            <Link href={`/learn/${summary.id}`}>
                              Study
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            ))}
          </div>
        )}
        </div>
      </div>
      
      <Footer />
    </main>
  )
}
