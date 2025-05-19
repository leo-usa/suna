-- Add billing_credits table for prepay AliPay/WeChat Pay support
create table if not exists basejump.billing_credits (
    id serial primary key,
    account_id uuid references basejump.accounts (id) on delete cascade not null,
    balance_minutes float default 0 not null,
    last_updated timestamp with time zone default timezone('utc' :: text, now()) not null,
    source text, -- e.g. 'stripe', 'alipay', 'wechat_pay'
    transaction_id text -- Stripe payment intent or session id
);

create index if not exists idx_billing_credits_account_id on basejump.billing_credits(account_id); 