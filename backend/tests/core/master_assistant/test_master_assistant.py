import json
from unittest.mock import AsyncMock, patch

import pytest

from core.master_assistant import service


def test_thread_path_with_and_without_project():
    assert service.thread_path("p1", "t1") == "/projects/p1/thread/t1"
    assert service.thread_path(None, "t1") == "/thread/t1"


def test_build_task_update_prompt_lists_each_task():
    rows = [
        {"thread_id": "t1", "project_id": "p1", "title": "调研", "execution_target": "cloud",
         "status": "completed", "summary": "找到 3 家供应商"},
        {"thread_id": "t2", "project_id": None, "title": None, "execution_target": "local",
         "status": "failed", "summary": ""},
    ]
    text = service.build_task_update_prompt(rows)
    lines = text.split("\n")
    assert lines[0] == service.TASK_UPDATE_MARKER
    assert lines[1].startswith("- 「调研」（云端）已完成 | thread_id=t1 | ")
    assert lines[1].endswith("/projects/p1/thread/t1")
    assert lines[2] == "  结果摘要：找到 3 家供应商"
    assert lines[3].startswith("- 「任务」（本地）失败 | thread_id=t2 | ")
    assert "check_conversation" in lines[-1]


async def test_deliver_child_files_uses_the_latest_conversation():
    child = {"thread_id": "t1", "title": "Hello World", "agent_run_id": "r1", "status": "completed"}
    with patch.object(service, "list_children", AsyncMock(return_value=[child])), \
         patch.object(service, "get_child", AsyncMock(return_value=child)), \
         patch.object(service, "_live_status", AsyncMock(return_value="completed")), \
         patch("core.integrations.im_file_outbox.enqueue_existing_office_files", AsyncMock(return_value={
             "queued": 1, "already_pending": 0, "names": ["hello_world.docx"],
         })):
        result = await service.deliver_child_files("a1")
    assert result["found"] is True
    assert result["thread_id"] == "t1"
    assert result["files"] == ["hello_world.docx"]
    assert result["sent_to_chat"] is True


async def test_deliver_child_files_when_none_started():
    with patch.object(service, "list_children", AsyncMock(return_value=[])):
        result = await service.deliver_child_files("a1")
    assert result == {"found": False, "reason": "no_conversation"}


async def test_child_finish_saves_summary_and_reports():
    child = {"account_id": "a1", "master_thread_id": "m1", "thread_id": "t1"}
    with patch.object(service, "execute_one", AsyncMock(side_effect=[child, {"?column?": 1}])) as ex_one, \
         patch.object(service, "latest_reply_text", AsyncMock(return_value="done")), \
         patch.object(service, "maybe_report_to_master", AsyncMock()) as report:
        await service.on_agent_run_terminal("r1", "completed")
    assert ex_one.await_count == 2
    assert ex_one.await_args_list[1].args[1]["summary"] == "done"
    report.assert_awaited_once_with("a1", "m1")


async def test_unrelated_run_is_ignored():
    with patch.object(service, "execute_one", AsyncMock(side_effect=[None, None])), \
         patch.object(service, "maybe_report_to_master", AsyncMock()) as report:
        await service.on_agent_run_terminal("r1", "completed")
    report.assert_not_awaited()


async def test_master_callback_run_pushes_once_and_flushes_pending():
    run = {"thread_id": "m1", "started_at": None, "metadata": {"source": "master_callback"}, "account_id": "a1"}
    fake_redis = AsyncMock()
    fake_redis.set = AsyncMock(return_value=True)
    with patch.object(service, "execute_one", AsyncMock(side_effect=[None, run])), \
         patch("core.services.redis.set", fake_redis.set), \
         patch.object(service, "_push_master_reply_to_channels", AsyncMock()) as push, \
         patch.object(service, "maybe_report_to_master", AsyncMock()) as report:
        await service.on_agent_run_terminal("r9", "completed")
    push.assert_awaited_once_with("a1", "m1", None)
    report.assert_awaited_once_with("a1", "m1")


async def test_report_deferred_while_master_running():
    with patch.object(service, "_master_has_running_run", AsyncMock(return_value=True)), \
         patch.object(service, "execute_mutate", AsyncMock()) as mutate:
        await service.maybe_report_to_master("a1", "m1")
    mutate.assert_not_awaited()


async def test_report_unclaims_when_run_cannot_start():
    claimed = [{"thread_id": "t1", "project_id": "p1", "title": "x", "execution_target": "cloud",
                "status": "completed", "summary": None}]
    with patch.object(service, "_master_has_running_run", AsyncMock(return_value=False)), \
         patch.object(service, "execute_mutate", AsyncMock(side_effect=[claimed, [{"_rowcount": 1}]])) as mutate, \
         patch("core.agents.api.start_agent_run", AsyncMock(side_effect=RuntimeError("no credits"))):
        await service.maybe_report_to_master("a1", "m1")
    assert mutate.await_count == 2
    assert mutate.await_args_list[1].args[1]["ids"] == ["t1"]


