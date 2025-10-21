import { createClient } from '@/services/supabase/server'
import { DatabaseError, AuthorizationError } from '@/lib/utils/errors'
export interface SharedDocument {
  id: string
  title: string
  shareSlug: string
  isPublic: boolean
  viewCount: number
  sharedAt: string | null
  ownerEmail: string
  createdAt: string
}

export interface DocumentShareInfo {
  id: string
  title: string
  shareSlug: string | null
  isPublic: boolean
  viewCount: number
  shareUrl: string | null
}

export class DocumentSharingService {
  private supabase: any

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient
  }

  /**
   * Share a document publicly (toggle sharing)
   */
  async toggleDocumentSharing(
    documentId: string,
    userId: string,
    makePublic: boolean
  ): Promise<DocumentShareInfo> {
    try {
      // Verify user owns the document
      const { data: document, error: fetchError } = await this.supabase
        .from('summaries')
        .select('id, title, lecture_name, user_id, is_public, share_slug, view_count')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single()

      if (fetchError) {
        throw new DatabaseError(
          `Failed to fetch document: ${fetchError.message}`,
          'select',
          'summaries'
        )
      }

      if (!document) {
        throw new AuthorizationError(
          'Document not found or you do not have permission to share it',
          'summaries',
          'share'
        )
      }

      // Update sharing status
      const { data: updatedDocument, error: updateError } = await this.supabase
        .from('summaries')
        .update({ is_public: makePublic })
        .eq('id', documentId)
        .eq('user_id', userId)
        .select('id, title, lecture_name, is_public, share_slug, view_count')
        .single()

      if (updateError) {
        throw new DatabaseError(
          `Failed to update sharing status: ${updateError.message}`,
          'update',
          'summaries'
        )
      }

      const title = updatedDocument.title || updatedDocument.lecture_name || 'Untitled Document'
      const shareUrl = updatedDocument.share_slug
        ? this.generateShareUrl(updatedDocument.share_slug)
        : null

      return {
        id: updatedDocument.id,
        title,
        shareSlug: updatedDocument.share_slug,
        isPublic: updatedDocument.is_public,
        viewCount: updatedDocument.view_count,
        shareUrl
      }
    } catch (error) {
      if (error instanceof DatabaseError || error instanceof AuthorizationError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error toggling document sharing',
        'update',
        'summaries'
      )
    }
  }

  /**
   * Get sharing information for a document
   */
  async getDocumentShareInfo(documentId: string, userId: string): Promise<DocumentShareInfo> {
    try {
      const { data: document, error } = await this.supabase
        .from('summaries')
        .select('id, title, lecture_name, is_public, share_slug, view_count')
        .eq('id', documentId)
        .eq('user_id', userId)
        .single()

      if (error) {
        throw new DatabaseError(
          `Failed to fetch document: ${error.message}`,
          'select',
          'summaries'
        )
      }

      if (!document) {
        throw new AuthorizationError(
          'Document not found or you do not have permission to access it',
          'summaries',
          'read'
        )
      }

      const title = document.title || document.lecture_name || 'Untitled Document'
      const shareUrl = document.share_slug
        ? this.generateShareUrl(document.share_slug)
        : null

      return {
        id: document.id,
        title,
        shareSlug: document.share_slug,
        isPublic: document.is_public,
        viewCount: document.view_count,
        shareUrl
      }
    } catch (error) {
      if (error instanceof DatabaseError || error instanceof AuthorizationError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error fetching document share info',
        'select',
        'summaries'
      )
    }
  }

  /**
   * Get a shared document by slug (public access)
   */
  async getSharedDocument(shareSlug: string): Promise<SharedDocument | null> {
    try {
      const { data: document, error } = await this.supabase
        .from('summaries')
        .select(`
          id,
          title,
          lecture_name,
          share_slug,
          is_public,
          view_count,
          shared_at,
          created_at,
          user_id,
          users!summaries_user_id_fkey(email)
        `)
        .eq('share_slug', shareSlug)
        .eq('is_public', true)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw new DatabaseError(
          `Failed to fetch shared document: ${error.message}`,
          'select',
          'summaries'
        )
      }

      if (!document) {
        return null
      }

      // Increment view count
      await this.incrementViewCount(document.id)

      const title = document.title || document.lecture_name || 'Untitled Document'

      return {
        id: document.id,
        title,
        shareSlug: document.share_slug,
        isPublic: document.is_public,
        viewCount: document.view_count + 1, // Include the increment we just made
        sharedAt: document.shared_at,
        ownerEmail: document.users?.email || 'Unknown',
        createdAt: document.created_at
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error fetching shared document',
        'select',
        'summaries'
      )
    }
  }

  /**
   * Get document content by slug for public viewing
   */
  async getSharedDocumentContent(shareSlug: string): Promise<{
    id: string
    title: string
    latexContent: string
    pdfUrl: string | null
    ownerEmail: string
    createdAt: string
    viewCount: number
  } | null> {
    try {
      const { data: document, error } = await this.supabase
        .from('summaries')
        .select(`
          id,
          title,
          lecture_name,
          latex_content,
          pdf_url,
          view_count,
          created_at,
          users!summaries_user_id_fkey(email)
        `)
        .eq('share_slug', shareSlug)
        .eq('is_public', true)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        throw new DatabaseError(
          `Failed to fetch shared document content: ${error.message}`,
          'select',
          'summaries'
        )
      }

      if (!document) {
        return null
      }

      // Increment view count
      await this.incrementViewCount(document.id)

      const title = document.title || document.lecture_name || 'Untitled Document'

      return {
        id: document.id,
        title,
        latexContent: document.latex_content,
        pdfUrl: document.pdf_url,
        ownerEmail: document.users?.email || 'Unknown',
        createdAt: document.created_at,
        viewCount: document.view_count + 1
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error fetching shared document content',
        'select',
        'summaries'
      )
    }
  }

  /**
   * Get list of user's shared documents
   */
  async getUserSharedDocuments(userId: string): Promise<DocumentShareInfo[]> {
    try {
      const { data: documents, error } = await this.supabase
        .from('summaries')
        .select('id, title, lecture_name, is_public, share_slug, view_count')
        .eq('user_id', userId)
        .eq('is_public', true)
        .order('shared_at', { ascending: false })

      if (error) {
        throw new DatabaseError(
          `Failed to fetch shared documents: ${error.message}`,
          'select',
          'summaries'
        )
      }

        return documents.map((doc: any) => {
        const title = doc.title || doc.lecture_name || 'Untitled Document'
        const shareUrl = doc.share_slug
          ? this.generateShareUrl(doc.share_slug)
          : null

        return {
          id: doc.id,
          title,
          shareSlug: doc.share_slug,
          isPublic: doc.is_public,
          viewCount: doc.view_count,
          shareUrl
        }
      })
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error fetching shared documents',
        'select',
        'summaries'
      )
    }
  }

  /**
   * Increment view count for a shared document
   */
  private async incrementViewCount(documentId: string): Promise<void> {
    try {
      const { error } = await this.supabase.rpc('increment_summary_views', {
        summary_id: documentId
      })

      if (error) {
        logger.warn('Failed to increment view count', { error: error })
        // Don't throw error as this is not critical
      }
    } catch (error) {
      logger.warn('Failed to increment view count', { error: error })
      // Don't throw error as this is not critical
    }
  }

  /**
   * Generate share URL from slug
   */
  private generateShareUrl(shareSlug: string): string {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    return `${baseUrl}/share/${shareSlug}`
  }

  /**
   * Validate if user can share document (rate limiting could be added here)
   */
  async canUserShareDocument(_userId: string): Promise<boolean> {
    // For now, all authenticated users can share documents
    // You could add rate limiting here later
    return true
  }

  /**
   * Get sharing statistics for a user
   */
  async getSharingStats(userId: string): Promise<{
    totalShared: number
    totalViews: number
    mostViewedDocument: { title: string; views: number } | null
  }> {
    try {
      const { data: documents, error } = await this.supabase
        .from('summaries')
        .select('title, lecture_name, view_count')
        .eq('user_id', userId)
        .eq('is_public', true)

      if (error) {
        throw new DatabaseError(
          `Failed to fetch sharing stats: ${error.message}`,
          'select',
          'summaries'
        )
      }

      const totalShared = documents.length
        const totalViews = documents.reduce((sum: number, doc: any) => sum + doc.view_count, 0)

      let mostViewedDocument = null
      if (documents.length > 0) {
        const mostViewed = documents.reduce((max: any, doc: any) =>
          doc.view_count > max.view_count ? doc : max
        )
        mostViewedDocument = {
          title: mostViewed.title || mostViewed.lecture_name || 'Untitled Document',
          views: mostViewed.view_count
        }
      }

      return {
        totalShared,
        totalViews,
        mostViewedDocument
      }
    } catch (error) {
      if (error instanceof DatabaseError) {
        throw error
      }
      throw new DatabaseError(
        'Unexpected error fetching sharing stats',
        'select',
        'summaries'
      )
    }
  }
}

/**
 * Factory function to create document sharing service
 */
export async function createDocumentSharingService(): Promise<DocumentSharingService> {
import { logger } from '@/lib/utils/logger'
  const supabase = await createClient()
  return new DocumentSharingService(supabase)
}