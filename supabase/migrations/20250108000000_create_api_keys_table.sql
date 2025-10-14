-- Create API Keys table for storing scraped Gemini keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL, -- 'github', 'manual', etc.
  source_url TEXT, -- GitHub repo/gist URL if scraped
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'quota_reached', 'invalid', 'expired')),
  quota_remaining INTEGER, -- If API provides this info
  last_validated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for quick status lookups
CREATE INDEX idx_api_keys_status ON public.api_keys(status);
CREATE INDEX idx_api_keys_last_validated ON public.api_keys(last_validated_at);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only service role can access (admin only)
CREATE POLICY "Service role full access"
ON public.api_keys
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER set_api_keys_updated_at
  BEFORE UPDATE ON public.api_keys
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_api_keys_updated_at();

-- Create view for available keys (valid and not quota-reached)
CREATE OR REPLACE VIEW public.available_api_keys AS
SELECT 
  id,
  api_key,
  source,
  last_used_at,
  success_count,
  error_count
FROM public.api_keys
WHERE status = 'valid'
ORDER BY 
  last_used_at ASC NULLS FIRST, -- Prioritize least recently used
  success_count DESC,            -- Then by success rate
  error_count ASC;               -- Then by lowest errors

-- Grant access to the view
GRANT SELECT ON public.available_api_keys TO service_role;
