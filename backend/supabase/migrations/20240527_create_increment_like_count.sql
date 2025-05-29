-- Migration: Create increment_like_count function for community_posts
CREATE OR REPLACE FUNCTION increment_like_count(post_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE community_posts
  SET like_count = like_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql; 