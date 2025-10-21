import { createClient } from '@/services/supabase/server'

// Note: collections and collection_items tables exist but aren't in generated types yet
// Using any for supabase client until types are regenerated from database

export interface Collection {
  id: string
  user_id: string
  name: string
  description?: string | null
  is_public: boolean
  share_slug: string | null
}

export class CollectionService {
  public supabase: any // Using any due to missing collection tables in generated types
  constructor(client: any) {
    this.supabase = client
  }

  async createCollection(name: string, description: string | undefined, summaryIds: string[] = []) {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('Authentication required to create a collection')

    // Ensure the user's profile row exists to satisfy FK on collections.user_id
    try {
      await (this.supabase as any)
        .from('users')
        .upsert({ id: user.id, email: user.email ?? null }, { onConflict: 'id', ignoreDuplicates: false })
        .select('id')
        .single()
    } catch (e) {
      // Proceed even if upsert fails; if FK fails we will catch below
      // eslint-disable-next-line no-console
      logger.warn('User profile ensure failed (non-fatal)', { error: e })
    }

    const { data: collection, error } = await (this.supabase as any)
      .from('collections')
      .insert({ name, description, user_id: user.id })
      .select('*')
      .single()

    if (error) throw error

    if (summaryIds.length > 0) {
      const items = summaryIds.map((sid, idx) => ({ collection_id: collection.id, summary_id: sid, position: idx }))
      const { error: itemsError } = await this.supabase.from('collection_items').insert(items)
      if (itemsError) throw itemsError
    }

    return collection as Collection
  }

  async toggleShare(collectionId: string, makePublic: boolean) {
    const { data, error } = await this.supabase
      .from('collections')
      .update({ is_public: makePublic })
      .eq('id', collectionId)
      .select('id, name, is_public, share_slug')
      .single()

    if (error) throw error

    return data as { id: string; name: string; is_public: boolean; share_slug: string | null }
  }

  async getSharedCollection(slug: string) {
    const { data: collection, error } = await this.supabase
      .from('collections')
      .select('id, name, description, is_public, share_slug')
      .eq('share_slug', slug)
      .eq('is_public', true)
      .single()
    if (error) return null

    const { data: items } = await this.supabase
      .from('collection_items')
      .select('summary_id')
      .eq('collection_id', (collection as any).id)

    // Fetch summary details (public only)
    const ids = (items || []).map((i: any) => i.summary_id)
    let summaries: any[] = []
    if (ids.length > 0) {
      const { data: s } = await this.supabase
        .from('summaries')
        .select('id, title, lecture_name, pdf_url, is_public')
        .in('id', ids)
        .eq('is_public', true)
      summaries = s || []
    }

    return { ...(collection as any), summaries }
  }

  // Accept a shared collection: duplicate summaries into recipient's account
  async acceptSharedCollection(slug: string, recipientUserId: string) {
    const shared = await this.getSharedCollection(slug)
    if (!shared) throw new Error('Shared collection not found. The link may be invalid or the collection is no longer shared')

    const sourceSummaries = (shared.summaries || []) as any[]

    // Duplicate each public summary into the recipient's account
    const insertedIds: string[] = []
    for (const src of sourceSummaries) {
      const { data: newSummary, error: insertError } = await (this.supabase
        .from('summaries') as any)
        .insert({
          user_id: recipientUserId,
          title: src.title || src.lecture_name,
          lecture_name: src.lecture_name,
          latex_content: null,
          pdf_url: src.pdf_url,
          is_public: false,
          summary_type: 'detailed',
        })
        .select('id')
        .single()
      if (!insertError && newSummary?.id) {
        insertedIds.push(newSummary.id)
      }
    }

    // Create a new collection for the recipient containing the duplicated summaries
    const { data: newCollection, error: collErr } = await this.supabase
      .from('collections')
      .insert({ name: shared.name, description: shared.description || null, user_id: recipientUserId })
      .select('id')
      .single()
    if (collErr) throw collErr

    if (insertedIds.length > 0) {
      const items = insertedIds.map((sid, idx) => ({ collection_id: (newCollection as any).id, summary_id: sid, position: idx }))
      await (this.supabase as any).from('collection_items').insert(items)
    }

    return { collectionId: (newCollection as any).id, importedCount: insertedIds.length }
  }

