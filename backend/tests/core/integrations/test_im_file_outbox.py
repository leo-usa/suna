from core.integrations.im_file_outbox import channel_should_receive_child_file, child_file_caption


def test_caption_names_the_child_conversation():
    assert child_file_caption("Hello World Word 文件") == "「Hello World Word 文件」已完成，文件在下面。"
    assert "任务" in child_file_caption("  ")


def test_skip_file_push_when_the_chat_is_already_that_conversation():
    child = "5881711a-4f63-4212-913c-ad2d7e6d227f"
    assert channel_should_receive_child_file(None, child)
    assert channel_should_receive_child_file("master-thread", child)
    assert not channel_should_receive_child_file(child, child)
