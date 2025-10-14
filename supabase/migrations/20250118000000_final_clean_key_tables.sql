-- ============================================
-- FINAL DATABASE CLEANUP & RESTRUCTURE
-- Creates clean 2-table system for API key management
-- WARNING: This DELETES ALL existing key data!
-- ============================================

-- STEP 1: Drop ALL old/duplicate key tables
-- ============================================
DROP TABLE IF EXISTS key_validations CASCADE;
DROP TABLE IF EXISTS scraped_keys CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP VIEW IF EXISTS available_api_keys CASCADE;
DROP VIEW IF EXISTS enriched_scraped_keys CASCADE;
DROP FUNCTION IF EXISTS update_capability_flags() CASCADE;
DROP FUNCTION IF EXISTS handle_api_keys_updated_at() CASCADE;

-- STEP 2: Create CLEAN table structure
-- ============================================

-- TABLE 1: potential_keys
-- Purpose: Store ALL keys found by GitHub scraper (raw, unvalidated)
-- Scraper constantly adds new keys here
CREATE TABLE IF NOT EXISTS potential_keys (
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
CREATE INDEX IF NOT EXISTS idx_potential_keys_validated ON potential_keys(validated) WHERE validated = FALSE;
CREATE INDEX IF NOT EXISTS idx_potential_keys_found_at ON potential_keys(found_at DESC);
CREATE INDEX IF NOT EXISTS idx_potential_keys_source ON potential_keys(source);
CREATE INDEX IF NOT EXISTS idx_potential_keys_api_key ON potential_keys(api_key);

-- TABLE 2: working_gemini_keys
-- Purpose: Validated keys (valid OR quota_exceeded) used by webapp
-- Validator moves keys here from potential_keys
-- Re-validated every 5 minutes to update status
CREATE TABLE IF NOT EXISTS working_gemini_keys (
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
CREATE INDEX IF NOT EXISTS idx_working_keys_status ON working_gemini_keys(status);
CREATE INDEX IF NOT EXISTS idx_working_keys_next_check ON working_gemini_keys(next_check_at) WHERE next_check_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_working_keys_models ON working_gemini_keys USING GIN(models_accessible);
CREATE INDEX IF NOT EXISTS idx_working_keys_valid ON working_gemini_keys(status, success_count DESC) WHERE status = 'valid';
CREATE INDEX IF NOT EXISTS idx_working_keys_api_key ON working_gemini_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_working_keys_last_validated ON working_gemini_keys(last_validated_at);
CREATE INDEX IF NOT EXISTS idx_working_keys_capabilities_text ON working_gemini_keys(can_generate_text) WHERE can_generate_text = TRUE;
CREATE INDEX IF NOT EXISTS idx_working_keys_capabilities_images ON working_gemini_keys(can_generate_images) WHERE can_generate_images = TRUE;

-- STEP 3: Helper Functions
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_working_keys_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS working_keys_updated_at ON working_gemini_keys;
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
  ORDER BY wgk.success_count DESC, wgk.quota_count ASC, wgk.last_validated_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get keys needing revalidation (5-minute check)
CREATE OR REPLACE FUNCTION get_keys_needing_revalidation()
RETURNS SETOF working_gemini_keys AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM working_gemini_keys
  WHERE next_check_at IS NULL OR next_check_at <= NOW()
  ORDER BY last_validated_at ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 4: Create helpful views
-- ============================================

-- View for all valid keys (webapp use)
CREATE OR REPLACE VIEW available_valid_keys AS
SELECT
  id,
  api_key,
  best_model,
  models_accessible,
  can_generate_text,
  can_generate_images,
  can_process_video,
  can_process_audio,
  max_tokens,
  success_count,
  quota_count,
  last_validated_at
FROM working_gemini_keys
WHERE status = 'valid'
ORDER BY success_count DESC, quota_count ASC;

-- View for keys needing validation (validator use)
CREATE OR REPLACE VIEW unvalidated_keys AS
SELECT
  id,
  api_key,
  source,
  source_url,
  found_at,
  metadata
FROM potential_keys
WHERE validated = FALSE
ORDER BY found_at ASC;

-- STEP 5: Add comments for documentation
-- ============================================

COMMENT ON TABLE potential_keys IS 'Raw API keys scraped from GitHub - unvalidated. Scraper constantly adds keys here.';
COMMENT ON TABLE working_gemini_keys IS 'Validated API keys (valid or quota_exceeded) used by webapp. Validator moves keys here and re-validates every 5 minutes.';

COMMENT ON COLUMN potential_keys.validated IS 'FALSE = not yet checked by validator, TRUE = already processed and moved to working_gemini_keys';
COMMENT ON COLUMN potential_keys.api_key IS 'The actual Gemini API key string';
COMMENT ON COLUMN potential_keys.source IS 'Where the key was found (github, gist, etc)';

COMMENT ON COLUMN working_gemini_keys.status IS 'valid = working now, quota_exceeded = hit quota limit (will be rechecked)';
COMMENT ON COLUMN working_gemini_keys.models_accessible IS 'Array of Gemini model names this key can access (e.g., [gemini-2.0-flash-exp])';
COMMENT ON COLUMN working_gemini_keys.next_check_at IS 'When to re-validate this key (5-min validator checks this)';
COMMENT ON COLUMN working_gemini_keys.best_model IS 'The best/highest capability model this key can access';

-- STEP 6: Enable RLS (Row Level Security)
-- ============================================

ALTER TABLE potential_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE working_gemini_keys ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access on potential_keys"
  ON potential_keys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on working_gemini_keys"
  ON working_gemini_keys FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- DONE: Clean 2-table structure ready!
-- ============================================

-- Summary of the flow:
-- 1. GitHub Scraper → saves all found keys to potential_keys (validated=false)
-- 2. Validator Service → picks unvalidated keys from potential_keys
-- 3. Validator → tests keys against Gemini API
-- 4. Validator → moves valid/quota_exceeded keys to working_gemini_keys (sets validated=true in potential_keys)
-- 5. 5-Minute Validator → re-checks keys in working_gemini_keys, updates status
-- 6. Webapp → uses get_available_key() function to get valid keys from working_gemini_keys
