#!/usr/bin/env node

/**
 * Utility script to apply the Telegram backup columns migration
 * Runs directly against the Supabase database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  console.log('Applying Telegram backup columns migration...');
  
  const migrationSQL = `
    -- Ensure Telegram backup columns exist in uploads table
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
        RAISE NOTICE 'Added column: telegram_backup_message_id';
      ELSE
        RAISE NOTICE 'Column already exists: telegram_backup_message_id';
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
        RAISE NOTICE 'Added column: telegram_backup_file_id';
      ELSE
        RAISE NOTICE 'Column already exists: telegram_backup_file_id';
      END IF;
    END $$;

    -- Create index for Telegram file lookups (if not exists)
    CREATE INDEX IF NOT EXISTS uploads_telegram_backup_file_id_idx 
      ON public.uploads(telegram_backup_file_id) 
      WHERE telegram_backup_file_id IS NOT NULL;
  `;

  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });
    
    if (error) {
      console.error('Migration failed:', error);
      process.exit(1);
    }
    
    console.log('✅ Migration applied successfully!');
    console.log('The uploads table now has telegram_backup_file_id column.');
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
}

applyMigration();

