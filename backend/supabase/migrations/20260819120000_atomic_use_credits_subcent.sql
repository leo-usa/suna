-- Keep sub-cent usage amounts. atomic_use_credits previously took
-- NUMERIC(10, 2), so each LLM step under $0.005 was stored as $0.00.

ALTER TABLE public.credit_accounts
    ALTER COLUMN balance TYPE DECIMAL(12, 4),
    ALTER COLUMN daily_credits_balance TYPE DECIMAL(12, 4),
    ALTER COLUMN expiring_credits TYPE DECIMAL(12, 4),
    ALTER COLUMN non_expiring_credits TYPE DECIMAL(12, 4);

ALTER TABLE public.credit_ledger
    ALTER COLUMN amount TYPE DECIMAL(12, 4),
    ALTER COLUMN balance_after TYPE DECIMAL(12, 4);

CREATE OR REPLACE FUNCTION atomic_use_credits(
    p_account_id UUID,
    p_amount NUMERIC(12, 4),
    p_description TEXT DEFAULT 'Credit usage',
    p_thread_id TEXT DEFAULT NULL,
    p_message_id TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
    v_daily_balance NUMERIC(12, 4);
    v_expiring_balance NUMERIC(12, 4);
    v_non_expiring_balance NUMERIC(12, 4);
    v_total_balance NUMERIC(12, 4);
    v_amount_from_daily NUMERIC(12, 4) := 0;
    v_amount_from_expiring NUMERIC(12, 4) := 0;
    v_amount_from_non_expiring NUMERIC(12, 4) := 0;
    v_remaining NUMERIC(12, 4);
    v_new_daily NUMERIC(12, 4);
    v_new_expiring NUMERIC(12, 4);
    v_new_non_expiring NUMERIC(12, 4);
    v_new_total NUMERIC(12, 4);
    v_transaction_id UUID;
BEGIN
    SELECT
        COALESCE(daily_credits_balance, 0),
        COALESCE(expiring_credits, 0),
        COALESCE(non_expiring_credits, 0),
        COALESCE(balance, 0)
    INTO
        v_daily_balance,
        v_expiring_balance,
        v_non_expiring_balance,
        v_total_balance
    FROM public.credit_accounts
    WHERE account_id = p_account_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'No credit account found',
            'required', p_amount,
            'available', 0
        );
    END IF;

    v_remaining := p_amount;

    IF v_remaining > 0 AND v_daily_balance > 0 THEN
        IF v_daily_balance >= v_remaining THEN
            v_amount_from_daily := v_remaining;
            v_remaining := 0;
        ELSE
            v_amount_from_daily := v_daily_balance;
            v_remaining := v_remaining - v_daily_balance;
        END IF;
    END IF;

    IF v_remaining > 0 AND v_expiring_balance > 0 THEN
        IF v_expiring_balance >= v_remaining THEN
            v_amount_from_expiring := v_remaining;
            v_remaining := 0;
        ELSE
            v_amount_from_expiring := v_expiring_balance;
            v_remaining := v_remaining - v_expiring_balance;
        END IF;
    END IF;

    IF v_remaining > 0 THEN
        v_amount_from_non_expiring := v_remaining;
        v_remaining := 0;
    END IF;

    v_new_daily := v_daily_balance - v_amount_from_daily;
    v_new_expiring := v_expiring_balance - v_amount_from_expiring;
    v_new_non_expiring := v_non_expiring_balance - v_amount_from_non_expiring;
    v_new_total := v_new_daily + v_new_expiring + v_new_non_expiring;

    UPDATE public.credit_accounts
    SET
        daily_credits_balance = v_new_daily,
        expiring_credits = v_new_expiring,
        non_expiring_credits = v_new_non_expiring,
        balance = v_new_total,
        updated_at = NOW()
    WHERE account_id = p_account_id;

    INSERT INTO public.credit_ledger (
        account_id,
        amount,
        balance_after,
        type,
        description,
        metadata
    ) VALUES (
        p_account_id,
        -p_amount,
        v_new_total,
        'usage',
        p_description,
        jsonb_build_object(
            'from_daily', v_amount_from_daily,
            'from_monthly', v_amount_from_expiring,
            'from_extra', v_amount_from_non_expiring,
            'thread_id', p_thread_id,
            'message_id', p_message_id
        )
    )
    RETURNING id INTO v_transaction_id;

    RETURN jsonb_build_object(
        'success', true,
        'amount_deducted', p_amount,
        'new_total', v_new_total,
        'new_daily', v_new_daily,
        'new_expiring', v_new_expiring,
        'new_non_expiring', v_new_non_expiring,
        'from_daily', v_amount_from_daily,
        'from_monthly', v_amount_from_expiring,
        'from_extra', v_amount_from_non_expiring,
        'from_expiring', v_amount_from_expiring,
        'from_non_expiring', v_amount_from_non_expiring,
        'transaction_id', v_transaction_id
    );
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_credit_breakdown(UUID);

CREATE FUNCTION get_credit_breakdown(
    p_account_id UUID
)
RETURNS TABLE(
    total NUMERIC(12, 4),
    daily NUMERIC(12, 4),
    monthly NUMERIC(12, 4),
    extra NUMERIC(12, 4)
)
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(ca.balance, 0)::NUMERIC(12, 4) as total,
        COALESCE(ca.daily_credits_balance, 0)::NUMERIC(12, 4) as daily,
        COALESCE(ca.expiring_credits, 0)::NUMERIC(12, 4) as monthly,
        COALESCE(ca.non_expiring_credits, 0)::NUMERIC(12, 4) as extra
    FROM public.credit_accounts ca
    WHERE ca.account_id = p_account_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_credit_breakdown(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION atomic_use_credits(UUID, NUMERIC, TEXT, TEXT, TEXT) TO authenticated, service_role;
