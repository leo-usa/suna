-- Create billing_credits table for pre-paid credits
CREATE TABLE IF NOT EXISTS basejump.billing_credits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    account_id UUID NOT NULL REFERENCES basejump.accounts(id) ON DELETE CASCADE,
    credits_minutes DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(account_id)
);

-- Add RLS policies
ALTER TABLE basejump.billing_credits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own credits
CREATE POLICY "Users can view own credits" ON basejump.billing_credits
    FOR SELECT USING (auth.uid() = account_id);

-- Policy: Users can update their own credits
CREATE POLICY "Users can update own credits" ON basejump.billing_credits
    FOR UPDATE USING (auth.uid() = account_id);

-- Policy: Users can insert their own credits
CREATE POLICY "Users can insert own credits" ON basejump.billing_credits
    FOR INSERT WITH CHECK (auth.uid() = account_id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_billing_credits_account_id ON basejump.billing_credits(account_id); 