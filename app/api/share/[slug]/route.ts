import { NextRequest, NextResponse } from 'next/server'
import { createDocumentSharingService } from '@/lib/services/document-sharing-service'
import { getSafeErrorMessage } from '@/lib/utils/errors'

/**
 * GET /api/share/[slug]
 * Get shared document information by slug (public access)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  try {
    const { slug } = await params

    if (!slug || typeof slug !== 'string') {
      return NextResponse.json(
        { error: 'Invalid share link' },
        { status: 400 }
      )
    }

    const sharingService = await createDocumentSharingService()
    const sharedDocument = await sharingService.getSharedDocumentContent(slug)

    if (!sharedDocument) {
      return NextResponse.json(
        { error: 'Shared document not found or no longer available' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: sharedDocument
    })
  } catch (error) {
    console.error('Error fetching shared document:', error)
    return NextResponse.json(
      { error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}