from core.billing.shared.config import (
    can_publish_custom_domain,
    get_publish_sites_limit,
    is_paid_publish_tier,
)


def test_free_publish_limits():
    assert get_publish_sites_limit("free") == 3
    assert can_publish_custom_domain("free") is False
    assert is_paid_publish_tier("free") is False


def test_paid_publish_limits():
    assert get_publish_sites_limit("tier_2_20") == 25
    assert can_publish_custom_domain("tier_2_20") is True
    assert is_paid_publish_tier("tier_2_20") is True
