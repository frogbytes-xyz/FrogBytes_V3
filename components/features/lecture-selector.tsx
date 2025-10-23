'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import PDFThumbnail from '@/components/PDFThumbnail'
import { Plus, Search } from 'lucide-react'

interface Summary {
  id: string
  title: string | null
  lecture_name: string | null
  university: string | null
  subject: string | null
  is_public: boolean
  reputation_score: number | null
  created_at: string
  updated_at: string
  pdf_url: string | null
}

interface Collection {
  id: string
  name: string
  description: string | null
  is_public: boolean
  share_slug: string | null
  created_at: string
  updated_at: string
  itemCount?: number
}

interface LectureSelectorProps {
  availableSummaries: Summary[]
  collections: Collection[]
  onAddToCollection: (
    collectionId: string,
    summaryIds: string[]
  ) => Promise<boolean>
  onRefresh: () => Promise<void>
}

export default function LectureSelector({
  availableSummaries,
  collections,
  onAddToCollection,
  onRefresh
}: LectureSelectorProps) {
  const [selectedSummaries, setSelectedSummaries] = useState<Set<string>>(
    new Set()
  )
  const [searchTerm, setSearchTerm] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [showSelector, setShowSelector] = useState(false)
  const [isAdding, setIsAdding] = useState(false)

  // Filter summaries based on search and subject filter
  const filteredSummaries = availableSummaries.filter(summary => {
    const matchesSearch =
      !searchTerm ||
      summary.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.lecture_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      summary.university?.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesSubject = !filterSubject || summary.subject === filterSubject

    return matchesSearch && matchesSubject
  })

  // Get unique subjects for filter
  const uniqueSubjects = [
    ...new Set(availableSummaries.map(s => s.subject).filter(Boolean))
  ]

  const toggleSummarySelection = useCallback((summaryId: string) => {
    setSelectedSummaries(prev => {
      const newSet = new Set(prev)
      if (newSet.has(summaryId)) {
        newSet.delete(summaryId)
      } else {
        newSet.add(summaryId)
      }
      return newSet
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedSummaries(new Set())
  }, [])

  const selectAll = useCallback(() => {
    setSelectedSummaries(new Set(filteredSummaries.map(s => s.id)))
  }, [filteredSummaries])

  const handleAddToCollection = useCallback(
    async (collectionId: string) => {
      if (selectedSummaries.size === 0) {
        toast.error('Please select at least one lecture')
        return
      }

      setIsAdding(true)
      try {
        const success = await onAddToCollection(
          collectionId,
          Array.from(selectedSummaries)
        )
        if (success) {
          toast.success(
            `Added ${selectedSummaries.size} lecture(s) to collection`
          )
          clearSelection()
          setShowSelector(false)
          await onRefresh()
        }
      } catch (error) {
        toast.error('Failed to add lectures to collection')
      } finally {
        setIsAdding(false)
      }
    },
    [selectedSummaries, onAddToCollection, clearSelection, onRefresh]
  )

  if (availableSummaries.length === 0) {
    return null
  }

  return (
    <Dialog open={showSelector} onOpenChange={setShowSelector}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add to Collection
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Lectures to Collection</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Search and Filter Controls */}
          <div className="flex gap-4 items-center">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search lectures..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <select
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Subjects</option>
              {uniqueSubjects.map(subject => (
                <option key={subject ?? ''} value={subject ?? ''}>
                  {subject ?? ''}
                </option>
              ))}
            </select>
          </div>

          {/* Selection Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {selectedSummaries.size} of {filteredSummaries.length} selected
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={selectAll}
                  disabled={filteredSummaries.length === 0}
                >
                  Select All
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                  disabled={selectedSummaries.size === 0}
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

          {/* Lecture Grid */}
          <div className="flex-1 overflow-y-auto">
            {filteredSummaries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm || filterSubject
                  ? 'No lectures match your search criteria'
                  : 'No lectures available'}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredSummaries.map(summary => (
                  <LectureCard
                    key={summary.id}
                    summary={summary}
                    isSelected={selectedSummaries.has(summary.id)}
                    onToggleSelection={() => toggleSummarySelection(summary.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Collection Selection */}
          {selectedSummaries.size > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Add to Collection:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {collections.map(collection => (
                  <Button
                    key={collection.id}
                    variant="outline"
                    className="justify-start h-auto p-3"
                    onClick={() => handleAddToCollection(collection.id)}
                    disabled={isAdding}
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                        📁
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm">
                          {collection.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {collection.itemCount || 0} items
                        </div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowSelector(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Individual lecture card for selection
interface LectureCardProps {
  summary: Summary
  isSelected: boolean
  onToggleSelection: () => void
}

function LectureCard({
  summary,
  isSelected,
  onToggleSelection
}: LectureCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-primary border-primary bg-primary/5' : ''
      }`}
      onClick={onToggleSelection}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={onToggleSelection}
            onClick={e => e.stopPropagation()}
          />

          <div className="flex-1 min-w-0">
            {/* Thumbnail if available */}
            {summary.pdf_url && (
              <div className="mb-2 rounded overflow-hidden bg-muted">
                <PDFThumbnail
                  pdfUrl={summary.pdf_url}
                  width={200}
                  height={120}
                  className="w-full h-20 object-cover"
                />
              </div>
            )}

            <h4 className="font-medium text-sm line-clamp-2 mb-1">
              {summary.title || summary.lecture_name || 'Untitled'}
            </h4>

            {(summary.university || summary.subject) && (
              <div className="space-y-1 text-xs text-muted-foreground mb-2">
                {summary.university && <p>{summary.university}</p>}
                {summary.subject && <p>{summary.subject}</p>}
              </div>
            )}

            <div className="flex items-center gap-2">
              <Badge
                variant={summary.is_public ? 'default' : 'secondary'}
                className="text-[10px]"
              >
                {summary.is_public ? 'Public' : 'Private'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {new Date(summary.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
