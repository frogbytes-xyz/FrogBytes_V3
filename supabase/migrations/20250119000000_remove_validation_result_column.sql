-- Remove validation_result column from working_gemini_keys
-- This column is unnecessary - validation tracking is done in potential_keys.validated

ALTER TABLE working_gemini_keys 
DROP COLUMN IF EXISTS validation_result;

-- Verify column is gone
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'working_gemini_keys' 
    AND column_name = 'validation_result'
  ) THEN
    RAISE EXCEPTION 'Column validation_result still exists!';
  ELSE
    RAISE NOTICE 'Column validation_result successfully removed';
  END IF;
END $$;