  // Update collection
  async updateCollection(collectionId: string, updates: { name?: string; description?: string; is_public?: boolean }) {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('Authentication required to update a collection')

    const { data, error } = await this.supabase
      .from('collections')
      .update(updates)
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) throw error
    return data as Collection
  }

  // Delete collection
  async deleteCollection(collectionId: string) {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('Authentication required to delete a collection')

    const { error } = await this.supabase
      .from('collections')
      .delete()
      .eq('id', collectionId)
      .eq('user_id', user.id)

    if (error) throw error
    return true
  }

  // Add items to collection
  async addItemsToCollection(collectionId: string, summaryIds: string[]) {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('Authentication required to add items to a collection')

    // Verify collection ownership
    const { data: collection, error: fetchError } = await this.supabase
      .from('collections')
      .select('id, user_id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !collection) throw new Error('Collection not found or you do not have permission to modify it')

    // Verify summary ownership
    const { data: validSummaries, error: summariesError } = await this.supabase
      .from('summaries')
      .select('id')
      .in('id', summaryIds)
      .eq('user_id', user.id)

    if (summariesError) throw summariesError

  const validIds = (validSummaries || []).map((s: any) => s.id)
    if (validIds.length === 0) throw new Error('No valid summaries found. Ensure the summaries exist and belong to your account')

    // Get existing items to avoid duplicates and determine position
    const { data: existingItems } = await this.supabase
      .from('collection_items')
      .select('summary_id, position')
      .eq('collection_id', collectionId)

    const existingIds = new Set((existingItems || []).map((item: any) => item.summary_id))
  const newIds = validIds.filter((id: string) => !existingIds.has(id))

    if (newIds.length === 0) {
      return { addedCount: 0, skippedCount: validIds.length }
    }

    // Add new items
    const maxPosition = Math.max(-1, ...(existingItems || []).map((item: any) => item.position || 0))
    const items = newIds.map((summaryId: string, index: number) => ({
      collection_id: collectionId,
      summary_id: summaryId,
      position: maxPosition + 1 + index
    }))

    const { error: insertError } = await (this.supabase as any)
      .from('collection_items')
      .insert(items)

    if (insertError) throw insertError

    return { addedCount: newIds.length, skippedCount: validIds.length - newIds.length }
  }

  // Remove items from collection
  async removeItemsFromCollection(collectionId: string, summaryIds: string[]) {
    const { data: { user } } = await this.supabase.auth.getUser()
    if (!user) throw new Error('Authentication required to remove items from a collection')

    // Verify collection ownership
    const { data: collection, error: fetchError } = await this.supabase
      .from('collections')
      .select('id, user_id')
      .eq('id', collectionId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !collection) throw new Error('Collection not found or you do not have permission to modify it')

    // Remove items
    const { error: deleteError } = await this.supabase
      .from('collection_items')
      .delete()
      .eq('collection_id', collectionId)
      .in('summary_id', summaryIds)

    if (deleteError) throw deleteError
    return true
  }

  // Get collections with item counts
  async getUserCollectionsWithCounts(userId: string) {
    const { data, error } = await this.supabase
      .from('collections')
      .select(`
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
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return (data || []).map((collection: Record<string, unknown>) => ({
      ...collection,
      itemCount: (collection.collection_items as unknown[] | undefined)?.length || 0,
      collection_items: undefined // Remove from response
    }))
  }
}

export async function createCollectionService() {
import { logger } from '@/lib/utils/logger'
  const supabase = await createClient()
  return new CollectionService(supabase)
}
