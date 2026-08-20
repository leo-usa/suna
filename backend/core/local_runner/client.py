"""Daytona-compatible sandbox adapter that RPCs to a local runner."""

from __future__ import annotations

import asyncio
import base64
import shlex
from dataclasses import dataclass
from typing import Any, Callable, Optional

from core.local_runner import protocol as proto
from core.local_runner.registry import get_online_info, publish_pty_data, rpc
from core.services import redis
from core.utils.logger import logger


class LocalSandboxState:
    value = "started"

    def __str__(self) -> str:
        return self.value

    def __eq__(self, other: object) -> bool:
        other_value = getattr(other, "value", other)
        return str(other_value).lower() in {"started", str(self.value)}


@dataclass
class LocalFileInfo:
    name: str
    is_dir: bool
    size: int = 0
    mod_time: str = ""
    permissions: Optional[str] = None


@dataclass
class LocalExecResult:
    exit_code: int = 0
    result: str = ""
    stdout: str = ""
    stderr: str = ""


@dataclass
class LocalSessionCommandResult:
    cmd_id: str
    exit_code: int = 0


@dataclass
class LocalSessionLogs:
    output: str = ""


@dataclass
class LocalPreviewLink:
    url: str
    token: Optional[str] = None


class LocalFs:
    def __init__(self, device_id: str, project_id: str, project_name: Optional[str] = None):
        self._device_id = device_id
        self._project_id = project_id
        self._project_name = project_name

    async def _rpc(self, method: str, params: dict, timeout: Optional[float] = None) -> Any:
        payload = {**params, "project_id": self._project_id}
        if self._project_name:
            payload["project_name"] = self._project_name
        return await rpc(
            self._device_id,
            method,
            payload,
            timeout=timeout or proto.RPC_TIMEOUT_SECONDS,
        )

    async def download_file(self, path: str, timeout: Optional[float] = None) -> bytes:
        result = await self._rpc(proto.FS_DOWNLOAD_FILE, {"path": path}, timeout=timeout)
        content_b64 = (result or {}).get("content_b64") or ""
        return base64.b64decode(content_b64) if content_b64 else b""

    async def upload_file(self, data: bytes, path: str) -> None:
        payload = base64.b64encode(data or b"").decode("ascii")
        await self._rpc(proto.FS_UPLOAD_FILE, {"path": path, "content_b64": payload})

    async def list_files(self, path: str) -> list[LocalFileInfo]:
        result = await self._rpc(proto.FS_LIST_FILES, {"path": path})
        files = (result or {}).get("files") or []
        return [
            LocalFileInfo(
                name=item.get("name") or "",
                is_dir=bool(item.get("is_dir")),
                size=int(item.get("size") or 0),
                mod_time=str(item.get("mod_time") or ""),
                permissions=item.get("permissions"),
            )
            for item in files
        ]

    async def create_folder(self, path: str, mode: str = "755") -> None:
        await self._rpc(proto.FS_CREATE_FOLDER, {"path": path, "mode": str(mode)})

    async def make_dir(self, path: str) -> None:
        await self._rpc(proto.FS_MAKE_DIR, {"path": path})

    async def delete_file(self, path: str) -> None:
        await self._rpc(proto.FS_DELETE_FILE, {"path": path})

    async def get_file_info(self, path: str) -> LocalFileInfo:
        result = await self._rpc(proto.FS_GET_FILE_INFO, {"path": path}) or {}
        return LocalFileInfo(
            name=result.get("name") or path.rsplit("/", 1)[-1],
            is_dir=bool(result.get("is_dir")),
            size=int(result.get("size") or 0),
            mod_time=str(result.get("mod_time") or ""),
            permissions=result.get("permissions"),
        )

    async def set_file_permissions(self, path: str, permissions: str) -> None:
        await self._rpc(proto.FS_SET_FILE_PERMISSIONS, {"path": path, "permissions": str(permissions)})


