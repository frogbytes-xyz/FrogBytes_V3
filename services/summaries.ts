import { createClient } from '@/services/supabase/client'

export interface SummaryListItem {
  id: string
  title: string | null
  lecture_name: string | null
  university: string | null
  subject: string | null
  is_public: boolean
  reputation_score: number | null
  created_at: string
  updated_at: string
  pdf_url: string | null
}

export interface FetchSummariesResult {
  success: boolean
  summaries: SummaryListItem[]
  error?: string
}

/**
 * Fetches all summaries for a specific user
 * Excludes orphaned summaries and orders by creation date (newest first)
 *
 * @param userId - The ID of the user
 * @returns Result with summaries array and success status
 */
export async function getUserSummaries(userId: string): Promise<FetchSummariesResult> {
  try {
    const supabase = createClient()

    const { data, error } = await supabase
      .from('summaries')
      .select('id, title, lecture_name, university, subject, is_public, reputation_score, created_at, updated_at, pdf_url')
      .eq('user_id', userId)
      .not('user_id', 'is', null) // Explicitly exclude orphaned summaries
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching user summaries:', error)
      return {
        success: false,
        summaries: [],
        error: 'Failed to load summaries',
      }
    }

    return {
      success: true,
      summaries: data || [],
    }
  } catch (error) {
    console.error('Unexpected error fetching summaries:', error)
    return {
      success: false,
      summaries: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Toggles the publish status of a summary
 *
 * @param summaryId - The ID of the summary to update
 * @param newStatus - The new public status
 * @returns Success status and any error
 */
export async function toggleSummaryPublishStatus(
  summaryId: string,
  newStatus: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await (supabase
      .from('summaries') as any)
      .update({ is_public: newStatus })
      .eq('id', summaryId)

    if (error) {
      console.error('Error updating summary status:', error)
      return {
        success: false,
        error: 'Failed to update summary status',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error updating summary:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Deletes a summary by ID
 *
 * @param summaryId - The ID of the summary to delete
 * @returns Success status and any error
 */
export async function deleteSummary(
  summaryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient()

    const { error } = await (supabase
      .from('summaries') as any)
      .delete()
      .eq('id', summaryId)

    if (error) {
      console.error('Error deleting summary:', error)
      return {
        success: false,
        error: 'Failed to delete summary',
      }
    }

    return { success: true }
  } catch (error) {
    console.error('Unexpected error deleting summary:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
