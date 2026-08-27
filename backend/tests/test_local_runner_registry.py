import asyncio

import pytest

from core.local_runner import registry as reg


@pytest.fixture
def fake_redis(monkeypatch):
    store = {}

    class Client:
        async def blpop(self, key, timeout=0):
            await asyncio.sleep(0.01)
            return None

        async def rpush(self, *args, **kwargs):
            return 1

        async def expire(self, *args, **kwargs):
            return True

    async def get_client():
        return Client()

    async def get(key, timeout=None):
        return store.get(key)

    async def set(key, value, ex=None, nx=False, timeout=None):
        store[key] = value
        return True

    async def delete(key, timeout=None):
        store.pop(key, None)
        return 1

    monkeypatch.setattr(reg.redis, "get_client", get_client)
    monkeypatch.setattr(reg.redis, "get", get)
    monkeypatch.setattr(reg.redis, "set", set)
    monkeypatch.setattr(reg.redis, "delete", delete)
    yield store
    for conn in list(reg._connections.values()):
        if conn._inbox_task:
            conn._inbox_task.cancel()
            conn._inbox_task = None
    reg._connections.clear()


@pytest.mark.asyncio
async def test_stale_unregister_keeps_newer_connection(fake_redis):
    async def send_old(_msg):
        return None

    async def send_new(_msg):
        return None

    first = await reg.register_connection("dev-1", send_old, 18080)
    second = await reg.register_connection("dev-1", send_new, 18081)
    assert reg.get_connection("dev-1") is second

    await reg.unregister_connection("dev-1", first)
    assert reg.get_connection("dev-1") is second
    assert await reg.is_online("dev-1")

    await reg.unregister_connection("dev-1", second)
    assert reg.get_connection("dev-1") is None
    assert not await reg.is_online("dev-1")


@pytest.mark.asyncio
async def test_unregister_without_conn_drops_current(fake_redis):
    async def send(_msg):
        return None

    await reg.register_connection("dev-2", send, 18080)
    await reg.unregister_connection("dev-2")
    assert reg.get_connection("dev-2") is None
    assert not await reg.is_online("dev-2")
