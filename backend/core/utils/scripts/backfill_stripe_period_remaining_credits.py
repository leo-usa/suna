#!/usr/bin/env python3
"""
Backfill expiring (monthly) credits from legacy chat usage vs Stripe billing period.

For each paid Stripe subscription on credit_accounts:
  entitlement = tier monthly pack for the current Stripe period (yearly → 12 × monthly)
  used       = sum of estimated $ from messages (type=assistant_response_end) in [period_start, min(now, period_end))
  remaining  = max(0, entitlement - used)
  delta      = remaining - current expiring_credits
If delta > small epsilon, grant delta once via atomic_add_credits with a stable stripe_event_id
  stripe_event_id = stripe_period_remaining_v1:{subscription_id}:{period_start}

Default is dry-run (no DB writes). Dry-run prints a TSV table of accounts that would receive a positive
expiring-credit delta: owner email, plan, Stripe billing period start (`current_period_start` UTC),
estimated usage in the window, entitlement, current expiring balance, target expiring, and delta.

Pass --apply to write.

Usage:
  cd backend && PYTHONPATH=. uv run python core/utils/scripts/backfill_stripe_period_remaining_credits.py
  cd backend && PYTHONPATH=. uv run python core/utils/scripts/backfill_stripe_period_remaining_credits.py --apply
  cd backend && PYTHONPATH=. uv run python core/utils/scripts/backfill_stripe_period_remaining_credits.py --tsv-out reports/backfill_dryrun.tsv
  cd backend && PYTHONPATH=. uv run python core/utils/scripts/backfill_stripe_period_remaining_credits.py \\
      --tsv-out reports/backfill_dryrun.tsv --tsv-scan-out reports/backfill_scan.tsv
  cd backend && PYTHONPATH=. uv run python core/utils/scripts/backfill_stripe_period_remaining_credits.py --account-id <uuid> --apply
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, TypedDict

backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))

import stripe
from core.billing import repo as billing_repo
from core.billing.credits.calculator import calculate_token_cost
from core.billing.shared.config import TRIAL_CREDITS, get_tier_by_price_id
from core.services.supabase import DBConnection
from core.utils.config import config
from core.utils.logger import logger

stripe.api_key = config.STRIPE_SECRET_KEY

MESSAGE_BATCH = 500
ACCOUNT_BATCH = 150
USAGE_CHUNK_DAYS = 7
EPSILON = Decimal("0.005")
MIGRATION_STRIPE_EVENT_PREFIX = "stripe_period_remaining_v1"

REPORT_TSV_COLUMNS = [
    "email",
    "account_id",
    "plan_label",
    "billing_period_start_utc",
    "usage_estimated_dollars",
    "entitlement_dollars",
    "expiring_credits_now",
    "target_expiring",
    "delta_dollars",
    "usage_window_end_utc",
    "price_id",
    "stripe_subscription_id",
]

SCAN_TSV_COLUMNS = [
    "email",
    "account_id",
    "tier_name",
    "stripe_interval",
    "price_id",
    "plan_label",
    "billing_period_start_utc",
    "billing_period_end_utc",
    "usage_window_end_utc",
    "stripe_subscription_id",
]


class WouldChangeRow(TypedDict, total=False):
    account_id: str
    email: str
    tier_name: str
    plan_label: str
    price_id: str
    stripe_interval: str
    billing_period_start_utc: str
    billing_period_end_utc: str
    usage_window_end_utc: str
    entitlement_dollars: str
    usage_estimated_dollars: str
    expiring_credits_now: str
    target_expiring: str
    delta_dollars: str
    stripe_subscription_id: str


def _as_dict(value: Any) -> Dict[str, Any]:
    if value is None:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except json.JSONDecodeError:
            return {}
    return {}


def _message_row_cost_dollars(row: Dict[str, Any]) -> Decimal:
    content = _as_dict(row.get("content"))
    metadata = _as_dict(row.get("metadata"))
    usage = content.get("usage") or {}
    prompt_tokens = int(usage.get("prompt_tokens") or 0)
    completion_tokens = int(usage.get("completion_tokens") or 0)
    model = str(content.get("model") or "unknown")
    total = calculate_token_cost(prompt_tokens, completion_tokens, model)
    for item in metadata.get("usage_data") or []:
        if not isinstance(item, dict):
            continue
        if "image_cost" in item:
            total += Decimal(str(item["image_cost"]))
        if "video_cost" in item:
            total += Decimal(str(item["video_cost"]))
        if "speech_cost" in item:
            total += Decimal(str(item["speech_cost"]))
    return total


async def _stripe_subscription_with_retry(subscription_id: str):
    max_attempts = 6
    base = 0.5
    for attempt in range(1, max_attempts + 1):
        try:
            return await stripe.Subscription.retrieve_async(
                subscription_id,
                expand=["items.data.price"],
            )
        except stripe.error.RateLimitError:
            if attempt == max_attempts:
                raise
            delay = min(base * (2 ** (attempt - 1)), 12.0) + random.random() * 0.35
            logger.warning(
                f"Stripe rate limit retrieving {subscription_id}; sleeping {delay:.2f}s "
                f"(attempt {attempt}/{max_attempts})"
            )
            await asyncio.sleep(delay)


def _primary_price_id(subscription: Any) -> Optional[str]:
    try:
        items = None
        if isinstance(subscription, dict):
            items = (subscription.get("items") or {}).get("data")
        elif hasattr(subscription, "items") and subscription.items:
            items = getattr(subscription.items, "data", None)
        if not items:
            return None
        item0 = items[0]
        price = item0.get("price") if isinstance(item0, dict) else getattr(item0, "price", None)
        if price is None:
            return None
        if isinstance(price, str):
            return price
        if isinstance(price, dict):
            return price.get("id")
        return getattr(price, "id", None)
    except Exception:
        return None


def _price_interval_months(subscription: Any, price_obj: Any) -> int:
    """1 for monthly Stripe period; 12 for yearly (full-period entitlement = 12 × monthly pack)."""
    interval = None
    try:
        if isinstance(subscription, dict):
            plan = subscription.get("plan") or {}
            interval = plan.get("interval") if isinstance(plan, dict) else None
        elif getattr(subscription, "plan", None):
            pl = subscription.plan
            interval = getattr(pl, "interval", None)
        if not interval and price_obj:
            if isinstance(price_obj, dict):
                rec = price_obj.get("recurring") or {}
                interval = rec.get("interval")
            else:
                rec = getattr(price_obj, "recurring", None)
                if rec is not None:
                    interval = getattr(rec, "interval", None)
        if interval == "year":
            return 12
    except Exception:
        pass
    return 1


def _stripe_plan_interval_label(subscription: Any, price_obj: Any) -> str:
    """Human-readable billing interval (month / year) from Stripe objects."""
    try:
        if isinstance(subscription, dict):
            pl = subscription.get("plan") or {}
            iv = pl.get("interval") if isinstance(pl, dict) else None
        elif getattr(subscription, "plan", None):
            iv = getattr(subscription.plan, "interval", None)
        else:
            iv = None
        if not iv and price_obj:
            if isinstance(price_obj, dict):
                rec = price_obj.get("recurring") or {}
                iv = rec.get("interval")
            else:
                rec = getattr(price_obj, "recurring", None)
                if rec is not None:
                    iv = getattr(rec, "interval", None)
        return str(iv or "unknown")
    except Exception:
        return "unknown"


def _price_nickname(price_obj: Any) -> str:
    if not price_obj:
        return ""
    if isinstance(price_obj, dict):
        return str(price_obj.get("nickname") or "").strip()
    return str(getattr(price_obj, "nickname", None) or "").strip()


async def _owner_email_for_account(client, account_id: str) -> str:
    try:
        bc = (
            await client.schema("basejump")
            .from_("billing_customers")
            .select("email")
            .eq("account_id", account_id)
            .limit(1)
            .execute()
        )
        if bc.data and bc.data[0].get("email"):
            return str(bc.data[0]["email"]).strip()
        acc = (
            await client.schema("basejump")
            .from_("accounts")
            .select("primary_owner_user_id")
            .eq("id", account_id)
            .limit(1)
            .execute()
        )
        if not acc.data:
            return ""
        uid = acc.data[0].get("primary_owner_user_id")
        if not uid:
            return ""
        r = await client.rpc("get_user_email", {"user_id": str(uid)}).execute()
        if r.data is None:
            return ""
        if isinstance(r.data, str):
            return r.data.strip()
        return str(r.data).strip()
    except Exception as e:
        logger.warning(f"[BACKFILL] email lookup failed account={account_id}: {e}")
        return ""


async def _sum_usage_chunk(
    client,
    account_id: str,
    chunk_start_iso: str,
    chunk_end_iso: str,
) -> Decimal:
    """Sum usage for [chunk_start_iso, chunk_end_iso) with pagination (smaller time windows avoid DB timeouts)."""
    total = Decimal("0")
    offset = 0
    while True:
        res = (
            await client.from_("messages")
            .select("content, metadata, created_at, threads!inner(account_id)")
            .eq("type", "assistant_response_end")
            .eq("threads.account_id", account_id)
            .gte("created_at", chunk_start_iso)
            .lt("created_at", chunk_end_iso)
            .order("created_at", desc=False)
            .range(offset, offset + MESSAGE_BATCH - 1)
            .execute()
        )
        rows: List[Dict[str, Any]] = res.data or []
        if not rows:
            break
        for row in rows:
            total += _message_row_cost_dollars(row)
        if len(rows) < MESSAGE_BATCH:
            break
        offset += MESSAGE_BATCH
    return total


async def _sum_usage_in_window(
    client,
    account_id: str,
    start_iso: str,
    end_iso: str,
) -> Decimal:
    """Aggregate message cost over a possibly long window (yearly) by summing fixed-length time chunks."""
    start_dt = datetime.fromisoformat(start_iso.replace("Z", "+00:00"))
    end_dt = datetime.fromisoformat(end_iso.replace("Z", "+00:00"))
    if end_dt <= start_dt:
        return Decimal("0")
    total = Decimal("0")
    chunk_start = start_dt
    while chunk_start < end_dt:
        chunk_end = min(chunk_start + timedelta(days=USAGE_CHUNK_DAYS), end_dt)
        total += await _sum_usage_chunk(
            client,
            account_id,
            chunk_start.isoformat(),
            chunk_end.isoformat(),
        )
        chunk_start = chunk_end
    return total


def _tsv_cell(value: Any) -> str:
    s = "" if value is None else str(value)
    return s.replace("\t", " ").replace("\r", " ").replace("\n", " ")


def _write_would_change_tsv(path: str, would_change_rows: List[Dict[str, Any]]) -> Path:
    """Write tab-separated UTF-8 (with BOM) for Excel. Header always written."""
    p = Path(path).expanduser().resolve()
    p.parent.mkdir(parents=True, exist_ok=True)
    out_lines = ["\t".join(REPORT_TSV_COLUMNS)]
    for r in would_change_rows:
        out_lines.append("\t".join(_tsv_cell(r.get(c, "")) for c in REPORT_TSV_COLUMNS))
    p.write_text("\n".join(out_lines) + "\n", encoding="utf-8-sig")
    return p


def _write_scan_tsv(path: str, scan_rows: List[Dict[str, Any]]) -> Path:
    """All accounts that reached usage calculation (matched tier, Stripe active); filter `stripe_interval` for year."""
    p = Path(path).expanduser().resolve()
    p.parent.mkdir(parents=True, exist_ok=True)
    out_lines = ["\t".join(SCAN_TSV_COLUMNS)]
    for r in scan_rows:
        out_lines.append("\t".join(_tsv_cell(r.get(c, "")) for c in SCAN_TSV_COLUMNS))
    p.write_text("\n".join(out_lines) + "\n", encoding="utf-8-sig")
    return p


async def process_account(
    client,
    account_id: str,
    stripe_subscription_id: str,
    current_expiring: Decimal,
    apply: bool,
    scan_rows: Optional[List[Dict[str, Any]]] = None,
) -> Tuple[str, Optional[Decimal], Optional[Dict[str, Any]]]:
    """
    Returns (status, delta_granted_or_none, detail_for_report_or_none).
    detail is set only when status == \"dry_run\" (positive delta; would grant on --apply).
    """
    sub_id = (stripe_subscription_id or "").strip()
    if not sub_id:
        return "skipped_no_sub", None, None

    try:
        subscription = await _stripe_subscription_with_retry(sub_id)
    except Exception as e:
        logger.error(f"[BACKFILL] Stripe retrieve failed for {account_id} sub={sub_id}: {e}")
        return "error", None, None

    status = subscription.get("status") if isinstance(subscription, dict) else getattr(subscription, "status", None)
    if status not in ("active", "trialing", "past_due"):
        return "skipped_status", None, None

    price_id = _primary_price_id(subscription)
    if not price_id:
        return "skipped_no_tier", None, None

    price_obj = None
    try:
        if isinstance(subscription, dict):
            items = (subscription.get("items") or {}).get("data") or []
        else:
            items = list(getattr(getattr(subscription, "items", None), "data", None) or [])
        if items:
            item0 = items[0]
            price_obj = item0.get("price") if isinstance(item0, dict) else getattr(item0, "price", None)
    except Exception:
        price_obj = None

    tier = get_tier_by_price_id(price_id)
    if not tier:
        logger.warning(f"[BACKFILL] Unknown price_id={price_id} account={account_id}")
        return "skipped_no_tier", None, None

    if tier.monthly_refill_enabled is False:
        return "skipped_no_refill", None, None

    if status == "trialing":
        entitlement = TRIAL_CREDITS
    else:
        months_pack = _price_interval_months(subscription, price_obj)
        entitlement = Decimal(str(tier.monthly_credits)) * Decimal(months_pack)

    period_start = subscription.get("current_period_start") if isinstance(subscription, dict) else subscription.current_period_start
    period_end = subscription.get("current_period_end") if isinstance(subscription, dict) else subscription.current_period_end
    if not period_start or not period_end:
        return "skipped_status", None, None

    start_dt = datetime.fromtimestamp(int(period_start), tz=timezone.utc)
    end_dt = datetime.fromtimestamp(int(period_end), tz=timezone.utc)
    now = datetime.now(timezone.utc)
    window_end = min(now, end_dt)
    if window_end <= start_dt:
        return "skipped_status", None, None

    start_iso = start_dt.isoformat()
    end_iso = window_end.isoformat()
    stripe_interval = _stripe_plan_interval_label(subscription, price_obj)
    nick = _price_nickname(price_obj)
    if nick:
        plan_label = f"{tier.name} ({stripe_interval}) — {nick}"
    else:
        plan_label = f"{tier.name} ({stripe_interval})"

    if scan_rows is not None:
        scan_rows.append(
            {
                "email": await _owner_email_for_account(client, account_id) or "(no email)",
                "account_id": account_id,
                "tier_name": tier.name,
                "stripe_interval": stripe_interval,
                "price_id": price_id,
                "plan_label": plan_label,
                "billing_period_start_utc": start_dt.isoformat(),
                "billing_period_end_utc": end_dt.isoformat(),
                "usage_window_end_utc": window_end.isoformat(),
                "stripe_subscription_id": sub_id,
            }
        )

    used = await _sum_usage_in_window(client, account_id, start_iso, end_iso)
    remaining = entitlement - used
    if remaining < Decimal("0"):
        remaining = Decimal("0")

    remaining = remaining.quantize(Decimal("0.01"))
    delta = (remaining - current_expiring).quantize(Decimal("0.01"))
    if delta <= EPSILON:
        return "noop_delta", None, None

    stripe_event_id = f"{MIGRATION_STRIPE_EVENT_PREFIX}:{sub_id}:{int(period_start)}"
    description = (
        f"Stripe period remaining backfill (v1): tier={tier.name}, "
        f"period={start_iso}/{end_dt.isoformat()}, used_est=${used}, target_expiring=${remaining}"
    )

    if not apply:
        logger.info(
            f"[BACKFILL][dry-run] account={account_id} tier={tier.name} sub={sub_id} "
            f"entitlement=${entitlement} used_est=${used} expiring_now=${current_expiring} "
            f"target_remaining=${remaining} delta=${delta}"
        )
        detail: Dict[str, Any] = {
            "account_id": account_id,
            "tier_name": tier.name,
            "plan_label": plan_label,
            "price_id": price_id,
            "stripe_interval": stripe_interval,
            "billing_period_start_utc": start_dt.isoformat(),
            "billing_period_end_utc": end_dt.isoformat(),
            "usage_window_end_utc": window_end.isoformat(),
            "entitlement_dollars": str(entitlement.quantize(Decimal("0.01"))),
            "usage_estimated_dollars": str(used.quantize(Decimal("0.01"))),
            "expiring_credits_now": str(current_expiring),
            "target_expiring": str(remaining),
            "delta_dollars": str(delta),
            "stripe_subscription_id": sub_id,
        }
        return "dry_run", delta, detail

    expires_at = end_dt.isoformat()
    result = await billing_repo.atomic_add_credits(
        account_id=account_id,
        amount=float(delta),
        is_expiring=True,
        description=description[:500],
        expires_at=expires_at,
        credit_type="tier_grant",
        stripe_event_id=stripe_event_id,
        idempotency_key=stripe_event_id,
    )
    if not result:
        logger.error(f"[BACKFILL] atomic_add_credits returned empty for {account_id}")
        return "error", None, None
    if result.get("duplicate_prevented"):
        logger.info(f"[BACKFILL] duplicate prevented for {account_id} ({stripe_event_id})")
        return "noop_delta", None, None
    if not result.get("success"):
        logger.error(f"[BACKFILL] atomic_add_credits failed for {account_id}: {result}")
        return "error", None, None
    logger.info(f"[BACKFILL] granted ${delta} to account={account_id} sub={sub_id}")
    return "granted", delta, None


async def run_backfill(
    apply: bool,
    account_id_filter: Optional[str],
    max_accounts: Optional[int],
    tsv_out: Optional[str],
    tsv_scan_out: Optional[str],
) -> None:
    db = DBConnection()
    await db.initialize()
    client = await db.client

    stats: Dict[str, int] = {}
    total_granted_dollars = Decimal("0")
    would_change_rows: List[WouldChangeRow] = []
    scan_rows: Optional[List[Dict[str, Any]]] = [] if tsv_scan_out else None
    processed = 0
    offset = 0

    while True:
        q = (
            client.from_("credit_accounts")
            .select("account_id, tier, stripe_subscription_id, expiring_credits, provider")
            .not_.in_("tier", ["none", "free"])
            .not_.is_("stripe_subscription_id", "null")
        )
        if account_id_filter:
            q = q.eq("account_id", account_id_filter)
        res = await q.range(offset, offset + ACCOUNT_BATCH - 1).execute()
        rows: List[Dict[str, Any]] = res.data or []
        if not rows:
            break

        for row in rows:
            if max_accounts is not None and processed >= max_accounts:
                break
            account_id = str(row["account_id"])
            prov = row.get("provider") or "stripe"
            if prov != "stripe":
                stats["skipped_provider"] = stats.get("skipped_provider", 0) + 1
                continue
            sub_raw = row.get("stripe_subscription_id")
            if not sub_raw or not str(sub_raw).strip():
                stats["skipped_no_sub"] = stats.get("skipped_no_sub", 0) + 1
                continue
            expiring = Decimal(str(row.get("expiring_credits") or 0))

            st, delta, detail = await process_account(
                client,
                account_id,
                str(sub_raw),
                expiring,
                apply,
                scan_rows,
            )
            stats[st] = stats.get(st, 0) + 1
            processed += 1
            if st == "dry_run" and detail and not apply:
                row = dict(detail)
                row["email"] = await _owner_email_for_account(client, account_id) or "(no email)"
                would_change_rows.append(row)  # type: ignore[arg-type]
            if st == "granted" and delta is not None:
                total_granted_dollars += delta
            await asyncio.sleep(0.12)

        if max_accounts is not None and processed >= max_accounts:
            break
        if len(rows) < ACCOUNT_BATCH:
            break
        offset += ACCOUNT_BATCH

    if tsv_out:
        if apply:
            print("\nNote: --tsv-out is ignored with --apply (dry-run report only).\n")
        else:
            written = _write_would_change_tsv(tsv_out, would_change_rows)
            print(f"\nWrote TSV report ({len(would_change_rows)} data rows): {written}\n")

    if tsv_scan_out and scan_rows is not None:
        if apply:
            print("\nNote: --tsv-scan-out is ignored with --apply.\n")
        else:
            sw = _write_scan_tsv(tsv_scan_out, scan_rows)
            print(f"\nWrote scan TSV ({len(scan_rows)} rows, all accounts evaluated for usage): {sw}\n")

    print("\n" + "=" * 60)
    print("STRIPE PERIOD REMAINING CREDITS BACKFILL (v1)")
    print("=" * 60)
    print(f"Mode: {'APPLY (writes enabled)' if apply else 'DRY-RUN (no writes)'}")
    if not apply:
        print("\nAccounts that would receive an expiring-credit top-up (delta > 0):")
        print("(usage = sum of estimated $ from assistant_response_end messages in the period window)\n")
        if not would_change_rows:
            print("  (none)\n")
        else:
            print("\t".join(REPORT_TSV_COLUMNS))
            for r in would_change_rows:
                print("\t".join(_tsv_cell(r.get(c, "")) for c in REPORT_TSV_COLUMNS))
            print()
    for k in sorted(stats.keys()):
        print(f"  {k}: {stats[k]}")
    if total_granted_dollars > 0:
        print(f"  total_granted_dollars: {total_granted_dollars}")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Perform writes (default is dry-run only).",
    )
    parser.add_argument(
        "--account-id",
        type=str,
        default=None,
        help="Process only this account_id (UUID).",
    )
    parser.add_argument(
        "--max-accounts",
        type=int,
        default=None,
        help="Stop after processing this many candidate rows (testing).",
    )
    parser.add_argument(
        "--tsv-out",
        type=str,
        default=None,
        metavar="PATH",
        help="Dry-run only: write the would-change table to this .tsv path (UTF-8 BOM, tab-delimited, opens in Excel).",
    )
    parser.add_argument(
        "--tsv-scan-out",
        type=str,
        default=None,
        metavar="PATH",
        help="Dry-run only: write every account that reached usage aggregation (includes yearly); filter column stripe_interval.",
    )
    args = parser.parse_args()
    asyncio.run(
        run_backfill(
            apply=args.apply,
            account_id_filter=args.account_id,
            max_accounts=args.max_accounts,
            tsv_out=args.tsv_out,
            tsv_scan_out=args.tsv_scan_out,
        )
    )


if __name__ == "__main__":
    main()
