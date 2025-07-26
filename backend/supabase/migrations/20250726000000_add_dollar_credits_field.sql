-- Migration: Add dollar credits field to billing_credits table
-- This migration adds support for dollar-based credits while maintaining backward compatibility

BEGIN;

-- Add dollar balance field to existing billing_credits table only if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'basejump' 
        AND table_name = 'billing_credits' 
        AND column_name = 'balance_dollars'
    ) THEN
        ALTER TABLE basejump.billing_credits 
        ADD COLUMN balance_dollars DECIMAL(10,2) DEFAULT 0;
    END IF;
END $$;

-- Add index for performance only if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_billing_credits_balance_dollars 
ON basejump.billing_credits(balance_dollars);

-- Add comment for documentation
COMMENT ON COLUMN basejump.billing_credits.balance_dollars IS 
'Dollar balance for pre-paid credits (after service fee deduction). New field for unified billing system.';

COMMIT; 