# Database Cleanup Scripts

This directory contains scripts for cleaning up test data from the FrogBytes database.

## Overview

During development and testing, the database accumulates user-generated data. These scripts help clean up this test data while preserving important system data like API keys.

## Scripts

### 1. `preview-cleanup.sql`
**Purpose:** Preview what will be deleted before running cleanup  
**Safety:** READ-ONLY (no data is deleted)

Run this script first to see exactly what data exists and will be deleted.

### 2. `cleanup-test-data.sql`
**Purpose:** Clean up all user-generated test data  
**Safety:** DESTRUCTIVE (deletes data - cannot be undone)

This script deletes:
- ✅ Feedback (feedback, feedback_votes, feedback_replies)
- ✅ Collections and collection items
- ✅ Votes on summaries
- ✅ Summaries (generated content)
- ✅ Transcriptions (generated content)
- ✅ Uploads (user files)
- ✅ User profiles (public.users)
- ✅ Auth users (auth.users)

This script preserves:
- ✅ API keys (api_keys table)
- ✅ Scraped keys (scraped_keys table)
- ✅ GitHub tokens and validation data

## Usage

### Option 1: Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Copy and paste `preview-cleanup.sql` first
4. Click **Run** to see the preview
5. If everything looks good, copy and paste `cleanup-test-data.sql`
6. Click **Run** to execute the cleanup

### Option 2: Supabase CLI

```bash
# Preview first
supabase db execute < scripts/database/preview-cleanup.sql

# Then cleanup
supabase db execute < scripts/database/cleanup-test-data.sql
```

### Option 3: psql (Direct Connection)

```bash
# Set your database URL
export DATABASE_URL="postgresql://postgres:[password]@[host]:[port]/postgres"

# Preview first
psql $DATABASE_URL -f scripts/database/preview-cleanup.sql

# Then cleanup
psql $DATABASE_URL -f scripts/database/cleanup-test-data.sql
```

### Option 4: Run as Migration (One-time)

If you want to run this as part of your migration process:

```bash
supabase migration up --file supabase/migrations/20251012000000_cleanup_test_data.sql
```

**Warning:** Migrations are tracked and won't run again. This is only suitable for one-time cleanup.

## Storage Cleanup

⚠️ **Important:** These scripts only clean the database records. You'll need to manually clean storage buckets:

1. Go to Supabase Dashboard → **Storage**
2. Delete files from these buckets:
   - `uploads` - User uploaded files
   - `pdfs` - Generated PDF files
3. Or use the Supabase Storage API to delete files programmatically

### Programmatic Storage Cleanup

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function cleanupStorage() {
  // List and delete all files in uploads bucket
  const { data: uploadFiles } = await supabase.storage.from('uploads').list();
  if (uploadFiles && uploadFiles.length > 0) {
    const filePaths = uploadFiles.map(file => file.name);
    await supabase.storage.from('uploads').remove(filePaths);
  }

  // List and delete all files in pdfs bucket
  const { data: pdfFiles } = await supabase.storage.from('pdfs').list();
  if (pdfFiles && pdfFiles.length > 0) {
    const filePaths = pdfFiles.map(file => file.name);
    await supabase.storage.from('pdfs').remove(filePaths);
  }
}

cleanupStorage();
```

## Safety Precautions

1. **Always run `preview-cleanup.sql` first** to see what will be deleted
2. **Backup your database** before running cleanup if needed
3. **Verify your API keys are preserved** by checking the preview output
4. **This operation cannot be undone** - make sure you're ready to delete all user data

## What Gets Preserved

✅ **API Keys System:**
- `api_keys` table - Validated API keys for production use
- `scraped_keys` table - Raw scraped keys from GitHub
- All key validation metadata
- GitHub token manager data
- Key pool service data

## Verification

After running the cleanup, you can verify the results:

```sql
-- Verify user data is deleted
SELECT 'users' as table_name, COUNT(*) as count FROM public.users
UNION ALL
SELECT 'uploads', COUNT(*) FROM public.uploads
UNION ALL
SELECT 'summaries', COUNT(*) FROM public.summaries
UNION ALL
SELECT 'feedback', COUNT(*) FROM public.feedback;

-- Verify API keys are preserved
SELECT 'api_keys' as table_name, COUNT(*) as count FROM public.api_keys
UNION ALL
SELECT 'scraped_keys', COUNT(*) FROM public.scraped_keys;
```

Expected results:
- User data tables: 0 records
- API key tables: Same count as before cleanup

## Troubleshooting

### Permission Errors

If you get permission errors, make sure you're using:
- Service role key (not anon key)
- Database owner credentials
- Admin/superuser access

### Foreign Key Constraints

The script handles deletion in the correct order to avoid FK constraint violations. If you still get errors, check for any custom tables that reference these tables.

### RLS Issues

The script temporarily disables RLS policies to ensure all records can be deleted. This requires service role privileges.

## Files in This Directory

- `preview-cleanup.sql` - Preview script (safe, read-only)
- `cleanup-test-data.sql` - Main cleanup script (destructive)
- `README.md` - This file
- `cleanup-storage.js` - Optional storage cleanup helper (create if needed)

## Questions?

If you encounter any issues or need help:
1. Check the error messages carefully
2. Verify you have the correct permissions
3. Make sure you're connected to the right database
4. Review the preview output before running cleanup
