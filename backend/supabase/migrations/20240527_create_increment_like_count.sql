-- Migration: Create increment_like_count function for community_posts
CREATE OR REPLACE FUNCTION increment_like_count(post_id uuid)
RETURNS integer AS $$
DECLARE
  new_count integer;
BEGIN
  UPDATE community_posts
  SET like_count = like_count + 1
  WHERE id = post_id
  RETURNING like_count INTO new_count;
  RETURN new_count;
END;
$$ LANGUAGE plpgsql; 