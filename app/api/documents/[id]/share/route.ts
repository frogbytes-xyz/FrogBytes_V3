import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createClient } from '@/services/supabase/server'
import { createDocumentSharingService } from '@/lib/services/document-sharing-service'
import {
  getSafeErrorMessage,
  ValidationError,
  AuthorizationError
} from '@/lib/utils/errors'
import { logger } from '@/lib/utils/logger'

/**
 * GET /api/documents/[id]/share
 * Get sharing information for a document
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: documentId } = await params

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sharingService = await createDocumentSharingService()
    const shareInfo = await sharingService.getDocumentShareInfo(
      documentId,
      user.id
    )

    return NextResponse.json({
      success: true,
      data: shareInfo
    })
  } catch (error) {
    logger.error('Error fetching document share info', error)

    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/documents/[id]/share
 * Toggle sharing status for a document
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: documentId } = await params

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { makePublic } = body

    if (typeof makePublic !== 'boolean') {
      return NextResponse.json(
        { error: 'makePublic must be a boolean value' },
        { status: 400 }
      )
    }

    const sharingService = await createDocumentSharingService()

    // Check if user can share documents
    const canShare = await sharingService.canUserShareDocument(user.id)
    if (!canShare) {
      return NextResponse.json(
        { error: 'You have reached your sharing limit' },
        { status: 429 }
      )
    }

    const shareInfo = await sharingService.toggleDocumentSharing(
      documentId,
      user.id,
      makePublic
    )

    return NextResponse.json({
      success: true,
      data: shareInfo,
      message: makePublic
        ? 'Document shared successfully!'
        : 'Document sharing disabled'
    })
  } catch (error) {
    logger.error('Error toggling document sharing', error)

    if (error instanceof ValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
