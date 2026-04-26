# Prepaid Credits Alipay WeChat Merge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users buy non-expiring prepaid credits without requiring an active paid subscription, with Stripe Checkout support for card, Alipay, and WeChat Pay.

**Architecture:** Do not port the old branch directly. The old code added prepaid support inside `backend/services/billing.py` and `frontend/src/...`, but this branch already has modular billing under `backend/core/billing`, ledger-backed `credit_accounts`, `credit_purchases`, and non-expiring credits. Merge the old behavior by extending the existing payment service, checkout webhook, account state, and credit purchase UI.

**Tech Stack:** FastAPI, Stripe Checkout, Supabase/Postgres migrations, Next.js, React, TypeScript, existing `billingApi`.

---

## Source Review

Old prepaid billing commits found:
- `78beae1b4` added backend prepaid credit session, old `basejump.billing_credits`, and checkout webhook handling.
- `68169da32` added old frontend API helpers `getCreditBalance` and `createCreditSession`.
- `1d7e948eb`, `1e7df9594`, and `9f2422ad0` added prepaid UI tabs and Alipay/WeChat payment selection.
- `a794e4e1d` fixed WeChat Pay by adding `payment_method_options.wechat_pay.client = "web"`.

Do not merge the old migration `20240612_add_billing_credits.sql`; it conflicts with this branch's current credit architecture. This branch already has `credit_accounts`, `credit_ledger`, `credit_purchases`, non-expiring credits, and `CheckoutHandler._handle_credit_purchase()`.

## Important Current-Branch Facts

Current top-up flow:
- `apps/frontend/src/components/billing/credit-purchase.tsx` opens the Add Credits modal.
- `apps/frontend/src/lib/api/billing.ts` posts to `/billing/purchase-credits`.
- `backend/core/billing/endpoints/payments.py` accepts `PurchaseCreditsRequest`.
- `backend/core/billing/payments/service.py` creates the Stripe checkout session.
- `backend/core/billing/external/stripe/handlers/checkout.py` grants non-expiring credits on `checkout.session.completed`.
- `backend/core/billing/shared/config.py` controls `can_purchase_credits` per tier.

Current blockers for prepaid-without-subscription:
- `PaymentService.create_credit_purchase_checkout()` rejects tiers where `can_purchase_credits` is false.
- The same method requires an existing `billing_customers` row instead of creating a customer for free/no-plan users.
- Checkout only uses `payment_method_types=['card']`.
- The frontend hides Add Credits unless `subscription.can_purchase_credits` is true.
- Model access is still tier-gated separately from balance, so prepaid credits alone do not automatically unlock paid models unless the merge intentionally changes that policy.

## Product Decision Before Coding

Choose one policy and keep it consistent:

1. **Credit wallet only:** Free/no-subscription users can buy credits and run only models/features allowed by their tier. This is the smallest and safest merge.
2. **Prepaid unlock:** Users with positive purchased credits can access paid models/features while credits remain. This requires changes to model access and possibly tier limits.

Recommended first merge: **Credit wallet only**, because it matches the current billing architecture and limits risk. Add the broader prepaid unlock later if desired.

## Task 1: Extend Request/Response Types

**Files:**
- Modify: `backend/core/billing/shared/models.py`
- Modify: `apps/frontend/src/lib/api/billing.ts`

**Step 1: Add backend request fields**

Extend `PurchaseCreditsRequest` with:
- `payment_method: Optional[str] = "card"`
- `locale: Optional[str] = None`

Validate allowed methods: `card`, `alipay`, `wechat_pay`.

**Step 2: Add frontend request fields**

Extend `PurchaseCreditsRequest` with:
- `payment_method?: 'card' | 'alipay' | 'wechat_pay'`
- `locale?: string`

**Step 3: Run type checks**

Run:
- `cd apps/frontend && npm run type-check`
- `cd backend && uv run python -m compileall core/billing`

