BEGIN;

ALTER TABLE public.wechat_ilink_connect_sessions
    ADD COLUMN IF NOT EXISTS poll_baseurl TEXT NOT NULL DEFAULT 'https://ilinkai.weixin.qq.com',
    ADD COLUMN IF NOT EXISTS pending_verify_code TEXT;

ALTER TABLE public.wechat_ilink_connect_sessions
    DROP CONSTRAINT IF EXISTS wechat_ilink_connect_sessions_status_check;

ALTER TABLE public.wechat_ilink_connect_sessions
    ADD CONSTRAINT wechat_ilink_connect_sessions_status_check
    CHECK (status IN (
        'pending',
        'scanned',
        'confirmed',
        'expired',
        'cancelled',
        'need_verifycode',
        'verify_blocked'
    ));

COMMIT;
