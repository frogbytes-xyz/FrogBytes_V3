const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://glojfttjbyaglysztwau.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdsb2pmdHRqYnlhZ2x5c3p0d2F1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI5ODQ4NiwiZXhwIjoyMDc0ODc0NDg2fQ.ex4JvuSNWdWfjbBZUan1VnJ2uOkwaZjgjxdPa-W0DoE';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testKeyCheck() {
  console.log('🔍 Testing the key we saw being "found"...\n');

  // The key we saw being found: AIzaSyCQAFtl...
  const testKey = 'AIzaSyCQAFtl'; // We'll check if a key starting with this exists

  try {
    // Check if this key (or similar) exists in database
    const { data: existingKeys } = await supabase
      .from('potential_keys')
      .select('api_key, created_at')
      .ilike('api_key', 'AIzaSyCQAFtl%');

    if (existingKeys && existingKeys.length > 0) {
      console.log('❌ KEY ALREADY EXISTS IN DATABASE:');
      existingKeys.forEach(key => {
        const timeAgo = Math.round((Date.now() - new Date(key.created_at).getTime()) / (1000 * 60));
        console.log(`   • ${key.api_key} (added ${timeAgo}m ago)`);
      });
      console.log('\n🔍 This explains why the "new" key gets filtered out in the second duplicate check!');
    } else {
      console.log('✅ Key not found in database - this would be genuinely new');
    }

    // Also check how many keys start with AIzaSyC (common prefix)
    const { count } = await supabase
      .from('potential_keys')
      .select('*', { count: 'exact' })
      .ilike('api_key', 'AIzaSyC%');

    console.log(`\n📊 Keys starting with "AIzaSyC": ${count} in database`);
    console.log('   This high count suggests most keys of this pattern are already stored.');

  } catch (error) {
    console.error('Error:', error.message);
  }
}

testKeyCheck().then(() => process.exit(0));