'use client'

import { logger } from '@/lib/utils/logger'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/services/supabase/client'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import PDFThumbnail from '@/components/PDFThumbnail'
import { getRecommendationsForUser } from '@/lib/recommendations/similarity'
import type {
  EnhancedSummary,
  DocumentType,
  FileCategory,
  DifficultyLevel
} from '@/lib/types/library'
import type { User } from '@supabase/supabase-js'

// Database row type from Supabase query
interface DbSummaryRow {
  id: string
  title: string | null
  university: string | null
  subject: string | null
  lecture_name: string | null
  course_code: string | null
  course_name: string | null
  professor: string | null
  semester: string | null
  academic_year: string | null
  document_type: string | null
  file_category: string | null
  difficulty_level: string | null
  language: string | null
  reputation_score: number | null
  pdf_url: string | null
  telegram_link: string | null
  created_at: string
  is_public: boolean | null
  user_id: string
  users?: {
    full_name: string | null
    reputation_score: number | null
  }
}

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

interface SimilarityScore {
  documentId: string
  score: number
  factors: {
    university: number
    subject: number
    courseCode: number
    tags: number
    keywords: number
    professor: number
    contentSimilarity: number
  }
}

interface ForYouSectionProps {
  currentUser: User
  onVote?: (summaryId: string, vote: 1 | -1) => void
}

