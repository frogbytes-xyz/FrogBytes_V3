/**
 * Type definitions for enhanced library system
 */

export type DocumentType =
  | 'lecture'
  | 'tutorial'
  | 'seminar'
  | 'exam'
  | 'notes'
  | 'other'
export type FileCategory =
  | 'lecture'
  | 'notes'
  | 'slides'
  | 'handout'
  | 'assignment'
  | 'exam'
  | 'tutorial'
  | 'project'
  | 'other'
  | 'uncategorized'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

export interface DocumentCategory {
  id: string
  name: string
  parent_category_id?: string
  description?: string
  icon?: string
  color?: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Institution {
  id: string
  name: string
  short_name?: string
  country?: string
  city?: string
  website?: string
  logo_url?: string
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface Course {
  id: string
  institution_id?: string
  course_code: string
  course_name: string
  department?: string
  description?: string
  credits?: number
  level?: 'undergraduate' | 'graduate' | 'doctoral'
  created_at: string
  updated_at: string
}

export interface EnhancedSummary {
  id: string
  user_id: string
  upload_id: string
  transcription_id: string

  // Content
  title?: string
  lecture_name?: string
  summary_text: string
  latex_content?: string
  keywords?: string[]
  tags?: string[]

  // Course information
  university?: string
  subject?: string
  course_code?: string
  course_name?: string
  professor?: string
  semester?: string
  academic_year?: string
  lecture_number?: number
  lecture_date?: string

  // Classification
  document_type?: DocumentType
  file_category?: FileCategory
  difficulty_level?: DifficultyLevel
  language?: string

  // Quality & verification
  file_quality_score?: number
  content_verified: boolean
  metadata_complete: boolean

  // Relationships
  institution_id?: string
  course_id?: string

  // Storage
  pdf_url?: string
  file_size_bytes?: number
  storage_size_mb?: number

  // Telegram storage
  telegram_link?: string
  telegram_archive_message_id?: number
  telegram_archive_file_id?: string
  telegram_pdf_message_id?: number
  telegram_pdf_file_id?: string
  telegram_pdf_link?: string
  telegram_audio_message_id?: number
  telegram_audio_file_id?: string
  telegram_transcript_message_id?: number
  telegram_transcript_file_id?: string

  // Sharing & voting
  is_public: boolean
  reputation_score: number

  // Timestamps
  created_at: string
  updated_at: string
}

export interface EnhancedUpload {
  id: string
  user_id: string
  filename: string
  original_filename?: string
  file_size: number
  mime_type: string
  file_path: string
  file_hash?: string
  status: 'uploaded' | 'processing' | 'transcribed' | 'failed'
  upload_metadata?: Record<string, any>

  // Telegram backup
  telegram_backup_message_id?: number
  telegram_backup_file_id?: string

  created_at: string
  updated_at: string
}

export interface LibraryFilters {
  search?: string
  university?: string
  institutionId?: string
  courseId?: string
  courseCode?: string
  subject?: string
  documentType?: DocumentType
  fileCategory?: FileCategory
  difficultyLevel?: DifficultyLevel
  language?: string
  semester?: string
  academicYear?: string
  tags?: string[]
  minReputation?: number
  contentVerified?: boolean
  sortBy?: 'reputation' | 'recent' | 'title' | 'university'
  sortOrder?: 'asc' | 'desc'
  page?: number
  perPage?: number
}

export interface LibrarySearchResult {
  items: EnhancedSummary[]
  total: number
  page: number
  perPage: number
  totalPages: number
  filters: LibraryFilters
}

export interface MetadataValidation {
  isValid: boolean
  errors: Record<string, string>
  warnings: Record<string, string>
  completeness: number // 0-100
}

export interface UploadMetadata {
  // From DocumentMetadata in telegram storage
  title?: string
  documentType?: DocumentType
  fileCategory?: FileCategory
  university?: string
  institutionId?: string
  courseCode?: string
  courseName?: string
  subject?: string
  professor?: string
  semester?: string
  academicYear?: string
  lectureNumber?: number
  lectureDate?: string
  language?: string
  difficultyLevel?: DifficultyLevel
  tags?: string[]
  keywords?: string[]
  originalFilename?: string
  makePublic?: boolean
}

export interface StorageMetrics {
  totalFiles: number
  totalSize: number
  averageSize: number
  filesByType: Record<string, number>
  filesByCategory: Record<string, number>
  storageByUser: Record<string, number>
}

export interface QualityMetrics {
  averageQualityScore: number
  verifiedContent: number
  completeMetadata: number
  totalDocuments: number
}
