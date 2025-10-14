import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'

/**
 * Diagnostic endpoint to test PDF accessibility
 * GET /api/test/pdf-access?summaryId=<id>
 * 
 * Tests if a PDF URL is accessible and returns diagnostic information
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const summaryId = searchParams.get('summaryId')

    if (!summaryId) {
      return NextResponse.json(
        { error: 'Missing summaryId parameter' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the summary with PDF URL
    const { data: summary, error: summaryError } = await supabase
      .from('summaries')
      .select('pdf_url, title, user_id, is_public')
      .eq('id', summaryId)
      .single()

    if (summaryError) {
      return NextResponse.json(
        { 
          error: 'Failed to fetch summary',
          details: summaryError.message 
        },
        { status: 404 }
      )
    }

    if (!summary) {
      return NextResponse.json(
        { error: 'Summary not found' },
        { status: 404 }
      )
    }

    const diagnostics = {
      summaryId,
      title: summary.title,
      isPublic: summary.is_public,
      hasPdfUrl: !!summary.pdf_url,
      pdfUrl: summary.pdf_url,
      urlFormat: null as string | null,
      isSupabaseStorage: false,
      bucketName: null as string | null,
      filePath: null as string | null,
      urlAccessible: false,
      httpStatus: null as number | null,
      corsHeaders: {} as Record<string, string>,
      error: null as string | null,
    }

    if (!summary.pdf_url) {
      diagnostics.error = 'No PDF URL found for this summary'
      return NextResponse.json(diagnostics)
    }

    // Parse the URL to determine format
    try {
      const url = new URL(summary.pdf_url)
      diagnostics.urlFormat = `${url.protocol}//${url.host}`
      
      // Check if it's Supabase Storage
      if (url.hostname.includes('supabase')) {
        diagnostics.isSupabaseStorage = true
        
        // Parse bucket and file path from Supabase URL
        // Format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
        const pathParts = url.pathname.split('/')
        const bucketIndex = pathParts.indexOf('public') + 1
        if (bucketIndex > 0 && bucketIndex < pathParts.length) {
          diagnostics.bucketName = pathParts[bucketIndex]
          diagnostics.filePath = pathParts.slice(bucketIndex + 1).join('/')
        }
      }

      // Test URL accessibility
      try {
        const response = await fetch(summary.pdf_url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'FrogBytes-Diagnostic/1.0',
          },
        })

        diagnostics.urlAccessible = response.ok
        diagnostics.httpStatus = response.status

        // Capture CORS headers
        const corsHeaders = [
          'access-control-allow-origin',
          'access-control-allow-methods',
          'access-control-allow-headers',
          'access-control-expose-headers',
        ]

        corsHeaders.forEach(header => {
          const value = response.headers.get(header)
          if (value) {
            diagnostics.corsHeaders[header] = value
          }
        })

        if (!response.ok) {
          diagnostics.error = `HTTP ${response.status}: ${response.statusText}`
        }
      } catch (fetchError) {
        diagnostics.error = `Fetch failed: ${fetchError instanceof Error ? fetchError.message : 'Unknown error'}`
      }
    } catch (urlError) {
      diagnostics.error = `Invalid URL: ${urlError instanceof Error ? urlError.message : 'Unknown error'}`
    }

    return NextResponse.json(diagnostics)
  } catch (error) {
    console.error('Diagnostic error:', error)
    return NextResponse.json(
      { 
        error: 'Diagnostic failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

