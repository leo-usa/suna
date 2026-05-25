"""Encrypt/decrypt per-user WeChat iLink bot tokens at rest."""

from __future__ import annotations

import os

from cryptography.fernet import Fernet, InvalidToken

from core.utils.config import config
from core.utils.logger import logger

_FALLBACK_ENV = "MCP_CREDENTIAL_ENCRYPTION_KEY"


def _get_key_bytes() -> bytes:
    raw = (config.WECHAT_ILINK_TOKEN_ENCRYPTION_KEY or os.getenv(_FALLBACK_ENV) or "").strip()
    if raw:
        return raw.encode("utf-8")
    logger.warning(
        "No WECHAT_ILINK_TOKEN_ENCRYPTION_KEY or %s — generating ephemeral key; tokens will not survive restarts",
        _FALLBACK_ENV,
    )
    return Fernet.generate_key()


def encrypt_bot_token(token: str) -> str:
    cipher = Fernet(_get_key_bytes())
    return cipher.encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_bot_token(encrypted: str) -> str:
    cipher = Fernet(_get_key_bytes())
    try:
        return cipher.decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("WeChat iLink token decryption failed (encryption key mismatch?)") from e
