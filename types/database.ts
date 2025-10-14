/**
 * Centralized database type definitions
 * Provides convenient type aliases for common database operations
 */

import type { Database } from '@/services/supabase/database.types'

// Table row types - representing data as it exists in the database
export type User = Database['public']['Tables']['users']['Row']
export type Upload = Database['public']['Tables']['uploads']['Row']
export type Transcription = Database['public']['Tables']['transcriptions']['Row']
export type Summary = Database['public']['Tables']['summaries']['Row']

// Insert types - for creating new records
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UploadInsert = Database['public']['Tables']['uploads']['Insert']
export type TranscriptionInsert = Database['public']['Tables']['transcriptions']['Insert']
export type SummaryInsert = Database['public']['Tables']['summaries']['Insert']

// Update types - for updating existing records
export type UserUpdate = Database['public']['Tables']['users']['Update']
export type UploadUpdate = Database['public']['Tables']['uploads']['Update']
export type TranscriptionUpdate = Database['public']['Tables']['transcriptions']['Update']
export type SummaryUpdate = Database['public']['Tables']['summaries']['Update']

// Re-export the full Database type for cases where it's needed
export type { Database }
