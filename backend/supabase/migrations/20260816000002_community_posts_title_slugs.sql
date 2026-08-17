BEGIN;

WITH prepared AS (
    SELECT
        id,
        created_at,
        NULLIF(
            TRIM(BOTH '-' FROM regexp_replace(
                regexp_replace(lower(coalesce(title, '')), '[^a-z0-9一-鿿]+', '-', 'g'),
                '-{2,}', '-', 'g'
            )),
            ''
        ) AS base_slug
    FROM public.community_posts
),
numbered AS (
    SELECT
        id,
        COALESCE(left(base_slug, 80), 'work') AS base_slug,
        ROW_NUMBER() OVER (
            PARTITION BY COALESCE(left(base_slug, 80), 'work')
            ORDER BY created_at, id
        ) AS rn
    FROM prepared
)
UPDATE public.community_posts AS p
SET slug = CASE
    WHEN n.rn = 1 THEN n.base_slug
    ELSE n.base_slug || '-' || n.rn::text
END
FROM numbered n
WHERE p.id = n.id;

COMMIT;
