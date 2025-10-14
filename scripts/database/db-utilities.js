#!/usr/bin/env node
/**
 * Database Utilities - Consolidated database checking and management tool
 * 
 * Usage:
 *   node scripts/database/db-utilities.js [command]
 * 
 * Commands:
 *   check         - Check database connection and counts (default)
 *   schema        - Check database schema
 *   production    - Check production database
 *   insert-test   - Test database insertion
 * 
 * Examples:
 *   node scripts/database/db-utilities.js check
 *   node scripts/database/db-utilities.js schema
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Database clients
const getLocalClient = () => createClient(
  'http://127.0.0.1:54321',
  'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'
);

const getProductionClient = () => createClient(
  'https://glojfttjbyaglysztwau.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsb2pmdHRqYnlhZ2x5c3p0d2F1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI5ODQ4NiwiZXhwIjoyMDc0ODc0NDg2fQ.ex4JvuSNWdWfjbBZUan1VnJ2uOkwaZjgjxdPa-W0DoE'
);

const getEnvClient = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Commands
async function checkDatabase() {
  const supabase = getLocalClient();
  
  console.log('🔍 Checking database connection and data...\n');
  
  try {
    const { count } = await supabase.from('potential_keys').select('*', { count: 'exact' });
    console.log('✅ Current total keys in potential_keys:', count);

    // Get some recent entries
    const { data: recent } = await supabase
      .from('potential_keys')
      .select('api_key, source, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    console.log('\nMost recent 10 keys:');
    recent?.forEach((key, i) => {
      const timeAgo = Math.round((Date.now() - new Date(key.created_at).getTime()) / 1000);
      console.log(`${i+1}. ${key.api_key.substring(0, 20)}... from ${key.source} (${timeAgo}s ago)`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

async function checkSchema() {
  const supabase = getEnvClient();
  
  console.log('🔍 Checking working_gemini_keys table schema...\n');
  
  // Try to get one row to see actual columns
  const { data, error } = await supabase
    .from('working_gemini_keys')
    .select('*')
    .limit(1);
  
  if (error) {
    console.error('❌ Error:', error.message);
    console.error('Code:', error.code);
    return;
  }
  
  if (data && data.length > 0) {
    console.log('✅ Table exists. Columns in first row:');
    console.log(Object.keys(data[0]).join(', '));
  } else {
    console.log('✅ Table exists but is empty');
  }
}

async function checkProduction() {
  const supabase = getProductionClient();
  
  console.log('🔍 Checking PRODUCTION database...\n');

  try {
    // Check potential_keys table
    const { count: potentialCount, error: potentialError } = await supabase
      .from('potential_keys')
      .select('*', { count: 'exact' });

    if (potentialError) {
      console.log('❌ Error accessing potential_keys:', potentialError.message);
    } else {
      console.log('✅ potential_keys count:', potentialCount);
    }

    // Check working_gemini_keys table  
    const { count: workingCount, error: workingError } = await supabase
      .from('working_gemini_keys')
      .select('*', { count: 'exact' });

    if (workingError) {
      console.log('❌ Error accessing working_gemini_keys:', workingError.message);
    } else {
      console.log('✅ working_gemini_keys count:', workingCount);
    }

    console.log(`\n📊 Total keys: ${(potentialCount || 0) + (workingCount || 0)}`);

    // Get some recent potential keys
    if (potentialCount > 0) {
      const { data: recentKeys } = await supabase
        .from('potential_keys')
        .select('api_key, source, created_at, validated')
        .order('created_at', { ascending: false })
        .limit(5);

      console.log('\n🆕 Recent 5 potential keys:');
      recentKeys?.forEach((key, i) => {
        const timeAgo = Math.round((Date.now() - new Date(key.created_at).getTime()) / (1000 * 60));
        console.log(`${i+1}. ${key.api_key.substring(0, 20)}... (${key.source}, ${timeAgo}m ago, validated: ${key.validated})`);
      });
    }

  } catch (error) {
    console.error('💥 Error:', error.message);
  }
}

async function testInsert() {
  const supabase = getEnvClient();
  
  console.log('🔍 Testing database insertion...\n');
  
  const testKey = `TEST_KEY_${Date.now()}`;
  
  const { data, error } = await supabase
    .from('potential_keys')
    .insert([{
      api_key: testKey,
      source: 'test_script',
      validated: false
    }])
    .select();
  
  if (error) {
    console.error('❌ Insert failed:', error.message);
  } else {
    console.log('✅ Insert successful:', data);
    
    // Clean up test data
    const { error: deleteError } = await supabase
      .from('potential_keys')
      .delete()
      .eq('api_key', testKey);
    
    if (!deleteError) {
      console.log('✅ Test data cleaned up');
    }
  }
}

// CLI Handler
const command = process.argv[2] || 'check';

const showHelp = () => {
  console.log(`
Database Utilities

Usage: node scripts/database/db-utilities.js [command]

Commands:
  check         - Check database connection and counts (default)
  schema        - Check database schema
  production    - Check production database
  insert-test   - Test database insertion
  help          - Show this help message
  `);
  process.exit(0);
};

const commands = {
  check: checkDatabase,
  schema: checkSchema,
  production: checkProduction,
  'insert-test': testInsert,
  help: showHelp
};

if (command === 'help') {
  showHelp();
} else if (commands[command]) {
  commands[command]().then(() => process.exit(0)).catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
} else {
  console.error(`Unknown command: ${command}`);
  showHelp();
}
