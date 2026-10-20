"""Tencent iLink bot QR login helpers (server-side, no OpenClaw gateway)."""

from __future__ import annotations

import base64
import os
import re
from typing import Any, Dict, List, Optional

import httpx

from core.services.http_client import get_http_client
from core.utils.logger import logger

ILINK_DEFAULT_BASE = "https://ilinkai.weixin.qq.com"
# Matches @tencent-weixin/openclaw-weixin 2.4.10 (ilink_appid "bot").
CHANNEL_VERSION = "2.4.10"
ILINK_APP_ID = "bot"
ILINK_APP_CLIENT_VERSION = (2 << 16) | (4 << 8) | 10
BOT_AGENT = "Dobby/1.0"
QR_STATUS_TIMEOUT = httpx.Timeout(connect=10.0, read=35.0, write=10.0, pool=10.0)

_HOST_RE = re.compile(r"^[A-Za-z0-9.-]+$")


def redirect_base_url(redirect_host: str) -> Optional[str]:
    host = (redirect_host or "").strip()
    if not host or not _HOST_RE.fullmatch(host):
        return None
    return f"https://{host}"


def _random_uin() -> str:
    n = int.from_bytes(os.urandom(4), "big")
    return base64.b64encode(str(n).encode("utf-8")).decode("ascii")


def _app_headers() -> Dict[str, str]:
    return {
        "iLink-App-Id": ILINK_APP_ID,
        "iLink-App-ClientVersion": str(ILINK_APP_CLIENT_VERSION),
    }


def _post_headers() -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "AuthorizationType": "ilink_bot_token",
        "X-WECHAT-UIN": _random_uin(),
        **_app_headers(),
    }


async def fetch_bot_qrcode(local_tokens: Optional[List[str]] = None) -> Dict[str, Any]:
    tokens = [t.strip() for t in (local_tokens or []) if t and t.strip()][:10]
    async with get_http_client() as client:
        res = await client.post(
            f"{ILINK_DEFAULT_BASE}/ilink/bot/get_bot_qrcode",
            params={"bot_type": 3},
            headers=_post_headers(),
            json={"local_token_list": tokens},
            timeout=20.0,
        )
        res.raise_for_status()
        data = res.json()
        if not isinstance(data, dict) or not data.get("qrcode") or not data.get("qrcode_img_content"):
            raise ValueError("iLink get_bot_qrcode returned no QR")
        return data


async def fetch_qrcode_status(
    qrcode_key: str,
    *,
    base_url: str = ILINK_DEFAULT_BASE,
    verify_code: Optional[str] = None,
) -> Dict[str, Any]:
    params: Dict[str, str] = {"qrcode": qrcode_key}
    code = (verify_code or "").strip()
    if code:
        params["verify_code"] = code
    base = (base_url or ILINK_DEFAULT_BASE).rstrip("/")
    try:
        async with get_http_client() as client:
            res = await client.get(
                f"{base}/ilink/bot/get_qrcode_status",
                params=params,
                headers=_app_headers(),
                timeout=QR_STATUS_TIMEOUT,
            )
            res.raise_for_status()
            data = res.json()
            if not isinstance(data, dict):
                return {"status": "wait"}
            return data
    except Exception as e:
        logger.warning(f"[wechat_ilink] get_qrcode_status wait: {e}")
        return {"status": "wait"}
