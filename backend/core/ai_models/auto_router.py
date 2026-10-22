"""Route a user message to Haiku, Sonnet, or Opus 5.5 with a short Haiku 5.5 call."""

from __future__ import annotations

import asyncio
import json
import re
from typing import Optional

from core.utils.logger import logger

AUTO_MODEL_ID = "dobby/auto"
SIMPLE_MODEL_ID = "dobby/claude-haiku-5.5"
MEDIUM_MODEL_ID = "dobby/claude-sonnet-5.5"
HARD_MODEL_ID = "dobby/claude-opus-5.5"
CLASSIFIER_MODEL_ID = SIMPLE_MODEL_ID

_MAX_PROMPT_CHARS = 2000
_CLASSIFY_TIMEOUT_SEC = 8
_LEVELS = {"simple": SIMPLE_MODEL_ID, "medium": MEDIUM_MODEL_ID, "hard": HARD_MODEL_ID}

_SYSTEM = """You choose how hard a user message is. Reply with JSON only: {"level":"simple"} or {"level":"medium"} or {"level":"hard"}.

simple: a short question, rewrite, translation, summary, lookup, or one-step answer. Not project work.
medium: normal coding, writing, analysis, or routine multi-step work.
hard: architecture, a large code change, hard debugging, research that must be correct, or the user asks for the strongest model.

If the note says files are attached, do not use simple.
If you are unsure, use medium."""


def parse_route_level(raw: str) -> Optional[str]:
    text = (raw or "").strip()
    if not text:
        return None
    fenced = re.search(r"\{[^{}]*\}", text)
    candidate = fenced.group(0) if fenced else text
    try:
        data = json.loads(candidate)
    except json.JSONDecodeError:
        lowered = text.lower()
        for level in ("simple", "medium", "hard"):
            if level in lowered:
                return level
        return None
    level = str((data or {}).get("level") or "").strip().lower()
    return level if level in _LEVELS else None


def _content_to_text(content) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
                continue
            text = block.get("text") if isinstance(block, dict) else getattr(block, "text", None)
            if text:
                parts.append(text)
        return "\n".join(parts)
    return str(content)


def _response_text(response) -> str:
    if isinstance(response, dict):
        choices = response.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        return _content_to_text(message.get("content"))
    choices = getattr(response, "choices", None) or []
    if not choices:
        return ""
    message = getattr(choices[0], "message", None)
    return _content_to_text(getattr(message, "content", None))


def _usage_tokens(response) -> tuple[int, int]:
    usage = response.get("usage") if isinstance(response, dict) else getattr(response, "usage", None)
    if not usage:
        return 0, 0
    if isinstance(usage, dict):
        return int(usage.get("prompt_tokens") or 0), int(usage.get("completion_tokens") or 0)
    return int(getattr(usage, "prompt_tokens", 0) or 0), int(getattr(usage, "completion_tokens", 0) or 0)


async def _tier_name(account_id: str) -> str:
    try:
        from core.billing.subscriptions import subscription_service
        info = await subscription_service.get_user_subscription_tier(account_id)
        return (info or {}).get("name") or "free"
    except Exception as e:
        logger.warning(f"[auto] tier lookup failed, treating as free: {e}")
        return "free"


async def _bill_classifier(account_id: str, response, thread_id: Optional[str]) -> None:
    prompt_tokens, completion_tokens = _usage_tokens(response)
    if prompt_tokens <= 0 and completion_tokens <= 0:
        return
    try:
        from core.billing.credits.integration import BillingIntegration
        await BillingIntegration.deduct_usage(
            account_id=account_id,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            model=CLASSIFIER_MODEL_ID,
            thread_id=thread_id,
        )
    except Exception as e:
        logger.warning(f"[auto] failed to bill classifier: {e}")


async def route_user_message(
    account_id: str,
    prompt: str,
    has_attachments: bool = False,
    thread_id: Optional[str] = None,
) -> str:
    """Return the concrete model id. Sonnet on any failure."""
    text = (prompt or "").strip()[:_MAX_PROMPT_CHARS]
    note = "Files or images are attached." if has_attachments else "No files attached."
    try:
        from core.services.llm import make_llm_api_call

        response = await asyncio.wait_for(
            make_llm_api_call(
                messages=[
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": f"{note}\n\nMessage:\n{text or '(empty)'}"},
                ],
                model_name=CLASSIFIER_MODEL_ID,
                temperature=0,
                max_tokens=256,
                stream=False,
                output_config={"effort": "low"},
            ),
            timeout=_CLASSIFY_TIMEOUT_SEC,
        )
    except Exception as e:
        logger.warning(f"[auto] classifier failed, using Sonnet: {e}")
        return MEDIUM_MODEL_ID

    await _bill_classifier(account_id, response, thread_id)
    level = parse_route_level(_response_text(response))
    if level is None:
        logger.warning("[auto] classifier returned junk, using Sonnet")
        return MEDIUM_MODEL_ID
    if has_attachments and level == "simple":
        level = "medium"

    model_id = _LEVELS[level]
    if level == "hard":
        from core.billing.shared.config import is_model_allowed
        tier = await _tier_name(account_id)
        if not is_model_allowed(tier, HARD_MODEL_ID):
            logger.info(f"[auto] {tier} cannot use Opus, using Sonnet")
            model_id = MEDIUM_MODEL_ID
    logger.info(f"[auto] routed {level} -> {model_id}")
    return model_id
