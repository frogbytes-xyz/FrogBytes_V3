"use client"

import DraggableSummaryCard from '@/components/DraggableSummaryCard'

interface Summary {
  id: string
  title?: string
  lecture_name?: string
  university?: string
  subject?: string
  is_public?: boolean
  reputation_score?: number
  created_at?: string
  updated_at?: string
  pdf_url?: string | null
}

interface Props {
  summary: Summary
}

export default function DraggableSummaryCardClientWrapper({ summary }: Props) {
  // Provide local no-op handlers so we can reuse the exact dashboard card UI
  const handleToggle = (_summaryId: string, _currentStatus: boolean) => {
    // no-op on guest preview
    return
  }

  const handleDelete = (_summaryId: string) => {
    // no-op on guest preview
    return
  }

  return (
    <div>
      <DraggableSummaryCard
        summary={summary as any}
        onTogglePublishStatus={handleToggle}
        onDeleteSummary={handleDelete}
      />
    </div>
  )
}