## Task 2: Allow Prepaid Purchases Without Subscription

**Files:**
- Modify: `backend/core/billing/payments/service.py`
- Modify: `backend/core/billing/endpoints/payments.py`
- Consider: `backend/core/billing/shared/config.py`

**Step 1: Replace tier-only eligibility**

In `PaymentService.create_credit_purchase_checkout()`, do not require `tier.can_purchase_credits` for ordinary prepaid purchases. Instead, validate:
- authenticated account exists,
- amount is positive,
- amount is within configured min/max,
- Stripe is configured,
- requested payment method is allowed.

Keep `can_purchase_credits` if it is still needed for a separate "subscription top-up only" product gate, but do not use it to block prepaid checkout.

**Step 2: Create Stripe customer when missing**

Replace the current "No billing customer found" error with:
- call `CustomerHandler.get_or_create_stripe_customer(account_id)`,
- use the returned Stripe customer id.

This makes free/no-plan users able to purchase credits.

**Step 3: Decide frontend capability flag**

Either set `can_purchase_credits=True` for `none`, `free`, `tier_2_20`, and `tier_6_50` in `backend/core/billing/shared/config.py`, or add a separate account-state field such as `can_prepaid_credits=True`. Prefer a separate field only if you need to preserve old semantics for top-up eligibility.

## Task 3: Add Alipay and WeChat Pay to Stripe Checkout

**Files:**
- Modify: `backend/core/billing/payments/service.py`

**Step 1: Map payment method safely**

Build payment method params:
- `card` -> `payment_method_types=['card']`
- `alipay` -> `payment_method_types=['alipay']`
- `wechat_pay` -> `payment_method_types=['wechat_pay']` plus `payment_method_options={'wechat_pay': {'client': 'web'}}`

This preserves the fix from commit `a794e4e1d`.

**Step 2: Store method in metadata**

Add `payment_method` to:
- checkout session metadata,
- `credit_purchases.metadata`,
- purchase update metadata.

Do not rely on payment method to determine credit amount. Continue using the server-side `amount` metadata and purchase record.

**Step 3: Keep idempotency**

Keep the existing `purchase_id` and idempotency key behavior. Do not add credits directly from the create-session endpoint.

## Task 4: Update Frontend Credit Purchase UI

**Files:**
- Modify: `apps/frontend/src/components/billing/credit-purchase.tsx`
- Modify: `apps/frontend/src/components/settings/user-settings-modal.tsx`
- Modify: `apps/frontend/src/components/billing/pricing/pricing-section.tsx`

**Step 1: Add payment method state**

Add `paymentMethod` state to `CreditPurchaseModal`, defaulting to:
- `alipay` for Chinese locale if reliable locale detection exists,
- otherwise `card`.

**Step 2: Add payment method selector**

Add a compact selector for:
- Card,
- Alipay,
- WeChat Pay.

Keep styling aligned with the current modal; do not bring over old large billing tabs unless explicitly requested.

**Step 3: Send method to API**

Pass `payment_method` and `locale` in `billingApi.purchaseCredits()`.

**Step 4: Remove paid-tier-only copy**

Replace messages like "Credit purchases are only available for users on the $200/month subscription tier" with prepaid copy:
- "Add prepaid credits to continue using Suna. Credits do not expire."

## Task 5: Webhook and Ledger Safety Review

**Files:**
- Review: `backend/core/billing/external/stripe/handlers/checkout.py`
- Review: `backend/core/billing/repo/refunds.py`
- Optional modify: `backend/core/billing/payments/reconciliation.py`

**Step 1: Confirm webhook works for async methods**

Alipay and WeChat Pay can have delayed or async payment confirmation behavior. Verify that `checkout.session.completed` only fires once payment is paid for these methods in the configured Stripe mode, or add a guard:
- require `session.payment_status == "paid"` before granting credits.

**Step 2: Ensure purchase completion works when `payment_intent` is missing**

The current handler already falls back to `purchase_id`. Keep that path.

