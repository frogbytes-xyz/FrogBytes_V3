-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('issue', 'improvement', 'feature')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'closed')),
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create feedback votes table
CREATE TABLE IF NOT EXISTS feedback_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(feedback_id, user_id)
);

-- Create feedback replies table
CREATE TABLE IF NOT EXISTS feedback_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id UUID REFERENCES feedback(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_feedback_id ON feedback_votes(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_user_id ON feedback_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_feedback_id ON feedback_replies(feedback_id);
CREATE INDEX IF NOT EXISTS idx_feedback_replies_user_id ON feedback_replies(user_id);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_replies ENABLE ROW LEVEL SECURITY;

-- Policies for feedback
CREATE POLICY "Anyone can view feedback" ON feedback
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create feedback" ON feedback
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON feedback
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback" ON feedback
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for feedback_votes
CREATE POLICY "Anyone can view votes" ON feedback_votes
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create votes" ON feedback_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" ON feedback_votes
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" ON feedback_votes
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for feedback_replies
CREATE POLICY "Anyone can view replies" ON feedback_replies
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create replies" ON feedback_replies
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own replies" ON feedback_replies
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own replies" ON feedback_replies
  FOR DELETE USING (auth.uid() = user_id);

-- Function to update vote counts
CREATE OR REPLACE FUNCTION update_feedback_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.vote_type = 'up' THEN
      UPDATE feedback SET upvotes = upvotes + 1 WHERE id = NEW.feedback_id;
    ELSE
      UPDATE feedback SET downvotes = downvotes + 1 WHERE id = NEW.feedback_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.vote_type = 'up' AND NEW.vote_type = 'down' THEN
      UPDATE feedback SET upvotes = upvotes - 1, downvotes = downvotes + 1 WHERE id = NEW.feedback_id;
    ELSIF OLD.vote_type = 'down' AND NEW.vote_type = 'up' THEN
      UPDATE feedback SET upvotes = upvotes + 1, downvotes = downvotes - 1 WHERE id = NEW.feedback_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.vote_type = 'up' THEN
      UPDATE feedback SET upvotes = upvotes - 1 WHERE id = OLD.feedback_id;
    ELSE
      UPDATE feedback SET downvotes = downvotes - 1 WHERE id = OLD.feedback_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger for vote counts
DROP TRIGGER IF EXISTS feedback_votes_trigger ON feedback_votes;
CREATE TRIGGER feedback_votes_trigger
  AFTER INSERT OR UPDATE OR DELETE ON feedback_votes
  FOR EACH ROW EXECUTE FUNCTION update_feedback_votes();

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at on feedback
DROP TRIGGER IF EXISTS update_feedback_updated_at ON feedback;
CREATE TRIGGER update_feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updated_at on feedback_replies
DROP TRIGGER IF EXISTS update_feedback_replies_updated_at ON feedback_replies;
CREATE TRIGGER update_feedback_replies_updated_at
  BEFORE UPDATE ON feedback_replies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
