"""Plain-text billing notices for WeChat and Telegram."""

from __future__ import annotations

from typing import Any, Optional


def _blob(value: Any) -> str:
    if isinstance(value, dict):
        parts = [
            value.get("error_code"),
            value.get("error_type"),
            value.get("message"),
            value.get("error"),
        ]
        return " ".join(str(part) for part in parts if part)
    return str(value or "")


def is_out_of_credits(value: Any) -> bool:
    text = _blob(value).lower()
    return (
        "insufficient_credits" in text
        or "insufficient credits" in text
        or "credit_exhausted" in text
    )


def pay_on_web_reply(frontend_url: str) -> str:
    base = (frontend_url or "").strip().rstrip("/") or "https://dobby.now"
    url = f"{base}/dashboard?settings=plan"
    return (
        "余额已经用完，这次请求没有继续。\n"
        "请用浏览器打开 Dobby，登录后充值，然后再回来发消息：\n"
        f"{url}"
    )


def out_of_credits_reply(value: Any, frontend_url: str) -> Optional[str]:
    if not is_out_of_credits(value):
        return None
    return pay_on_web_reply(frontend_url)
