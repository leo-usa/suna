from core.local_runner.runtime_prompt import local_runtime_prompt


def test_local_runtime_prompt_lists_missing_python():
    text = local_runtime_prompt({})
    assert "NOT FOUND on this Mac" in text
    assert "python3 -m pip install" in text
    assert "cloud sandbox" in text.lower() or "switch to cloud" in text


def test_local_runtime_prompt_shows_detected_python():
    text = local_runtime_prompt({"python": {"version": "Python 3.11.8", "path": "/opt/homebrew/bin/python3"}})
    assert "Python 3.11.8" in text
    assert "python3: NOT FOUND" not in text
