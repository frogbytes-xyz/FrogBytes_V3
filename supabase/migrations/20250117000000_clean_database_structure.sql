-- CLEAN DATABASE RESTRUCTURE
-- Removes all duplicate/confusing tables and creates clean 2-table system
-- WARNING: This will DELETE ALL existing key data!

-- ============================================
-- STEP 1: DROP OLD TABLES AND DATA
-- ============================================

-- Drop old confusing tables (this deletes all data!)
DROP TABLE IF EXISTS key_validations CASCADE;
DROP TABLE IF EXISTS scraped_keys CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;

-- ============================================
-- STEP 2: CREATE CLEAN TABLE STRUCTURE
-- ============================================

-- TABLE 1: potential_keys
-- Purpose: Store ALL keys found by GitHub scraper (raw, unvalidated)
-- Scraper constantly adds new keys here
CREATE TABLE potential_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL, -- 'github', 'gist', etc
  source_url TEXT,
  found_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated BOOLEAN DEFAULT FALSE, -- has validator checked this yet?
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for potential_keys
CREATE INDEX idx_potential_keys_validated ON potential_keys(validated) WHERE validated = FALSE;
CREATE INDEX idx_potential_keys_found_at ON potential_keys(found_at DESC);
CREATE INDEX idx_potential_keys_source ON potential_keys(source);

-- TABLE 2: working_gemini_keys
-- Purpose: Validated keys (valid OR quota_exceeded) used by webapp
-- Validator moves keys here from potential_keys
-- Re-validated every 5 minutes to update status
CREATE TABLE working_gemini_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('valid', 'quota_exceeded')),
  source TEXT,
  source_url TEXT,

  -- Model compatibility (which Gemini models this key works with)
  models_accessible TEXT[] DEFAULT ARRAY[]::TEXT[], -- array of model names: ['gemini-2.0-flash-exp', 'gemini-pro']
  can_generate_text BOOLEAN DEFAULT FALSE,
  can_generate_images BOOLEAN DEFAULT FALSE,
  can_process_video BOOLEAN DEFAULT FALSE,
  can_process_audio BOOLEAN DEFAULT FALSE,
  can_execute_code BOOLEAN DEFAULT FALSE,
  can_call_functions BOOLEAN DEFAULT FALSE,
  max_tokens INTEGER DEFAULT 0,
  best_model TEXT, -- the best/highest capability model for this key

  -- Usage tracking
  last_validated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_check_at TIMESTAMPTZ, -- when to check again (for 5-min validator)
  success_count INTEGER DEFAULT 0, -- how many times used successfully
  quota_count INTEGER DEFAULT 0, -- how many times hit quota
  error_count INTEGER DEFAULT 0,

  -- Timestamps
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for working_gemini_keys
CREATE INDEX idx_working_keys_status ON working_gemini_keys(status);
CREATE INDEX idx_working_keys_next_check ON working_gemini_keys(next_check_at) WHERE next_check_at IS NOT NULL;
CREATE INDEX idx_working_keys_models ON working_gemini_keys USING GIN(models_accessible);
CREATE INDEX idx_working_keys_valid ON working_gemini_keys(status, success_count DESC) WHERE status = 'valid';

-- ============================================
-- STEP 3: CREATE HELPER FUNCTIONS
-- ============================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_working_keys_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
CREATE TRIGGER working_keys_updated_at
  BEFORE UPDATE ON working_gemini_keys
  FOR EACH ROW
  EXECUTE FUNCTION update_working_keys_timestamp();

-- Function to get available valid key for use
CREATE OR REPLACE FUNCTION get_available_key(
  required_text BOOLEAN DEFAULT TRUE,
  required_images BOOLEAN DEFAULT FALSE,
  required_video BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  api_key TEXT,
  best_model TEXT,
  models_accessible TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wgk.api_key,
    wgk.best_model,
    wgk.models_accessible
  FROM working_gemini_keys wgk
  WHERE wgk.status = 'valid'
    AND (NOT required_text OR wgk.can_generate_text = TRUE)
    AND (NOT required_images OR wgk.can_generate_images = TRUE)
    AND (NOT required_video OR wgk.can_process_video = TRUE)
  ORDER BY wgk.success_count DESC, wgk.quota_count ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to mark key as used (increment success/quota/error count)
CREATE OR REPLACE FUNCTION mark_key_used(
  p_api_key TEXT,
  p_result TEXT -- 'success', 'quota', 'error'
)
RETURNS VOID AS $$
BEGIN
  UPDATE working_gemini_keys
  SET
    success_count = CASE WHEN p_result = 'success' THEN success_count + 1 ELSE success_count END,
    quota_count = CASE WHEN p_result = 'quota' THEN quota_count + 1 ELSE quota_count END,
    error_count = CASE WHEN p_result = 'error' THEN error_count + 1 ELSE error_count END,
    status = CASE WHEN p_result = 'quota' THEN 'quota_exceeded' ELSE status END,
    updated_at = NOW()
  WHERE api_key = p_api_key;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: ADD COMMENTS
-- ============================================

COMMENT ON TABLE potential_keys IS 'Raw API keys scraped from GitHub - unvalidated';
COMMENT ON TABLE working_gemini_keys IS 'Validated API keys (valid or quota_exceeded) used by webapp';

COMMENT ON COLUMN potential_keys.validated IS 'FALSE = not yet checked by validator, TRUE = already processed';
COMMENT ON COLUMN working_gemini_keys.status IS 'valid = working now, quota_exceeded = hit quota limit';
COMMENT ON COLUMN working_gemini_keys.models_accessible IS 'Array of Gemini model names this key can access';
COMMENT ON COLUMN working_gemini_keys.next_check_at IS 'When to re-validate this key (5-min validator checks this)';

-- ============================================
-- DONE: Clean 2-table structure ready!
-- ============================================

-- Summary:
-- 1. potential_keys: Scraper saves all found keys here
-- 2. working_gemini_keys: Validator moves valid/quota keys here, webapp uses these
