import pytest

from core.local_runner.protocol import (
    COMPUTER_CLICK,
    COMPUTER_SCREENSHOT,
    FS_DOWNLOAD_FILE,
    PROCESS_EXEC,
    RPC_METHODS,
)
from core.local_runner.client import LocalComputer, LocalFileInfo, LocalProcess, LocalSandbox
from core.local_runner.service import (
    is_local_sandbox_id,
    local_preview_url,
    local_sandbox_id,
    uses_local_runtime,
)


def test_rpc_methods_include_daytona_surface():
    assert FS_DOWNLOAD_FILE in RPC_METHODS
    assert PROCESS_EXEC in RPC_METHODS
    assert "fs.list_files" in RPC_METHODS
    assert "process.create_pty_session" in RPC_METHODS
    assert COMPUTER_SCREENSHOT in RPC_METHODS
    assert COMPUTER_CLICK in RPC_METHODS
    assert "computer.type" in RPC_METHODS
    assert "computer.open" in RPC_METHODS


def test_local_file_info_matches_tool_access():
    info = LocalFileInfo(name="index.html", is_dir=False, size=12, mod_time="2026-08-17")
    assert info.name == "index.html"
    assert info.is_dir is False
    assert info.size == 12


def test_local_process_joins_positional_exec_args():
    process = LocalProcess("device", "proj")
    assert hasattr(process, "exec")
    assert hasattr(process, "create_session")
    assert hasattr(process, "create_pty_session")


def test_local_sandbox_id_uses_project():
    sandbox = LocalSandbox("device", "proj", project_name="Deepseek harness")
    assert sandbox.id == "local:proj"
    assert sandbox.fs._project_id == "proj"
    assert sandbox.fs._project_name == "Deepseek harness"
    assert sandbox.process._project_name == "Deepseek harness"
    assert hasattr(sandbox, "computer")
    assert isinstance(sandbox.computer, LocalComputer)
    assert local_sandbox_id("proj") == "local:proj"
    assert is_local_sandbox_id("local:proj")
    assert not is_local_sandbox_id("abc")


def test_local_preview_url_includes_project():
    assert local_preview_url("proj_abc", 18080) == "http://127.0.0.1:18080/proj_abc"


def test_uses_local_runtime():
    assert uses_local_runtime("local", None) is True
    assert uses_local_runtime("cloud", "local:proj") is True
    assert uses_local_runtime("cloud", "daytona-id") is False


@pytest.mark.asyncio
async def test_ensure_local_workspace_creates_folder_via_rpc(monkeypatch):
    from core.local_runner import service as local_service
    from core.local_runner.protocol import FS_MAKE_DIR

    calls = []

    async def fake_is_online(device_id):
        return device_id == "dev-online"

    async def fake_rpc(device_id, method, params, timeout=30):
        calls.append((device_id, method, params, timeout))
        return {"ok": True}

    monkeypatch.setattr(local_service, "is_online", fake_is_online)
    monkeypatch.setattr("core.local_runner.registry.rpc", fake_rpc)

    assert await local_service.ensure_local_workspace(None, "proj") is False
    assert await local_service.ensure_local_workspace("dev-offline", "proj") is False
    assert await local_service.ensure_local_workspace("dev-online", "proj", "Hello World") is True
    assert calls == [
        (
            "dev-online",
            FS_MAKE_DIR,
            {"project_id": "proj", "path": "/workspace", "project_name": "Hello World"},
            30,
        )
    ]


def test_computer_tool_is_not_in_cloud_index():
    from core.tools.tool_registry import ALL_TOOLS
    from core.jit.loader import JITLoader

    names = {item[0] for item in ALL_TOOLS}
    assert "sb_computer_tool" not in names
    assert "sb_computer_tool" not in JITLoader.get_core_tools()
