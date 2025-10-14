-- User Scaling System Migration
-- Implements user tiers, rate limiting, and invitation-based upgrades

-- User tier enum
CREATE TYPE user_tier AS ENUM ('free', 'unlimited');

-- User profiles table (extend existing)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  tier user_tier DEFAULT 'free' NOT NULL,
  tier_expires_at timestamptz,
  invited_by uuid REFERENCES public.user_profiles(id),
  invitation_code text UNIQUE,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Daily usage tracking
CREATE TABLE public.user_daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  usage_date date DEFAULT CURRENT_DATE NOT NULL,
  questions_asked integer DEFAULT 0 NOT NULL,
  quiz_questions_generated integer DEFAULT 0 NOT NULL,
  copilot_interactions integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(user_id, usage_date)
);

-- User invitations tracking
CREATE TABLE public.user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  invitee_email text NOT NULL,
  invitee_id uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  invitation_code text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'accepted', 'expired')),
  sent_at timestamptz DEFAULT now() NOT NULL,
  accepted_at timestamptz,
  expires_at timestamptz DEFAULT (now() + INTERVAL '7 days') NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Tier upgrade history
CREATE TABLE public.user_tier_upgrades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE NOT NULL,
  from_tier user_tier NOT NULL,
  to_tier user_tier NOT NULL,
  upgrade_reason text DEFAULT 'invitation_milestone' NOT NULL,
  successful_invitations integer DEFAULT 0,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Rate limit configurations
CREATE TABLE public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier user_tier NOT NULL,
  questions_per_day integer NOT NULL,
  quiz_questions_per_day integer NOT NULL,
  copilot_interactions_per_day integer NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,

  UNIQUE(tier)
);

-- Indexes
CREATE INDEX idx_user_daily_usage_user_date ON public.user_daily_usage(user_id, usage_date);
CREATE INDEX idx_user_invitations_inviter ON public.user_invitations(inviter_id);
CREATE INDEX idx_user_invitations_code ON public.user_invitations(invitation_code);
CREATE INDEX idx_user_invitations_status ON public.user_invitations(status);
CREATE INDEX idx_user_profiles_tier ON public.user_profiles(tier);
CREATE INDEX idx_user_profiles_invited_by ON public.user_profiles(invited_by);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tier_upgrades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile" ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own usage" ON public.user_daily_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own usage" ON public.user_daily_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own usage" ON public.user_daily_usage FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their sent invitations" ON public.user_invitations FOR SELECT USING (auth.uid() = inviter_id);
CREATE POLICY "Users can create invitations" ON public.user_invitations FOR INSERT WITH CHECK (auth.uid() = inviter_id);
CREATE POLICY "Anyone can view invitations by code" ON public.user_invitations FOR SELECT USING (true);
CREATE POLICY "Users can accept invitations" ON public.user_invitations FOR UPDATE USING (true);

CREATE POLICY "Users can view their own tier history" ON public.user_tier_upgrades FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view rate limits" ON public.rate_limits FOR SELECT USING (true);

-- Insert default rate limits
INSERT INTO public.rate_limits (tier, questions_per_day, quiz_questions_per_day, copilot_interactions_per_day) VALUES
  ('free', 10, 15, 20),
  ('unlimited', 999999, 999999, 999999);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated at triggers
CREATE TRIGGER handle_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_user_daily_usage_updated_at BEFORE UPDATE ON public.user_daily_usage FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER handle_user_invitations_updated_at BEFORE UPDATE ON public.user_invitations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to check invitation milestone and upgrade user
CREATE OR REPLACE FUNCTION public.check_invitation_milestone(user_id_param uuid)
RETURNS void AS $$
DECLARE
  successful_invitations integer;
  current_tier user_tier;
BEGIN
  -- Get current tier
  SELECT tier INTO current_tier FROM public.user_profiles WHERE id = user_id_param;

  -- Count successful invitations
  SELECT COUNT(*) INTO successful_invitations
  FROM public.user_invitations
  WHERE inviter_id = user_id_param AND status = 'accepted' AND invitee_id IS NOT NULL;

  -- Upgrade to unlimited if 3+ successful invitations and not already unlimited
  IF successful_invitations >= 3 AND (current_tier != 'unlimited' OR
      (SELECT tier_expires_at FROM public.user_profiles WHERE id = user_id_param) < now()) THEN

    -- Upgrade user
    UPDATE public.user_profiles
    SET
      tier = 'unlimited',
      tier_expires_at = now() + INTERVAL '30 days',
      updated_at = now()
    WHERE id = user_id_param;

    -- Record upgrade
    INSERT INTO public.user_tier_upgrades (user_id, from_tier, to_tier, successful_invitations, expires_at)
    VALUES (user_id_param, current_tier, 'unlimited', successful_invitations, now() + INTERVAL '30 days');
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to handle invitation acceptance
CREATE OR REPLACE FUNCTION public.handle_invitation_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status != 'accepted' AND NEW.status = 'accepted' AND NEW.invitee_id IS NOT NULL THEN
    NEW.accepted_at = now();
    PERFORM public.check_invitation_milestone(NEW.inviter_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER handle_invitation_acceptance_trigger
  BEFORE UPDATE ON public.user_invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_invitation_acceptance();

-- Function to check if user has reached daily limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  user_id_param uuid,
  usage_type text,
  increment_amount integer DEFAULT 1
)
RETURNS boolean AS $$
DECLARE
  current_tier user_tier;
  daily_limit integer;
  current_usage integer := 0;
  tier_expires timestamptz;
