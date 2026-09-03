from decimal import Decimal

from core.billing.shared.config import (
    compute_credit_purchase_grant,
    granted_credits_from_purchase,
    serialize_credit_packages,
)


def test_catalog_bonus_ladder_caps_at_20_percent():
    expected = {
        '10.00': ('0.00', '10.00'),
        '25.00': ('5.00', '26.25'),
        '50.00': ('8.00', '54.00'),
        '100.00': ('12.00', '112.00'),
        '250.00': ('16.00', '290.00'),
        '500.00': ('20.00', '600.00'),
    }
    for amount, (percent, total) in expected.items():
        grant = compute_credit_purchase_grant(Decimal(amount))
        assert grant['bonus_percent'] == Decimal(percent)
        assert grant['total'] == Decimal(total)
        assert grant['stripe_price_id']


def test_non_catalog_amount_is_one_to_one():
    grant = compute_credit_purchase_grant(Decimal('19.00'))
    assert grant['bonus_percent'] == Decimal('0.00')
    assert grant['bonus'] == Decimal('0.00')
    assert grant['total'] == Decimal('19.00')
    assert grant['stripe_price_id'] is None


def test_serialize_credit_packages_exposes_display_credits():
    packages = serialize_credit_packages()
    by_amount = {pkg['amount']: pkg for pkg in packages}
    assert by_amount[10.0]['total_credits'] == 10_000
    assert by_amount[10.0]['bonus_percent'] == 0.0
    assert by_amount[500.0]['total_credits'] == 600_000
    assert by_amount[500.0]['bonus_percent'] == 20.0
    assert by_amount[100.0]['popular'] is True


def test_refund_uses_granted_credits_when_present():
    granted = granted_credits_from_purchase({
        'amount_dollars': 100,
        'metadata': {'credits_granted': 112},
    })
    historical = granted_credits_from_purchase({
        'amount_dollars': 100,
        'metadata': {},
    })
    assert granted == Decimal('112.00')
    assert historical == Decimal('100.00')
