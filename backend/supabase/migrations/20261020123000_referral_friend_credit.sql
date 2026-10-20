-- Award the referred account the signup bonus, and keep reading the active code.

DROP FUNCTION IF EXISTS process_referral(UUID, UUID, TEXT, DECIMAL);
DROP FUNCTION IF EXISTS process_referral(UUID, UUID, TEXT, DECIMAL, DECIMAL);

CREATE FUNCTION process_referral(
    p_referrer_id UUID,
    p_referred_account_id UUID,
    p_referral_code TEXT,
    p_credits_amount DECIMAL DEFAULT 1.00,
    p_referred_credits_amount DECIMAL DEFAULT 1.00
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_referral_id UUID;
    v_referrer_balance DECIMAL;
    v_referred_balance DECIMAL;
    v_existing_referral UUID;
    v_friend_amount DECIMAL;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_referred_account_id::text));

    SELECT id INTO v_existing_referral
    FROM referrals
    WHERE referred_account_id = p_referred_account_id;

    IF v_existing_referral IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'User already referred by someone else',
            'referral_id', v_existing_referral
        );
    END IF;

    IF p_referrer_id = p_referred_account_id THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'Cannot refer yourself'
        );
    END IF;

    v_friend_amount := COALESCE(p_referred_credits_amount, p_credits_amount, 0);

    INSERT INTO referrals (
        referrer_id,
        referred_account_id,
        referral_code,
        credits_awarded,
        status,
        completed_at
    )
    VALUES (
        p_referrer_id,
        p_referred_account_id,
        p_referral_code,
        p_credits_amount,
        'completed',
        NOW()
    )
    RETURNING id INTO v_referral_id;

    IF p_credits_amount > 0 THEN
        INSERT INTO credit_accounts (account_id, balance, non_expiring_credits, tier)
        VALUES (p_referrer_id, p_credits_amount, p_credits_amount, 'free')
        ON CONFLICT (account_id)
        DO UPDATE SET
            balance = credit_accounts.balance + p_credits_amount,
            non_expiring_credits = credit_accounts.non_expiring_credits + p_credits_amount,
            updated_at = NOW()
        RETURNING balance INTO v_referrer_balance;

        INSERT INTO credit_ledger (account_id, amount, balance_after, type, description)
        VALUES (
            p_referrer_id,
            p_credits_amount,
            v_referrer_balance,
            'promotional',
            format('Referral bonus for user signup (code: %s)', p_referral_code)
        );
    END IF;

    IF v_friend_amount > 0 THEN
        INSERT INTO credit_accounts (account_id, balance, non_expiring_credits, tier)
        VALUES (p_referred_account_id, v_friend_amount, v_friend_amount, 'free')
        ON CONFLICT (account_id)
        DO UPDATE SET
            balance = credit_accounts.balance + v_friend_amount,
            non_expiring_credits = credit_accounts.non_expiring_credits + v_friend_amount,
            updated_at = NOW()
        RETURNING balance INTO v_referred_balance;

        INSERT INTO credit_ledger (account_id, amount, balance_after, type, description)
        VALUES (
            p_referred_account_id,
            v_friend_amount,
            v_referred_balance,
            'promotional',
            format('Referral signup bonus (code: %s)', p_referral_code)
        );
    END IF;

    INSERT INTO referral_stats (account_id, total_referrals, successful_referrals, total_credits_earned, last_referral_at)
    VALUES (p_referrer_id, 1, 1, GREATEST(p_credits_amount, 0), NOW())
    ON CONFLICT (account_id) DO UPDATE
    SET
        total_referrals = referral_stats.total_referrals + 1,
        successful_referrals = referral_stats.successful_referrals + 1,
        total_credits_earned = referral_stats.total_credits_earned + GREATEST(p_credits_amount, 0),
        last_referral_at = NOW(),
        updated_at = NOW();

    RETURN jsonb_build_object(
        'success', true,
        'referral_id', v_referral_id,
        'credits_awarded', p_credits_amount,
        'referred_credits_awarded', v_friend_amount,
        'new_balance', v_referrer_balance,
        'message', 'Referral processed successfully'
    );
END;
$$;

CREATE OR REPLACE FUNCTION get_referral_stats(
    p_account_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stats JSONB;
    v_code TEXT;
BEGIN
    SELECT code INTO v_code
    FROM referral_codes
    WHERE account_id = p_account_id
      AND expired_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1;

    SELECT jsonb_build_object(
        'referral_code', COALESCE(v_code, ''),
        'total_referrals', COALESCE(rs.total_referrals, 0),
        'successful_referrals', COALESCE(rs.successful_referrals, 0),
        'total_credits_earned', COALESCE(rs.total_credits_earned, 0),
        'last_referral_at', rs.last_referral_at
    ) INTO v_stats
    FROM referral_stats rs
    WHERE rs.account_id = p_account_id;

    IF v_stats IS NULL THEN
        v_stats := jsonb_build_object(
            'referral_code', COALESCE(v_code, ''),
            'total_referrals', 0,
            'successful_referrals', 0,
            'total_credits_earned', 0,
            'last_referral_at', NULL
        );
    END IF;

    RETURN v_stats;
END;
$$;

GRANT EXECUTE ON FUNCTION process_referral(UUID, UUID, TEXT, DECIMAL, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION get_referral_stats(UUID) TO service_role, authenticated;
