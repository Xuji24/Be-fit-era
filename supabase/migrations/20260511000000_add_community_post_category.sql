-- Add category to community posts for filtering
ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'race-story', 'personal-best', 'training', 'question', 'achievement'));

-- Index for category filter queries
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON community_posts(category);

-- Index for full-text search on content
CREATE INDEX IF NOT EXISTS idx_community_posts_content_search ON community_posts USING gin(to_tsvector('english', content));
