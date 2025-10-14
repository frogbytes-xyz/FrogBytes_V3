-- Add sharing functionality columns to summaries table
-- Enables public sharing of summaries with unique slugs

-- Add is_public column for sharing control
ALTER TABLE public.summaries
ADD COLUMN is_public BOOLEAN DEFAULT false NOT NULL;

-- Add share_slug column for public URLs (e.g., /share/abc123)
ALTER TABLE public.summaries
ADD COLUMN share_slug TEXT UNIQUE;

-- Add view_count column for tracking popularity
ALTER TABLE public.summaries
ADD COLUMN view_count BIGINT DEFAULT 0 NOT NULL;

-- Add shared_at timestamp for when summary was made public
ALTER TABLE public.summaries
ADD COLUMN shared_at TIMESTAMPTZ;

-- Create index on is_public for filtering public summaries
CREATE INDEX summaries_is_public_idx ON public.summaries(is_public) WHERE is_public = true;

-- Create index on share_slug for fast lookups
CREATE INDEX summaries_share_slug_idx ON public.summaries(share_slug) WHERE share_slug IS NOT NULL;

-- Create index on view_count for sorting by popularity
CREATE INDEX summaries_view_count_idx ON public.summaries(view_count DESC) WHERE is_public = true;

-- Create function to generate unique share slug
CREATE OR REPLACE FUNCTION public.generate_share_slug()
RETURNS TEXT AS $$
DECLARE
  slug TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character random slug
    slug := lower(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    
    -- Check if slug already exists
    SELECT EXISTS(SELECT 1 FROM public.summaries WHERE share_slug = slug) INTO exists;
    
    EXIT WHEN NOT exists;
  END LOOP;
  
  RETURN slug;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate share_slug when is_public set to true
CREATE OR REPLACE FUNCTION public.handle_summary_sharing()
RETURNS TRIGGER AS $$
BEGIN
  -- If being made public and no slug exists, generate one
  IF NEW.is_public = true AND NEW.share_slug IS NULL THEN
    NEW.share_slug := public.generate_share_slug();
    NEW.shared_at := now();
  END IF;
  
  -- If being made private, keep slug but update shared_at
  IF NEW.is_public = false AND OLD.is_public = true THEN
    NEW.shared_at := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_summary_sharing_trigger
  BEFORE UPDATE ON public.summaries
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_summary_sharing();

-- Update RLS policies to allow public access to shared summaries

-- Policy: Anyone can view public summaries
CREATE POLICY "Anyone can view public summaries"
  ON public.summaries
  FOR SELECT
  TO anon, authenticated
  USING (is_public = true);

-- Create function to increment view count
CREATE OR REPLACE FUNCTION public.increment_summary_views(summary_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.summaries
  SET view_count = view_count + 1
  WHERE id = summary_id AND is_public = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.increment_summary_views(UUID) TO anon, authenticated;

-- Add comments
COMMENT ON COLUMN public.summaries.is_public IS 'Whether summary is publicly shared';
COMMENT ON COLUMN public.summaries.share_slug IS 'Unique slug for public URL (e.g., /share/abc123)';
COMMENT ON COLUMN public.summaries.view_count IS 'Number of times summary has been viewed';
COMMENT ON COLUMN public.summaries.shared_at IS 'Timestamp when summary was first made public';
COMMENT ON FUNCTION public.generate_share_slug() IS 'Generates unique 8-character slug for sharing';
COMMENT ON FUNCTION public.increment_summary_views(UUID) IS 'Increments view count for public summary';
