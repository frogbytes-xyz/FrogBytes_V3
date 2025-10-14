'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/services/supabase/client'
import PDFThumbnail from '@/components/PDFThumbnail'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface TestSummary {
  id: string
  title: string
  pdf_url: string
}

export default function TestPDFPage() {
  const [summaries, setSummaries] = useState<TestSummary[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadTestData()
  }, [])

  async function loadTestData() {
    const { data, error } = await supabase
      .from('summaries')
      .select('id, title, pdf_url')
      .not('pdf_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Error loading test data:', error)
    } else if (data) {
      setSummaries(data as TestSummary[])
      
      // Log URL types
      data.forEach((s: any) => {
        const urlType = s.pdf_url.includes('telegram') ? '🔴 Telegram' : 
                       s.pdf_url.includes('supabase') ? '🟢 Supabase' : '⚪ Other'
        console.log(`${urlType}: ${s.title}`)
        console.log(`  URL: ${s.pdf_url}`)
      })
    }

    setLoading(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div>Loading test data...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">PDF Thumbnail Test Page</h1>
        <p className="text-muted-foreground mb-8">
          Testing PDF thumbnails with different URL types. Check console for errors.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {summaries.map((summary) => {
            const isTelegram = summary.pdf_url.includes('telegram')
            const isSupabase = summary.pdf_url.includes('supabase')
            
            return (
              <Card key={summary.id}>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {isTelegram && <span className="text-red-500">🔴 </span>}
                    {isSupabase && <span className="text-green-500">🟢 </span>}
                    {summary.title || 'Untitled'}
                  </CardTitle>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {summary.pdf_url}
                  </p>
                </CardHeader>
                <CardContent>
                  <PDFThumbnail
                    pdfUrl={summary.pdf_url}
                    width={300}
                    height={200}
                  />
                  <div className="mt-2 text-xs">
                    {isTelegram && (
                      <p className="text-red-500">
                        ⚠️ Telegram URLs don't support CORS
                      </p>
                    )}
                    {isSupabase && (
                      <p className="text-green-500">
                        ✓ Supabase URL (should work)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

