const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixSchema() {
  console.log('Adding validation_result column to working_gemini_keys...\n');
  
  // Execute raw SQL to add the column
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `
      -- Add validation_result column if it doesn't exist
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'working_gemini_keys' 
          AND column_name = 'validation_result'
        ) THEN
          ALTER TABLE working_gemini_keys 
          ADD COLUMN validation_result JSONB DEFAULT '{}'::jsonb;
          
          RAISE NOTICE 'Column validation_result added successfully';
        ELSE
          RAISE NOTICE 'Column validation_result already exists';
        END IF;
      END $$;
    `
  });
  
  if (error) {
    console.error('❌ Error:', error.message);
    console.log('\nTrying alternative approach with direct SQL...');
    
    // Alternative: Try direct ALTER TABLE
    const { error: alterError } = await supabase
      .from('working_gemini_keys')
      .select('validation_result')
      .limit(0);
    
    if (alterError && alterError.message.includes('validation_result')) {
      console.log('Column still missing. You need to run this SQL manually in Supabase dashboard:');
      console.log('\n--- Copy and paste this SQL ---\n');
      console.log('ALTER TABLE working_gemini_keys ADD COLUMN IF NOT EXISTS validation_result JSONB DEFAULT \'{}\\'::jsonb;');
      console.log('\n--- End of SQL ---\n');
    }
  } else {
    console.log('✓ Success!');
  }
}

fixSchema().catch(console.error);
