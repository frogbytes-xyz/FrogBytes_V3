-- Enhanced feedback system to be more like GitHub Issues
-- Run this after the basic feedback tables are created

-- Add labels table for categorizing feedback (like GitHub labels)
CREATE TABLE IF NOT EXISTS feedback_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#6b7280', -- Default gray color
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Junction table for feedback-label relationships (many-to-many)
CREATE TABLE IF NOT EXISTS feedback_label_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
  label_id UUID REFERENCES feedback_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(feedback_id, label_id)
);

-- Add priority column to feedback table
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Add assignee functionality
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add reaction system (like GitHub reactions)
CREATE TABLE IF NOT EXISTS feedback_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('thumbs_up', 'thumbs_down', 'heart', 'hooray', 'confused', 'rocket', 'eyes')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(feedback_id, user_id, reaction_type)
);

-- Add reaction counts to feedback table for performance
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS reaction_counts JSONB DEFAULT '{}';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feedback_labels_name ON feedback_labels(name);
CREATE INDEX IF NOT EXISTS idx_feedback_label_assignments_feedback_id ON feedback_label_assignments(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_label_assignments_label_id ON feedback_label_assignments(label_id);
CREATE INDEX IF NOT EXISTS idx_feedback_priority ON feedback(priority);
CREATE INDEX IF NOT EXISTS idx_feedback_assignee_id ON feedback(assignee_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reactions_feedback_id ON feedback_reactions(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_reactions_user_id ON feedback_reactions(user_id);

-- Enable RLS on new tables
ALTER TABLE feedback_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_label_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_reactions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view labels" ON feedback_labels;
DROP POLICY IF EXISTS "Authenticated users can create labels" ON feedback_labels;
DROP POLICY IF EXISTS "Authenticated users can update labels" ON feedback_labels;
DROP POLICY IF EXISTS "Anyone can view label assignments" ON feedback_label_assignments;
DROP POLICY IF EXISTS "Authenticated users can create label assignments" ON feedback_label_assignments;
DROP POLICY IF EXISTS "Authenticated users can delete label assignments" ON feedback_label_assignments;
DROP POLICY IF EXISTS "Anyone can view reactions" ON feedback_reactions;
DROP POLICY IF EXISTS "Authenticated users can create reactions" ON feedback_reactions;
DROP POLICY IF EXISTS "Users can delete their own reactions" ON feedback_reactions;

-- Policies for labels (anyone can view, authenticated users can create)
CREATE POLICY "Anyone can view labels" ON feedback_labels
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create labels" ON feedback_labels
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update labels" ON feedback_labels
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Policies for label assignments
CREATE POLICY "Anyone can view label assignments" ON feedback_label_assignments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create label assignments" ON feedback_label_assignments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete label assignments" ON feedback_label_assignments
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- Policies for reactions
CREATE POLICY "Anyone can view reactions" ON feedback_reactions
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reactions" ON feedback_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reactions" ON feedback_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- Insert default labels (like GitHub's default labels)
INSERT INTO feedback_labels (name, color, description) VALUES
  ('bug', '#d73a49', 'Something is not working'),
  ('enhancement', '#a2eeef', 'New feature or request'),
  ('documentation', '#0075ca', 'Improvements or additions to documentation'),
  ('good first issue', '#7057ff', 'Good for newcomers'),
  ('help wanted', '#008672', 'Extra attention is needed'),
  ('duplicate', '#cfd3d7', 'This issue or pull request already exists'),
  ('invalid', '#e4e669', 'This does not seem right'),
  ('question', '#d876e3', 'Further information is requested'),
  ('wontfix', '#ffffff', 'This will not be worked on')
ON CONFLICT (name) DO NOTHING;

-- Function to update reaction counts
CREATE OR REPLACE FUNCTION update_feedback_reaction_counts()
RETURNS TRIGGER AS $$
DECLARE
  reaction_counts JSONB;
BEGIN
  -- Get current reaction counts for the feedback
  SELECT COALESCE(
    jsonb_object_agg(reaction_type, count),
    '{}'::jsonb
  ) INTO reaction_counts
  FROM (
    SELECT reaction_type, COUNT(*)::int as count
    FROM feedback_reactions
    WHERE feedback_id = COALESCE(NEW.feedback_id, OLD.feedback_id)
    GROUP BY reaction_type
  ) counts;

  -- Update the feedback table
  UPDATE feedback 
  SET reaction_counts = reaction_counts 
  WHERE id = COALESCE(NEW.feedback_id, OLD.feedback_id);

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for reaction counts
DROP TRIGGER IF EXISTS feedback_reactions_count_trigger ON feedback_reactions;
CREATE TRIGGER feedback_reactions_count_trigger
  AFTER INSERT OR DELETE ON feedback_reactions
  FOR EACH ROW EXECUTE FUNCTION update_feedback_reaction_counts();

-- Grant permissions
GRANT ALL ON feedback_labels TO anon, authenticated;
GRANT ALL ON feedback_label_assignments TO anon, authenticated;
GRANT ALL ON feedback_reactions TO anon, authenticated;