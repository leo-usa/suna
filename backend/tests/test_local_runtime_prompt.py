from core.local_runner.runtime_prompt import local_runtime_prompt


def test_local_runtime_prompt_lists_missing_python():
    text = local_runtime_prompt({})
    assert "NOT FOUND on this Mac" in text
    assert "python3 -m pip install" in text
    assert "cloud sandbox" in text.lower() or "switch to cloud" in text
    assert "computer_click" in text
    assert "search-first" in text


def test_local_runtime_prompt_shows_detected_python():
    text = local_runtime_prompt({"python": {"version": "Python 3.11.8", "path": "/opt/homebrew/bin/python3"}})
    assert "Python 3.11.8" in text
    assert "python3: NOT FOUND" not in text


def test_local_runtime_prompt_uses_ctrl_on_windows():
    text = local_runtime_prompt({}, "win32")
    assert "Windows PC" in text
    assert "NOT FOUND on this Windows PC" in text
    assert "ctrl+c" in text
    assert "Do not send cmd+" in text
    assert "Notepad" in text
    assert "python -m pip install" in text
