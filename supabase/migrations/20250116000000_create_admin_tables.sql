-- Create tables for admin dashboard functionality

-- 1. GitHub Tokens Management Table
CREATE TABLE IF NOT EXISTS github_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_name TEXT NOT NULL UNIQUE,
  token_value TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  rate_limit_remaining INTEGER,
  rate_limit_reset_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  total_requests INTEGER DEFAULT 0,
  successful_requests INTEGER DEFAULT 0,
  failed_requests INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick active token lookups
CREATE INDEX IF NOT EXISTS idx_github_tokens_active ON github_tokens(is_active, rate_limit_reset_at);

-- 2. Scraper/Validator Logs Table
CREATE TABLE IF NOT EXISTS api_key_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type TEXT NOT NULL CHECK (log_type IN ('scraper', 'validator')),
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error', 'success')),
  message TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  api_key TEXT, -- Optional: specific key related to this log
  github_token_id UUID REFERENCES github_tokens(id),
  execution_id UUID, -- Group logs by execution run
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for log queries
CREATE INDEX IF NOT EXISTS idx_api_key_logs_type ON api_key_logs(log_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_logs_level ON api_key_logs(level, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_logs_execution ON api_key_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_api_key_logs_created_at ON api_key_logs(created_at DESC);

-- 3. System Status Table (for tracking scraper/validator runs)
CREATE TABLE IF NOT EXISTS system_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL CHECK (service_name IN ('scraper', 'validator')),
  status TEXT NOT NULL CHECK (status IN ('idle', 'running', 'completed', 'failed')),
  execution_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  stats JSONB DEFAULT '{}'::jsonb, -- Store execution stats
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for status queries
CREATE INDEX IF NOT EXISTS idx_system_status_service ON system_status(service_name, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_status_execution ON system_status(execution_id);

-- 4. Create view for latest system status
CREATE OR REPLACE VIEW latest_system_status AS
SELECT DISTINCT ON (service_name)
  id,
  service_name,
  status,
  execution_id,
  started_at,
  completed_at,
  duration_ms,
  stats,
  error_message
FROM system_status
ORDER BY service_name, created_at DESC;

-- 5. Create function to update github token stats
CREATE OR REPLACE FUNCTION update_github_token_stats(
  p_token_id UUID,
  p_success BOOLEAN,
  p_rate_limit_remaining INTEGER DEFAULT NULL,
  p_rate_limit_reset_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  UPDATE github_tokens
  SET
    last_used_at = NOW(),
    total_requests = total_requests + 1,
    successful_requests = CASE WHEN p_success THEN successful_requests + 1 ELSE successful_requests END,
    failed_requests = CASE WHEN NOT p_success THEN failed_requests + 1 ELSE failed_requests END,
    rate_limit_remaining = COALESCE(p_rate_limit_remaining, rate_limit_remaining),
    rate_limit_reset_at = COALESCE(p_rate_limit_reset_at, rate_limit_reset_at),
    updated_at = NOW()
  WHERE id = p_token_id;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to log scraper/validator events
CREATE OR REPLACE FUNCTION log_api_key_event(
  p_log_type TEXT,
  p_level TEXT,
  p_message TEXT,
  p_details JSONB DEFAULT '{}'::jsonb,
  p_api_key TEXT DEFAULT NULL,
  p_github_token_id UUID DEFAULT NULL,
  p_execution_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO api_key_logs (
    log_type,
    level,
    message,
    details,
    api_key,
    github_token_id,
    execution_id
  )
  VALUES (
    p_log_type,
    p_level,
    p_message,
    p_details,
    p_api_key,
    p_github_token_id,
    p_execution_id
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- 7. Create function to update system status
CREATE OR REPLACE FUNCTION update_system_status(
  p_service_name TEXT,
  p_status TEXT,
  p_execution_id UUID,
  p_stats JSONB DEFAULT '{}'::jsonb,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_status_id UUID;
  v_started_at TIMESTAMPTZ;
  v_duration_ms INTEGER;
BEGIN
  -- Get the start time if completing
  IF p_status IN ('completed', 'failed') THEN
    SELECT started_at INTO v_started_at
    FROM system_status
    WHERE execution_id = p_execution_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_started_at IS NOT NULL THEN
      v_duration_ms := EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000;
    END IF;
  END IF;

  INSERT INTO system_status (
    service_name,
    status,
    execution_id,
    started_at,
    completed_at,
    duration_ms,
    stats,
    error_message
  )
  VALUES (
    p_service_name,
    p_status,
    p_execution_id,
    CASE WHEN p_status = 'running' THEN NOW() ELSE v_started_at END,
    CASE WHEN p_status IN ('completed', 'failed') THEN NOW() ELSE NULL END,
    v_duration_ms,
    p_stats,
    p_error_message
  )
  RETURNING id INTO v_status_id;

  RETURN v_status_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Auto-update timestamp trigger for github_tokens
CREATE OR REPLACE FUNCTION update_github_tokens_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER github_tokens_updated_at
  BEFORE UPDATE ON github_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_github_tokens_timestamp();

-- 9. Grant necessary permissions
-- GRANT ALL ON github_tokens TO service_role;
-- GRANT ALL ON api_key_logs TO service_role;
-- GRANT ALL ON system_status TO service_role;
-- GRANT SELECT ON latest_system_status TO service_role;

-- Add comments
COMMENT ON TABLE github_tokens IS 'Manages multiple GitHub API tokens for scraping with rate limit tracking';
COMMENT ON TABLE api_key_logs IS 'Logs all scraper and validator operations for admin monitoring';
COMMENT ON TABLE system_status IS 'Tracks execution status of scraper and validator services';
COMMENT ON VIEW latest_system_status IS 'Shows the most recent status for each service';
