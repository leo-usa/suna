-- Migration: Add dollar credits field to billing_credits table
-- This migration adds support for dollar-based credits while maintaining backward compatibility

BEGIN;

-- Add dollar balance field to existing billing_credits table
ALTER TABLE basejump.billing_credits 
ADD COLUMN balance_dollars DECIMAL(10,2) DEFAULT 0;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_billing_credits_balance_dollars 
ON basejump.billing_credits(balance_dollars);

-- Add comment for documentation
COMMENT ON COLUMN basejump.billing_credits.balance_dollars IS 
'Dollar balance for pre-paid credits (after service fee deduction). New field for unified billing system.';

COMMIT; 