class LocalPtyHandle:
    def __init__(self, device_id: str, project_id: str, session_id: str, on_data: Optional[Callable[[bytes], Any]] = None, project_name: Optional[str] = None):
        self._device_id = device_id
        self._project_id = project_id
        self._project_name = project_name
        self.session_id = session_id
        self._on_data = on_data
        self._pump_task: Optional[asyncio.Task] = None
        if on_data:
            self._pump_task = asyncio.create_task(self._pump(), name=f"local-pty-{session_id}")

    def _params(self, extra: Optional[dict] = None) -> dict:
        payload = {"session_id": self.session_id, "project_id": self._project_id, **(extra or {})}
        if self._project_name:
            payload["project_name"] = self._project_name
        return payload

    async def send_input(self, data: str) -> None:
        await rpc(self._device_id, proto.PROCESS_PTY_INPUT, self._params({"data": data}))

    async def kill(self) -> None:
        try:
            await rpc(self._device_id, proto.PROCESS_PTY_KILL, self._params())
        finally:
            await self._stop_pump()

    async def resize(self, pty_size: Any) -> None:
        cols = getattr(pty_size, "cols", None) or (pty_size.get("cols") if isinstance(pty_size, dict) else 120)
        rows = getattr(pty_size, "rows", None) or (pty_size.get("rows") if isinstance(pty_size, dict) else 40)
        await rpc(self._device_id, proto.PROCESS_PTY_RESIZE, self._params({"cols": cols, "rows": rows}))

    async def _pump(self) -> None:
        client = await redis.get_client()
        key = proto.PTY_KEY.format(session_id=self.session_id)
        try:
            while True:
                item = await client.blpop(key, timeout=5)
                if not item:
                    continue
                _redis_key, raw = item
                if isinstance(raw, bytes):
                    raw = raw.decode("utf-8", errors="replace")
                if not self._on_data:
                    continue
                payload = raw.encode("utf-8") if isinstance(raw, str) else raw
                maybe = self._on_data(payload)
                if asyncio.iscoroutine(maybe):
                    await maybe
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"[LOCAL_RUNNER] PTY pump ended for {self.session_id}: {e}")

    async def _stop_pump(self) -> None:
        if self._pump_task:
            self._pump_task.cancel()
            try:
                await self._pump_task
            except asyncio.CancelledError:
                pass
            self._pump_task = None


class LocalProcess:
    def __init__(self, device_id: str, project_id: str, project_name: Optional[str] = None):
        self._device_id = device_id
        self._project_id = project_id
        self._project_name = project_name

    def _params(self, extra: dict) -> dict:
        payload = {**extra, "project_id": self._project_id}
        if self._project_name:
            payload["project_name"] = self._project_name
        return payload

    async def exec(self, command: str, *args, timeout: Optional[float] = None, env: Optional[dict] = None, cwd: Optional[str] = None) -> LocalExecResult:
        if args:
            command = " ".join(shlex.quote(str(part)) for part in (command, *args))
        result = await rpc(
            self._device_id,
            proto.PROCESS_EXEC,
            self._params({"command": command, "env": env or {}, "cwd": cwd}),
            timeout=timeout or proto.RPC_TIMEOUT_SECONDS,
        ) or {}
        stdout = result.get("stdout") or result.get("result") or ""
        stderr = result.get("stderr") or ""
        return LocalExecResult(
            exit_code=int(result.get("exit_code") or 0),
            result=stdout,
            stdout=stdout,
            stderr=stderr,
        )

    async def start(self, command: str) -> LocalExecResult:
        result = await rpc(self._device_id, proto.PROCESS_START, self._params({"command": command})) or {}
        stdout = result.get("stdout") or result.get("result") or ""
        return LocalExecResult(exit_code=int(result.get("exit_code") or 0), result=stdout, stdout=stdout, stderr=result.get("stderr") or "")

    async def create_session(self, session_id: str) -> None:
        await rpc(self._device_id, proto.PROCESS_CREATE_SESSION, self._params({"session_id": session_id}))

    async def execute_session_command(self, session_id: str, req: Any, timeout: Optional[float] = None) -> LocalSessionCommandResult:
        command = getattr(req, "command", None) or (req.get("command") if isinstance(req, dict) else str(req))
        cwd = getattr(req, "cwd", None) or (req.get("cwd") if isinstance(req, dict) else None)
        result = await rpc(
            self._device_id,
            proto.PROCESS_EXECUTE_SESSION_COMMAND,
            self._params({"session_id": session_id, "command": command, "cwd": cwd}),
            timeout=timeout or proto.RPC_TIMEOUT_SECONDS,
        ) or {}
        return LocalSessionCommandResult(
            cmd_id=result.get("cmd_id") or session_id,
            exit_code=int(result.get("exit_code") or 0),
        )

    async def get_session_command_logs(self, session_id: str, command_id: str) -> LocalSessionLogs:
        result = await rpc(
            self._device_id,
            proto.PROCESS_GET_SESSION_COMMAND_LOGS,
            self._params({"session_id": session_id, "command_id": command_id}),
        ) or {}
        return LocalSessionLogs(output=result.get("output") or "")

    async def delete_session(self, session_id: str) -> None:
        await rpc(self._device_id, proto.PROCESS_DELETE_SESSION, self._params({"session_id": session_id}))

    async def create_pty_session(self, id: str, on_data: Optional[Callable[[bytes], Any]] = None, pty_size: Any = None) -> LocalPtyHandle:
        cols = getattr(pty_size, "cols", 120) if pty_size is not None else 120
        rows = getattr(pty_size, "rows", 40) if pty_size is not None else 40
        await rpc(
            self._device_id,
            proto.PROCESS_CREATE_PTY_SESSION,
            self._params({"session_id": id, "cols": cols, "rows": rows}),
        )
        return LocalPtyHandle(self._device_id, self._project_id, id, on_data=on_data, project_name=self._project_name)


