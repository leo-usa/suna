from pathlib import Path

from core.sandbox.tool_base import SandboxToolsBase
from core.utils.files_utils import is_host_home_path, rewrite_foreign_home_path


def test_is_host_home_path_recognizes_tilde_and_users():
    assert is_host_home_path("~/Documents/Playground/wechat-batch-workflow/README.md")
    assert is_host_home_path("~/.agents/skills/wechat-group-sharing/SKILL.md")
    assert is_host_home_path("/Users/leo/Documents/Playground/x.md")
    assert is_host_home_path("/home/leo/.agents/skills/x.md")
    assert is_host_home_path(r"C:\Users\leo\Documents\a.md")
    assert not is_host_home_path("src/main.py")
    assert not is_host_home_path("/workspace/src/main.py")
    assert not is_host_home_path("/etc/passwd")


def test_rewrite_foreign_home_path_maps_wrong_username():
    home = "/Users/leo"
    assert (
        rewrite_foreign_home_path(
            "/Users/huang.wendy/Documents/Playground/wechat-batch-workflow/README.md",
            home=home,
        )
        == "/Users/leo/Documents/Playground/wechat-batch-workflow/README.md"
    )
    assert (
        rewrite_foreign_home_path("/Users/huang.wendy/.agents/skills/wechat-group-sharing/SKILL.md", home=home)
        == "/Users/leo/.agents/skills/wechat-group-sharing/SKILL.md"
    )
    assert rewrite_foreign_home_path("~/Documents/a.md", home=home) == "~/Documents/a.md"
    assert (
        rewrite_foreign_home_path("/Users/leo/Documents/a.md", home=home) == "/Users/leo/Documents/a.md"
    )


def test_resolve_fs_path_expands_tilde_on_local_runtime():
    tool = SandboxToolsBase("proj")
    tool._sandbox_info = type("Info", (), {"sandbox_id": "local:proj"})()
    real_home = str(Path.home())
    home = "~/Documents/Playground/wechat-batch-workflow/README.md"
    agents = "~/.agents/skills/wechat-group-sharing/SKILL.md"
    users = f"{real_home}/.agents/skills/wechat-group-sharing/SKILL.md"
    # Expand ~/ so shell-quoted cat/download paths work on the local runner.
    assert tool.resolve_fs_path(home) == f"{real_home}/Documents/Playground/wechat-batch-workflow/README.md"
    assert tool.resolve_fs_path(agents) == f"{real_home}/.agents/skills/wechat-group-sharing/SKILL.md"
    assert tool.resolve_fs_path(users) == users
    wrong = "/Users/huang.wendy/Documents/Playground/wechat-batch-workflow/README.md"
    assert tool.resolve_fs_path(wrong) == f"{real_home}/Documents/Playground/wechat-batch-workflow/README.md"
    assert tool.resolve_fs_path("src/main.py") == "/workspace/src/main.py"
    assert tool.resolve_fs_path("/workspace/src/main.py") == "/workspace/src/main.py"


def test_resolve_fs_path_rewrites_home_into_workspace_on_cloud():
    tool = SandboxToolsBase("proj")
    tool._sandbox_info = type("Info", (), {"sandbox_id": "daytona-abc"})()
    # Cloud must not treat host home paths as mountable.
    assert tool.resolve_fs_path("~/Documents/a.md") == "/workspace/~/Documents/a.md"
    assert tool.resolve_fs_path("/Users/leo/Documents/a.md") == "/workspace/Users/leo/Documents/a.md"
