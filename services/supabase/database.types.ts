/**
 * Database type definitions
 * These types are generated based on the database schema
 * Run `npx supabase gen types typescript --local` to regenerate
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string | null
          university: string | null
          reputation_score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          full_name?: string | null
          university?: string | null
          reputation_score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          university?: string | null
          reputation_score?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      uploads: {
        Row: {
          id: string
          user_id: string
          filename: string
          file_size: number
          mime_type: string
          file_path: string
          status: string
          telegram_backup_message_id: number | null
          telegram_backup_file_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          filename: string
          file_size: number
          mime_type: string
          file_path: string
          status?: string
          telegram_backup_message_id?: number | null
          telegram_backup_file_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          filename?: string
          file_size?: number
          mime_type?: string
          file_path?: string
          status?: string
          telegram_backup_message_id?: number | null
          telegram_backup_file_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'uploads_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      transcriptions: {
        Row: {
          id: string
          upload_id: string
          user_id: string
          raw_text: string
          language: string | null
          duration_seconds: number | null
          word_count: number | null
          status: string
          error_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          upload_id: string
          user_id: string
          raw_text: string
          language?: string | null
          duration_seconds?: number | null
          word_count?: number | null
          status?: string
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          upload_id?: string
          user_id?: string
          raw_text?: string
          language?: string | null
          duration_seconds?: number | null
          word_count?: number | null
          status?: string
          error_message?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'transcriptions_upload_id_fkey'
            columns: ['upload_id']
            referencedRelation: 'uploads'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'transcriptions_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      summaries: {
        Row: {
          id: string
          transcription_id: string
          user_id: string
          latex_content: string
          summary_type: string
          title: string | null
          chunk_count: number
          total_tokens: number | null
          processing_time_seconds: number | null
          status: string
          error_message: string | null
          pdf_url: string | null
          telegram_link: string | null
          telegram_archive_message_id: number | null
          telegram_archive_file_id: string | null
          telegram_pdf_message_id: number | null
          telegram_pdf_file_id: string | null
          telegram_pdf_link: string | null
          file_size_bytes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          transcription_id: string
          user_id: string
          latex_content: string
          summary_type: string
          title?: string | null
          chunk_count?: number
          total_tokens?: number | null
          processing_time_seconds?: number | null
          status?: string
          error_message?: string | null
          pdf_url?: string | null
          telegram_link?: string | null
          telegram_archive_message_id?: number | null
          telegram_archive_file_id?: string | null
          telegram_pdf_message_id?: number | null
          telegram_pdf_file_id?: string | null
          telegram_pdf_link?: string | null
          file_size_bytes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          transcription_id?: string
          user_id?: string
          latex_content?: string
          summary_type?: string
          title?: string | null
          chunk_count?: number
          total_tokens?: number | null
          processing_time_seconds?: number | null
          status?: string
          error_message?: string | null
          pdf_url?: string | null
          telegram_link?: string | null
          telegram_archive_message_id?: number | null
          telegram_archive_file_id?: string | null
          telegram_pdf_message_id?: number | null
          telegram_pdf_file_id?: string | null
          telegram_pdf_link?: string | null
          file_size_bytes?: number | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'summaries_transcription_id_fkey'
            columns: ['transcription_id']
            referencedRelation: 'transcriptions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'summaries_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
