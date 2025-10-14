import { createClient } from '@/services/supabase/server'
import { getAuthUser } from '@/lib/auth/helpers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/test/transcription?id=<transcription_id>
 * 
 * Debug endpoint to view transcription details
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const transcriptionId = searchParams.get('id')
    const uploadId = searchParams.get('uploadId')

    const supabase = await createClient()

    // Get transcription by ID or by upload ID
    let query = supabase
      .from('transcriptions')
      .select(`
        *,
        uploads:upload_id (
          id,
          filename,
          file_type,
          file_size,
          status,
          created_at
        )
      `)
      .eq('user_id', user.id)

    if (transcriptionId) {
      query = query.eq('id', transcriptionId)
    } else if (uploadId) {
      query = query.eq('upload_id', uploadId)
    } else {
      // Get all recent transcriptions
      query = query.order('created_at', { ascending: false }).limit(10)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      count: Array.isArray(data) ? data.length : (data ? 1 : 0),
      transcriptions: data,
    })
  } catch (error) {
    console.error('Transcription debug error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