def test_tool_exposes_expected_functions():
    from core.tools.master_assistant_tool import MasterAssistantTool

    names = set(MasterAssistantTool.__dict__)
    for fn in ("start_conversation", "list_conversations", "check_conversation", "send_to_conversation",
               "stop_conversation", "list_local_devices", "list_models", "get_account_status",
               "open_dobby_page", "share_conversation", "list_recent_conversations", "switch_conversation"):
        assert fn in names


@pytest.mark.parametrize("text,expected", [
    ("回到总助理", True),
    ("请回到总助理吧。", True),
    ("切回 Dobby 总助理！", True),
    ("返回助理", True),
    ("回到总助理帮我订机票", False),
    ("总助理你好", False),
])
def test_back_to_master_phrases(text, expected):
    from core.integrations.qq_bot.api import _is_back_to_master

    assert _is_back_to_master(text) is expected


async def test_current_run_channel_detects_qq():
    row = {"metadata": json.dumps({"source": "qq_bot", "qq_user_openid": "oid1"})}
    with patch.object(service, "execute_one", AsyncMock(return_value=row)):
        assert await service.current_run_channel("m1") == {"channel": "qq", "qq_user_openid": "oid1"}
    with patch.object(service, "execute_one", AsyncMock(return_value=None)):
        assert await service.current_run_channel("m1") == {"channel": "web"}


async def test_switch_from_qq_updates_link():
    tid = "11111111-1111-1111-1111-111111111111"
    thread = {"thread_id": tid, "project_id": "p1", "title": "旅行计划"}
    with patch.object(service, "current_run_channel", AsyncMock(return_value={"channel": "qq", "qq_user_openid": "oid1"})), \
         patch.object(service, "_thread_for_account", AsyncMock(return_value=thread)), \
         patch.object(service, "execute_one", AsyncMock(return_value={"?column?": 1})) as ex:
        result = await service.switch_channel_conversation("a1", "m1", tid)
    assert result["switched"] is True and result["title"] == "旅行计划"
    assert ex.await_args.args[1] == {"tid": tid, "openid": "oid1", "aid": "a1"}


async def test_switch_new_from_qq_clears_link():
    with patch.object(service, "current_run_channel", AsyncMock(return_value={"channel": "qq", "qq_user_openid": "oid1"})), \
         patch.object(service, "execute_one", AsyncMock(return_value={"?column?": 1})) as ex:
        result = await service.switch_channel_conversation("a1", "m1", None)
    assert result["new"] is True and result["switched"] is True
    assert ex.await_args.args[1]["tid"] is None


async def test_switch_on_web_only_returns_button():
    tid = "11111111-1111-1111-1111-111111111111"
    thread = {"thread_id": tid, "project_id": "p1", "title": "旅行计划"}
    with patch.object(service, "current_run_channel", AsyncMock(return_value={"channel": "web"})), \
         patch.object(service, "_thread_for_account", AsyncMock(return_value=thread)), \
         patch.object(service, "execute_one", AsyncMock()) as ex:
        result = await service.switch_channel_conversation("a1", "m1", tid)
    assert result["switched"] is False and result["path"] == f"/projects/p1/thread/{tid}"
    ex.assert_not_awaited()


async def test_switch_rejects_unknown_thread():
    with patch.object(service, "current_run_channel", AsyncMock(return_value={"channel": "qq", "qq_user_openid": "o"})), \
         patch.object(service, "_thread_for_account", AsyncMock(return_value=None)):
        with pytest.raises(ValueError):
            await service.switch_channel_conversation("a1", "m1", "11111111-1111-1111-1111-111111111111")
        with pytest.raises(ValueError):
            await service.switch_channel_conversation("a1", "m1", "第2个")


def test_bridge_text_for_master_tools():
    from core.integrations.bridge_reply_format import tool_message_row_to_bridge_text

    def row(name, output):
        return {
            "type": "tool",
            "content": json.dumps({"name": name}),
            "metadata": json.dumps({"function_name": name, "result": {"success": True, "output": json.dumps(output)}}),
        }

    card = tool_message_row_to_bridge_text(row("start_conversation", {
        "title": "调研", "execution_target": "cloud", "status": "running", "url": "https://dobby.now/thread/t1"}))
    assert "调研" in card and "https://dobby.now/thread/t1" in card

    page = tool_message_row_to_bridge_text(row("open_dobby_page", {
        "label": "充值", "url": "https://dobby.now/dashboard?settings=billing"}))
    assert "充值" in page and "settings=billing" in page
