"""
Plain-text replies for external IM bridges (Telegram, WeChat iLink).

Assistant rows often store OpenAI-shaped JSON: content may be null while
tool_calls (e.g. `complete`) carry user-visible text and attachment names.
Never use str(dict) for content — that produces Python repr, not JSON.
"""

from __future__ import annotations

import ast
import asyncio
import json
import re
import unicodedata
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Dict, List, Optional

from core.integrations.bridge_tool_labels import tool_completed_label, tool_started_label

# Polling cadence after agent run completes (seconds). Always run the full list
# for each bridge reply: early-exit heuristics were wrong when merged body
# stabilized on tool output before assistant narrative rows were persisted.
BRIDGE_REPLY_POLL_DELAYS: tuple[float, ...] = (
    0.0,
    0.12,
    0.28,
    0.5,
    0.85,
    1.25,
    1.75,
    2.2,
    3.0,
    4.2,
    5.5,
    7.5,
    10.0,
    8.0,
    16.0,
)

# Brief pause after agent_runs reaches a terminal status so WAL / batch flushes
# can land in Postgres before we read messages for the bridge reply.
BRIDGE_POST_RUN_SETTLE_SEC = 2.0


def bridge_progress_tail_looks_inflight(composed: str) -> bool:
    """True when the last non-empty line looks like a tool still running (``→ …``)."""
    c = (composed or "").strip()
    if not c:
        return False
    lines = [ln.strip() for ln in c.splitlines() if ln.strip()]
    if not lines:
        return False
    return lines[-1].startswith("→ ")


def best_bridge_reply_from_snapshots(snapshots: List[tuple[str, str]]) -> str:
    """
    Pick the best composed reply from the poll ladder.

    1) Prefer the **latest** snapshot where both composed text and assistant/tool
       body are non-empty — avoids returning a poll that only has status rows
       before the final assistant rows are committed.
    2) Else prefer the **longest** composed among the last few polls (stability
       if the final read is oddly short).
    3) Else fall back to the last non-empty composed string.
    """
    if not snapshots:
        return ""
    for composed, body in reversed(snapshots):
        c = (composed or "").strip()
        b = (body or "").strip()
        if c and b:
            return c
    tail_n = min(6, len(snapshots))
    tail = snapshots[-tail_n:]
    best = ""
    for composed, _ in tail:
        c = (composed or "").strip()
        if len(c) > len(best):
            best = c
    if best:
        return best
    for composed, _ in reversed(snapshots):
        c = (composed or "").strip()
        if c:
            return c
    return ""


async def latest_bridge_reply_plain_text_via_poll(
    run_started_at: Any,
    user_prompt: str,
    fetch_rows: Callable[[], Awaitable[List[Dict[str, Any]]]],
) -> str:
    """
    Poll thread messages after a terminal run status; ``fetch_rows`` loads
    current messages (same query each time).
    """
    snapshots: List[tuple[str, str]] = []
    for delay in BRIDGE_REPLY_POLL_DELAYS:
        if delay > 0:
            await asyncio.sleep(delay)
        rows = await fetch_rows()
        snapshots.append(
            (
                compose_bridge_turn_plain_text(rows, run_started_at, user_prompt),
                bridge_turn_assistant_body(rows, run_started_at, user_prompt),
            )
        )
    text = best_bridge_reply_from_snapshots(snapshots)
    if bridge_progress_tail_looks_inflight(text):
        await asyncio.sleep(4.0)
        rows = await fetch_rows()
        snapshots.append(
            (
                compose_bridge_turn_plain_text(rows, run_started_at, user_prompt),
                bridge_turn_assistant_body(rows, run_started_at, user_prompt),
            )
        )
        text = best_bridge_reply_from_snapshots(snapshots)
    return text


def _parse_ts(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, datetime):
        if val.tzinfo is None:
            return val.replace(tzinfo=timezone.utc)
        return val
    if isinstance(val, str):
        s = val.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(s)
            if dt.tzinfo is None:
                return dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            return None
    return None


def _normalize_user_prompt_text(s: str) -> str:
    t = (s or "").strip().lower()
    t = unicodedata.normalize("NFC", t)
    # Curly apostrophes / quotes (web UI vs Telegram / paste variants)
    t = t.replace("\u2019", "'").replace("\u2018", "'").replace("\u201c", '"').replace("\u201d", '"')
    t = " ".join(t.split())
    # "word ?" vs "word?" (spacing before punctuation)
    t = re.sub(r"\s+([?.!,;:])", r"\1", t)
    return t


