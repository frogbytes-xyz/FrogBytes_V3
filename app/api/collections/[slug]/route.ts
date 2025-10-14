import { NextRequest, NextResponse } from 'next/server'
import { createCollectionService } from '@/lib/services/collection-service'
import { getSafeErrorMessage } from '@/lib/utils/errors'

// GET /api/collections/[slug] - fetch shared collection (public)
export async function GET(_request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const service = await createCollectionService()
    const shared = await service.getSharedCollection(slug)
    if (!shared) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ success: true, collection: shared })
  } catch (error) {
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: 500 })
  }
}
