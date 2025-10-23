'use client'

import { logger } from '@/lib/utils/logger'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { createClient } from '@/services/supabase/client'
import AICopilot from '@/components/AICopilot'
import QuizGenerator from '@/components/QuizGenerator'
import FlashcardGenerator from '@/components/FlashcardGenerator'
import Menubar from '@/components/layout/Menubar'
import { DocumentShareButton } from '@/components/features/document-share-button'
import { Button } from '@/components/ui/button'

// Import PDFViewer dynamically with no SSR to avoid DOMMatrix error
const PDFViewer = dynamic(() => import('@/components/PDFViewer'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-muted rounded-lg">
      <div className="text-center p-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-muted-foreground">Loading PDF viewer...</p>
      </div>
    </div>
  )
})

export default function LearnPage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [documentContext, setDocumentContext] = useState<string>('')
  const [summaryTitle, setSummaryTitle] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'copilot' | 'quiz' | 'flashcards'>(
    'copilot'
  )
  const [isExpanded, setIsExpanded] = useState(false)
  const supabase = createClient()

  // Unwrap params using React.use()
  const { id: summaryId } = use(params)

  useEffect(() => {
    checkAuthAndLoadContent()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryId])

  async function checkAuthAndLoadContent() {
    try {
      const {
        data: { user },
        error
      } = await supabase.auth.getUser()

      if (error || !user) {
        // Not logged in: proceed in guest mode (will blur content and show CTA)
        setUser(null)
        await loadSummary('', summaryId)
        return
      }

      setUser(user)
      await loadSummary(user.id, summaryId)
    } catch (err) {
      logger.error('Auth check failed', err)
      // Guest mode fallback
      setUser(null)
      await loadSummary('', summaryId)
    } finally {
      setLoading(false)
    }
  }

  async function loadSummary(userId: string, summaryId: string) {
    try {
      const { data: summary, error: dbError } = await supabase
        .from('summaries')
        .select(
          'latex_content, pdf_url, title, lecture_name, user_id, is_public'
        )
        .eq('id', summaryId)
        .single()

      if (dbError) {
        logger.error('Error loading summary', dbError)
        setError('Failed to load summary')
        return
      }

      if (!summary) {
        setError('Summary not found')
        return
      }

      logger.info('Summary loaded:', {
        id: summaryId,
        has_latex: !!(summary as any).latex_content,
        pdf_url: (summary as any).pdf_url,
        title: (summary as any).title || (summary as any).lecture_name
      })

      // Check if user has access (owner or public)
      if ((summary as any).user_id !== userId && !(summary as any).is_public) {
        setError('You do not have access to this summary')
        return
      }

      // Set document context for AI copilot
      if ((summary as any).latex_content) {
        setDocumentContext((summary as any).latex_content)
      }

      // Set PDF URL if available
      if ((summary as any).pdf_url) {
        logger.info('Setting PDF URL:', (summary as any).pdf_url)
        setPdfUrl((summary as any).pdf_url)
      } else {
        logger.warn('No PDF URL found for summary')
        // For guest users, still allow viewing the page (with CTA overlay)
      }

      // Set title
      setSummaryTitle(
        (summary as any).title || (summary as any).lecture_name || 'Untitled'
      )
    } catch (err) {
      logger.error('Error loading content', err)
      setError('Failed to load content')
    }
  }

  // sign out handled by Menubar; no local handler required

  function handlePDFError(error: Error) {
    logger.error('PDF load error', error)
    setError('Failed to load PDF document')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={() => router.push('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-screen flex flex-col bg-gradient-to-b from-background via-background to-muted/5"
      style={{ touchAction: 'pan-x pan-y' }}
    >
      <div className="flex-shrink-0 z-40">
        <Menubar />
      </div>

      {/* Main Content Area */}
      <div
        className="relative flex-1 flex overflow-hidden"
        style={{ touchAction: 'pan-x pan-y' }}
      >
        {/* Blurred content wrapper when guest */}
        <div
          className={`${!user ? 'filter blur-sm pointer-events-none' : ''} flex w-full`}
        >
          {/* PDF Viewer */}
          <main
            className={`transition-all duration-300 ease-in-out overflow-hidden bg-gradient-to-br from-background/50 to-muted/10 ${
              isExpanded ? 'w-0 p-0 opacity-0' : 'flex-1 p-6 pt-20'
            }`}
          >
            <div className="mb-6 flex items-center justify-between gap-6 min-w-0">
              <h1 className="text-2xl font-normal tracking-tight truncate min-w-0 flex-1">
                {summaryTitle}
              </h1>
              <div className="flex-shrink-0">
                <DocumentShareButton
                  documentId={summaryId}
                  documentTitle={summaryTitle}
                />
              </div>
            </div>
            <div className="h-[calc(100%-7rem)] rounded-2xl overflow-hidden border border-border/30 bg-background shadow-xl">
              <PDFViewer pdfUrl={pdfUrl} onLoadError={handlePDFError} />
            </div>
          </main>

          {/* Sidebar - expands to full width when isExpanded */}
          <aside
            className={`flex flex-col border-l bg-gradient-to-b from-muted/5 to-background transition-all duration-300 ease-in-out relative z-10 pt-16 ${
              isExpanded ? 'flex-1' : 'w-96'
            }`}
          >
            {/* Expand/Collapse Arrow Button - Positioned on the border */}
            <button
              onClick={() => {
                logger.info('Toggling expand mode:', {
                  isExpanded: !isExpanded
                })
                setIsExpanded(!isExpanded)
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-50 w-8 h-16 bg-background border-2 border-border rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group hover:scale-110"
              type="button"
              title={
                isExpanded
                  ? 'Show PDF and content side by side'
                  : 'Expand to full width view'
              }
            >
              {isExpanded ? (
                <svg
                  className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              ) : (
                <svg
                  className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              )}
            </button>

            {/* Tabs */}
            <div className="border-b px-4 py-3 bg-background/80 backdrop-blur-sm relative z-50">
              <div className="flex items-center justify-between gap-3">
                {/* Tab Buttons with Icons */}
                <div className="flex gap-1 flex-1 min-w-0 bg-muted/50 rounded-lg p-1">
                  <button
                    onClick={() => {
                      logger.info('Switching to copilot tab')
                      setActiveTab('copilot')
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      activeTab === 'copilot'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                    type="button"
                  >
                    <svg
                      className="h-4 w-4 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <span className="hidden sm:inline">Copilot</span>
                  </button>
                  <button
                    onClick={() => {
                      logger.info('Switching to quiz tab')
                      setActiveTab('quiz')
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      activeTab === 'quiz'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                    type="button"
                  >
                    <svg
                      className="h-4 w-4 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="hidden sm:inline">Quiz</span>
                  </button>
                  <button
                    onClick={() => {
                      logger.info('Switching to flashcards tab')
                      setActiveTab('flashcards')
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      activeTab === 'flashcards'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                    }`}
                    type="button"
                  >
                    <svg
                      className="h-4 w-4 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                    <span className="hidden sm:inline">Cards</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'copilot' && (
                <AICopilot
                  documentContext={documentContext}
                  isFocusMode={isExpanded}
                />
              )}
              {activeTab === 'quiz' && (
                <QuizGenerator
                  documentContext={documentContext}
                  isFocusMode={isExpanded}
                />
              )}
              {activeTab === 'flashcards' && (
                <FlashcardGenerator
                  documentContext={documentContext}
                  isFocusMode={isExpanded}
                />
              )}
            </div>
          </aside>
        </div>

        {/* Guest CTA overlay */}
        {!user && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/10 backdrop-blur-md">
            <div className="bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl p-8 text-center shadow-2xl max-w-md">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-primary"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-normal mb-2">
                Create an account to view this document
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                Log in or register to access the full content and learning
                tools.
              </p>
              <div className="flex gap-3 justify-center">
                <Button
                  onClick={() =>
                    router.push(
                      `/login?returnUrl=${encodeURIComponent(`/learn/${summaryId}`)}`
                    )
                  }
                  className="rounded-lg px-6"
                >
                  Log in
                </Button>
                <Button
                  variant="outline"
                  onClick={() =>
                    router.push(
                      `/register?returnUrl=${encodeURIComponent(`/learn/${summaryId}`)}`
                    )
                  }
                  className="rounded-lg px-6"
                >
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