def _message_event_time(msg: Dict[str, Any]) -> Optional[datetime]:
    """Use latest of created_at / updated_at so upserted assistant rows count after completion."""
    c = _parse_ts(msg.get("created_at"))
    u = _parse_ts(msg.get("updated_at"))
    if c and u:
        return max(c, u)
    return c or u


def latest_assistant_text_since_run_started(
    rows: List[Dict[str, Any]],
    run_started_at: Any,
) -> Optional[str]:
    """
    Assistant message with latest event time (created_at / updated_at) among rows
    for this run (messages at/after anchor). Matches the current bridge turn
    even when user text in DB differs slightly from Telegram ``raw``.
    """
    anchor = _parse_ts(run_started_at)
    if anchor is None:
        return None
    best_text: Optional[str] = None
    best_ct: Optional[datetime] = None
    for msg in rows:
        if msg.get("type") != "assistant":
            continue
        ct = _message_event_time(msg)
        if ct is None or ct < anchor:
            continue
        tx = assistant_message_row_to_plain_text(msg)
        if not tx:
            continue
        if best_ct is None or ct > best_ct:
            best_ct = ct
            best_text = tx
    return best_text


def _parse_json_if_str(val: Any) -> Any:
    if val is None:
        return None
    if not isinstance(val, str):
        return val
    s = val.strip()
    if not s:
        return None
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        return None


def _coerce_dict(raw: Any) -> Dict[str, Any]:
    if raw is None:
        return {}
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str):
        s = raw.strip()
        if not s:
            return {}
        parsed = _parse_json_if_str(s)
        if isinstance(parsed, dict):
            return parsed
        try:
            lit = ast.literal_eval(s)
            if isinstance(lit, dict):
                return lit
        except (ValueError, SyntaxError):
            pass
    return {}


def _append_unique(parts: List[str], chunk: str) -> None:
    c = (chunk or "").strip()
    if not c:
        return
    if c not in parts:
        parts.append(c)


def _openai_tool_calls_to_text(tool_calls: Any) -> str:
    if not isinstance(tool_calls, list):
        return ""
    out: List[str] = []
    for tc in tool_calls:
        if not isinstance(tc, dict):
            continue
        fn_block = tc.get("function") if isinstance(tc.get("function"), dict) else {}
        name = (fn_block.get("name") or tc.get("function_name") or "").strip()
        args_raw = fn_block.get("arguments")
        if args_raw is None:
            args_raw = tc.get("arguments")
        args: Any = args_raw
        if isinstance(args, str):
            args = _parse_json_if_str(args)
        if not isinstance(args, dict):
            continue
        name_l = name.lower()
        if name_l == "complete" or name_l.endswith("/complete") or "complete" == name_l.split(".")[-1]:
            text = args.get("text") or args.get("message") or ""
            if isinstance(text, str) and text.strip():
                out.append(text.strip())
            att = args.get("attachments")
            if att is not None:
                if isinstance(att, list):
                    names = ", ".join(str(x) for x in att if x)
                    if names:
                        out.append(f"Files: {names}")
                elif isinstance(att, str) and att.strip():
                    out.append(f"Files: {att.strip()}")
            for key in ("url", "preview_url", "link", "href"):
                u = args.get(key)
                if isinstance(u, str) and u.strip().startswith("http"):
                    out.append(u.strip())
        elif isinstance(args.get("text"), str) and args["text"].strip():
            out.append(args["text"].strip())
    return "\n\n".join(out).strip()


def _unified_metadata_tool_calls_to_text(tool_calls: Any) -> str:
    if not isinstance(tool_calls, list):
        return ""
    out: List[str] = []
    for tc in tool_calls:
        if not isinstance(tc, dict):
            continue
        name = (tc.get("function_name") or tc.get("name") or "").strip()
        args = tc.get("arguments")
        if isinstance(args, str):
            args = _parse_json_if_str(args)
        if not isinstance(args, dict):
            continue
        name_l = name.lower()
        if "complete" in name_l or name_l == "complete":
            text = args.get("text") or args.get("message") or ""
            if isinstance(text, str) and text.strip():
                out.append(text.strip())
            att = args.get("attachments")
            if att is not None:
                if isinstance(att, list):
                    names = ", ".join(str(x) for x in att if x)
                    if names:
                        out.append(f"Files: {names}")
                elif isinstance(att, str) and att.strip():
                    out.append(f"Files: {att.strip()}")
        elif isinstance(args.get("text"), str) and args["text"].strip():
            out.append(args["text"].strip())
    return "\n\n".join(out).strip()


