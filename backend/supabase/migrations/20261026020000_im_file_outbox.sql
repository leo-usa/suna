BEGIN;

ALTER TABLE public.wechat_ilink_sessions
    ADD COLUMN IF NOT EXISTS reply_peer_id TEXT,
    ADD COLUMN IF NOT EXISTS reply_context_token TEXT;

CREATE TABLE IF NOT EXISTS public.im_file_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    channel TEXT NOT NULL CHECK (channel IN ('wechat_ilink', 'telegram')),
    recipient TEXT NOT NULL,
    thread_id UUID NOT NULL,
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    size BIGINT NOT NULL DEFAULT 0,
    caption TEXT,
    attempts INT NOT NULL DEFAULT 0,
    claimed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_im_file_outbox_pending
    ON public.im_file_outbox (channel, created_at)
    WHERE sent_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_im_file_outbox_pending_file
    ON public.im_file_outbox (channel, recipient, thread_id, path)
    WHERE sent_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.im_file_outbox TO service_role;

ALTER TABLE public.im_file_outbox ENABLE ROW LEVEL SECURITY;

COMMIT;
