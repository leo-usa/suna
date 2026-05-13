BEGIN;

CREATE TABLE IF NOT EXISTS public.wechat_ilink_pairing_codes (
    code VARCHAR(8) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_wechat_ilink_pairing_account
    ON public.wechat_ilink_pairing_codes (account_id);

CREATE INDEX IF NOT EXISTS idx_wechat_ilink_pairing_expires
    ON public.wechat_ilink_pairing_codes (expires_at);

CREATE TABLE IF NOT EXISTS public.wechat_ilink_links (
    ilink_peer_id TEXT PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES public.threads(thread_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_wechat_ilink_links_account
    ON public.wechat_ilink_links (account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wechat_ilink_pairing_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wechat_ilink_links TO service_role;

COMMIT;
