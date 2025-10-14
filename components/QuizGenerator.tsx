'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
}

interface QuizGeneratorProps {
  documentContext?: string
  isFocusMode?: boolean
}

export default function QuizGenerator({ documentContext, isFocusMode = false }: QuizGeneratorProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<(number | null)[]>([])
  const [showAnswers, setShowAnswers] = useState<boolean[]>([])
  const [difficulty, setDifficulty] = useState<'bachelor' | 'master' | 'phd'>('bachelor')
  const [questionCount, setQuestionCount] = useState(5)

  const generateQuiz = async () => {
    if (!documentContext) {
      setError('No document content available')
      return
    }

    setLoading(true)
    setError(null)
    setQuestions([])
    setSelectedAnswers([])
    setShowAnswers([])

    try {
      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: documentContext,
          questionCount,
          difficulty,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.details?.[0] || data.error || 'Failed to generate quiz')
      }

      setQuestions(data.quiz.questions)
      setSelectedAnswers(new Array(data.quiz.questions.length).fill(null))
      setShowAnswers(new Array(data.quiz.questions.length).fill(false))
    } catch (err) {
      console.error('Quiz generation error:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerSelect = (questionIndex: number, optionIndex: number) => {
    const newAnswers = [...selectedAnswers]
    newAnswers[questionIndex] = optionIndex
    setSelectedAnswers(newAnswers)
  }

  const toggleAnswer = (questionIndex: number) => {
    const newShowAnswers = [...showAnswers]
    newShowAnswers[questionIndex] = !newShowAnswers[questionIndex]
    setShowAnswers(newShowAnswers)
  }

  const resetQuiz = () => {
    setQuestions([])
    setSelectedAnswers([])
    setShowAnswers([])
    setError(null)
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <h3 className={`font-semibold ${isFocusMode ? 'text-2xl' : 'text-lg'}`}>Quiz Generator</h3>
        <p className={`text-muted-foreground ${isFocusMode ? 'text-sm' : 'text-xs'} mt-0.5`}>
          Test your knowledge with AI-generated questions
        </p>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gradient-to-b from-background to-muted/30">
        {questions.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto px-4">
            {/* Configuration Section */}
            <div className="w-full max-w-2xl space-y-8">
              {/* Difficulty Selector */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 text-center">
                  Select Difficulty
                </label>
                <div className={`grid gap-3 ${isFocusMode ? 'grid-cols-3' : 'grid-cols-1'}`}>
                  {[
                    { 
                      value: 'bachelor', 
                      label: 'Bachelor', 
                      desc: 'Foundational concepts',
                      icon: (
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                        </svg>
                      )
                    },
                    { 
                      value: 'master', 
                      label: 'Master', 
                      desc: 'Advanced understanding',
                      icon: (
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path d="M12 14l9-5-9-5-9 5 9 5z" />
                          <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                        </svg>
                      )
                    },
                    { 
                      value: 'phd', 
                      label: 'PhD', 
                      desc: 'Expert-level depth',
                      icon: (
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      )
                    }
                  ].map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setDifficulty(level.value as 'bachelor' | 'master' | 'phd')}
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
                        <span className={difficulty === level.value ? 'text-primary-foreground' : 'text-muted-foreground'}>
                          {level.icon}
                        </span>
                        <div className="flex-1">
                          <div className={`font-semibold ${isFocusMode ? 'text-base' : 'text-sm'}`}>
                            {level.label}
                          </div>
                          <div className={`text-xs ${difficulty === level.value ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            {level.desc}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Count Selector */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 text-center">
                  Number of Questions
                </label>
                <div className={`grid gap-3 ${isFocusMode ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  {[3, 5, 10, 15].map((count) => (
                    <button
                      key={count}
                      onClick={() => setQuestionCount(count)}
                      disabled={loading}
                      className={`relative rounded-xl border-2 transition-all duration-200 ${
                        isFocusMode ? 'py-6' : 'py-4'
                      } ${
                        questionCount === count
                          ? 'border-primary bg-primary text-primary-foreground shadow-lg scale-105'
                          : 'border-border bg-card hover:border-border/80 hover:shadow-md'
                      } ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
                    >
                      <div className={`font-bold ${isFocusMode ? 'text-3xl' : 'text-2xl'}`}>
                        {count}
                      </div>
                      <div className={`text-xs ${questionCount === count ? 'text-primary-foreground/80' : 'text-muted-foreground'} mt-1`}>
                        questions
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <Button
                onClick={generateQuiz}
                disabled={loading || !documentContext}
                className={`w-full rounded-xl shadow-md hover:shadow-lg transition-all disabled:opacity-50 ${
                  isFocusMode ? 'py-6 text-lg' : 'py-4'
                }`}
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Generating Quiz...
                  </>
                ) : (
                  <>
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Generate Quiz
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

        {questions.length > 0 && (
          <div className="space-y-4">
            <Button
              onClick={resetQuiz}
              variant="outline"
              className="rounded-xl"
            >
              Generate New Quiz
            </Button>
          <div className={`space-y-6 ${isFocusMode ? 'max-w-4xl mx-auto' : ''}`}>
            {questions.map((q, qIndex) => (
              <div
                key={qIndex}
                className={`border border-border bg-card rounded-xl shadow-sm ${
                  isFocusMode ? 'p-8' : 'p-6'
                }`}
              >
                <h4 className={`font-semibold text-foreground mb-4 ${
                  isFocusMode ? 'text-2xl' : 'text-lg'
                }`}>
                  <span className="text-muted-foreground mr-2">{qIndex + 1}.</span>
                  {q.question}
                </h4>

                <div className={`space-y-2 mb-4`}>
                  {q.options.map((option, oIndex) => {
                    const isSelected = selectedAnswers[qIndex] === oIndex
                    const isCorrect = q.correctAnswer === oIndex
                    const showingAnswer = showAnswers[qIndex]

                    return (
                      <button
                        key={oIndex}
                        onClick={() => handleAnswerSelect(qIndex, oIndex)}
                        className={`w-full text-left rounded-xl border-2 transition-all ${
                          isFocusMode ? 'px-6 py-4 text-base' : 'px-4 py-3 text-sm'
                        } ${
                          isSelected
                            ? showingAnswer
                              ? isCorrect
                                ? 'bg-green-500/10 border-green-500/50 text-foreground shadow-lg'
                                : 'bg-destructive/10 border-destructive/50 text-foreground shadow-lg'
                              : 'bg-muted border-border'
                            : showingAnswer && isCorrect
                            ? 'bg-green-500/10 border-green-500/50 text-foreground'
                            : 'bg-card border-border hover:border-border/80 hover:bg-muted/50'
                        }`}
                      >
                        {option}
                      </button>
                    )
                  })}
                </div>

                {selectedAnswers[qIndex] !== null && (
                  <button
                    onClick={() => toggleAnswer(qIndex)}
                    className="text-sm text-muted-foreground hover:text-foreground font-medium hover:underline"
                  >
                    {showAnswers[qIndex] ? '← Hide' : 'Show →'} Answer
                  </button>
                )}

                {showAnswers[qIndex] && (
                  <div className="mt-4 p-4 bg-muted border border-border rounded-xl">
                    <p className={`text-foreground ${isFocusMode ? 'text-base' : 'text-sm'}`}>
                      <strong className="text-foreground">Explanation:</strong> {q.explanation}
                    </p>
                  </div>
                )}
              </div>
            ))}

            <div className="mt-6 p-6 bg-primary text-primary-foreground rounded-xl shadow-lg">
              <p className={`font-semibold ${isFocusMode ? 'text-xl' : 'text-lg'}`}>
                Score: {questions.filter((q, i) => selectedAnswers[i] === q.correctAnswer).length} / {questions.length}
              </p>
              <p className="text-primary-foreground/80 text-sm mt-1">
                {Math.round((questions.filter((q, i) => selectedAnswers[i] === q.correctAnswer).length / questions.length) * 100)}% correct
              </p>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  )
}
