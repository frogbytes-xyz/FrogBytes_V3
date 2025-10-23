'use client'

import { logger } from '@/lib/utils/logger'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface Flashcard {
  front: string
  back: string
  category: string
}

interface FlashcardGeneratorProps {
  documentContext?: string
  isFocusMode?: boolean
}

export default function FlashcardGenerator({
  documentContext,
  isFocusMode = false
}: FlashcardGeneratorProps) {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [difficulty, setDifficulty] = useState<'bachelor' | 'master' | 'phd'>(
    'bachelor'
  )
  const [cardCount, setCardCount] = useState(10)

  const generateFlashcards = async () => {
    if (!documentContext) {
      setError('No document content available')
      return
    }

    setLoading(true)
    setError(null)
    setFlashcards([])
    setCurrentIndex(0)
    setIsFlipped(false)

    try {
      const response = await fetch('/api/flashcards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: documentContext,
          cardCount,
          difficulty
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(
          data.details?.[0] || data.error || 'Failed to generate flashcards'
        )
      }

      setFlashcards(data.flashcards)
    } catch (err) {
      logger.error('Flashcard generation error', err)
      setError(
        err instanceof Error ? err.message : 'Failed to generate flashcards'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1)
      setIsFlipped(false)
    }
  }

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
      setIsFlipped(false)
    }
  }

  const resetFlashcards = () => {
    setFlashcards([])
    setCurrentIndex(0)
    setIsFlipped(false)
    setError(null)
  }

  const currentCard = flashcards[currentIndex]

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h3 className={`font-semibold ${isFocusMode ? 'text-2xl' : 'text-lg'}`}>
          Flashcard Generator
        </h3>
        <p
          className={`text-muted-foreground ${isFocusMode ? 'text-sm' : 'text-xs'} mt-0.5`}
        >
          Study with AI-generated flashcards
        </p>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-background to-muted/30">
        {flashcards.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto px-4">
            <div className="w-full max-w-2xl space-y-8">
              {/* Difficulty Selector */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 text-center">
                  Select Difficulty
                </label>
                <div
                  className={`grid gap-3 ${isFocusMode ? 'grid-cols-3' : 'grid-cols-1'}`}
                >
                  {[
                    {
                      value: 'bachelor',
                      label: 'Bachelor',
                      desc: 'Basic concepts',
                      icon: (
                        <svg
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      )
                    },
                    {
                      value: 'master',
                      label: 'Master',
                      desc: 'Advanced topics',
                      icon: (
                        <svg
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"
                          />
                        </svg>
                      )
                    },
                    {
                      value: 'phd',
                      label: 'PhD',
                      desc: 'Expert knowledge',
                      icon: (
                        <svg
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
                          />
                        </svg>
                      )
                    }
                  ].map(level => (
                    <button
                      key={level.value}
                      onClick={() =>
                        setDifficulty(
                          level.value as 'bachelor' | 'master' | 'phd'
                        )
                      }
                      disabled={loading}
                      className={`group relative text-left rounded-xl border-2 transition-all duration-200 ${
                        isFocusMode ? 'px-6 py-5' : 'px-4 py-4'
                      } ${
                        difficulty === level.value
                          ? 'border-primary bg-primary text-primary-foreground shadow-lg scale-105'
                          : 'border-border bg-card hover:border-border/80 hover:shadow-md'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={
                            difficulty === level.value
                              ? 'text-primary-foreground'
                              : 'text-muted-foreground'
                          }
                        >
                          {level.icon}
                        </span>
                        <div className="flex-1">
                          <div
                            className={`font-semibold ${isFocusMode ? 'text-base' : 'text-sm'}`}
                          >
                            {level.label}
                          </div>
                          <div
                            className={`text-xs ${difficulty === level.value ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}
                          >
                            {level.desc}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Card Count Selector */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 text-center">
                  Number of Flashcards
                </label>
                <div
                  className={`grid gap-3 ${isFocusMode ? 'grid-cols-4' : 'grid-cols-2'}`}
                >
                  {[5, 10, 15, 20].map(count => (
                    <button
                      key={count}
                      onClick={() => setCardCount(count)}
                      disabled={loading}
                      className={`relative rounded-xl border-2 transition-all duration-200 ${
                        isFocusMode ? 'py-6' : 'py-4'
                      } ${
                        cardCount === count
                          ? 'border-primary bg-primary text-primary-foreground shadow-lg scale-105'
                          : 'border-border bg-card hover:border-border/80 hover:shadow-md'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
                    >
                      <div
                        className={`font-bold ${isFocusMode ? 'text-3xl' : 'text-2xl'}`}
                      >
                        {count}
                      </div>
                      <div
                        className={`text-xs ${cardCount === count ? 'text-primary-foreground/80' : 'text-muted-foreground'} mt-1`}
                      >
                        cards
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={generateFlashcards}
                disabled={loading || !documentContext}
                className={`w-full rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 ${
                  isFocusMode ? 'py-6 text-lg' : 'py-4'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Generating Flashcards...
                  </>
                ) : (
                  <>
                    <svg
                      className="h-5 w-5 mr-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
                      />
                    </svg>
                    Generate Flashcards
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-xl shadow-sm">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}

        {flashcards.length > 0 && currentCard && (
          <div
            className={`space-y-6 ${isFocusMode ? 'max-w-4xl mx-auto' : ''}`}
          >
            <Button
              onClick={resetFlashcards}
              variant="outline"
              className="rounded-xl"
            >
              Generate New Flashcards
            </Button>
            {/* Progress */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Card {currentIndex + 1} of {flashcards.length}
              </p>
              <div className="mt-2 w-full bg-muted rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${((currentIndex + 1) / flashcards.length) * 100}%`
                  }}
                />
              </div>
            </div>

            {/* Flashcard */}
            <div
              onClick={handleFlip}
              className={`relative w-full cursor-pointer group mx-auto ${
                isFocusMode ? 'h-96 max-w-4xl' : 'h-64'
              }`}
              style={{ perspective: '1000px' }}
            >
              <div
                className={`relative w-full h-full transition-transform duration-500 preserve-3d ${
                  isFlipped ? 'rotate-y-180' : ''
                }`}
                style={{
                  transformStyle: 'preserve-3d',
                  transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                }}
              >
                {/* Front of card */}
                <div
                  className={`absolute w-full h-full backface-hidden border-2 border-primary/20 rounded-2xl bg-gradient-to-br from-primary/5 to-primary/10 p-8 flex flex-col items-center justify-center ${
                    isFocusMode ? 'p-12' : 'p-8'
                  }`}
                  style={{ backfaceVisibility: 'hidden' }}
                >
                  <div
                    className={`font-medium text-primary mb-4 px-3 py-1 bg-primary/10 rounded-full ${
                      isFocusMode ? 'text-sm' : 'text-xs'
                    }`}
                  >
                    {currentCard.category}
                  </div>
                  <p
                    className={`font-medium text-center ${
                      isFocusMode ? 'text-3xl' : 'text-lg'
                    }`}
                  >
                    {currentCard.front}
                  </p>
                  <div
                    className={`absolute bottom-4 text-muted-foreground ${
                      isFocusMode ? 'text-sm' : 'text-xs'
                    }`}
                  >
                    Click to reveal answer
                  </div>
                </div>

                {/* Back of card */}
                <div
                  className={`absolute w-full h-full backface-hidden border-2 border-primary/20 rounded-2xl bg-gradient-to-br from-accent to-muted p-8 flex flex-col items-center justify-center ${
                    isFocusMode ? 'p-12' : 'p-8'
                  }`}
                  style={{
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <div
                    className={`font-medium text-primary mb-4 px-3 py-1 bg-background rounded-full ${
                      isFocusMode ? 'text-sm' : 'text-xs'
                    }`}
                  >
                    Answer
                  </div>
                  <p
                    className={`text-center leading-relaxed ${
                      isFocusMode ? 'text-2xl' : 'text-base'
                    }`}
                  >
                    {currentCard.back}
                  </p>
                  <div
                    className={`absolute bottom-4 text-muted-foreground ${
                      isFocusMode ? 'text-sm' : 'text-xs'
                    }`}
                  >
                    Click to see question
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-4">
              <Button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                variant="outline"
                size="lg"
                className="flex-1"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Previous
              </Button>

              <Button
                onClick={handleFlip}
                variant="default"
                size="lg"
                className="flex-1"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Flip
              </Button>

              <Button
                onClick={handleNext}
                disabled={currentIndex === flashcards.length - 1}
                variant="outline"
                size="lg"
                className="flex-1"
              >
                Next
                <svg
                  className="w-5 h-5 ml-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-4 p-4 bg-muted border border-border rounded-lg">
              <p className="text-sm text-foreground">
                <strong>Progress:</strong> {currentIndex + 1} /{' '}
                {flashcards.length} cards reviewed
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
