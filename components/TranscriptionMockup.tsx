'use client'

import { useEffect, useRef } from 'react'

export default function TranscriptionMockup() {
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

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div
        ref={containerRef}
        className="relative w-full max-w-2xl h-full transition-transform duration-300 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: 'perspective(2000px) rotateX(-5deg) rotateY(8deg)',
        }}
      >
        {/* Upload/Processing Screen Mockup */}
        <div
          className="relative w-full h-full rounded-2xl border-2 border-border/60 bg-card shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden"
          style={{
            transform: 'translateZ(0px)',
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Content */}
          <div className="flex flex-col items-center justify-center h-full p-16 space-y-10">
            {/* Audio/Microphone Icon with Animation */}
            <div className="relative">
              <div className="w-28 h-28 rounded-2xl bg-primary/10 dark:bg-primary/20 border-2 border-primary/30 dark:border-primary/40 flex items-center justify-center shadow-lg">
                <svg className="w-14 h-14 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              {/* Animated pulse ring */}
              <div className="absolute inset-0 rounded-2xl bg-primary/30 dark:bg-primary/40 animate-pulse" />
            </div>

            {/* Title */}
            <div className="text-center space-y-4">
              <div className="h-7 w-72 bg-gray-300 dark:bg-foreground/20 rounded-lg mx-auto shadow-sm" />
              <div className="h-5 w-56 bg-gray-200 dark:bg-foreground/15 rounded mx-auto shadow-sm" />
            </div>

            {/* Simple Progress Indicator */}
            <div className="w-full max-w-md space-y-4">
              <div className="h-3 bg-gray-200 dark:bg-muted rounded-full overflow-hidden border border-border/40 shadow-inner">
                <div className="h-full w-2/3 bg-gradient-to-r from-primary to-primary/80 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced 3D depth shadow - more visible in light mode */}
        <div
          className="absolute inset-0 rounded-2xl bg-gradient-to-b from-gray-300/40 to-gray-400/60 dark:from-black/30 dark:to-black/50 blur-3xl"
          style={{
            transform: 'translateZ(-50px) translateY(25px)',
          }}
        />
      </div>
    </div>
  )
}
