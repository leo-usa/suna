from core.integrations.bridge_thread_commands import (
    _build_list_reply,
    append_where_line,
    parse_navigation,
    where_line_for,
)


def test_where_line_names_master_or_project():
    assert where_line_for(is_master=True) == "现在：总助理"
    assert where_line_for(is_master=False, title="") == "现在：总助理"
    assert where_line_for(is_master=False, title="Hello World") == "现在：Hello World · 发 /master 回总助理"


def test_where_line_is_not_repeated():
    line = "现在：总助理"
    assert append_where_line(f"好的\n\n{line}", line) == f"好的\n\n{line}"
    assert append_where_line("现在：总助理", "现在：另一个") == "现在：总助理"


def test_navigation_phrases():
    assert parse_navigation("回到总助理") == {"command": "/master"}
    assert parse_navigation("0") == {"command": "/master"}
    assert parse_navigation("切进去") == {"command": "/enter"}
    assert parse_navigation("2") == {"command": "/use 2"}
    assert parse_navigation("第 3 个") == {"command": "/use 3"}
    assert parse_navigation("切到那个 PPT") == {"title": "ppt"}
    assert parse_navigation("帮我做一份报告") is None
    assert parse_navigation("/list") is None


def test_list_reply_uses_numbers_and_callback_buttons():
    threads = [
        {"thread_id": "t1", "name": "New Chat", "project": {"name": "季度报告"}, "updated_at": None},
    ]
    reply, markup = _build_list_reply(
        threads,
        active_thread_id="t1",
        page=1,
        total=1,
        frontend_url="https://dobby.now",
    )
    assert "季度报告" in reply
    assert "回复编号进入" in reply
    assert "回复 0 回总助理" in reply
    buttons = markup["inline_keyboard"]
    assert buttons[0][0]["callback_data"] == "use:1"
    assert buttons[-1][0]["callback_data"] == "master"
