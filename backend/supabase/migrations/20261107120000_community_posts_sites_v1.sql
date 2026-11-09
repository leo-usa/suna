BEGIN;

ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS branded boolean;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS owner_account_id uuid;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS project_id uuid;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS updated_at timestamptz;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS custom_domain text;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS custom_domain_verified boolean;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS vanity_enabled boolean;

UPDATE public.community_posts
SET status = CASE WHEN coalesce(approved, true) THEN 'published' ELSE 'unpublished' END
WHERE status IS NULL;

UPDATE public.community_posts
SET branded = true
WHERE branded IS NULL;

UPDATE public.community_posts
SET owner_account_id = user_id
WHERE owner_account_id IS NULL AND user_id IS NOT NULL;

UPDATE public.community_posts
SET updated_at = coalesce(created_at, now())
WHERE updated_at IS NULL;

UPDATE public.community_posts
SET custom_domain_verified = false
WHERE custom_domain_verified IS NULL;

UPDATE public.community_posts
SET vanity_enabled = false
WHERE vanity_enabled IS NULL;

ALTER TABLE public.community_posts ALTER COLUMN status SET DEFAULT 'published';
ALTER TABLE public.community_posts ALTER COLUMN branded SET DEFAULT true;
ALTER TABLE public.community_posts ALTER COLUMN custom_domain_verified SET DEFAULT false;
ALTER TABLE public.community_posts ALTER COLUMN vanity_enabled SET DEFAULT false;

CREATE INDEX IF NOT EXISTS community_posts_owner_status_idx
    ON public.community_posts (owner_account_id, status, updated_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS community_posts_custom_domain_key
    ON public.community_posts (lower(custom_domain))
    WHERE custom_domain IS NOT NULL AND custom_domain_verified = true;

COMMIT;
