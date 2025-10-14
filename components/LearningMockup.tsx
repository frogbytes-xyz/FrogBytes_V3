'use client'

import { useEffect, useRef } from 'react'

export default function LearningMockup() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const rotateX = (y - centerY) / 60
      const rotateY = (centerX - x) / 60

      container.style.transform = `perspective(1500px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`
    }

    const handleMouseLeave = () => {
      container.style.transform = 'perspective(1500px) rotateX(0deg) rotateY(0deg)'
    }

    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl h-full transition-transform duration-300 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: 'perspective(1500px) rotateX(-5deg) rotateY(8deg)',
        }}
      >
        {/* Minimalist Quiz Interface */}
        <div
          className="relative w-full h-full rounded-xl border border-border/60 bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden"
          style={{
            transform: 'translateZ(0px)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Simple header */}
          <div className="h-12 border-b border-border flex items-center justify-between px-5 bg-muted/30">
            <div className="h-3 w-24 bg-gray-300 dark:bg-muted rounded" />
            <div className="h-2 w-16 bg-gray-200 dark:bg-muted/60 rounded" />
          </div>

          {/* Content area */}
          <div className="p-10 space-y-8">
            {/* Progress indicator */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-2 w-20 bg-gray-300 dark:bg-muted/60 rounded" />
                <div className="h-2 w-12 bg-gray-200 dark:bg-muted/40 rounded" />
              </div>
              <div className="h-1 bg-gray-200 dark:bg-muted/40 rounded-full overflow-hidden">
                <div className="h-full w-3/5 bg-primary rounded-full" />
              </div>
            </div>

            {/* Quiz Question */}
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-[9px] uppercase tracking-wider text-gray-500 dark:text-muted-foreground font-medium">Question 3 of 5</div>
                <p className="text-foreground text-sm leading-relaxed">
                  Which algorithm is commonly used for classification tasks?
                </p>
              </div>

              {/* Answer Options - Minimal Style */}
              <div className="space-y-2.5">
                {['Decision Trees', 'K-Means Clustering', 'Linear Regression', 'PCA'].map((option, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-300 dark:border-border hover:bg-muted/20 transition-colors cursor-pointer">
                    <div className="w-4 h-4 rounded-full border-2 border-gray-400 dark:border-border flex-shrink-0" />
                    <span className="text-xs text-foreground">{option}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Navigation Buttons - Previous/Next */}
            <div className="flex items-center justify-between pt-4">
              <button className="px-4 py-2 rounded-md border border-border bg-card hover:bg-muted/20 transition-colors flex items-center gap-2">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                <span className="text-xs text-muted-foreground">Previous</span>
              </button>
              <button className="px-4 py-2 rounded-md border border-primary/30 bg-primary/10 hover:bg-primary/20 transition-colors flex items-center gap-2">
                <span className="text-xs text-primary">Next</span>
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
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
