from core.integrations.bridge_billing import is_out_of_credits, out_of_credits_reply


def test_detects_credit_errors():
    assert is_out_of_credits({"error_code": "INSUFFICIENT_CREDITS", "message": "Billing check failed"})
    assert is_out_of_credits("insufficient_credits")
    assert is_out_of_credits("Billing check failed: Insufficient credits. Your balance is 0 credits.")
    assert not is_out_of_credits("sandbox unavailable")


def test_pay_reply_points_at_the_plan_page():
    reply = out_of_credits_reply("insufficient_credits", "https://dobby.now/")
    assert reply is not None
    assert "余额已经用完" in reply
    assert reply.endswith("https://dobby.now/dashboard?settings=plan")
    assert out_of_credits_reply("try again", "https://dobby.now") is None
