BEGIN;

CREATE TABLE IF NOT EXISTS public.feishu_bot_pairing_codes (
    code VARCHAR(8) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_feishu_bot_pairing_account
    ON public.feishu_bot_pairing_codes (account_id);

CREATE INDEX IF NOT EXISTS idx_feishu_bot_pairing_expires
    ON public.feishu_bot_pairing_codes (expires_at);

CREATE TABLE IF NOT EXISTS public.feishu_bot_links (
    feishu_open_id TEXT PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES public.threads(thread_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_feishu_bot_links_account
    ON public.feishu_bot_links (account_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feishu_bot_pairing_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feishu_bot_links TO service_role;

COMMIT;
