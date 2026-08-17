BEGIN;

CREATE TABLE IF NOT EXISTS public.community_posts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid,
    user_name text,
    title text,
    description text,
    html_path text,
    thumbnail_path text,
    created_at timestamptz NOT NULL DEFAULT now(),
    like_count integer NOT NULL DEFAULT 0,
    approved boolean NOT NULL DEFAULT true
);

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS artifact_type text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS thread_id uuid;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS language text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS files jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS community_posts_slug_key
    ON public.community_posts (slug)
    WHERE slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS community_posts_approved_lang_created_idx
    ON public.community_posts (approved, language, created_at DESC);

UPDATE public.community_posts
SET language = CASE
    WHEN coalesce(title, '') ~ '[⺀-⻳⼀-⿕㐀-䶿一-鿿豈-龎]'
      OR coalesce(description, '') ~ '[⺀-⻳⼀-⿕㐀-䶿一-鿿豈-龎]'
    THEN 'zh'
    ELSE 'en'
END
WHERE language IS NULL;

UPDATE public.community_posts
SET artifact_type = 'site'
WHERE artifact_type IS NULL AND html_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('share', 'share', true, 52428800)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Share objects are publicly readable" ON storage.objects;
CREATE POLICY "Share objects are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'share');

CREATE OR REPLACE FUNCTION public.increment_like_count(post_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_count integer;
BEGIN
    UPDATE public.community_posts
    SET like_count = coalesce(like_count, 0) + 1
    WHERE id = post_id
    RETURNING like_count INTO new_count;
    RETURN new_count;
END;
$$;

ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Approved community posts are publicly readable" ON public.community_posts;
CREATE POLICY "Approved community posts are publicly readable"
ON public.community_posts FOR SELECT
USING (approved = true);

GRANT SELECT ON public.community_posts TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON public.community_posts TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_like_count(uuid) TO authenticated, service_role;

COMMIT;
