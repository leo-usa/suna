BEGIN;

UPDATE public.community_posts
SET language = CASE
    WHEN coalesce(title, '') ~ '[⺀-⻳⼀-⿕㐀-䶿一-鿿豈-龎]'
      OR coalesce(description, '') ~ '[⺀-⻳⼀-⿕㐀-䶿一-鿿豈-龎]'
    THEN 'zh'
    ELSE 'en'
END;

COMMIT;
