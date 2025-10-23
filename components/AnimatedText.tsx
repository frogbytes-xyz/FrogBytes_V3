'use client'

import { useEffect, useState } from 'react'

interface AnimatedTextProps {
  words: string[]
  className?: string
}

export default function AnimatedText({
  words,
  className = ''
}: AnimatedTextProps) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIsAnimating(true)

      setTimeout(() => {
        setCurrentWordIndex(prev => (prev + 1) % words.length)
        setIsAnimating(false)
      }, 600) // Give more time for smooth fade out before switching
    }, 3000) // Change word every 3 seconds

    return () => clearInterval(intervalId)
  }, [words.length])

  const currentWord = words[currentWordIndex]
  const longestWord = words.reduce((a, b) => (a.length > b.length ? a : b), '')

  return (
    <span
      className={`inline-flex relative ${className}`}
      style={{
        minWidth: `${longestWord.length * 0.6}em`
      }}
    >
      {currentWord?.split('').map((char, index) => (
        <span
          key={`${currentWordIndex}-${index}`}
          className={`inline-block transition-all duration-500 ease-in-out ${
            isAnimating
              ? 'opacity-0 translate-y-3 blur-[2px]'
              : 'opacity-100 translate-y-0 blur-0'
          }`}
          style={{
            transitionDelay: `${index * 25}ms`,
            transitionProperty: 'opacity, transform, filter'
          }}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  )
}
