import { NextRequest, NextResponse } from 'next/server'
import { createCollectionService } from '@/lib/services/collection-service'
import { getAuthUser } from '@/lib/auth/helpers'
import { getSafeErrorMessage } from '@/lib/utils/errors'

// POST /api/collections/share - toggle sharing of a collection
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const collectionId: string = body.collectionId
    const makePublic: boolean = !!body.makePublic
    if (!collectionId) return NextResponse.json({ error: 'collectionId is required' }, { status: 400 })

    const service = await createCollectionService()
    const res = await service.toggleShare(collectionId, makePublic)

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const shareUrl = res.share_slug ? `${baseUrl}/collections/${res.share_slug}` : null

    return NextResponse.json({ success: true, ...res, shareUrl })
  } catch (error) {
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: 500 })
  }
}
