-- Add PDF storage fields to summaries table
-- This migration adds columns for storing compiled PDFs and Telegram backup links

-- Add pdf_url column for Supabase Storage URL
ALTER TABLE public.summaries
ADD COLUMN pdf_url TEXT;

-- Add telegram_link column for Telegram cloud storage backup
ALTER TABLE public.summaries
ADD COLUMN telegram_link TEXT;

-- Add title column for summary title (extracted from content or user-provided)
ALTER TABLE public.summaries
ADD COLUMN title TEXT;

-- Add file_size column for tracking PDF size
ALTER TABLE public.summaries
ADD COLUMN file_size_bytes BIGINT;

-- Create index on pdf_url for existence checks
CREATE INDEX summaries_pdf_url_idx ON public.summaries(pdf_url) WHERE pdf_url IS NOT NULL;

-- Add comment describing the columns
COMMENT ON COLUMN public.summaries.pdf_url IS 'URL to compiled PDF in Supabase Storage';
COMMENT ON COLUMN public.summaries.telegram_link IS 'Telegram cloud backup link for original file (<4GB)';
COMMENT ON COLUMN public.summaries.title IS 'Summary title extracted from content or user-provided';
COMMENT ON COLUMN public.summaries.file_size_bytes IS 'Size of the compiled PDF in bytes';
