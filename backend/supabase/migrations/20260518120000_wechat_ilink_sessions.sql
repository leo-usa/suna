BEGIN;

CREATE TABLE IF NOT EXISTS public.wechat_ilink_connect_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    qrcode TEXT NOT NULL,
    qrcode_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'scanned', 'confirmed', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_wechat_ilink_connect_account
    ON public.wechat_ilink_connect_sessions (account_id);

CREATE INDEX IF NOT EXISTS idx_wechat_ilink_connect_expires
    ON public.wechat_ilink_connect_sessions (expires_at);

CREATE TABLE IF NOT EXISTS public.wechat_ilink_sessions (
    account_id UUID PRIMARY KEY REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    encrypted_bot_token TEXT NOT NULL,
    ilink_bot_id TEXT,
    ilink_user_id TEXT,
    baseurl TEXT NOT NULL DEFAULT 'https://ilinkai.weixin.qq.com',
    get_updates_buf TEXT NOT NULL DEFAULT '',
    thread_id UUID REFERENCES public.threads(thread_id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'expired', 'disconnected')),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_wechat_ilink_sessions_status
    ON public.wechat_ilink_sessions (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wechat_ilink_connect_sessions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wechat_ilink_sessions TO service_role;

COMMIT;
