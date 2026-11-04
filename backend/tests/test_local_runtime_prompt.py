from core.local_runner.runtime_prompt import local_runtime_prompt


def test_local_runtime_prompt_lists_missing_python():
    text = local_runtime_prompt({})
    assert "NOT FOUND on this Mac" in text
    assert "python3 -m pip install" in text
    assert "cloud sandbox" in text.lower() or "switch to cloud" in text
    assert "computer_click" in text
    assert "search-first" in text
    assert "agent-desktop is NOT installed" in text
    assert "computer_ui_snapshot" in text
    assert "NOT limited to it on this computer" in text
    assert "I can only access /workspace" in text
    assert "~/Documents/Playground" in text
    assert "Keep `~/...` literal" in text


def test_local_runtime_prompt_home_path_examples_on_windows():
    text = local_runtime_prompt({}, "win32")
    assert r"C:\Users\<you>\Documents\Playground" in text


def test_local_runtime_prompt_includes_detected_home():
    text = local_runtime_prompt({"home": "/Users/leo"})
    assert "This machine's home is `/Users/leo`" in text


def test_local_runtime_prompt_shows_detected_python():
    text = local_runtime_prompt({"python": {"version": "Python 3.11.8", "path": "/opt/homebrew/bin/python3"}})
    assert "Python 3.11.8" in text
    assert "python3: NOT FOUND" not in text


def test_local_runtime_prompt_prefers_ui_tree_when_agent_desktop_present():
    text = local_runtime_prompt({"agent_desktop": {"path": "/usr/local/bin/agent-desktop-darwin-arm64"}})
    assert "agent-desktop IS AVAILABLE" in text
    assert "Prefer accessibility for named controls" in text
    assert "computer_ui_click" in text
    assert "MUST call computer_screenshot" in text
    assert "Do not ask the user to scroll or right-click" in text
    assert "switch BACK" in text
    assert "AUTHORIZED LOCAL FORWARDING" in text
    assert "Do NOT refuse" in text
    assert "agent-desktop is NOT installed" not in text
    assert "agent_desktop:" in text


def test_local_runtime_prompt_uses_ctrl_on_windows():
    text = local_runtime_prompt({}, "win32")
    assert "Windows PC" in text
    assert "NOT FOUND on this Windows PC" in text
    assert "ctrl+c" in text
    assert "Do not send cmd+" in text
    assert "Notepad" in text
    assert "python -m pip install" in text
