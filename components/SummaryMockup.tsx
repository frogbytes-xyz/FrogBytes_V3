'use client'

import { useEffect, useRef, useState } from 'react'

export default function SummaryMockup() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isFlipped, setIsFlipped] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const rotateX = (y - centerY) / 50
      const rotateY = (centerX - x) / 50

      container.style.transform = `perspective(2000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
    }

    const handleMouseLeave = () => {
      container.style.transform = 'perspective(2000px) rotateX(0deg) rotateY(0deg)'
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  // Auto-flip flashcard animation
  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlipped(prev => !prev)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl h-full transition-transform duration-300 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: 'perspective(1500px) rotateX(-5deg) rotateY(-8deg)',
        }}
      >
        {/* Minimalist Study Interface */}
        <div
          className="relative w-full h-full rounded-xl border border-border/60 bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden"
          style={{
            transform: 'translateZ(0px)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Simple Header */}
          <div className="h-12 border-b border-border flex items-center justify-between px-5 bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="h-3 w-32 bg-gray-300 dark:bg-muted rounded" />
            </div>
            <div className="h-2 w-16 bg-gray-200 dark:bg-muted/60 rounded" />
          </div>

          {/* Main Content Area */}
          <div className="p-8 flex items-center justify-center">
            <div className="w-full max-w-sm space-y-6">
              {/* Card Counter */}
              <div className="flex items-center justify-between">
                <div className="h-2 w-16 bg-gray-300 dark:bg-muted/60 rounded" />
                <div className="h-2 w-12 bg-gray-200 dark:bg-muted/40 rounded" />
              </div>

              {/* Flashcard - Clean Minimal Design */}
              <div 
                className="relative h-56"
                style={{
                  transformStyle: 'preserve-3d',
                  perspective: '1000px',
                }}
              >
                <div
                  className="w-full h-full transition-transform duration-700"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Front of card */}
                  <div
                    className="absolute inset-0 rounded-lg border border-border bg-card p-6 flex items-center justify-center shadow-lg"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                    }}
                  >
                    <div className="text-center space-y-3">
                      <div className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-muted-foreground font-medium">Question</div>
                      <p className="text-foreground text-sm font-normal leading-relaxed">
                        What is the primary goal of supervised learning?
                      </p>
                    </div>
                  </div>

                  {/* Back of card */}
                  <div
                    className="absolute inset-0 rounded-lg border border-border bg-card p-6 flex items-center justify-center shadow-lg"
                    style={{
                      backfaceVisibility: 'hidden',
                      WebkitBackfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                    }}
                  >
                    <div className="text-center space-y-3">
                      <div className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-muted-foreground font-medium">Answer</div>
                      <p className="text-foreground text-xs leading-relaxed">
                        To learn a function that maps inputs to outputs based on labeled training data, enabling predictions on new, unseen data.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="space-y-2">
                <div className="h-1 bg-gray-200 dark:bg-muted/40 rounded-full overflow-hidden">
                  <div className="h-full w-1/4 bg-primary rounded-full" />
                </div>
                <div className="flex justify-between">
                  <div className="h-2 w-20 bg-gray-300 dark:bg-muted/40 rounded" />
                  <div className="h-2 w-12 bg-gray-200 dark:bg-muted/30 rounded" />
                </div>
              </div>

              {/* Action Buttons - Correct/Incorrect */}
              <div className="flex items-center justify-center gap-3 pt-2">
                <button className="px-4 py-2 rounded-md border border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-950/20 hover:bg-red-100 dark:hover:bg-red-950/30 transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-xs text-red-600 dark:text-red-400">Incorrect</span>
                </button>
                <button className="px-4 py-2 rounded-md border border-green-200 dark:border-green-800/40 bg-green-50/50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30 transition-colors flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs text-green-600 dark:text-green-400">Correct</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle 3D depth shadow */}
        <div
          className="absolute inset-0 rounded-xl bg-gradient-to-b from-black/10 to-black/20 dark:from-black/20 dark:to-black/30 blur-3xl"
          style={{
            transform: 'translateZ(-50px) translateY(25px)',
          }}
        />
      </div>
    </div>
  )
}
