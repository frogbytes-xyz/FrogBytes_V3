import { NextRequest, NextResponse } from 'next/server'
import { createCollectionService } from '@/lib/services/collection-service'
import { getSafeErrorMessage } from '@/lib/utils/errors'
import { getAuthUser } from '@/lib/auth/helpers'
import { logger } from '@/lib/utils/logger'

// POST /api/collections/manage/items?id=[id] - Add items to collection
export async function POST(
  request: NextRequest
) {
  try {
    const url = new URL(request.url)
    const collectionId = url.searchParams.get('id')
    
    if (!collectionId) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 })
    }
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const summaryIds: string[] = Array.isArray(body.summaryIds) ? body.summaryIds : []

    if (summaryIds.length === 0) {
      return NextResponse.json({ error: 'No summary IDs provided' }, { status: 400 })
    }

    const service = await createCollectionService()
    
    // Verify collection ownership
    const { data: collection, error: fetchError } = await (service as any).supabase
      .from('collections')
      .select('id, user_id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !collection) {
      return NextResponse.json({ error: 'Collection not found or access denied' }, { status: 404 })
    }

    // Verify summary ownership and get valid IDs
    const { data: validSummaries, error: summariesError } = await (service as any).supabase
      .from('summaries')
      .select('id')
      .in('id', summaryIds)
      .eq('user_id', user.id)

    if (summariesError) {
      return NextResponse.json({ error: 'Failed to verify summaries' }, { status: 500 })
    }

    const validIds = (validSummaries || []).map((s: any) => s.id)
    if (validIds.length === 0) {
      return NextResponse.json({ error: 'No valid summaries found' }, { status: 400 })
    }

    // Get existing items to avoid duplicates
    const { data: existingItems } = await (service as any).supabase
      .from('collection_items')
      .select('summary_id')
      .eq('collection_id', collectionId)
      .in('summary_id', validIds)

  const existingIds = new Set((existingItems || []).map((item: any) => item.summary_id))
  const newIds = validIds.filter((id: string) => !existingIds.has(id))

    if (newIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'All items were already in the collection',
        addedCount: 0,
        skippedCount: validIds.length
      })
    }

    // Add new items
    const items = newIds.map((summaryId: string, index: number) => ({
      collection_id: collectionId,
      summary_id: summaryId,
      position: (existingItems?.length || 0) + index
    }))

    const { error: insertError } = await (service as any).supabase
      .from('collection_items')
      .insert(items)

    if (insertError) {
      return NextResponse.json({ error: 'Failed to add items to collection' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      addedCount: newIds.length,
      skippedCount: validIds.length - newIds.length
    })

  } catch (error) {
    logger.error('Add items to collection error', error)
    return NextResponse.json({ 
      success: false, 
      error: getSafeErrorMessage(error) 
    }, { status: 500 })
  }
}

// DELETE /api/collections/manage/items?id=[id] - Remove items from collection
export async function DELETE(
  request: NextRequest
) {
  try {
    const url = new URL(request.url)
    const collectionId = url.searchParams.get('id')
    
    if (!collectionId) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 })
    }
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const summaryIds: string[] = Array.isArray(body.summaryIds) ? body.summaryIds : []

    if (summaryIds.length === 0) {
      return NextResponse.json({ error: 'No summary IDs provided' }, { status: 400 })
    }

    const service = await createCollectionService()
    
    // Verify collection ownership
    const { data: collection, error: fetchError } = await (service as any).supabase
      .from('collections')
      .select('id, user_id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !collection) {
      return NextResponse.json({ error: 'Collection not found or access denied' }, { status: 404 })
    }

    // Remove items
    const { error: deleteError } = await (service as any).supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .in('summary_id', summaryIds)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to remove items from collection' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    logger.error('Remove items from collection error', error)
    return NextResponse.json({ 
      success: false, 
      error: getSafeErrorMessage(error) 
    }, { status: 500 })
  }
}

// GET /api/collections/manage/items?id=[id] - Get collection items
export async function GET(
  request: NextRequest
) {
  try {
    const url = new URL(request.url)
    const collectionId = url.searchParams.get('id')
    
    if (!collectionId) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 })
    }
    const user = await getAuthUser(request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const service = await createCollectionService()
    
    // Verify collection access
    const { data: collection, error: fetchError } = await (service as any).supabase
      .from('collections')
      .select('id, user_id, is_public')
      .eq('id', collectionId)
      .single()

    if (fetchError || !collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 })
    }

    // Check access (owner or public collection)
    if (collection.user_id !== user.id && !collection.is_public) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get collection items with summary details
    const { data: items, error: itemsError } = await (service as any).supabase
      .from('collection_items')
      .select(`
        summary_id,
        position,
        summaries:summary_id (
          id,
          title,
          lecture_name,
          university,
          subject,
          is_public,
          reputation_score,
          created_at,
          updated_at,
          pdf_url
        )
      `)
      .eq('collection_id', collectionId)
      .order('position', { ascending: true })

    if (itemsError) {
      return NextResponse.json({ error: 'Failed to fetch collection items' }, { status: 500 })
    }

    const summaries = (items || [])
      .map((item: any) => item.summaries)
      .filter(Boolean)

    return NextResponse.json({ 
      success: true, 
      collection,
      summaries,
      totalItems: summaries.length
    })

  } catch (error) {
    logger.error('Get collection items error', error)
    return NextResponse.json({ 
      success: false, 
      error: getSafeErrorMessage(error) 
    }, { status: 500 })
  }
}