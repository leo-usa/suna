BEGIN;

INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
    'browser-screenshots',
    'browser-screenshots',
    true,
    ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']::text[],
    10485760
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Browser screenshots are publicly readable" ON storage.objects;
CREATE POLICY "Browser screenshots are publicly readable" ON storage.objects
FOR SELECT USING (bucket_id = 'browser-screenshots');

DROP POLICY IF EXISTS "Service role can write browser screenshots" ON storage.objects;
CREATE POLICY "Service role can write browser screenshots" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'browser-screenshots');

COMMIT;
