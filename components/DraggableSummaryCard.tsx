'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import PDFThumbnail from '@/components/PDFThumbnail'
import { Eye, Share, Lock, Trash2 } from 'lucide-react'

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

interface SummaryCardProps {
  summary: Summary
  onTogglePublishStatus: (summaryId: string, currentStatus: boolean) => void
  onDeleteSummary: (summaryId: string) => void
}

export default function SummaryCard({ 
  summary, 
  onTogglePublishStatus, 
  onDeleteSummary 
}: SummaryCardProps) {

  return (
    <Card className="hover:shadow-lg transition-all overflow-hidden group">
      {/* PDF Thumbnail Preview */}
      {summary.pdf_url && summary.pdf_url.trim() !== '' && (
        <Link href={`/learn/${summary.id}`} className="block relative overflow-hidden bg-gradient-to-br from-accent to-muted flex items-center justify-center" style={{ height: '300px' }}>
          <PDFThumbnail
            pdfUrl={summary.pdf_url}
            width={450}
            height={300}
            className="cursor-pointer transition-transform group-hover:scale-105"
          />
          <div className="absolute top-2 right-6 z-30">
            <Badge variant={summary.is_public ? 'default' : 'secondary'} className="shadow-lg">
              {summary.is_public ? 'Published' : 'Private'}
            </Badge>
          </div>
        </Link>
      )}

      <CardHeader className={!summary.pdf_url ? 'pt-6' : ''}>
        <div className="flex items-start justify-between gap-2 mb-2">
          <CardTitle className="text-lg font-medium leading-tight line-clamp-2">
            {summary.title || summary.lecture_name || 'Untitled'}
          </CardTitle>
          {!summary.pdf_url && (
            <Badge variant={summary.is_public ? 'default' : 'secondary'} className="flex-shrink-0">
              {summary.is_public ? 'Published' : 'Private'}
            </Badge>
          )}
        </div>
        {(summary.university || summary.subject) && (
          <div className="space-y-1 text-sm text-muted-foreground">
            {summary.university && (
              <p className="font-mono text-xs">{summary.university}</p>
            )}
            {summary.subject && <p>{summary.subject}</p>}
          </div>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {summary.is_public && (
            <div className="flex items-center gap-2 text-sm">
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              <span className="font-medium">{summary.reputation_score ?? 0}</span>
              <span className="text-muted-foreground">upvotes</span>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            <p>Created {new Date(summary.created_at).toLocaleDateString()}</p>
            {summary.updated_at !== summary.created_at && (
              <p>Updated {new Date(summary.updated_at).toLocaleDateString()}</p>
            )}
          </div>

          <div className="pt-3 border-t flex flex-wrap gap-2">
            <Button asChild size="sm" variant="default" className="flex-1">
              <Link href={`/learn/${summary.id}`}>
                <Eye className="w-4 h-4 mr-1" />
                Study
              </Link>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => onTogglePublishStatus(summary.id, summary.is_public)}
              title={summary.is_public ? 'Make private' : 'Publish to library'}
            >
              {summary.is_public ? (
                <Lock className="w-4 h-4" />
              ) : (
                <Share className="w-4 h-4" />
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDeleteSummary(summary.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Delete summary"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}