def _content_blocks_to_text(inner: Any) -> str:
    if isinstance(inner, str):
        return inner.strip()
    if not isinstance(inner, list):
        return ""
    parts: List[str] = []
    for block in inner:
        if block is None:
            continue
        if isinstance(block, str):
            if block.strip():
                parts.append(block)
            continue
        if not isinstance(block, dict):
            continue
        btype = block.get("type")
        if btype in ("image_url", "input_image", "thinking"):
            continue
        # OpenAI Responses / newer APIs
        if btype in ("output_text", "output_text_delta", "text", "input_text"):
            text_like = (
                (block.get("text") if isinstance(block.get("text"), str) else None)
                or (block.get("content") if isinstance(block.get("content"), str) else None)
                or (block.get("value") if isinstance(block.get("value"), str) else None)
            )
            if text_like and str(text_like).strip():
                parts.append(str(text_like))
            continue
        text_like = (
            (block.get("text") if isinstance(block.get("text"), str) else None)
            or (block.get("content") if isinstance(block.get("content"), str) else None)
            or (block.get("value") if isinstance(block.get("value"), str) else None)
        )
        if text_like and str(text_like).strip():
            parts.append(str(text_like))
    return "".join(parts).strip()


def sanitize_plain_text_for_messaging_apps(text: str) -> str:
    """
    Strip Markdown wrappers around http(s) URLs so Telegram/WhatsApp link
    detection does not treat trailing ``**`` as part of the URL.
    """
    if not text:
        return text
    s = text
    for _ in range(6):
        prev = s
        s = re.sub(r"\*\*(https?://[^*\s]+)\*\*", r"\1", s)
        s = re.sub(r"(https?://[^*\s]+)\*\*", r"\1", s)
        s = re.sub(r"\*\*(https?://[^*\s]+)", r"\1", s)
        s = re.sub(r"(?<!\*)\*(https?://[^*\s]+)\*(?!\*)", r"\1", s)
        s = re.sub(r"`(https?://[^`\s]+)`", r"\1", s)
        if s == prev:
            break
    return s


def dedupe_consecutive_paragraphs(text: str) -> str:
    """Remove back-to-back identical paragraphs (common when text + tool repeat)."""
    blocks = [b.strip() for b in text.split("\n\n") if b.strip()]
    if len(blocks) < 2:
        return text.strip()
    out: List[str] = [blocks[0]]
    for b in blocks[1:]:
        if b == out[-1]:
            continue
        out.append(b)
    return "\n\n".join(out)


def _finalize_bridge_plain_text(text: str) -> str:
    text = text.strip()
    if not text:
        return text
    return dedupe_consecutive_paragraphs(sanitize_plain_text_for_messaging_apps(text))


def assistant_message_row_to_plain_text(msg: Dict[str, Any]) -> str:
    """
    Build user-visible plain text from a messages row (type == assistant).
    Preserves http(s) URLs so Telegram auto-linkifies them.
    """
    raw_content = msg.get("content")
    meta = _coerce_dict(msg.get("metadata"))

    pieces: List[str] = []

    tc_meta = meta.get("tool_calls")
    text_meta = meta.get("text_content")
    if isinstance(text_meta, str) and text_meta.strip():
        _append_unique(pieces, text_meta)
    # Some rows store display text only in alternate metadata keys
    for alt in ("assistant_text", "display_text", "message_text"):
        alt_v = meta.get(alt)
        if isinstance(alt_v, str) and alt_v.strip():
            _append_unique(pieces, alt_v)

    # Top-level JSON array (multimodal blocks) stored directly in content
    if isinstance(raw_content, list):
        block_text = _content_blocks_to_text(raw_content)
        if block_text:
            _append_unique(pieces, block_text)

    body = _coerce_dict(raw_content)

    inner = body.get("content")
    block_text = _content_blocks_to_text(inner)
    if block_text:
        _append_unique(pieces, block_text)
    elif isinstance(inner, str) and inner.strip():
        _append_unique(pieces, inner)

    tt = body.get("tool_calls")
    if tt:
        t1 = _openai_tool_calls_to_text(tt)
        if t1:
            _append_unique(pieces, t1)

    if tc_meta:
        t2 = _unified_metadata_tool_calls_to_text(tc_meta)
        if t2:
            _append_unique(pieces, t2)

    # Fallback: plain string content column (non-JSON)
    if not pieces and isinstance(raw_content, str) and raw_content.strip():
        _append_unique(pieces, raw_content.strip())

    text = "\n\n".join(pieces).strip()
    if text:
        return _finalize_bridge_plain_text(text)

    # Last resort: extract any URLs from a stringified blob (no raw repr of dict)
    if isinstance(raw_content, str) and raw_content.strip():
        urls = _URL_RE.findall(raw_content)
        if urls:
            return _finalize_bridge_plain_text("Links:\n" + "\n".join(urls))
    return ""