**Step 3: Ensure duplicate webhook safety**

The current `credit_manager.add_credits()` idempotency key is description/time based, not ideal for Stripe event idempotency. Prefer passing a stable `stripe_event_id` or `purchase_id` into credit addition if available.

## Task 6: Tests

**Files:**
- Add or modify backend tests near existing billing tests.
- Add frontend component/API tests only if the repo already has a nearby test pattern.

**Backend test cases:**
- Free/no-plan account can create credit checkout.
- Paid account can create credit checkout.
- Invalid payment method returns 400.
- `wechat_pay` includes `payment_method_options.wechat_pay.client = "web"`.
- Existing card checkout still works.
- Checkout webhook grants non-expiring credits once.
- Duplicate checkout webhook does not double-credit.

**Frontend test cases:**
- Credit modal renders Card, Alipay, WeChat Pay.
- Selected payment method is sent to `purchaseCredits`.
- Add Credits is visible for free/no-plan users if product policy allows prepaid purchases.

## Task 7: Manual Stripe Testing

Use Stripe test mode first if possible. If recreating all test products is too expensive, use live Stripe only through a controlled staging/canary path, not directly on the main production service.

**Environment:**
- `ENV_MODE=STAGING` or equivalent non-local mode.
- Stripe test secret key.
- Stripe webhook forwarding to backend.
- Stripe account has Alipay and WeChat Pay enabled where Stripe supports them.

**Commands:**
- `stripe listen --forward-to localhost:8000/api/billing/webhook`
- Start backend and frontend normally.

**Manual checks:**
- Free user opens Add Credits.
- Card checkout redirects and returns.
- Alipay checkout redirects and returns.
- WeChat checkout redirects and returns.
- `credit_purchases.status` becomes `completed`.
- `credit_accounts.non_expiring_credits` increases.
- `credit_ledger` has one purchase entry.
- Agent run consumes credits from the new balance.

## Task 8: Production Data Migration

**Files:**
- Create: `backend/supabase/migrations/<timestamp>_migrate_legacy_prepaid_credits.sql`
- Optional create: `backend/core/utils/scripts/audit_legacy_credit_migration.py`

**Current production source schema:**
- `render-upstream-test` stores prepaid credits in `basejump.billing_credits`.
- Existing columns include `account_id`, `balance_minutes`, and `balance_dollars`.
- Old conversion shown by production code: `6 minutes per $1`.

**Current target schema:**
- `credit_accounts.balance`
- `credit_accounts.non_expiring_credits`
- `credit_accounts.expiring_credits`
- `credit_ledger`

**Step 1: Audit before migration**

Run read-only SQL against production before deployment:

```sql
SELECT
  COUNT(*) AS rows,
  COUNT(*) FILTER (WHERE COALESCE(balance_dollars, 0) <> 0) AS rows_with_dollars,
  COUNT(*) FILTER (WHERE COALESCE(balance_minutes, 0) <> 0) AS rows_with_minutes,
  SUM(COALESCE(balance_dollars, 0)) AS total_balance_dollars,
  SUM(COALESCE(balance_minutes, 0)) AS total_balance_minutes
FROM basejump.billing_credits;
```

Also export a CSV backup:

```sql
SELECT account_id, balance_dollars, balance_minutes, created_at, updated_at
FROM basejump.billing_credits
ORDER BY updated_at DESC;
```

**Step 2: Define conversion rule**

For each account:

```sql
legacy_credit_amount =
  GREATEST(COALESCE(balance_dollars, 0), COALESCE(balance_minutes, 0) / 6.0)
```

Use `GREATEST` because production code reports `total_credits_dollars` as the max of dollar credits and minute credits converted at 6 minutes per $1.

**Step 3: Backfill `credit_accounts`**

For every legacy row with a positive converted balance:
- Ensure a `credit_accounts` row exists.
- Add the converted amount to `non_expiring_credits`.
- Add the converted amount to `balance`.
- Do not touch `expiring_credits`.

