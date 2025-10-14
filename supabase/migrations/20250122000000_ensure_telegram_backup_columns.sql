-- Ensure Telegram backup columns exist in uploads table
-- This migration is idempotent and safe to run multiple times

-- Add columns if they don't exist
DO $$ 
BEGIN
  -- Add telegram_backup_message_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'uploads' 
      AND column_name = 'telegram_backup_message_id'
  ) THEN
    ALTER TABLE public.uploads ADD COLUMN telegram_backup_message_id INTEGER;
    COMMENT ON COLUMN public.uploads.telegram_backup_message_id IS 'Telegram message ID for audio backup';
  END IF;

  -- Add telegram_backup_file_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'uploads' 
      AND column_name = 'telegram_backup_file_id'
  ) THEN
    ALTER TABLE public.uploads ADD COLUMN telegram_backup_file_id TEXT;
    COMMENT ON COLUMN public.uploads.telegram_backup_file_id IS 'Telegram file ID for audio backup';
  END IF;
END $$;

-- Create index for Telegram file lookups (if not exists)
CREATE INDEX IF NOT EXISTS uploads_telegram_backup_file_id_idx 
  ON public.uploads(telegram_backup_file_id) 
  WHERE telegram_backup_file_id IS NOT NULL;

