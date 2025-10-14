'use client'

import { useEffect, useRef } from 'react'

export default function Image3DPlaceholder() {
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
      const rotateX = (y - centerY) / 10
      const rotateY = (centerX - x) / 10

      container.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`
    }

    const handleMouseLeave = () => {
      container.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)'
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
        className="relative w-full max-w-md aspect-square transition-transform duration-200 ease-out"
        style={{
          transformStyle: 'preserve-3d',
          transform: 'perspective(1000px) rotateX(-5deg) rotateY(15deg)',
        }}
      >
        {/* Main card with 3D effect */}
        <div 
          className="absolute inset-0 rounded-2xl border border-border bg-gradient-to-br from-secondary via-background to-secondary shadow-2xl"
          style={{
            transform: 'translateZ(40px)',
          }}
        >
          {/* Gradient overlay for depth */}
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
          
          {/* Content placeholder */}
          <div className="relative h-full w-full flex flex-col items-center justify-center p-8">
            {/* Icon or graphic placeholder */}
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
              <svg 
                className="w-12 h-12 text-primary" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={1.5} 
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
                />
              </svg>
            </div>
            
            {/* Text lines as placeholders */}
            <div className="w-full space-y-3">
              <div className="h-3 bg-muted rounded-full w-3/4 mx-auto" />
              <div className="h-3 bg-muted rounded-full w-1/2 mx-auto" />
              <div className="h-3 bg-muted rounded-full w-2/3 mx-auto" />
            </div>

            {/* Decorative elements */}
            <div className="absolute top-8 right-8 w-16 h-16 rounded-full bg-primary/5 blur-2xl" />
            <div className="absolute bottom-8 left-8 w-20 h-20 rounded-full bg-accent/5 blur-2xl" />
          </div>
        </div>

        {/* Shadow layer */}
        <div 
          className="absolute inset-0 rounded-2xl bg-gradient-to-br from-black/10 to-black/30 blur-xl"
          style={{
            transform: 'translateZ(0px) translateY(20px)',
          }}
        />

        {/* Back layer for depth */}
        <div 
          className="absolute inset-0 rounded-2xl border border-border/50 bg-muted/20"
          style={{
            transform: 'translateZ(-40px)',
          }}
        />
      </div>

      {/* Floating particles/elements for extra effect */}
      <div className="absolute top-1/4 left-1/4 w-3 h-3 rounded-full bg-primary/20 animate-pulse" />
      <div className="absolute bottom-1/3 right-1/4 w-2 h-2 rounded-full bg-accent/20 animate-pulse" style={{ animationDelay: '0.5s' }} />
      <div className="absolute top-1/2 right-1/3 w-4 h-4 rounded-full bg-primary/10 animate-pulse" style={{ animationDelay: '1s' }} />
    </div>
  )
}
