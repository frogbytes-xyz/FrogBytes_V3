/**
 * Storage Cleanup Script
 * 
 * This script deletes all files from the uploads and pdfs storage buckets
 * while preserving the API keys database tables.
 * 
 * Usage:
 *   node scripts/database/cleanup-storage.js
 * 
 * Requirements:
 *   - SUPABASE_URL environment variable
 *   - SUPABASE_SERVICE_KEY environment variable (service role key, not anon key)
 */

const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Recursively delete all files from a bucket
 */
async function cleanupBucket(bucketName) {
  console.log(`\n📦 Cleaning up bucket: ${bucketName}`);
  
  try {
    // List all files in the bucket (including nested folders)
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list('', {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError) {
      console.error(`❌ Error listing files in ${bucketName}:`, listError);
      return;
    }

    if (!files || files.length === 0) {
      console.log(`   ✅ Bucket ${bucketName} is already empty`);
      return;
    }

    console.log(`   📄 Found ${files.length} items`);

    // Separate files and folders
    const folders = files.filter(item => !item.id); // Folders don't have IDs
    const fileNames = files.filter(item => item.id).map(file => file.name);

    // Delete all files first
    if (fileNames.length > 0) {
      console.log(`   🗑️  Deleting ${fileNames.length} files...`);
      const { error: deleteError } = await supabase.storage
        .from(bucketName)
        .remove(fileNames);

      if (deleteError) {
        console.error(`   ❌ Error deleting files:`, deleteError);
      } else {
        console.log(`   ✅ Deleted ${fileNames.length} files`);
      }
    }

    // Recursively delete folders
    for (const folder of folders) {
      await cleanupFolder(bucketName, folder.name);
    }

    console.log(`   ✅ Bucket ${bucketName} cleanup complete`);
  } catch (error) {
    console.error(`❌ Unexpected error cleaning ${bucketName}:`, error);
  }
}

/**
 * Recursively delete all files in a folder
 */
async function cleanupFolder(bucketName, folderPath) {
  try {
    const { data: files, error: listError } = await supabase.storage
      .from(bucketName)
      .list(folderPath, {
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (listError || !files || files.length === 0) {
      return;
    }

    const folders = files.filter(item => !item.id);
    const fileNames = files
      .filter(item => item.id)
      .map(file => `${folderPath}/${file.name}`);

    // Delete files
    if (fileNames.length > 0) {
      await supabase.storage.from(bucketName).remove(fileNames);
    }

    // Recursively delete subfolders
    for (const folder of folders) {
      await cleanupFolder(bucketName, `${folderPath}/${folder.name}`);
    }
  } catch (error) {
    console.error(`   ⚠️  Error cleaning folder ${folderPath}:`, error.message);
  }
}

/**
 * Main cleanup function
 */
async function main() {
  console.log('=============================================================================');
  console.log('🧹 FrogBytes Storage Cleanup');
  console.log('=============================================================================');
  console.log('\n⚠️  This will delete ALL files from storage buckets:');
  console.log('   - uploads (user uploaded files)');
  console.log('   - pdfs (generated PDF files)');
  console.log('\n✅ This will NOT affect:');
  console.log('   - API keys database tables');
  console.log('   - Scraped keys database tables');
  console.log('=============================================================================\n');

  // Wait 3 seconds before proceeding
  console.log('⏳ Starting in 3 seconds... (Ctrl+C to cancel)');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Clean up uploads bucket
  await cleanupBucket('uploads');

  // Clean up pdfs bucket
  await cleanupBucket('pdfs');

  console.log('\n=============================================================================');
  console.log('✅ Storage cleanup complete!');
  console.log('=============================================================================\n');
}

// Run the cleanup
main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});


