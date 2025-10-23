'use client'

import { logger } from '@/lib/utils/logger'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'

interface AutocompleteSuggestion {
  value: string
  label: string
  courseCode?: string
  courseName?: string
  subject?: string
}

interface AutocompleteInputProps {
  id: string
  value: string
  placeholder?: string
  field: 'university' | 'subject' | 'course_name' | 'course_code'
  onChange: (value: string) => void
  onSelect?: (suggestion: AutocompleteSuggestion) => void
  className?: string
}

export function AutocompleteInput({
  id,
  value,
  placeholder,
  field,
  onChange,
  onSelect,
  className
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
  const [isLoading, setIsLoading] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debounceTimeout = useRef<NodeJS.Timeout>()

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fetch suggestions
  const fetchSuggestions = async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/metadata/autocomplete?field=${field}&query=${encodeURIComponent(query)}`
      )
      const data = await response.json()

      if (data.suggestions) {
        setSuggestions(data.suggestions)
        setShowSuggestions(data.suggestions.length > 0)
      }
    } catch (error) {
      logger.error('Failed to fetch suggestions', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    setActiveSuggestionIndex(-1)

    // Debounce the API call
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current)
    }

    debounceTimeout.current = setTimeout(() => {
      fetchSuggestions(newValue)
    }, 300)
  }

  // Handle suggestion click
  const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
    onChange(suggestion.value)
    setShowSuggestions(false)
    setActiveSuggestionIndex(-1)

    if (onSelect) {
      onSelect(suggestion)
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggestionIndex(prev =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      )
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeSuggestionIndex >= 0 && suggestions[activeSuggestionIndex]) {
        handleSuggestionClick(suggestions[activeSuggestionIndex])
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
      setActiveSuggestionIndex(-1)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        id={id}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (value.length >= 2 && suggestions.length > 0) {
            setShowSuggestions(true)
          }
        }}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <div
              key={`${suggestion.value}-${index}`}
              className={`px-3 py-2 cursor-pointer text-sm ${
                index === activeSuggestionIndex
                  ? 'bg-primary/10 text-foreground'
                  : 'text-foreground hover:bg-muted'
              }`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
            >
              <div className="font-medium">{suggestion.label}</div>
              {suggestion.courseCode && suggestion.subject && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {suggestion.courseCode} • {suggestion.subject}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isLoading && value.length >= 2 && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
