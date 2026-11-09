from decimal import Decimal

from core.billing.credits.media_calculator import (
    GPT_IMAGE_FLARE,
    GPT_IMAGE_SUNBURST,
    GPT_IMAGE_VARIANTS,
    calculate_replicate_image_cost,
    cap_quality_for_tier,
    get_variant_cost,
    select_image_quality,
)
from core.billing.shared.config import TOKEN_PRICE_MULTIPLIER as SHARED_MARKUP


def test_flare_and_sunburst_share_token_rates():
    assert get_variant_cost(GPT_IMAGE_FLARE, "medium") == get_variant_cost(GPT_IMAGE_SUNBURST, "medium")
    assert get_variant_cost(GPT_IMAGE_FLARE, "low") == GPT_IMAGE_VARIANTS["low"]
    assert get_variant_cost(GPT_IMAGE_FLARE, "max") == GPT_IMAGE_VARIANTS["max"]


def test_legacy_gpt_image_aliases_use_current_prices():
    assert get_variant_cost("openai/gpt-image-2", "medium") == GPT_IMAGE_VARIANTS["medium"]
    assert get_variant_cost("openai/gpt-image-2.5-flare", "medium") == GPT_IMAGE_VARIANTS["medium"]
    assert GPT_IMAGE_FLARE == "openai/gpt-image-2.6-flare"
    assert GPT_IMAGE_SUNBURST == "openai/gpt-image-2.6-sunburst"


def test_gif_frames_increase_image_cost():
    still = calculate_replicate_image_cost(GPT_IMAGE_FLARE, count=1, variant="medium")
    gif = calculate_replicate_image_cost(GPT_IMAGE_FLARE, count=1, variant="medium", gif_frames=8)
    assert gif == still * 2
    short = calculate_replicate_image_cost(GPT_IMAGE_FLARE, count=1, variant="medium", gif_frames=2)
    assert short == still


def test_replicate_image_cost_applies_markup():
    billed = calculate_replicate_image_cost(GPT_IMAGE_FLARE, count=1, variant="medium")
    assert billed == GPT_IMAGE_VARIANTS["medium"] * SHARED_MARKUP


def test_quality_defaults_and_free_cap():
    assert select_image_quality("free") == "low"
    assert select_image_quality("tier_2_20") == "medium"
    assert cap_quality_for_tier("free", "xhigh") == "medium"
    assert cap_quality_for_tier("free", "max") == "medium"
    assert cap_quality_for_tier("tier_2_20", "high") == "high"
