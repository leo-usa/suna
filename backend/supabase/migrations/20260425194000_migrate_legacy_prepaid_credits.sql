DO $$
DECLARE
    v_migration_id CONSTANT TEXT := 'legacy_prepaid_credits_20260425';
    v_dollars_expr TEXT := '0';
    v_minutes_expr TEXT := '0';
    v_migrated_accounts INTEGER := 0;
    v_migrated_amount NUMERIC := 0;
BEGIN
    IF to_regclass('basejump.billing_credits') IS NULL THEN
        RAISE NOTICE 'Skipping %: basejump.billing_credits does not exist', v_migration_id;
        RETURN;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'basejump'
          AND table_name = 'billing_credits'
          AND column_name = 'balance_dollars'
    ) THEN
        v_dollars_expr := 'COALESCE(balance_dollars, 0)';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'basejump'
          AND table_name = 'billing_credits'
          AND column_name = 'balance_minutes'
    ) THEN
        v_minutes_expr := 'COALESCE(balance_minutes, 0)';
    ELSIF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'basejump'
          AND table_name = 'billing_credits'
          AND column_name = 'credits_minutes'
    ) THEN
        v_minutes_expr := 'COALESCE(credits_minutes, 0)';
    END IF;

    EXECUTE format($migration$
        WITH legacy AS (
            SELECT
                account_id,
                (%1$s)::NUMERIC AS legacy_balance_dollars,
                (%2$s)::NUMERIC AS legacy_balance_minutes,
                GREATEST((%1$s)::NUMERIC, ((%2$s)::NUMERIC / 6.0))::NUMERIC(12, 4) AS migration_amount
            FROM basejump.billing_credits
        ),
        to_migrate AS (
            SELECT *
            FROM legacy l
            WHERE l.migration_amount > 0
              AND NOT EXISTS (
                  SELECT 1
                  FROM credit_ledger cl
                  WHERE cl.account_id = l.account_id
                    AND cl.metadata->>'migration_id' = %3$L
              )
        ),
        upserted AS (
            INSERT INTO credit_accounts (
                account_id,
                balance,
                expiring_credits,
                non_expiring_credits,
                tier
            )
            SELECT
                account_id,
                migration_amount,
                0,
                migration_amount,
                'none'
            FROM to_migrate
            ON CONFLICT (account_id) DO UPDATE
            SET
                balance = credit_accounts.balance + EXCLUDED.non_expiring_credits,
                non_expiring_credits = credit_accounts.non_expiring_credits + EXCLUDED.non_expiring_credits,
                updated_at = NOW()
            RETURNING account_id, balance
        ),
        ledger_insert AS (
            INSERT INTO credit_ledger (
                account_id,
                amount,
                balance_after,
                type,
                description,
                is_expiring,
                metadata,
                created_at
            )
            SELECT
                tm.account_id,
                tm.migration_amount,
                u.balance,
                'purchase',
                'Migrated legacy prepaid credits from basejump.billing_credits',
                false,
                jsonb_build_object(
                    'migration_id', %3$L,
                    'source_table', 'basejump.billing_credits',
                    'legacy_balance_dollars', tm.legacy_balance_dollars,
                    'legacy_balance_minutes', tm.legacy_balance_minutes,
                    'conversion_rate', '6 minutes per $1'
                ),
                NOW()
            FROM to_migrate tm
            JOIN upserted u ON u.account_id = tm.account_id
            RETURNING amount
        )
        SELECT COUNT(*), COALESCE(SUM(amount), 0)
        FROM ledger_insert
    $migration$, v_dollars_expr, v_minutes_expr, v_migration_id)
    INTO v_migrated_accounts, v_migrated_amount;

    RAISE NOTICE 'Migrated % legacy prepaid credit accounts totaling $% with migration id %',
        v_migrated_accounts, v_migrated_amount, v_migration_id;
END $$;
