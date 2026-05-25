"""Tencent iLink bot QR login helpers (server-side, no OpenClaw gateway)."""

from __future__ import annotations

from typing import Any, Dict

from core.services.http_client import get_http_client

ILINK_DEFAULT_BASE = "https://ilinkai.weixin.qq.com"


async def fetch_bot_qrcode() -> Dict[str, Any]:
    async with get_http_client() as client:
        res = await client.get(
            f"{ILINK_DEFAULT_BASE}/ilink/bot/get_bot_qrcode",
            params={"bot_type": 3},
            timeout=20.0,
        )
        res.raise_for_status()
        data = res.json()
        if not data.get("qrcode") or not data.get("qrcode_img_content"):
            raise ValueError(f"iLink get_bot_qrcode failed: {data!r}")
        return data


async def fetch_qrcode_status(qrcode_key: str) -> Dict[str, Any]:
    async with get_http_client() as client:
        res = await client.get(
            f"{ILINK_DEFAULT_BASE}/ilink/bot/get_qrcode_status",
            params={"qrcode": qrcode_key},
            timeout=20.0,
        )
        res.raise_for_status()
        return res.json()
