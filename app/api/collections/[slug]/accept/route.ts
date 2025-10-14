import { NextRequest, NextResponse } from 'next/server'
import { createCollectionService } from '@/lib/services/collection-service'
import { getAuthUser } from '@/lib/auth/helpers'
import { getSafeErrorMessage } from '@/lib/utils/errors'

// POST /api/collections/[slug]/accept - import collection into recipient's dashboard
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { slug } = await params
    const service = await createCollectionService()
    const result = await service.acceptSharedCollection(slug, user.id)
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: getSafeErrorMessage(error) }, { status: 500 })
  }
}
