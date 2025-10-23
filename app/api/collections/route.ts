import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createCollectionService } from '@/lib/services/collection-service'
import { getSafeErrorMessage } from '@/lib/utils/errors'
import { getAuthUser } from '@/lib/auth/helpers'
import { logger } from '@/lib/utils/logger'

// GET /api/collections - list user's collections
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = await createCollectionService()

    try {
      const collections = await service.getUserCollectionsWithCounts(user.id)

      // Auto-provision a default folder if none exists yet
      if (collections.length === 0) {
        try {
          await service.createCollection('My Folder', undefined, [])
          const newCollections = await service.getUserCollectionsWithCounts(
            user.id
          )
          return NextResponse.json({
            success: true,
            collections: newCollections
          })
        } catch (provisionErr) {
          logger.warn('Auto-provision default collection failed', {
            error: provisionErr
          })
        }
      }

      return NextResponse.json({ success: true, collections })
    } catch (dbError) {
      // If the table doesn't exist yet or another DB error occurs, do not fail the dashboard.
      logger.warn('Collections query failed', { error: dbError })
      return NextResponse.json({ success: true, collections: [] })
    }
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}

// POST /api/collections - create a collection (folder)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const name: string = body.name
    const description: string | undefined = body.description
    const summaryIds: string[] = Array.isArray(body.summaryIds)
      ? body.summaryIds
      : []

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const service = await createCollectionService()
    const coll = await service.createCollection(name, description, summaryIds)
    return NextResponse.json(
      { success: true, collection: coll },
      { status: 201 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: getSafeErrorMessage(error) },
      { status: 500 }
    )
  }
}
