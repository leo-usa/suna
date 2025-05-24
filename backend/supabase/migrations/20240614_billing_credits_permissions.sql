-- Migration: Ensure billing_credits table, unique constraint, and permissions for prepaid credits

-- 1. Create the billing_credits table if it does not exist
CREATE TABLE IF NOT EXISTS basejump.billing_credits (
    id SERIAL PRIMARY KEY,
    account_id UUID NOT NULL,
    balance_minutes NUMERIC DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
    source TEXT,
    transaction_id TEXT
);

-- 2. Add a unique constraint on account_id (one row per user)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'billing_credits_account_id_key'
    ) THEN
        ALTER TABLE basejump.billing_credits
        ADD CONSTRAINT billing_credits_account_id_key UNIQUE (account_id);
    END IF;
END$$;

-- 3. Grant usage and select on the sequence to the service role
GRANT USAGE, SELECT ON SEQUENCE basejump.billing_credits_id_seq TO service_role;

-- 4. Grant permissions on the table itself
GRANT SELECT, INSERT, UPDATE, DELETE ON basejump.billing_credits TO service_role; 