-- Migration: Create community_posts table for Community feature
CREATE TABLE IF NOT EXISTS community_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    user_name text NOT NULL,
    title text NOT NULL,
    html_path text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    like_count integer NOT NULL DEFAULT 0,
    description text,
    thumbnail_path text,
    approved boolean NOT NULL DEFAULT TRUE
);

-- Index for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON community_posts (created_at DESC);
-- Index for sorting by like count
CREATE INDEX IF NOT EXISTS idx_community_posts_like_count ON community_posts (like_count DESC); 