def user_message_row_to_plain(msg: Dict[str, Any]) -> str:
    """Plain text from a messages row (type == user)."""
    raw = msg.get("content")
    body = _coerce_dict(raw)
    if isinstance(raw, str) and not body and raw.strip():
        return raw.strip()
    if body.get("role") == "user":
        c = body.get("content")
        if isinstance(c, str):
            return c.strip()
        if isinstance(c, list):
            return _content_blocks_to_text(c)
    c = body.get("content")
    if isinstance(c, str):
        return c.strip()
    return ""


def latest_assistant_text_for_user_prompt(
    rows: List[Dict[str, Any]],
    user_prompt: str,
) -> Optional[str]:
    """
    Return assistant text for the turn that starts with the latest user message
    equal to ``user_prompt``. Avoids picking an older assistant when the newest
    assistant row is still empty or not yet written.
    """
    prompt = (user_prompt or "").strip()
    if not prompt:
        return None
    want = _normalize_user_prompt_text(prompt)
    user_times: List[Any] = []
    for msg in rows:
        if msg.get("type") != "user":
            continue
        plain = user_message_row_to_plain(msg).strip()
        if _normalize_user_prompt_text(plain) != want:
            continue
        ct = msg.get("created_at")
        if ct is not None:
            user_times.append(ct)
    if not user_times:
        return None
    parsed_times = [t for t in (_parse_ts(x) for x in user_times) if t is not None]
    if not parsed_times:
        return None
    anchor_dt = max(parsed_times)
    best_text: Optional[str] = None
    best_ct: Optional[datetime] = None
    for msg in rows:
        if msg.get("type") != "assistant":
            continue
        ct = _message_event_time(msg)
        if ct is None or ct <= anchor_dt:
            continue
        tx = assistant_message_row_to_plain_text(msg)
        if not tx:
            continue
        if best_ct is None or ct > best_ct:
            best_ct = ct
            best_text = tx
    return best_text


