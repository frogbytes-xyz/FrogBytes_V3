import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createCollectionService } from '@/lib/services/collection-service'
import { getSafeErrorMessage } from '@/lib/utils/errors'
import { getAuthUser } from '@/lib/auth/helpers'
import { logger } from '@/lib/utils/logger'

// GET /api/collections/manage/[id] - get collection by ID
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const collectionId = url.searchParams.get('id')

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      )
    }
    const user = await getAuthUser(request)
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = await createCollectionService()

    const { data: collection, error } = await (service as any).supabase
      .from('collections')
      .select(
        `
        id,
        name,
        description,
        is_public,
        share_slug,
        created_at,
        updated_at,
        collection_items (
          summary_id
        )
      `
      )
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single()

    if (error || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      )
    }

    // Add item count
    const itemCount = collection.collection_items?.length || 0
    const { collection_items, ...collectionData } = collection

    return NextResponse.json({
      success: true,
      collection: {
        ...collectionData,
        itemCount
      }
    })
  } catch (error) {
    logger.error('Get collection error', error)
    return NextResponse.json(
      {
        success: false,
        error: getSafeErrorMessage(error)
      },
      { status: 500 }
    )
  }
}

// PATCH /api/collections/manage?id=[id] - update collection
export async function PATCH(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const collectionId = url.searchParams.get('id')

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      )
    }
    const user = await getAuthUser(request)
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { name, description, is_public } = body

    // Validate inputs
    const updates: any = {}
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json(
          { error: 'Name is required and must be a non-empty string' },
          { status: 400 }
        )
      }
      updates.name = name.trim()
    }
    if (description !== undefined) {
      updates.description =
        typeof description === 'string' ? description.trim() || null : null
    }
    if (is_public !== undefined) {
      updates.is_public = Boolean(is_public)
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid updates provided' },
        { status: 400 }
      )
    }

    const service = await createCollectionService()

    // Verify ownership and update
    const { data: collection, error } = await (service as any).supabase
      .from('collections')
      .update(updates)
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Collection not found or access denied' },
          { status: 404 }
        )
      }
      throw error
    }

    return NextResponse.json({
      success: true,
      collection
    })
  } catch (error) {
    logger.error('Update collection error', error)
    return NextResponse.json(
      {
        success: false,
        error: getSafeErrorMessage(error)
      },
      { status: 500 }
    )
  }
}

// DELETE /api/collections/manage?id=[id] - delete collection
export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const collectionId = url.searchParams.get('id')

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      )
    }
    const user = await getAuthUser(request)
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = await createCollectionService()

    // Verify ownership and delete (cascade will handle collection_items)
    const { error } = await (service as any).supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .eq('user_id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Delete collection error', error)
    return NextResponse.json(
      {
        success: false,
        error: getSafeErrorMessage(error)
      },
      { status: 500 }
    )
  }
}
