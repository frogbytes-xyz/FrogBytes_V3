-- Add telegram_backup_complete field to summaries table
-- This migration is idempotent and safe to run multiple times

DO $$ 
BEGIN
  -- Add telegram_backup_complete column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'summaries' 
      AND column_name = 'telegram_backup_complete'
  ) THEN
    ALTER TABLE public.summaries ADD COLUMN telegram_backup_complete BOOLEAN DEFAULT FALSE;
    COMMENT ON COLUMN public.summaries.telegram_backup_complete IS 'Indicates if the complete package has been successfully uploaded to Telegram';
  END IF;
END $$;

-- Create index for telegram_backup_complete field
CREATE INDEX IF NOT EXISTS summaries_telegram_backup_complete_idx 
  ON public.summaries(telegram_backup_complete) 
  WHERE telegram_backup_complete = true;
