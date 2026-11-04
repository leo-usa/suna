"""Cost controls for local computer-use loops.

Computer sessions accumulate huge AX trees / screenshots. Running them on
premium models (e.g. GPT-6.1 Sol) balloons spend. These helpers:

1. Detect computer tools and expensive models
2. Pick a cheap vision model for computer-use loops
3. Cap AX payloads
4. Compress prior computer tool results in thread history
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

COMPUTER_MODEL_ID = "dobby/gpt-6-luna"
# Downgrade when selected model input price exceeds this ($/M tokens).
COMPUTER_EXPENSIVE_INPUT_USD_PER_M = 0.5
AX_MAX_ELEMENTS = 40
AX_MAX_TREE_CHARS = 4000
COMPUTER_TOOL_HISTORY_KEEP = 1
COMPUTER_HISTORY_PLACEHOLDER = (
    "[Prior computer observation omitted to save tokens. "
    "Prefer computer_ui_snapshot for named controls (search, checkboxes, Send To); "
    "use computer_screenshot only for video/message cards or unlabeled visuals. "
    "Actions so far / targets remain the progress memory — continue from there.]"
)
PREMIUM_CONTEXT_WARN_TOKENS = 100_000


def is_computer_tool_name(name: Optional[str]) -> bool:
    return bool(name) and str(name).startswith("computer_")


def compress_ax_payload(elements: Optional[List[Any]], tree: Optional[str]) -> Dict[str, Any]:
    elems = list(elements or [])
    truncated_elements = len(elems) > AX_MAX_ELEMENTS
    elems = elems[:AX_MAX_ELEMENTS]
    text = str(tree or "")
    truncated_tree = len(text) > AX_MAX_TREE_CHARS
    if truncated_tree:
        text = text[: AX_MAX_TREE_CHARS - 1] + "…"
    return {
        "elements": elems,
        "tree": text,
        "truncated": truncated_elements or truncated_tree,
        "ref_count": len(elems),
    }


def resolve_computer_model_id() -> str:
    return COMPUTER_MODEL_ID


def is_expensive_for_computer(model_id: Optional[str]) -> bool:
    if not model_id:
        return False
    from core.ai_models import model_manager

    resolved = model_manager.resolve_model_id(model_id) or model_id
    if resolved == COMPUTER_MODEL_ID or model_id == COMPUTER_MODEL_ID:
        return False
    # Already on the dedicated cheap vision path (or an alias).
    if "gpt-6-luna" in str(resolved) or "gpt-6-luna" in str(model_id):
        return False

    pricing = model_manager.get_pricing(resolved) or model_manager.get_pricing(model_id)
    if not pricing:
        # Unknown premium-looking ids (sol/astra/opus/power/terra).
        lowered = f"{resolved} {model_id}".lower()
        return any(tag in lowered for tag in ("sol", "astra", "opus", "power", "terra", "sonnet", "gpt-5.4", "gpt-6.1"))

    return float(pricing.input_cost_per_million_tokens) >= COMPUTER_EXPENSIVE_INPUT_USD_PER_M


def maybe_computer_model(model_id: Optional[str]) -> Optional[str]:
    """Return COMPUTER_MODEL_ID when the current model is too expensive for computer use."""
    if not is_expensive_for_computer(model_id):
        return None
    return COMPUTER_MODEL_ID


def registry_has_computer_tools(tool_registry) -> bool:
    if not tool_registry:
        return False
    try:
        funcs = tool_registry.get_available_functions() or {}
    except Exception:
        return False
    return any(is_computer_tool_name(name) for name in funcs)


def state_has_computer_tools(state) -> bool:
    if not state:
        return False
    results = getattr(state, "_tool_results", None) or {}
    for result in results.values():
        if is_computer_tool_name(getattr(result, "tool_name", None)):
            return True
    for msg in getattr(state, "_messages", []) or []:
        name = _tool_name_from_message(msg)
        if is_computer_tool_name(name):
            return True
    return False


def _tool_name_from_message(msg: Dict[str, Any]) -> Optional[str]:
    if not isinstance(msg, dict):
        return None
    if msg.get("type") not in (None, "tool") and msg.get("role") != "tool":
        # LLM-shaped messages from fetcher may already be role/tool
        pass
    content = msg.get("content")
    if isinstance(content, str):
        try:
            import json
            content = json.loads(content)
        except Exception:
            content = None
    if isinstance(content, dict):
        name = content.get("name") or content.get("tool_name")
        if name:
            return str(name)
    metadata = msg.get("metadata")
    if isinstance(metadata, str):
        try:
            import json
            metadata = json.loads(metadata)
        except Exception:
            metadata = None
    if isinstance(metadata, dict):
        name = metadata.get("function_name")
        if name:
            return str(name)
    return None


def should_route_computer_to_cheap_model(
    model_id: Optional[str],
    *,
    tool_registry=None,
    state=None,
    thread_has_computer: bool = False,
) -> bool:
    if not is_expensive_for_computer(model_id):
        return False
    if thread_has_computer:
        return True
    if state_has_computer_tools(state):
        return True
    # Do not force Luna merely because computer tools are registered on desktop —
    # that would downgrade every local coding chat. Only route when computer
    # tools have already been used (this run or prior turns on the thread).
    return False


async def omit_previous_computer_tool_results(
    thread_id: str,
    *,
    keep_latest: int = COMPUTER_TOOL_HISTORY_KEEP,
) -> int:
    """Replace older computer_* tool payloads with a short placeholder.

    Keeps the most recent `keep_latest` computer tool messages intact so the
    model still has a fresh UI/screenshot observation.
    """
    if not thread_id:
        return 0
    from core.cache.runtime_cache import invalidate_message_history_cache
    from core.services.db import execute, execute_mutate

    rows = await execute(
        """
        SELECT message_id
        FROM messages
        WHERE thread_id = :thread_id
          AND type = 'tool'
          AND (
            content->>'name' LIKE 'computer_%'
            OR metadata->>'function_name' LIKE 'computer_%'
          )
          AND (
            metadata->>'computer_history_omitted' IS NULL
            OR metadata->>'computer_history_omitted' != 'true'
          )
        ORDER BY created_at DESC
        """,
        {"thread_id": thread_id},
    )
    if not rows:
        return 0

    keep_ids = {row["message_id"] for row in rows[: max(0, keep_latest)]}
    omit_ids = [row["message_id"] for row in rows if row["message_id"] not in keep_ids]
    if not omit_ids:
        return 0

    placeholders = ", ".join(f":id_{i}" for i in range(len(omit_ids)))
    params: Dict[str, Any] = {
        "thread_id": thread_id,
        "placeholder": COMPUTER_HISTORY_PLACEHOLDER,
    }
    for i, mid in enumerate(omit_ids):
        params[f"id_{i}"] = mid

    await execute_mutate(
        f"""
        UPDATE messages
        SET
          content = jsonb_set(
            CASE WHEN jsonb_typeof(content::jsonb) = 'object' THEN content::jsonb ELSE '{{}}'::jsonb END,
            '{{content}}',
            to_jsonb(CAST(:placeholder AS text)),
            true
          ),
          metadata = COALESCE(metadata, '{{}}'::jsonb)
            || '{{"computer_history_omitted": true}}'::jsonb,
          updated_at = NOW()
        WHERE thread_id = :thread_id
          AND message_id IN ({placeholders})
        """,
        params,
    )
    try:
        await invalidate_message_history_cache(thread_id)
    except Exception:
        pass
    return len(omit_ids)


async def thread_has_computer_tools(thread_id: str) -> bool:
    if not thread_id:
        return False
    from core.services.db import execute_one

    row = await execute_one(
        """
        SELECT 1 AS ok
        FROM messages
        WHERE thread_id = :thread_id
          AND type = 'tool'
          AND (
            content->>'name' LIKE 'computer_%'
            OR metadata->>'function_name' LIKE 'computer_%'
          )
        LIMIT 1
        """,
        {"thread_id": thread_id},
    )
    return bool(row)