class LocalComputer:
    def __init__(self, device_id: str, project_id: str, project_name: Optional[str] = None):
        self._device_id = device_id
        self._project_id = project_id
        self._project_name = project_name

    def _params(self, extra: dict) -> dict:
        payload = {**extra, "project_id": self._project_id}
        if self._project_name:
            payload["project_name"] = self._project_name
        return payload

    async def screenshot(self) -> dict:
        return await rpc(self._device_id, proto.COMPUTER_SCREENSHOT, self._params({})) or {}

    async def click(self, x: float, y: float, button: str = "left", count: int = 1, **meta) -> dict:
        return await rpc(
            self._device_id,
            proto.COMPUTER_CLICK,
            self._params({"x": x, "y": y, "button": button, "count": count, **meta}),
        ) or {}

    async def type(self, text: str) -> dict:
        return await rpc(self._device_id, proto.COMPUTER_TYPE, self._params({"text": text})) or {}

    async def key(self, key: str) -> dict:
        return await rpc(self._device_id, proto.COMPUTER_KEY, self._params({"key": key})) or {}

    async def scroll(self, x: float = 0, y: float = 0, dy: float = 0, dx: float = 0, **meta) -> dict:
        return await rpc(
            self._device_id,
            proto.COMPUTER_SCROLL,
            self._params({"x": x, "y": y, "dy": dy, "dx": dx, **meta}),
        ) or {}

    async def open(self, target: str) -> dict:
        return await rpc(self._device_id, proto.COMPUTER_OPEN, self._params({"target": target})) or {}


class LocalSandbox:
    def __init__(self, device_id: str, project_id: str, preview_port: Optional[int] = None, project_name: Optional[str] = None):
        self.device_id = device_id
        self.project_id = project_id
        self.project_name = project_name
        self.id = f"local:{project_id}"
        self.state = LocalSandboxState()
        self.fs = LocalFs(device_id, project_id, project_name)
        self.process = LocalProcess(device_id, project_id, project_name)
        self.computer = LocalComputer(device_id, project_id, project_name)
        self._preview_port = preview_port or proto.DEFAULT_PREVIEW_PORT

    async def get_preview_link(self, port: int) -> LocalPreviewLink:
        info = await get_online_info(self.device_id)
        preview_port = int((info or {}).get("preview_port") or self._preview_port)
        if int(port) == 8080:
            return LocalPreviewLink(url=f"http://127.0.0.1:{preview_port}/{self.project_id}")
        return LocalPreviewLink(url=f"http://127.0.0.1:{port}")


async def handle_runner_event(device_id: str, event: dict) -> None:
    name = event.get("event")
    if name == proto.EVENT_PTY_DATA:
        session_id = event.get("session_id")
        data = event.get("data") or ""
        if session_id:
            await publish_pty_data(session_id, data)
    elif name == proto.EVENT_PTY_EXIT:
        session_id = event.get("session_id")
        if session_id:
            await publish_pty_data(session_id, "")
    else:
        logger.debug(f"[LOCAL_RUNNER] Unhandled event from {device_id}: {name}")