BEGIN
  -- Get user tier and check expiration
  SELECT tier, tier_expires_at INTO current_tier, tier_expires
  FROM public.user_profiles WHERE id = user_id_param;

  -- Check if tier expired, downgrade if needed
  IF tier_expires IS NOT NULL AND tier_expires < now() AND current_tier = 'unlimited' THEN
    UPDATE public.user_profiles
    SET tier = 'free', tier_expires_at = NULL, updated_at = now()
    WHERE id = user_id_param;
    current_tier := 'free';
  END IF;

  -- Get rate limit for current tier
  EXECUTE format('SELECT %I FROM public.rate_limits WHERE tier = $1', usage_type || '_per_day')
  INTO daily_limit USING current_tier;

  -- Get current usage
  EXECUTE format('SELECT COALESCE(%I, 0) FROM public.user_daily_usage WHERE user_id = $1 AND usage_date = CURRENT_DATE', usage_type)
  INTO current_usage USING user_id_param;

  -- Check if increment would exceed limit
  RETURN (current_usage + increment_amount) <= daily_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to increment usage
CREATE OR REPLACE FUNCTION public.increment_usage(
  user_id_param uuid,
  usage_type text,
  increment_amount integer DEFAULT 1
)
RETURNS boolean AS $$
BEGIN
  -- Check rate limit first
  IF NOT public.check_rate_limit(user_id_param, usage_type, increment_amount) THEN
    RETURN false;
  END IF;

  -- Insert or update usage
  INSERT INTO public.user_daily_usage (user_id, usage_date, questions_asked, quiz_questions_generated, copilot_interactions)
  VALUES (
    user_id_param,
    CURRENT_DATE,
    CASE WHEN usage_type = 'questions_asked' THEN increment_amount ELSE 0 END,
    CASE WHEN usage_type = 'quiz_questions_generated' THEN increment_amount ELSE 0 END,
    CASE WHEN usage_type = 'copilot_interactions' THEN increment_amount ELSE 0 END
  )
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    questions_asked = user_daily_usage.questions_asked +
      CASE WHEN usage_type = 'questions_asked' THEN increment_amount ELSE 0 END,
    quiz_questions_generated = user_daily_usage.quiz_questions_generated +
      CASE WHEN usage_type = 'quiz_questions_generated' THEN increment_amount ELSE 0 END,
    copilot_interactions = user_daily_usage.copilot_interactions +
      CASE WHEN usage_type = 'copilot_interactions' THEN increment_amount ELSE 0 END,
    updated_at = now();

  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's current usage and limits
CREATE OR REPLACE FUNCTION public.get_user_usage_status(user_id_param uuid)
RETURNS TABLE(
  current_tier user_tier,
  tier_expires_at timestamptz,
  questions_used integer,
  questions_limit integer,
  quiz_questions_used integer,
  quiz_questions_limit integer,
  copilot_interactions_used integer,
  copilot_interactions_limit integer,
  successful_invitations integer
) AS $$
DECLARE
  user_tier user_tier;
  tier_expires timestamptz;
BEGIN
  -- Get user tier
  SELECT tier, tier_expires_at INTO user_tier, tier_expires
  FROM public.user_profiles WHERE id = user_id_param;

  -- Check if tier expired
  IF tier_expires IS NOT NULL AND tier_expires < now() AND user_tier = 'unlimited' THEN
    UPDATE public.user_profiles
    SET tier = 'free', tier_expires_at = NULL, updated_at = now()
    WHERE id = user_id_param;
    user_tier := 'free';
    tier_expires := NULL;
  END IF;

  RETURN QUERY
  SELECT
    user_tier,
    tier_expires,
    COALESCE(u.questions_asked, 0)::integer,
    r.questions_per_day,
    COALESCE(u.quiz_questions_generated, 0)::integer,
    r.quiz_questions_per_day,
    COALESCE(u.copilot_interactions, 0)::integer,
    r.copilot_interactions_per_day,
    (SELECT COUNT(*)::integer FROM public.user_invitations
     WHERE inviter_id = user_id_param AND status = 'accepted' AND invitee_id IS NOT NULL)
  FROM public.rate_limits r
  LEFT JOIN public.user_daily_usage u ON u.user_id = user_id_param AND u.usage_date = CURRENT_DATE
  WHERE r.tier = user_tier AND r.is_active = true;
END;
$$ LANGUAGE plpgsql;