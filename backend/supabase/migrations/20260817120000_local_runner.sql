BEGIN;

CREATE TABLE IF NOT EXISTS public.local_runner_devices (
    device_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'This computer',
    platform TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    preview_port INTEGER NOT NULL DEFAULT 18080,
    last_seen_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now())),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()))
);

CREATE INDEX IF NOT EXISTS idx_local_runner_devices_account
    ON public.local_runner_devices (account_id)
    WHERE revoked_at IS NULL;

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS execution_target TEXT NOT NULL DEFAULT 'cloud';

ALTER TABLE public.projects
    DROP CONSTRAINT IF EXISTS projects_execution_target_check;

ALTER TABLE public.projects
    ADD CONSTRAINT projects_execution_target_check
    CHECK (execution_target IN ('cloud', 'local'));

ALTER TABLE public.projects
    ADD COLUMN IF NOT EXISTS local_device_id UUID REFERENCES public.local_runner_devices(device_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_local_device
    ON public.projects (local_device_id)
    WHERE local_device_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.local_runner_devices TO service_role;

COMMIT;