Make this idempotent. Add a ledger check or migration marker so rerunning the migration does not double-credit accounts.

**Step 4: Write a ledger entry**

Insert one `credit_ledger` row per migrated account:
- `amount = legacy_credit_amount`
- `balance_after = new credit_accounts.balance`
- `type = 'purchase'` or `'adjustment'`
- `description = 'Migrated legacy prepaid credits from basejump.billing_credits'`
- `is_expiring = false`
- `metadata` includes old `balance_dollars`, old `balance_minutes`, and migration id.

**Step 5: Verify after migration**

Run:

```sql
SELECT
  SUM(GREATEST(COALESCE(balance_dollars, 0), COALESCE(balance_minutes, 0) / 6.0)) AS expected_migrated
FROM basejump.billing_credits;
```

Compare with:

```sql
SELECT
  SUM(amount) AS ledger_migrated
FROM credit_ledger
WHERE metadata->>'migration_id' = '<migration_id>';
```

The totals should match within rounding tolerance.

## Task 9: Production-Mode Testing Strategy

**Current setup:** This branch is linked to a staging database cloned from production. Use this database for the migration rehearsal and payment-flow validation before touching the real production database.

**Observed migration state:** `supabase migration list --linked` shows the linked staging database has the legacy prepaid migrations (`20240612`, `20240614`) applied remotely, but many current-branch migrations after early July 2025 are still local-only. Do not run `supabase db push` casually; it will apply the whole backlog, not only `20260425194000_migrate_legacy_prepaid_credits.sql`. That may be correct for a full branch upgrade rehearsal, but it should be treated as a staging schema upgrade step.

**Recommendation:** Use the current branch's staging database for migration testing. For payment testing, live Stripe keys/products are acceptable on a staging Render service as long as the service stays connected to the cloned staging database, not the real production database.

1. **Best/current path:** Current branch + cloned staging database + live Stripe keys/products.
2. **Acceptable:** Render staging service + cloned staging database + one internal test account first, then broader staging users.
3. **Last resort:** Main production service canary, with Add Credits visible only to your admin/internal account until migration, card, Alipay, WeChat Pay, webhook, and ledger updates are verified.

**Why live Stripe may be acceptable here:**
- You already have live product/price IDs on `render-upstream-test`.
- The credit purchase flow can use live Stripe Checkout with very small packages.
- Alipay/WeChat behavior is often most realistic in live mode.

**Production-mode guardrails:**
- For staging rehearsal, confirm the DB is the cloned staging DB before running migrations.
- Confirm whether the rehearsal should apply the full current-branch migration backlog. If yes, run the normal migration flow on the staging clone; if no, apply only the legacy prepaid migration manually after the current billing schema already exists.
- For real production, take a production DB backup first.
- Deploy backend migration before exposing the new UI.
- Keep the old `basejump.billing_credits` table read-only and untouched until the migration is verified.
- Add a feature flag for the prepaid UI if possible.
- Start with one admin account and one small purchase per payment method.
- Confirm webhook idempotency by replaying one Stripe event and checking no double credit is granted.
- Only then enable prepaid checkout for all users.

## Suggested Commit Sequence

1. `feat(billing): allow prepaid credit checkout for all users`
2. `feat(billing): support alipay and wechat pay for credit purchases`
3. `feat(web): add prepaid payment method selector`
4. `test(billing): cover prepaid credit checkout methods`
5. `chore(billing): migrate legacy prepaid credit balances`

## Risks

- Stripe may require payment method activation and country/currency compatibility for Alipay/WeChat Pay.
- WeChat Pay requires `payment_method_options.wechat_pay.client = "web"`.
- If prepaid credits are expected to unlock paid models, model access must be changed separately from billing balance checks.
- Enabling purchases for `none` and `free` users may expose product limits that still depend on tier, such as model access, concurrent runs, custom workers, and triggers.
