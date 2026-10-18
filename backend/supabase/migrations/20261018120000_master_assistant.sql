BEGIN;

CREATE TABLE IF NOT EXISTS public.master_assistants (
    account_id UUID PRIMARY KEY REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(project_id) ON DELETE CASCADE,
    thread_id UUID NOT NULL UNIQUE REFERENCES public.threads(thread_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE TABLE IF NOT EXISTS public.master_child_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    master_thread_id UUID NOT NULL REFERENCES public.threads(thread_id) ON DELETE CASCADE,
    child_thread_id UUID NOT NULL UNIQUE,
    child_project_id UUID,
    child_agent_run_id UUID,
    title TEXT,
    execution_target TEXT NOT NULL DEFAULT 'cloud',
    model_name TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    summary TEXT,
    finished_at TIMESTAMPTZ,
    reported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_master_child_runs_run
    ON public.master_child_runs (child_agent_run_id);

CREATE INDEX IF NOT EXISTS idx_master_child_runs_master
    ON public.master_child_runs (master_thread_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_master_child_runs_unreported
    ON public.master_child_runs (master_thread_id)
    WHERE finished_at IS NOT NULL AND reported_at IS NULL;

CREATE TABLE IF NOT EXISTS public.qq_bot_pairing_codes (
    code VARCHAR(8) PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_qq_bot_pairing_account
    ON public.qq_bot_pairing_codes (account_id);

CREATE TABLE IF NOT EXISTS public.qq_bot_links (
    user_openid TEXT PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES public.threads(thread_id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_qq_bot_links_account
    ON public.qq_bot_links (account_id);

CREATE TABLE IF NOT EXISTS public.qq_bot_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_openid TEXT NOT NULL REFERENCES public.qq_bot_links(user_openid) ON DELETE CASCADE,
    text TEXT NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    claimed_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_qq_bot_outbox_pending
    ON public.qq_bot_outbox (created_at)
    WHERE sent_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_assistants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.master_child_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qq_bot_pairing_codes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qq_bot_links TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.qq_bot_outbox TO service_role;

ALTER TABLE public.master_assistants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.master_child_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qq_bot_pairing_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qq_bot_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qq_bot_outbox ENABLE ROW LEVEL SECURITY;

COMMIT;
