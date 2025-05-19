# Prepay Credits Feature for AliPay/WeChat Pay

## Background

- Stripe subscriptions (recurring) do **not** support AliPay/WeChat Pay.
- Many Chinese users prefer/preferably require these payment methods.
- We want to add a **prepaid credit** system (pay for minutes/hours) with minimal changes to the current billing/subscription logic.

---

## 1. Database Changes

Add a new table to Supabase:

```sql
create table if not exists basejump.billing_credits (
    id serial primary key,
    account_id uuid references basejump.accounts (id) on delete cascade not null,
    balance_minutes float default 0 not null,
    last_updated timestamp with time zone default timezone('utc' :: text, now()) not null,
    source text, -- e.g. 'stripe', 'alipay', 'wechat_pay'
    transaction_id text -- Stripe payment intent or session id
);

create index if not exists idx_billing_credits_account_id on basejump.billing_credits(account_id);
```

---

## 2. Backend Changes

- **New endpoint:** `/billing/create-credit-session`
  - Accepts: amount (minutes or currency), payment method (AliPay/WeChat/Stripe), success/cancel URLs.
  - For AliPay/WeChat: Use Stripe Checkout with `mode: 'payment'` and the correct payment method.
  - On webhook/payment success: Add purchased minutes to `billing_credits` for the user.
- **Modify usage check logic:**
  - If user has an active subscription: use as now.
  - If not, check `billing_credits.balance_minutes > 0` before allowing agent runs.
  - Deduct minutes from credits as used.

---

## 3. Frontend Changes

- **Billing page:**
  - Add a "Prepay with AliPay/WeChat" section/button.
  - Show current credit balance (if any).
  - Allow user to choose amount to top up (e.g., 1h, 5h, 10h).
  - On success, show updated balance and allow usage as with subscription.
- **Pricing section:**
  - Add "Prepay" as an alternative to subscription for users in China.

---

## 4. Stripe Integration

- **Create a Stripe Checkout session** with `payment_method_types: ['alipay', 'wechat_pay']` and `mode: 'payment'` (not subscription).
- **On webhook:** When payment is successful, update the user's credit balance.

---

## 5. Minimal Change Principle

- No changes to subscription logic for existing Stripe card users.
- No changes to existing usage tracking—just add a fallback to check/deduct from credits if no subscription.
- No changes to user auth/account structure.

---

## 6. Migration/Transition

- Existing users keep their subscriptions.
- New users (or those who want to use AliPay/WeChat) can prepay for credits and use the platform the same way.

---

## 7. Implementation Steps

1. Add `billing_credits` table to Supabase.
2. Add backend endpoints for creating credit payment sessions and handling webhooks.
3. Update usage check logic to fallback to credits.
4. Update frontend billing UI to show and allow prepay/top-up.
5. Test AliPay/WeChat Pay flow end-to-end. 