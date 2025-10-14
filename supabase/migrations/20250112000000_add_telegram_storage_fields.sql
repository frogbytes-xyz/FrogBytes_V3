-- Add Telegram storage fields to replace Supabase bucket storage
-- This migration adds columns for storing Telegram message links and file IDs

-- Update summaries table with Telegram-specific fields
ALTER TABLE public.summaries
ADD COLUMN telegram_archive_message_id INTEGER,
ADD COLUMN telegram_archive_file_id TEXT,
ADD COLUMN telegram_pdf_message_id INTEGER,
ADD COLUMN telegram_pdf_file_id TEXT,
ADD COLUMN telegram_pdf_link TEXT;

-- Update uploads table with Telegram backup info
ALTER TABLE public.uploads
ADD COLUMN telegram_backup_message_id INTEGER,
ADD COLUMN telegram_backup_file_id TEXT;

-- Add indexes for Telegram file lookups
CREATE INDEX summaries_telegram_pdf_file_id_idx ON public.summaries(telegram_pdf_file_id) WHERE telegram_pdf_file_id IS NOT NULL;
CREATE INDEX uploads_telegram_backup_file_id_idx ON public.uploads(telegram_backup_file_id) WHERE telegram_backup_file_id IS NOT NULL;

-- Add comments describing the new columns
COMMENT ON COLUMN public.summaries.telegram_archive_message_id IS 'Telegram message ID for archive ZIP in Topic 1';
COMMENT ON COLUMN public.summaries.telegram_archive_file_id IS 'Telegram file ID for archive ZIP';
COMMENT ON COLUMN public.summaries.telegram_pdf_message_id IS 'Telegram message ID for PDF in Topic 2';
COMMENT ON COLUMN public.summaries.telegram_pdf_file_id IS 'Telegram file ID for PDF in Topic 2';
COMMENT ON COLUMN public.summaries.telegram_pdf_link IS 'Direct Telegram link to PDF message (clickable URL)';
COMMENT ON COLUMN public.uploads.telegram_backup_message_id IS 'Telegram message ID for audio backup';
COMMENT ON COLUMN public.uploads.telegram_backup_file_id IS 'Telegram file ID for audio backup';

-- Update telegram_link column comment to clarify its new usage
COMMENT ON COLUMN public.summaries.telegram_link IS 'Direct Telegram link to archive ZIP message (clickable URL)';

-- Note: pdf_url column is kept for backward compatibility and can store Telegram file links
COMMENT ON COLUMN public.summaries.pdf_url IS 'URL to PDF (can be Telegram file link or Supabase Storage URL)';
