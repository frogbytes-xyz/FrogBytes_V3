-- Create scraped_keys table for raw, unvalidated keys from scraper
CREATE TABLE IF NOT EXISTS scraped_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  api_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  source_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validation_status TEXT DEFAULT 'pending' CHECK (validation_status IN ('pending', 'validating', 'processed')),
  validated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_scraped_keys_api_key ON scraped_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_scraped_keys_validation_status ON scraped_keys(validation_status);
CREATE INDEX IF NOT EXISTS idx_scraped_keys_scraped_at ON scraped_keys(scraped_at DESC);

-- Add comment
COMMENT ON TABLE scraped_keys IS 'Raw API keys scraped from GitHub (unvalidated)';
COMMENT ON COLUMN scraped_keys.validation_status IS 'pending = not yet validated, validating = currently being validated, processed = validation complete';