export default function ForYouSection({
  currentUser,
  onVote
}: ForYouSectionProps) {
  const supabase = createClient()
  const [recommendations, setRecommendations] = useState<Summary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadRecommendations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Get user's uploaded documents
      // Note: tags and keywords columns removed as they don&apos;t exist in current schema
      const { data: userDocs, error: userDocsError } = await supabase
        .from('summaries')
        .select(
          `
          id, title, university, subject, lecture_name,
          course_code, course_name, professor, semester, academic_year,
          document_type, file_category, difficulty_level, language,
          reputation_score, pdf_url, telegram_link, created_at,
          is_public, user_id
        `
        )
        .eq('user_id', currentUser.id)
        .eq('is_public', true)

      const typedUserDocs = (userDocs || []) as DbSummaryRow[]

      if (userDocsError) {
        logger.error('Error loading user documents', {
          message: userDocsError.message || 'No error message',
          details: userDocsError.details || 'No details',
          hint: userDocsError.hint || 'No hint',
          code: userDocsError.code || 'No error code',
          fullError: userDocsError
        })
        throw userDocsError
      }

      // Get all public documents for comparison
      // Note: tags and keywords columns removed as they don&apos;t exist in current schema
      const { data: allDocs, error: allDocsError } = await supabase
        .from('summaries')
        .select(
          `
          id, title, university, subject, lecture_name,
          course_code, course_name, professor, semester, academic_year,
          document_type, file_category, difficulty_level, language,
          reputation_score, pdf_url, telegram_link, created_at,
          is_public, user_id,
          users (
            full_name,
            reputation_score
          )
        `
        )
        .eq('is_public', true)
        .not('pdf_url', 'is', null)
        .limit(200)

      const typedAllDocs = (allDocs || []) as DbSummaryRow[]

      if (allDocsError) {
        logger.error('Error loading all documents', {
          message: allDocsError.message || 'No error message',
          details: allDocsError.details || 'No details',
          hint: allDocsError.hint || 'No hint',
          code: allDocsError.code || 'No error code',
          fullError: allDocsError
        })
        throw allDocsError
      }

      // Transform to EnhancedSummary format
      const userDocuments: EnhancedSummary[] = typedUserDocs.map(
        transformToEnhancedSummary
      )
      const allDocuments: EnhancedSummary[] = typedAllDocs.map(
        transformToEnhancedSummary
      )

      // Get recommendations
      const recommendationScores = getRecommendationsForUser(
        userDocuments,
        allDocuments,
        { maxResults: 6, minScore: 0.2 }
      )

      // Convert back to Summary format with recommendation scores
      const recommendedDocs = recommendationScores
        .map(rec => {
          const doc = typedAllDocs.find(d => d.id === rec.documentId)
          if (!doc) return null

          return {
            id: doc.id,
            title: doc.title || doc.lecture_name || 'Untitled',
            university: doc.university || '',
            subject: doc.subject || '',
            lecture_name: doc.lecture_name || '',
            tags: [],
            keywords: [],
            reputation_score: Number(doc.reputation_score) || 0,
            pdf_url: doc.pdf_url || '',
            telegram_link: doc.telegram_link || '',
            created_at: doc.created_at,
            user: {
              full_name: doc.users?.full_name || 'Anonymous',
              reputation_score: doc.users?.reputation_score || 0
            },
            recommendationScore: rec.score,
            recommendationFactors: rec.factors
          }
        })
        .filter(Boolean) as (Summary & {
        recommendationScore: number
        recommendationFactors: SimilarityScore['factors']
      })[]

      // Fetch user votes if logged in
      if (currentUser && recommendedDocs.length > 0) {
        const summaryIds = recommendedDocs.map(s => s.id)
        const { data: votesData } = await supabase
          .from('votes')
          .select('summary_id, vote')
          .eq('user_id', currentUser.id)
          .in('summary_id', summaryIds)

        type VoteRow = { summary_id: string; vote: number }
        const typedVotesData = (votesData || []) as VoteRow[]

        const votesMap = new Map(
          typedVotesData.map(v => [v.summary_id, v.vote])
        )

        const recommendedWithVotes = recommendedDocs.map(s => ({
          ...s,
          user_vote: votesMap.get(s.id) || null
        }))

        setRecommendations(recommendedWithVotes)
      } else {
        setRecommendations(recommendedDocs)
      }
    } catch (err) {
      logger.error('Error loading recommendations', {
        message: err instanceof Error ? err.message : 'Unknown error',
        stack: err instanceof Error ? err.stack : undefined,
        error: err,
        errorType: typeof err,
        errorConstructor: err?.constructor?.name
      })
      setError(
        err instanceof Error ? err.message : 'Failed to load recommendations'
      )
    } finally {
      setLoading(false)
    }
  }, [currentUser, supabase])

  useEffect(() => {
    if (currentUser) {
      loadRecommendations()
    } else {
      setLoading(false)
    }
  }, [currentUser, loadRecommendations])

  const transformToEnhancedSummary = (doc: DbSummaryRow): EnhancedSummary => {
    const result: EnhancedSummary = {
      id: doc.id,
      user_id: doc.user_id,
      upload_id: '',
      transcription_id: '',
      summary_text: '',
      keywords: [],
      tags: [],
      language: doc.language || 'en',
      content_verified: false,
      metadata_complete: false,
      is_public: doc.is_public ?? false,
      reputation_score: doc.reputation_score || 0,
      created_at: doc.created_at,
      updated_at: doc.created_at
    }

    // Only add optional properties if they have values
    if (doc.title) result.title = doc.title
    if (doc.lecture_name) result.lecture_name = doc.lecture_name
    if (doc.university) result.university = doc.university
    if (doc.subject) result.subject = doc.subject
    if (doc.course_code) result.course_code = doc.course_code
    if (doc.course_name) result.course_name = doc.course_name
    if (doc.professor) result.professor = doc.professor
    if (doc.semester) result.semester = doc.semester
    if (doc.academic_year) result.academic_year = doc.academic_year
    if (doc.document_type)
      result.document_type = doc.document_type as DocumentType
    if (doc.file_category)
      result.file_category = doc.file_category as FileCategory
    if (doc.difficulty_level)
      result.difficulty_level = doc.difficulty_level as DifficultyLevel
    if (doc.pdf_url) result.pdf_url = doc.pdf_url
    if (doc.telegram_link) result.telegram_link = doc.telegram_link

    return result
  }

  if (!currentUser) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-normal">For You</h2>
        </div>
        <div className="rounded-2xl border border-border/30 bg-gradient-to-b from-muted/5 to-background p-12 text-center">
          <p className="text-muted-foreground mb-6 text-lg">
            Sign in to get personalized recommendations based on your uploaded
            documents
          </p>
          <Button asChild size="lg">
            <a href="/login">Sign In</a>
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-normal">For You</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/30 bg-gradient-to-b from-muted/5 to-background overflow-hidden animate-pulse"
            >
              <div className="h-[300px] bg-muted/20"></div>
              <div className="p-6 space-y-4">
                <div className="h-4 bg-muted/50 rounded w-3/4"></div>
                <div className="h-3 bg-muted/30 rounded w-1/2"></div>
                <div className="flex gap-2">
                  <div className="h-5 bg-muted/30 rounded w-16"></div>
                  <div className="h-5 bg-muted/30 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-normal">For You</h2>
        </div>
        <div className="rounded-2xl border border-destructive/30 bg-gradient-to-b from-destructive/5 to-background p-8 text-center">
          <p className="text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  if (recommendations.length === 0) {
    return (
      <div className="mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-normal">For You</h2>
        </div>
        <div className="rounded-2xl border border-border/30 bg-gradient-to-b from-muted/5 to-background p-12 text-center">
          <p className="text-muted-foreground mb-3 text-lg">
            No recommendations available yet
          </p>
          <p className="text-sm text-muted-foreground">
            Upload some documents to get personalized recommendations
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-normal">For You</h2>
        <span className="text-sm text-muted-foreground">
          Based on your {recommendations.length === 1 ? 'upload' : 'uploads'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {recommendations.map(summary => (
          <div
            key={summary.id}
            className="rounded-2xl border border-border/30 bg-gradient-to-b from-muted/5 to-background overflow-hidden group hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
          >
            {/* PDF Thumbnail Preview */}
            {summary.pdf_url && (
              <Link
                href={`/learn/${summary.id}`}
                className="block relative overflow-hidden bg-gradient-to-br from-muted/20 to-muted/5 flex items-center justify-center"
                style={{ height: '300px' }}
              >
                <PDFThumbnail
                  pdfUrl={summary.pdf_url}
                  width={450}
                  height={300}
                  className="cursor-pointer transition-transform group-hover:scale-105 duration-500"
                />
                <div className="absolute top-3 right-3 flex items-center gap-2 z-30">
                  {'recommendationScore' in summary && (
                    <Badge
                      variant="secondary"
                      className="text-xs px-2 py-0.5 shadow-lg backdrop-blur-sm bg-background/80"
                    >
                      {Math.round((summary as any).recommendationScore * 100)}%
                      match
                    </Badge>
                  )}
                  {summary.reputation_score !== 0 && (
                    <Badge
                      variant="tag-rounded"
                      className="shadow-lg backdrop-blur-sm bg-background/80"
                    >
                      {summary.reputation_score > 0 ? '+' : ''}
                      {summary.reputation_score}
                    </Badge>
                  )}
                </div>
              </Link>
            )}

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-normal leading-tight line-clamp-2 text-foreground">
                    {summary.lecture_name || 'Untitled'}
                  </h3>
                  {!summary.pdf_url && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {'recommendationScore' in summary && (
                        <Badge variant="secondary" className="text-xs px-2">
                          {Math.round(
                            (summary as any).recommendationScore * 100
                          )}
                          %
                        </Badge>
                      )}
                      {summary.reputation_score !== 0 && (
                        <Badge variant="tag-rounded">
                          {summary.reputation_score > 0 ? '+' : ''}
                          {summary.reputation_score}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-sm text-muted-foreground font-mono">
                  {summary.university || 'University not specified'}
                </p>
                {summary.subject && (
                  <p className="text-xs text-muted-foreground">
                    {summary.subject}
                  </p>
                )}
              </div>

              {summary.tags && summary.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {summary.tags.slice(0, 3).map((tag, idx) => (
                    <Badge key={idx} variant="tag" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {summary.tags.length > 3 && (
                    <Badge variant="tag" className="text-xs">
                      +{summary.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}

              <div className="pt-4 border-t border-border/30 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {onVote && (
                    <>
                      <button
                        onClick={() => onVote(summary.id, 1)}
                        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all ${
                          summary.user_vote === 1
                            ? 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-950 scale-110'
                            : 'text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/50'
                        }`}
                        title="Upvote"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 15l7-7 7 7"
                          />
                        </svg>
                      </button>
                      <span className="text-sm font-mono min-w-[3ch] text-center text-foreground">
                        {Number(summary.reputation_score) || 0}
                      </span>
                      <button
                        onClick={() => onVote(summary.id, -1)}
                        className={`h-9 w-9 rounded-lg flex items-center justify-center transition-all ${
                          summary.user_vote === -1
                            ? 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-950 scale-110'
                            : 'text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50'
                        }`}
                        title="Downvote"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                <Button
                  asChild
                  size="default"
                  variant="outline"
                  className="h-9"
                >
                  <Link href={`/learn/${summary.id}`}>Learn</Link>
                </Button>
              </div>

              <div className="pt-3 border-t border-border/30 text-xs text-muted-foreground">
                <p>By {summary.user?.full_name || 'Anonymous'}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
