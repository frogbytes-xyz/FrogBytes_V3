-- Add key validation and capability tracking
-- This migration enhances the existing scraped_keys table and adds a new validated_keys table

-- First, add new columns to scraped_keys table for validation results
ALTER TABLE scraped_keys ADD COLUMN IF NOT EXISTS validation_result JSONB;
ALTER TABLE scraped_keys ADD COLUMN IF NOT EXISTS last_validation_attempt TIMESTAMPTZ;
ALTER TABLE scraped_keys ADD COLUMN IF NOT EXISTS validation_error TEXT;

-- Create table for storing detailed validation results and capabilities
CREATE TABLE IF NOT EXISTS key_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL,
  validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_models_tested INTEGER NOT NULL DEFAULT 0,
  total_models_accessible INTEGER NOT NULL DEFAULT 0,
  average_response_time INTEGER, -- in milliseconds
  quota_remaining INTEGER,
  rate_limit_per_minute INTEGER,
  rate_limit_per_day INTEGER,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of ModelCapability objects

  -- Derived capability flags for easy querying
  can_generate_text BOOLEAN DEFAULT FALSE,
  can_generate_images BOOLEAN DEFAULT FALSE,
  can_process_video BOOLEAN DEFAULT FALSE,
  can_process_audio BOOLEAN DEFAULT FALSE,
  can_execute_code BOOLEAN DEFAULT FALSE,
  can_call_functions BOOLEAN DEFAULT FALSE,
  can_search_grounding BOOLEAN DEFAULT FALSE,
  max_token_limit INTEGER DEFAULT 0,
  best_model TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_key_validations_api_key ON key_validations(api_key);
CREATE INDEX IF NOT EXISTS idx_key_validations_is_valid ON key_validations(is_valid);
CREATE INDEX IF NOT EXISTS idx_key_validations_validated_at ON key_validations(validated_at DESC);
CREATE INDEX IF NOT EXISTS idx_key_validations_capabilities ON key_validations USING GIN(capabilities);

-- Create capability-specific indexes for filtering
CREATE INDEX IF NOT EXISTS idx_key_validations_can_generate_text ON key_validations(can_generate_text) WHERE can_generate_text = TRUE;
CREATE INDEX IF NOT EXISTS idx_key_validations_can_generate_images ON key_validations(can_generate_images) WHERE can_generate_images = TRUE;
CREATE INDEX IF NOT EXISTS idx_key_validations_can_process_video ON key_validations(can_process_video) WHERE can_process_video = TRUE;
CREATE INDEX IF NOT EXISTS idx_key_validations_can_process_audio ON key_validations(can_process_audio) WHERE can_process_audio = TRUE;
CREATE INDEX IF NOT EXISTS idx_key_validations_can_execute_code ON key_validations(can_execute_code) WHERE can_execute_code = TRUE;
CREATE INDEX IF NOT EXISTS idx_key_validations_max_tokens ON key_validations(max_token_limit DESC);

-- Create a view that combines scraped keys with their latest validation
CREATE OR REPLACE VIEW enriched_scraped_keys AS
SELECT
  sk.*,
  kv.is_valid,
  kv.total_models_tested,
  kv.total_models_accessible,
  kv.average_response_time,
  kv.quota_remaining,
  kv.rate_limit_per_minute,
  kv.rate_limit_per_day,
  kv.can_generate_text,
  kv.can_generate_images,
  kv.can_process_video,
  kv.can_process_audio,
  kv.can_execute_code,
  kv.can_call_functions,
  kv.can_search_grounding,
  kv.max_token_limit,
  kv.best_model,
  kv.capabilities,
  kv.validated_at AS capability_validated_at
FROM scraped_keys sk
LEFT JOIN key_validations kv ON sk.api_key = kv.api_key
  AND kv.validated_at = (
    SELECT MAX(validated_at)
    FROM key_validations kv2
    WHERE kv2.api_key = sk.api_key
  );

-- Create function to update capability flags based on capabilities JSON
CREATE OR REPLACE FUNCTION update_capability_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- Extract capability flags from the capabilities JSONB array
  NEW.can_generate_text := EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.capabilities) AS cap
    WHERE (cap->>'isAccessible')::boolean = true
    AND cap->'features' ? 'text'
  );

  NEW.can_generate_images := EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.capabilities) AS cap
    WHERE (cap->>'isAccessible')::boolean = true
    AND cap->'features' ? 'image-generation'
  );

  NEW.can_process_video := EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.capabilities) AS cap
    WHERE (cap->>'isAccessible')::boolean = true
    AND cap->'features' ? 'video'
  );

  NEW.can_process_audio := EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.capabilities) AS cap
    WHERE (cap->>'isAccessible')::boolean = true
    AND (cap->'features' ? 'audio' OR cap->'features' ? 'native-audio')
  );

  NEW.can_execute_code := EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.capabilities) AS cap
    WHERE (cap->>'isAccessible')::boolean = true
    AND cap->'features' ? 'code-execution'
  );

  NEW.can_call_functions := EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.capabilities) AS cap
    WHERE (cap->>'isAccessible')::boolean = true
    AND cap->'features' ? 'function-calling'
  );

  NEW.can_search_grounding := EXISTS (
    SELECT 1 FROM jsonb_array_elements(NEW.capabilities) AS cap
    WHERE (cap->>'isAccessible')::boolean = true
    AND cap->'features' ? 'search-grounding'
  );

  -- Find max token limit from accessible models
  SELECT COALESCE(MAX((cap->>'maxTokens')::integer), 0)
  INTO NEW.max_token_limit
  FROM jsonb_array_elements(NEW.capabilities) AS cap
  WHERE (cap->>'isAccessible')::boolean = true;

  -- Find best model (highest token limit)
  SELECT cap->>'modelName'
  INTO NEW.best_model
  FROM jsonb_array_elements(NEW.capabilities) AS cap
  WHERE (cap->>'isAccessible')::boolean = true
  ORDER BY (cap->>'maxTokens')::integer DESC
  LIMIT 1;

  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update capability flags
CREATE TRIGGER update_capability_flags_trigger
  BEFORE INSERT OR UPDATE ON key_validations
  FOR EACH ROW
  EXECUTE FUNCTION update_capability_flags();

-- Add comments
COMMENT ON TABLE key_validations IS 'Detailed validation results and capabilities for API keys';
COMMENT ON COLUMN key_validations.capabilities IS 'JSON array of ModelCapability objects from validation';
COMMENT ON COLUMN key_validations.average_response_time IS 'Average response time in milliseconds across all tested models';
COMMENT ON VIEW enriched_scraped_keys IS 'Scraped keys with their latest validation and capability data';

-- Grant necessary permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON key_validations TO authenticated;
-- GRANT SELECT ON enriched_scraped_keys TO authenticated;