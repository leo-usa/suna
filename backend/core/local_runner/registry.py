"""Redis-backed routing from any API instance to the instance holding a runner socket."""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, Callable, Optional

from core.local_runner.protocol import (
    INBOX_KEY,
    JSONRPC_VERSION,
    ONLINE_KEY,
    ONLINE_TTL_SECONDS,
    PTY_KEY,
    PTY_STREAM_TTL_SECONDS,
    REPLY_KEY,
    RPC_TIMEOUT_SECONDS,
)
from core.services import redis
from core.utils.logger import logger

_connections: dict[str, "RunnerConnection"] = {}
_connections_lock = asyncio.Lock()


class LocalRunnerError(RuntimeError):
    pass


class LocalRunnerOffline(LocalRunnerError):
    pass


class RunnerConnection:
    """In-memory handle for the WebSocket on this API instance."""

    def __init__(self, device_id: str, send: Callable[[dict], Any], preview_port: int, host_tools: Optional[dict] = None):
        self.device_id = device_id
        self.send = send
        self.preview_port = preview_port
        self.host_tools = host_tools or {}
        self.pending: dict[str, asyncio.Future] = {}
        self._inbox_task: Optional[asyncio.Task] = None

    async def start_inbox(self) -> None:
        if self._inbox_task and not self._inbox_task.done():
            return
        self._inbox_task = asyncio.create_task(self._drain_inbox(), name=f"local-runner-inbox-{self.device_id}")

    async def stop(self) -> None:
        if self._inbox_task:
            self._inbox_task.cancel()
            try:
                await self._inbox_task
            except asyncio.CancelledError:
                pass
            self._inbox_task = None
        for future in list(self.pending.values()):
            if not future.done():
                future.set_exception(LocalRunnerOffline("Runner disconnected"))
        self.pending.clear()

    async def _drain_inbox(self) -> None:
        client = await redis.get_client()
        inbox = INBOX_KEY.format(device_id=self.device_id)
        try:
            while True:
                item = await client.blpop(inbox, timeout=5)
                if not item:
                    continue
                _key, raw = item
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8")
                try:
                    message = json.loads(raw)
                except json.JSONDecodeError:
                    logger.warning(f"[LOCAL_RUNNER] Bad inbox payload for {self.device_id}")
                    continue
                try:
                    await self.send(message)
                except Exception as e:
                    logger.warning(f"[LOCAL_RUNNER] Failed to forward RPC to {self.device_id}: {e}")
                    request_id = message.get("id")
                    if request_id:
                        await _write_reply(
                            request_id,
                            {"jsonrpc": JSONRPC_VERSION, "id": request_id, "error": {"code": -32000, "message": str(e)}},
                        )
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.error(f"[LOCAL_RUNNER] Inbox loop died for {self.device_id}: {e}")


async def register_connection(
    device_id: str,
    send: Callable[[dict], Any],
    preview_port: int,
    host_tools: Optional[dict] = None,
) -> RunnerConnection:
    async with _connections_lock:
        existing = _connections.get(device_id)
        if existing:
            await existing.stop()
        conn = RunnerConnection(device_id, send, preview_port, host_tools=host_tools)
        _connections[device_id] = conn
    await mark_online(device_id, preview_port, host_tools)
    await conn.start_inbox()
    return conn


async def unregister_connection(device_id: str) -> None:
    async with _connections_lock:
        conn = _connections.pop(device_id, None)
    if conn:
        await conn.stop()
    await redis.delete(ONLINE_KEY.format(device_id=device_id))


def get_connection(device_id: str) -> Optional[RunnerConnection]:
    return _connections.get(device_id)


async def mark_online(device_id: str, preview_port: int, host_tools: Optional[dict] = None) -> None:
    payload: dict[str, Any] = {"preview_port": preview_port}
    if host_tools:
        payload["host_tools"] = host_tools
    await redis.set(ONLINE_KEY.format(device_id=device_id), json.dumps(payload), ex=ONLINE_TTL_SECONDS)


async def is_online(device_id: str) -> bool:
    return bool(await redis.get(ONLINE_KEY.format(device_id=device_id)))


async def get_online_info(device_id: str) -> Optional[dict]:
    raw = await redis.get(ONLINE_KEY.format(device_id=device_id))
    if not raw:
        return None
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


async def complete_rpc(device_id: str, message: dict) -> None:
    """Handle a JSON-RPC response from the runner (local pending future or Redis reply)."""
    request_id = message.get("id")
    if not request_id:
        return
    conn = _connections.get(device_id)
    if conn and request_id in conn.pending:
        future = conn.pending.pop(request_id)
        if not future.done():
            future.set_result(message)
        return
    await _write_reply(request_id, message)


async def publish_pty_data(session_id: str, data: str) -> None:
    client = await redis.get_client()
    key = PTY_KEY.format(session_id=session_id)
    await client.rpush(key, data)
    await client.expire(key, PTY_STREAM_TTL_SECONDS)


async def rpc(device_id: str, method: str, params: Optional[dict] = None, timeout: float = RPC_TIMEOUT_SECONDS) -> Any:
    if not await is_online(device_id):
        raise LocalRunnerOffline(f"Local runner {device_id} is offline")

    request_id = str(uuid.uuid4())
    message = {
        "jsonrpc": JSONRPC_VERSION,
        "id": request_id,
        "method": method,
        "params": params or {},
    }

    conn = _connections.get(device_id)
    if conn:
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        conn.pending[request_id] = future
        try:
            await conn.send(message)
            response = await asyncio.wait_for(future, timeout=timeout)
        except Exception:
            conn.pending.pop(request_id, None)
            raise
    else:
        client = await redis.get_client()
        inbox = INBOX_KEY.format(device_id=device_id)
        await client.rpush(inbox, json.dumps(message))
        await client.expire(inbox, int(timeout) + 30)
        reply_key = REPLY_KEY.format(request_id=request_id)
        popped = await client.blpop(reply_key, timeout=int(timeout))
        if not popped:
            raise LocalRunnerError(f"RPC {method} timed out waiting for runner {device_id}")
        _key, raw = popped
        if isinstance(raw, bytes):
            raw = raw.decode("utf-8")
        response = json.loads(raw)

    if response.get("error"):
        err = response["error"]
        raise LocalRunnerError(err.get("message") if isinstance(err, dict) else str(err))
    return response.get("result")


async def _write_reply(request_id: str, message: dict) -> None:
    client = await redis.get_client()
    reply_key = REPLY_KEY.format(request_id=request_id)
    await client.rpush(reply_key, json.dumps(message))
    await client.expire(reply_key, 60)
