from core.agentpress.prompt_caching import mark_stable_conversation_prefix


def _marked(message):
    content = message.get("content")
    if isinstance(content, list):
        return any(isinstance(block, dict) and block.get("cache_control") for block in content)
    return False


def test_first_turn_has_no_second_marker():
    messages = [
        {"role": "system", "content": "You are Dobby."},
        {"role": "user", "content": "Hello"},
    ]
    assert mark_stable_conversation_prefix(messages) is messages


def test_new_user_message_stays_after_the_marker():
    messages = [
        {"role": "system", "content": "You are Dobby."},
        {"role": "user", "content": "Make a file"},
        {"role": "assistant", "content": "Done."},
        {"role": "user", "content": "Now change it"},
    ]
    marked = mark_stable_conversation_prefix(messages)
    assert _marked(marked[2])
    assert not _marked(marked[3])
    assert marked[3]["content"] == "Now change it"


def test_trailing_tool_results_stay_after_the_marker():
    messages = [
        {"role": "system", "content": "You are Dobby."},
        {"role": "user", "content": "Click the button"},
        {"role": "assistant", "content": "Clicking."},
        {"role": "tool", "tool_call_id": "t1", "content": "old screenshot"},
        {"role": "tool", "tool_call_id": "t2", "content": "new screenshot"},
    ]
    marked = mark_stable_conversation_prefix(messages)
    assert _marked(marked[2])
    assert not _marked(marked[3])
    assert not _marked(marked[4])
