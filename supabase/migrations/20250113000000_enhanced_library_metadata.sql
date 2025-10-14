-- Enhanced Library Metadata System
-- Adds comprehensive metadata fields and categorization for better library organization

-- Add course/lecture metadata fields to summaries table
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS course_code TEXT,
ADD COLUMN IF NOT EXISTS course_name TEXT,
ADD COLUMN IF NOT EXISTS professor TEXT,
ADD COLUMN IF NOT EXISTS semester TEXT,
ADD COLUMN IF NOT EXISTS academic_year TEXT,
ADD COLUMN IF NOT EXISTS lecture_number INTEGER,
ADD COLUMN IF NOT EXISTS lecture_date DATE,
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'lecture' CHECK (document_type IN ('lecture', 'tutorial', 'seminar', 'exam', 'notes', 'other')),
ADD COLUMN IF NOT EXISTS difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', NULL));

-- Add file organization metadata
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS file_category TEXT DEFAULT 'uncategorized' CHECK (
  file_category IN ('lecture', 'notes', 'slides', 'handout', 'assignment', 'exam', 'tutorial', 'project', 'other', 'uncategorized')
),
ADD COLUMN IF NOT EXISTS file_quality_score INTEGER CHECK (file_quality_score >= 0 AND file_quality_score <= 100),
ADD COLUMN IF NOT EXISTS content_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS metadata_complete BOOLEAN DEFAULT false;

-- Add enhanced storage metadata
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS telegram_audio_message_id INTEGER,
ADD COLUMN IF NOT EXISTS telegram_audio_file_id TEXT,
ADD COLUMN IF NOT EXISTS telegram_transcript_message_id INTEGER,
ADD COLUMN IF NOT EXISTS telegram_transcript_file_id TEXT,
ADD COLUMN IF NOT EXISTS storage_size_mb NUMERIC(10, 2);

-- Add enhanced user metadata to uploads
ALTER TABLE public.uploads
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS file_hash TEXT,
ADD COLUMN IF NOT EXISTS upload_metadata JSONB DEFAULT '{}'::jsonb;

-- Create a new table for document categories/tags taxonomy
CREATE TABLE IF NOT EXISTS public.document_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  parent_category_id UUID REFERENCES public.document_categories(id) ON DELETE CASCADE,
  description TEXT,
  icon TEXT,
  color TEXT,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create junction table for many-to-many relationship between summaries and categories
CREATE TABLE IF NOT EXISTS public.summary_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_id UUID NOT NULL REFERENCES public.summaries(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.document_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(summary_id, category_id)
);

-- Create table for storing university/institution information
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  short_name TEXT,
  country TEXT,
  city TEXT,
  website TEXT,
  logo_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create table for course/subject catalog
CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  department TEXT,
  description TEXT,
  credits INTEGER,
  level TEXT CHECK (level IN ('undergraduate', 'graduate', 'doctoral', NULL)),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(institution_id, course_code)
);

-- Add foreign key to link summaries to courses
ALTER TABLE public.summaries
ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS summaries_institution_id_idx ON public.summaries(institution_id) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS summaries_course_id_idx ON public.summaries(course_id) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS summaries_course_code_idx ON public.summaries(course_code) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS summaries_document_type_idx ON public.summaries(document_type) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS summaries_file_category_idx ON public.summaries(file_category) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS summaries_language_idx ON public.summaries(language) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS summaries_difficulty_idx ON public.summaries(difficulty_level) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS summaries_semester_idx ON public.summaries(semester) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS summaries_academic_year_idx ON public.summaries(academic_year) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS uploads_file_hash_idx ON public.uploads(file_hash) WHERE file_hash IS NOT NULL;

-- Create full-text search indexes
CREATE INDEX IF NOT EXISTS summaries_search_idx ON public.summaries 
  USING GIN (to_tsvector('english', 
    COALESCE(title, '') || ' ' || 
    COALESCE(lecture_name, '') || ' ' || 
    COALESCE(course_name, '') || ' ' || 
    COALESCE(course_code, '') || ' ' ||
    COALESCE(subject, '')
  )) WHERE is_public = true;

-- Enable RLS on new tables
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summary_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for document_categories (public read, admin write)
CREATE POLICY "Anyone can view active categories"
  ON public.document_categories
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for summary_categories (users can manage their own)
CREATE POLICY "Users can view summary categories"
  ON public.summary_categories
  FOR SELECT
  USING (true);

CREATE POLICY "Users can manage their summary categories"
  ON public.summary_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.summaries
      WHERE summaries.id = summary_categories.summary_id
      AND summaries.user_id = auth.uid()
    )
  );

-- RLS Policies for institutions (public read)
CREATE POLICY "Anyone can view institutions"
  ON public.institutions
  FOR SELECT
  USING (true);

-- RLS Policies for courses (public read)
CREATE POLICY "Anyone can view courses"
  ON public.courses
  FOR SELECT
  USING (true);

-- Create triggers for updated_at
CREATE TRIGGER handle_document_categories_updated_at
  BEFORE UPDATE ON public.document_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_institutions_updated_at
  BEFORE UPDATE ON public.institutions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Grant permissions
GRANT SELECT ON public.document_categories TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.summary_categories TO authenticated;
GRANT SELECT ON public.institutions TO authenticated, anon;
GRANT SELECT ON public.courses TO authenticated, anon;

-- Add helpful comments
COMMENT ON COLUMN public.summaries.course_code IS 'Official course code (e.g., CS101, MATH201)';
COMMENT ON COLUMN public.summaries.course_name IS 'Full course name';
COMMENT ON COLUMN public.summaries.professor IS 'Professor/instructor name';
COMMENT ON COLUMN public.summaries.semester IS 'Semester (e.g., Fall 2024, Spring 2025)';
COMMENT ON COLUMN public.summaries.academic_year IS 'Academic year (e.g., 2024-2025)';
COMMENT ON COLUMN public.summaries.lecture_number IS 'Lecture number in sequence';
COMMENT ON COLUMN public.summaries.lecture_date IS 'Date when lecture was given';
COMMENT ON COLUMN public.summaries.language IS 'Language code (ISO 639-1)';
COMMENT ON COLUMN public.summaries.document_type IS 'Type of educational document';
COMMENT ON COLUMN public.summaries.difficulty_level IS 'Perceived difficulty level';
COMMENT ON COLUMN public.summaries.file_category IS 'Category for file organization';
COMMENT ON COLUMN public.summaries.file_quality_score IS 'Automated quality score (0-100)';
COMMENT ON COLUMN public.summaries.content_verified IS 'Whether content has been verified';
COMMENT ON COLUMN public.summaries.metadata_complete IS 'Whether all metadata fields are filled';
COMMENT ON COLUMN public.summaries.storage_size_mb IS 'Total storage size in megabytes';
COMMENT ON COLUMN public.uploads.file_hash IS 'SHA-256 hash for duplicate detection';
COMMENT ON COLUMN public.uploads.upload_metadata IS 'Additional metadata in JSON format';

COMMENT ON TABLE public.document_categories IS 'Hierarchical category system for organizing documents';
COMMENT ON TABLE public.summary_categories IS 'Many-to-many relationship between summaries and categories';
COMMENT ON TABLE public.institutions IS 'University/institution catalog';
COMMENT ON TABLE public.courses IS 'Course catalog linked to institutions';
