from __future__ import annotations

import hashlib
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from core.local_runner import protocol as proto
from core.local_runner.client import handle_runner_event
from core.local_runner.registry import (
    complete_rpc,
    get_connection,
    is_online,
    mark_online,
    register_connection,
    unregister_connection,
)
from core.services.supabase import DBConnection
from core.utils.auth_utils import verify_and_get_user_id_from_jwt
from core.utils.logger import logger

router = APIRouter(tags=["local-runner"])
db: Optional[DBConnection] = None


def initialize(_db: DBConnection) -> None:
    global db
    db = _db
    logger.debug("Initialized local runner API")


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class PairRequest(BaseModel):
    name: Optional[str] = None
    platform: Optional[str] = None


class PairResponse(BaseModel):
    device_id: str
    device_token: str
    preview_port: int


class DeviceOut(BaseModel):
    device_id: str
    name: str
    platform: Optional[str] = None
    preview_port: int
    online: bool
    last_seen_at: Optional[str] = None
    created_at: Optional[str] = None


@router.post("/local-runner/pair", response_model=PairResponse)
async def pair_device(body: PairRequest, user_id: str = Depends(verify_and_get_user_id_from_jwt)):
    if db is None:
        raise HTTPException(status_code=500, detail="Local runner API not initialized")
    client = await db.client
    token = secrets.token_urlsafe(32)
    row = {
        "account_id": user_id,
        "name": (body.name or "This computer").strip() or "This computer",
        "platform": body.platform,
        "token_hash": _token_hash(token),
        "preview_port": proto.DEFAULT_PREVIEW_PORT,
        "last_seen_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await client.table("local_runner_devices").insert(row).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to register this computer")
    device = result.data[0]
    return PairResponse(
        device_id=device["device_id"],
        device_token=token,
        preview_port=int(device.get("preview_port") or proto.DEFAULT_PREVIEW_PORT),
    )


@router.get("/local-runner/devices", response_model=list[DeviceOut])
async def list_devices(user_id: str = Depends(verify_and_get_user_id_from_jwt)):
    if db is None:
        raise HTTPException(status_code=500, detail="Local runner API not initialized")
    client = await db.client
    result = (
        await client.table("local_runner_devices")
        .select("device_id, name, platform, preview_port, last_seen_at, created_at")
        .eq("account_id", user_id)
        .is_("revoked_at", "null")
        .order("created_at", desc=True)
        .execute()
    )
    devices = []
    for row in result.data or []:
        device_id = row["device_id"]
        devices.append(
            DeviceOut(
                device_id=device_id,
                name=row.get("name") or "This computer",
                platform=row.get("platform"),
                preview_port=int(row.get("preview_port") or proto.DEFAULT_PREVIEW_PORT),
                online=await is_online(device_id),
                last_seen_at=row.get("last_seen_at"),
                created_at=row.get("created_at"),
            )
        )
    return devices


@router.delete("/local-runner/devices/{device_id}")
async def revoke_device(device_id: str, user_id: str = Depends(verify_and_get_user_id_from_jwt)):
    if db is None:
        raise HTTPException(status_code=500, detail="Local runner API not initialized")
    client = await db.client
    existing = (
        await client.table("local_runner_devices")
        .select("device_id")
        .eq("device_id", device_id)
        .eq("account_id", user_id)
        .maybe_single()
        .execute()
    )
    if not existing or not existing.data:
        raise HTTPException(status_code=404, detail="Device not found")
    await client.table("local_runner_devices").update(
        {"revoked_at": datetime.now(timezone.utc).isoformat()}
    ).eq("device_id", device_id).execute()
    await unregister_connection(device_id)
    return {"success": True}


@router.websocket("/local-runner/ws")
async def local_runner_ws(websocket: WebSocket):
    await websocket.accept()
    device_id: Optional[str] = None
    try:
        auth = await websocket.receive_json()
        if not isinstance(auth, dict) or auth.get("type") != proto.AUTH_TYPE:
            await websocket.send_json({"type": "error", "message": "Expected auth message"})
            await websocket.close()
            return
        token = auth.get("device_token") or ""
        if not token or db is None:
            await websocket.send_json({"type": "error", "message": "Missing device token"})
            await websocket.close()
            return

        client = await db.client
        found = (
            await client.table("local_runner_devices")
            .select("device_id, account_id, preview_port, revoked_at")
            .eq("token_hash", _token_hash(token))
            .maybe_single()
            .execute()
        )
        if not found or not found.data or found.data.get("revoked_at"):
            await websocket.send_json({"type": "error", "message": "Invalid device token"})
            await websocket.close()
            return

        device_id = found.data["device_id"]
        preview_port = int(found.data.get("preview_port") or proto.DEFAULT_PREVIEW_PORT)
        host_tools: dict = {}

        hello = await websocket.receive_json()
        if isinstance(hello, dict) and hello.get("type") == proto.HELLO_TYPE:
            preview_port = int(hello.get("preview_port") or preview_port)
            platform = hello.get("platform")
            if isinstance(hello.get("host_tools"), dict):
                host_tools = hello["host_tools"]
            updates = {
                "preview_port": preview_port,
                "last_seen_at": datetime.now(timezone.utc).isoformat(),
            }
            if platform:
                updates["platform"] = platform
            await client.table("local_runner_devices").update(updates).eq("device_id", device_id).execute()

        async def send(message: dict):
            await websocket.send_json(message)

        await register_connection(device_id, send, preview_port, host_tools=host_tools)
        await websocket.send_json({"type": proto.READY_TYPE, "device_id": device_id})
        logger.info(f"[LOCAL_RUNNER] Device {device_id} connected")

        while True:
            message = await websocket.receive_json()
            if not isinstance(message, dict):
                continue
            msg_type = message.get("type")
            if msg_type == proto.PING_TYPE:
                conn = get_connection(device_id)
                await mark_online(device_id, preview_port, host_tools=(conn.host_tools if conn else host_tools))
                await websocket.send_json({"type": proto.PONG_TYPE})
                continue
            if msg_type == proto.EVENT_TYPE:
                await handle_runner_event(device_id, message)
                continue
            if message.get("jsonrpc") == proto.JSONRPC_VERSION and message.get("id"):
                await complete_rpc(device_id, message)
                continue
            logger.debug(f"[LOCAL_RUNNER] Ignored frame from {device_id}: {msg_type}")
    except WebSocketDisconnect:
        logger.info(f"[LOCAL_RUNNER] Device {device_id} disconnected")
    except Exception as e:
        logger.warning(f"[LOCAL_RUNNER] WebSocket error for {device_id}: {e}")
        try:
            await websocket.close()
        except Exception:
            pass
    finally:
        if device_id:
            await unregister_connection(device_id)
