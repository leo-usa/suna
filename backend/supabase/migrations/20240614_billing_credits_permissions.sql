-- Legacy prepaid credits compatibility migration from render-upstream-test.
-- Written defensively because historical environments may have either UUID or
-- SERIAL ids and either credits_minutes or balance_minutes columns.
CREATE TABLE IF NOT EXISTS basejump.billing_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    credits_minutes DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id)
);

ALTER TABLE basejump.billing_credits
ADD COLUMN IF NOT EXISTS balance_minutes NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS transaction_id TEXT,
ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP WITH TIME ZONE DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'billing_credits_account_id_key'
    ) THEN
        ALTER TABLE basejump.billing_credits
        ADD CONSTRAINT billing_credits_account_id_key UNIQUE (account_id);
    END IF;
END $$;

DO $$
BEGIN
    IF to_regclass('basejump.billing_credits_id_seq') IS NOT NULL THEN
        GRANT USAGE, SELECT ON SEQUENCE basejump.billing_credits_id_seq TO service_role;
    END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON basejump.billing_credits TO service_role;
