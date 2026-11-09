"""Publish site quotas and branding eligibility from subscription tier."""

from __future__ import annotations

from typing import Any

from core.billing.shared.config import (
    can_publish_custom_domain,
    get_publish_sites_limit,
    is_paid_publish_tier,
)
from core.billing.subscriptions.handlers.tier import TierHandler


async def resolve_publish_entitlements(account_id: str) -> dict[str, Any]:
    tier_info = await TierHandler.get_user_subscription_tier(account_id)
    tier_name = str(tier_info.get("name") or "none")
    return {
        "tier_name": tier_name,
        "sites_limit": int(tier_info.get("publish_sites_limit") or get_publish_sites_limit(tier_name)),
        "custom_domain": bool(tier_info.get("publish_custom_domain") if "publish_custom_domain" in tier_info else can_publish_custom_domain(tier_name)),
        "branded": not is_paid_publish_tier(tier_name) and not bool(tier_info.get("publish_custom_domain")),
        "display_name": tier_info.get("display_name"),
    }


async def count_active_sites(client, account_id: str) -> int:
    """Count Sites published via project publish (project_id set).

    Legacy Works posts (share-to-community without a project) must not
    consume the Sites quota — otherwise accounts with old Works are
    immediately over the plan limit.
    """
    result = (
        await client.table("community_posts")
        .select("id", count="exact")
        .eq("owner_account_id", account_id)
        .eq("status", "published")
        .not_.is_("project_id", "null")
        .execute()
    )
    if getattr(result, "count", None) is not None:
        return int(result.count)
    # Fallback if count unsupported
    rows = (
        await client.table("community_posts")
        .select("id")
        .eq("owner_account_id", account_id)
        .eq("status", "published")
        .not_.is_("project_id", "null")
        .execute()
    )
    return len(rows.data or [])