def _rows_sorted_by_time(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def key(m: Dict[str, Any]) -> float:
        t = _parse_ts(m.get("created_at"))
        return t.timestamp() if t else 0.0

    return sorted(rows, key=key)


def _rows_sorted_by_event_time(rows: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    def key(m: Dict[str, Any]) -> float:
        t = _message_event_time(m)
        return t.timestamp() if t else 0.0

    return sorted(rows, key=key)


def status_message_row_to_bridge_line(msg: Dict[str, Any], max_len: int = 140) -> str:
    """One-line summary for status rows (tool_started / tool_completed / etc.)."""
    raw = msg.get("content")
    body = _coerce_dict(raw)
    if not body and isinstance(raw, str) and raw.strip():
        body = _coerce_dict(_parse_json_if_str(raw.strip()))
    st = (body.get("status_type") or "").strip()
    if st in ("finish", "thread_run_start", "thread_run_end"):
        return ""
    if st == "tool_started":
        fn = str(body.get("function_name") or "")
        label = tool_started_label(fn)
        return f"→ {label}"[:max_len]
    if st == "tool_completed":
        fn = str(body.get("function_name") or "")
        label = tool_completed_label(fn)
        return f"✓ {label}"[:max_len]
    if st == "tool_failed":
        fn = str(body.get("function_name") or "")
        label = tool_completed_label(fn)
        return f"✗ {label}"[:max_len]
    if st == "terminating_tool_completed":
        fn = str(body.get("function_name") or "")
        label = tool_completed_label(fn) if fn else "Completing task"
        return f"✓ {label}"[:max_len]
    mtxt = body.get("message")
    if isinstance(mtxt, str) and mtxt.strip():
        return mtxt.strip()[:max_len]
    return ""


def _dedupe_consecutive_lines(lines: List[str]) -> List[str]:
    out: List[str] = []
    for ln in lines:
        c = ln.strip()
        if not c:
            continue
        if out and out[-1] == c:
            continue
        out.append(c)
    return out


def bridge_turn_content_anchor(
    rows: List[Dict[str, Any]],
    run_started_at: Any,
    user_prompt: str,
) -> Any:
    """
    Timestamp for \"this turn\" when filtering thread rows.

    Prefer the latest user message matching ``user_prompt`` so status rows
    created after the user spoke but before ``agent_runs.started_at`` are not
    dropped (``started_at`` is often slightly after the user row).
    """
    prompt = (user_prompt or "").strip()
    if not prompt:
        return run_started_at
    want = _normalize_user_prompt_text(prompt)
    best: Optional[datetime] = None
    for msg in rows:
        if msg.get("type") != "user":
            continue
        plain = user_message_row_to_plain(msg).strip()
        if _normalize_user_prompt_text(plain) != want:
            continue
        ct = _message_event_time(msg)
        if ct is None:
            continue
        if best is None or ct > best:
            best = ct
    if best is not None:
        return best
    return run_started_at


def _progress_block_for_bridge(
    rows: List[Dict[str, Any]],
    anchor: Optional[datetime],
    *,
    max_lines: int = 40,
) -> str:
    lines: List[str] = []
    for msg in _rows_sorted_by_time(rows):
        if msg.get("type") != "status":
            continue
        ct = _message_event_time(msg)
        if anchor and (ct is None or ct < anchor):
            continue
        line = status_message_row_to_bridge_line(msg)
        if line:
            lines.append(line)
    lines = _dedupe_consecutive_lines(lines)[-max_lines:]
    return "\n".join(lines).strip()


def _format_view_tasks_for_bridge(data: Dict[str, Any]) -> str:
    lines: List[str] = []
    total = data.get("total_tasks")
    done = data.get("completed_tasks")
    pct = data.get("progress_percent")
    if total is not None:
        head = f"Tasks {int(done or 0)}/{int(total)}"
        if pct is not None:
            head += f" ({pct}%)"
        lines.append(head)
    for sec in data.get("sections") or []:
        if not isinstance(sec, dict):
            continue
        title = (sec.get("title") or "").strip() or "Section"
        lines.append(f"• {title}")
        for t in sec.get("tasks") or []:
            if not isinstance(t, dict):
                continue
            st = (t.get("status") or "").lower()
            mark = "✓" if st == "completed" else ("✗" if st == "cancelled" else "○")
            content = (t.get("content") or "").strip()
            if content:
                lines.append(f"  {mark} {content}")
    out = "\n".join(lines).strip()
    if len(out) > 2800:
        out = out[:2780] + "…"
    return out


def _tool_message_output_string(body: Dict[str, Any], meta: Dict[str, Any]) -> str:
    cval = body.get("content")
    if isinstance(cval, str) and cval.strip():
        return cval.strip()
    if isinstance(cval, (dict, list)):
        try:
            return json.dumps(cval, ensure_ascii=False)
        except (TypeError, ValueError):
            pass
    res = meta.get("result")
    if isinstance(res, dict):
        o = res.get("output")
        if isinstance(o, str) and o.strip():
            return o.strip()
        if isinstance(o, (dict, list)):
            try:
                return json.dumps(o, ensure_ascii=False)
            except (TypeError, ValueError):
                pass
    return ""


def _format_execute_command_for_bridge(data: Dict[str, Any]) -> str:
    """
    Short IM-friendly summary. Full stdout includes echoed multiline scripts (heredocs),
    which overwhelms WeChat/Telegram and hides assistant prose. The web UI collapses
    these into one-line cards; we approximate with exit + tail of actual output.
    """
    exit_code = data.get("exit_code")
    timed_out = bool(data.get("timeout"))
    out = (data.get("output") or data.get("stdout") or data.get("message") or "").strip()
    cwd = data.get("cwd")

    if timed_out:
        tail = _bridge_tail_output_lines(out, max_lines=12, max_chars=700)
        base = "Command output — timed out"
        return f"{base}\n{tail}" if tail else base

    ec_s = str(exit_code) if exit_code is not None else "?"
    head = f"Command output (exit {ec_s})"
    if cwd and isinstance(cwd, str) and cwd.strip():
        head += f"\ncwd: {cwd.strip()[:120]}"

    if not out:
        return head

    tail = _bridge_tail_output_lines(out, max_lines=36, max_chars=1600)
    if not tail:
        return head
    return f"{head}\n{tail}"


def _bridge_tail_output_lines(raw: str, *, max_lines: int, max_chars: int) -> str:
    """Keep the last lines of command output (results/errors), bounded by size."""
    lines = [ln.rstrip() for ln in raw.splitlines() if ln.strip()]
    if not lines:
        return ""
    tail_lines = lines[-max_lines:] if len(lines) > max_lines else lines
    blob = "\n".join(tail_lines).strip()
    if len(blob) <= max_chars:
        return blob
    return "…\n" + blob[-(max_chars - 2) :]


def tool_message_row_to_bridge_text(msg: Dict[str, Any]) -> str:
    """Summarize tool rows the web UI renders as cards (e.g. view_tasks)."""
    if msg.get("type") != "tool":
        return ""
    raw = msg.get("content")
    body = _coerce_dict(raw)
    meta = _coerce_dict(msg.get("metadata"))
    name = (body.get("name") or meta.get("function_name") or "").strip()
    name_l = name.lower().replace("-", "_")
    s = _tool_message_output_string(body, meta)
    if not s:
        return ""
    if name_l == "view_tasks":
        parsed = _parse_json_if_str(s)
        if isinstance(parsed, dict):
            return _format_view_tasks_for_bridge(parsed)
    if name_l in ("execute_command",):
        parsed = _parse_json_if_str(s)
        if isinstance(parsed, dict):
            return _format_execute_command_for_bridge(parsed)
    return ""


def _body_chunks_merged(
    rows: List[Dict[str, Any]],
    anchor: Optional[datetime],
    max_blocks: int = 200,
) -> str:
    """Assistant + selected tool summaries after anchor, ordered by message event time."""
    items: List[tuple[float, str]] = []
    for msg in _rows_sorted_by_event_time(rows):
        et = _message_event_time(msg)
        if anchor and (et is None or et < anchor):
            continue
        key_t = et.timestamp() if et else 0.0
        mtype = msg.get("type")
        if mtype == "assistant":
            tx = assistant_message_row_to_plain_text(msg)
            if tx:
                items.append((key_t, tx))
        elif mtype == "tool":
            tx = tool_message_row_to_bridge_text(msg)
            if tx:
                items.append((key_t, tx))
    if not items:
        return ""
    items.sort(key=lambda x: x[0])
    chunks = [c for _, c in items]
    deduped: List[str] = []
    for tx in chunks:
        if deduped and deduped[-1] == tx:
            continue
        deduped.append(tx)
    tail = deduped[-max_blocks:]
    joined = "\n\n---\n\n".join(tail)
    return _finalize_bridge_plain_text(joined)


def bridge_turn_assistant_body(
    rows: List[Dict[str, Any]],
    run_started_at: Any,
    user_prompt: str,
) -> str:
    """Plain assistant output for this turn (no status progress lines)."""
    content_anchor = bridge_turn_content_anchor(rows, run_started_at, user_prompt)
    anchor_dt = _parse_ts(content_anchor)
    merged = _body_chunks_merged(rows, anchor_dt, max_blocks=200)
    if merged:
        return merged
    body = latest_assistant_text_since_run_started(rows, content_anchor)
    if not body:
        body = latest_assistant_text_for_user_prompt(rows, user_prompt)
    return (body or "").strip()


def _trim_earliest_status_lines_from_events(events: List[Dict[str, Any]], max_lines: int) -> None:
    """Drop oldest status lines (chronological) until count <= max_lines. Mutates events."""
    if max_lines <= 0:
        return

    def count_status_lines() -> int:
        n = 0
        for ev in events:
            if ev.get("kind") != "status":
                continue
            n += sum(1 for ln in ev["text"].splitlines() if ln.strip())
        return n

    while count_status_lines() > max_lines:
        idx = next((i for i, e in enumerate(events) if e.get("kind") == "status"), None)
        if idx is None:
            break
        raw_lines = [ln for ln in events[idx]["text"].splitlines() if ln.strip()]
        if not raw_lines:
            events.pop(idx)
            continue
        raw_lines = raw_lines[1:]
        if raw_lines:
            events[idx]["text"] = "\n".join(raw_lines)
        else:
            events.pop(idx)


def compose_bridge_turn_plain_text(
    rows: List[Dict[str, Any]],
    run_started_at: Any,
    user_prompt: str,
    *,
    max_progress_lines: int = 120,
) -> str:
    """
    Plain-text reply for IM bridges: status rows, assistant text, and tool
    summaries in **chronological order** (same rhythm as the web UI), not all
    tool lines batched ahead of prose.
    """
    content_anchor = bridge_turn_content_anchor(rows, run_started_at, user_prompt)
    anchor_dt = _parse_ts(content_anchor)

    events: List[Dict[str, Any]] = []
    status_buf: List[str] = []

    def flush_status() -> None:
        if not status_buf:
            return
        joined = "\n".join(_dedupe_consecutive_lines(status_buf)).strip()
        status_buf.clear()
        if joined:
            events.append({"kind": "status", "text": joined})

    for msg in _rows_sorted_by_event_time(rows):
        et = _message_event_time(msg)
        if anchor_dt and (et is None or et < anchor_dt):
            continue
        mtype = msg.get("type")
        if mtype == "status":
            line = status_message_row_to_bridge_line(msg)
            if line:
                status_buf.append(line)
        elif mtype == "assistant":
            tx = assistant_message_row_to_plain_text(msg)
            if tx:
                flush_status()
                events.append({"kind": "text", "text": tx})
        elif mtype == "tool":
            tx = tool_message_row_to_bridge_text(msg)
            if tx:
                flush_status()
                events.append({"kind": "text", "text": tx})

    flush_status()
    _trim_earliest_status_lines_from_events(events, max_progress_lines)

    parts: List[str] = [ev["text"] for ev in events if ev.get("text")]
    deduped: List[str] = []
    for p in parts:
        if deduped and deduped[-1] == p:
            continue
        deduped.append(p)
    raw = "\n\n".join(deduped).strip()
    return _finalize_bridge_plain_text(raw)


def public_http_url_for_im_linkify(url: str) -> str:
    """
    Telegram and some IM clients do not auto-linkify http://localhost/... .
    http://127.0.0.1/... is linkified and opens the same dev server on the host machine.
    """
    s = (url or "").strip()
    if not s:
        return s
    try:
        p = urllib.parse.urlsplit(s)
        if not p.scheme or not p.netloc:
            return s
        if (p.hostname or "").lower() != "localhost":
            return s
        port = p.port
        new_netloc = f"127.0.0.1:{port}" if port else "127.0.0.1"
        return urllib.parse.urlunsplit((p.scheme, new_netloc, p.path, p.query, p.fragment))
    except Exception:
        return s


THREAD_BROWSER_FOOTER_LABEL = "Open in browser (files & full reply):"


async def append_thread_workspace_link(
    reply_text: str,
    thread_id: str,
    *,
    threads_repo: Any,
    frontend_url: str,
) -> tuple[str, Optional[str]]:
    """
    Append thread deep link. Returns (full_text, display_url_for_clients).

    ``display_url`` uses 127.0.0.1 instead of localhost so Telegram linkifies it;
    IM bridges may also show an inline URL button with the same string.
    """
    if not thread_id:
        return reply_text or "", None
    try:
        project_id = await threads_repo.get_thread_project_id(thread_id)
    except Exception:
        project_id = None
    if not project_id:
        return reply_text or "", None
    base = (frontend_url or "").strip().rstrip("/")
    if not base:
        return reply_text or "", None
    url = f"{base}/projects/{project_id}/thread/{thread_id}"
    display_url = public_http_url_for_im_linkify(url)
    body = (reply_text or "").rstrip()
    if url in body or display_url in body:
        return body, display_url
    footer = f"\n\n────────\n{THREAD_BROWSER_FOOTER_LABEL}\n{display_url}"
    return body + footer, display_url
