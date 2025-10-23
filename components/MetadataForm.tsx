'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AutocompleteInput } from '@/components/ui/autocomplete-input'

export interface LibraryMetadata {
  // Document info
  title?: string
  documentType?: 'lecture' | 'tutorial' | 'seminar' | 'exam' | 'notes' | 'other'
  fileCategory?:
    | 'lecture'
    | 'notes'
    | 'slides'
    | 'handout'
    | 'assignment'
    | 'exam'
    | 'tutorial'
    | 'project'
    | 'other'

  // Educational metadata
  university?: string
  courseCode?: string
  courseName?: string
  subject?: string
  professor?: string
  semester?: string
  academicYear?: string
  lectureNumber?: number
  lectureDate?: string

  // Classification
  language?: string
  difficultyLevel?: 'beginner' | 'intermediate' | 'advanced'
  tags?: string[]

  // Privacy
  makePublic?: boolean
}

interface MetadataFormProps {
  onComplete: (metadata: LibraryMetadata) => void
  onSkip?: () => void
  initialData?: Partial<LibraryMetadata>
  showPublicOption?: boolean
}

export default function MetadataForm({
  onComplete,
  onSkip,
  initialData = {},
  showPublicOption = true
}: MetadataFormProps) {
  const [metadata, setMetadata] = useState<LibraryMetadata>({
    documentType: 'lecture',
    fileCategory: 'lecture',
    language: 'en',
    makePublic: true,
    tags: [],
    ...initialData
  })

  const [tagInput, setTagInput] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const updateMetadata = <K extends keyof LibraryMetadata>(
    field: K,
    value: LibraryMetadata[K]
  ) => {
    setMetadata(prev => ({ ...prev, [field]: value }))
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !metadata.tags?.includes(tagInput.trim())) {
      updateMetadata('tags', [...(metadata.tags || []), tagInput.trim()])
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    updateMetadata(
      'tags',
      metadata.tags?.filter(tag => tag !== tagToRemove) || []
    )
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      addTag()
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!metadata.title?.trim()) {
      newErrors.title = 'Title is required'
    }

    if (!metadata.university?.trim()) {
      newErrors.university = 'University is required'
    }

    if (!metadata.courseName?.trim()) {
      newErrors.courseName = 'Course Name is required'
    }

    if (!metadata.subject?.trim()) {
      newErrors.subject = 'Subject is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (validateForm()) {
      onComplete(metadata)
    }
  }

  const Label = ({
    htmlFor,
    children,
    className = '',
    required = false
  }: {
    htmlFor: string
    children: React.ReactNode
    className?: string
    required?: boolean
  }) => (
    <label
      htmlFor={htmlFor}
      className={`text-sm font-medium text-foreground/80 ${className}`}
    >
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-12 text-center">
        <h1 className="text-3xl font-semibold mb-3 text-foreground">
          Document Information
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Help us organize your document by providing some basic information
        </p>
      </div>

      {/* Form */}
      <div className="space-y-8">
        {/* Title - Full Width */}
        <div className="space-y-2">
          <Label htmlFor="title" required>
            Title
          </Label>
          <Input
            id="title"
            placeholder="Introduction to Machine Learning"
            value={metadata.title || ''}
            onChange={e => updateMetadata('title', e.target.value)}
            className={`h-12 ${errors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
          />
          {errors.title && (
            <p className="text-xs text-red-500 mt-1">{errors.title}</p>
          )}
        </div>

        {/* University - Full Width */}
        <div className="space-y-2">
          <Label htmlFor="university" required>
            University
          </Label>
          <AutocompleteInput
            id="university"
            field="university"
            placeholder="MIT, Stanford University..."
            value={metadata.university || ''}
            onChange={value => updateMetadata('university', value)}
            className={`h-12 ${errors.university ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
          />
          {errors.university && (
            <p className="text-xs text-red-500 mt-1">{errors.university}</p>
          )}
        </div>

        {/* Course Name and Code - Two Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="courseName" required>
              Course Name
            </Label>
            <AutocompleteInput
              id="courseName"
              field="course_name"
              placeholder="Introduction to Computer Science"
              value={metadata.courseName || ''}
              onChange={value => updateMetadata('courseName', value)}
              onSelect={suggestion => {
                if (suggestion.courseCode) {
                  updateMetadata('courseCode', suggestion.courseCode)
                }
                if (suggestion.subject) {
                  updateMetadata('subject', suggestion.subject)
                }
              }}
              className={`h-12 ${errors.courseName ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            {errors.courseName && (
              <p className="text-xs text-red-500 mt-1">{errors.courseName}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="courseCode">Course Code</Label>
            <AutocompleteInput
              id="courseCode"
              field="course_code"
              placeholder="CS101"
              value={metadata.courseCode || ''}
              onChange={value => updateMetadata('courseCode', value)}
              onSelect={suggestion => {
                if (suggestion.courseName) {
                  updateMetadata('courseName', suggestion.courseName)
                }
                if (suggestion.subject) {
                  updateMetadata('subject', suggestion.subject)
                }
              }}
              className="h-12"
            />
          </div>
        </div>

        {/* Subject - Full Width */}
        <div className="space-y-2">
          <Label htmlFor="subject" required>
            Subject
          </Label>
          <AutocompleteInput
            id="subject"
            field="subject"
            placeholder="Computer Science, Mathematics..."
            value={metadata.subject || ''}
            onChange={value => updateMetadata('subject', value)}
            className={`h-12 ${errors.subject ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
          />
          {errors.subject && (
            <p className="text-xs text-red-500 mt-1">{errors.subject}</p>
          )}
        </div>

        {/* Professor - Full Width */}
        <div className="space-y-2">
          <Label htmlFor="professor">Professor / Instructor</Label>
          <Input
            id="professor"
            placeholder="Dr. Jane Smith"
            value={metadata.professor || ''}
            onChange={e => updateMetadata('professor', e.target.value)}
            className="h-12"
          />
        </div>

        {/* Divider */}
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-4 text-sm text-muted-foreground">
              Optional Information
            </span>
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <Label htmlFor="tags">Tags</Label>
          <div className="flex gap-2">
            <Input
              id="tags"
              placeholder="Add tags (press Enter)"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyPress={handleKeyPress}
              className="h-12"
            />
            <Button
              type="button"
              variant="outline"
              onClick={addTag}
              className="h-12 px-6"
            >
              Add
            </Button>
          </div>
          {metadata.tags && metadata.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {metadata.tags.map((tag, idx) => (
                <Badge
                  key={idx}
                  variant="secondary"
                  className="px-3 py-1.5 text-sm"
                >
                  {tag}
                  <button
                    onClick={() => removeTag(tag)}
                    className="ml-2 hover:text-red-500 transition-colors"
                    aria-label={`Remove ${tag}`}
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Privacy Toggle */}
        {showPublicOption && (
          <div className="pt-6 border-t border-border">
            <div className="flex items-start gap-4 p-4 rounded-lg border border-border bg-muted/30">
              <input
                type="checkbox"
                id="makePrivate"
                checked={!metadata.makePublic}
                onChange={e => updateMetadata('makePublic', !e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border"
              />
              <div className="flex-1">
                <Label
                  htmlFor="makePrivate"
                  className="cursor-pointer text-base font-medium"
                >
                  Keep this document private
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  {metadata.makePublic
                    ? 'This document will be visible to everyone in the public library.'
                    : 'Only you will be able to see this document.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-8 border-t border-border">
          {onSkip && (
            <Button
              type="button"
              variant="ghost"
              onClick={onSkip}
              className="text-muted-foreground hover:text-foreground"
            >
              Skip for now
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            size="lg"
            className="ml-auto px-8 h-12"
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  )
}
