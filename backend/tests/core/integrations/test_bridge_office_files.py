import json

from core.integrations.bridge_office_files import office_paths_from_turn, workspace_office_path


def _row(message_type, created_at, content, metadata=None):
    return {
        "type": message_type,
        "created_at": created_at,
        "updated_at": created_at,
        "content": content,
        "metadata": metadata or {},
    }


def test_workspace_office_path_accepts_workspace_files():
    assert workspace_office_path("/workspace/预算.xlsx") == "预算.xlsx"
    assert workspace_office_path("reports/季度.pptx") == "reports/季度.pptx"
    assert workspace_office_path("slides/slide_01.html") is None
    assert workspace_office_path("/workspace/../secret.pdf") is None
    assert workspace_office_path("https://example.com/a.pdf") is None


def test_office_paths_prefer_this_turn_attachments():
    rows = [
        _row("user", "2026-10-25T00:00:00+00:00", {"content": "请看 old.pdf"}),
        _row(
            "assistant",
            "2026-10-25T00:01:00+00:00",
            {
                "content": "先看 https://example.com/remote.pdf",
                "tool_calls": [
                    {
                        "function": {
                            "name": "complete",
                            "arguments": json.dumps(
                                {
                                    "text": "做好了",
                                    "attachments": [
                                        "/workspace/预算.xlsx",
                                        "slides/slide_01.html",
                                        "notes/说明.docx",
                                    ],
                                }
                            ),
                        }
                    }
                ],
            },
        ),
        _row("tool", "2026-10-25T00:02:00+00:00", "Created: /workspace/out/报告.pdf"),
    ]
    assert office_paths_from_turn(rows, "2026-10-25T00:00:30+00:00", "请看 old.pdf") == [
        "预算.xlsx",
        "notes/说明.docx",
        "out/报告.pdf",
    ]


def test_office_paths_keep_three_attachments_ahead_of_mentions():
    rows = [
        _row("user", "2026-10-25T00:00:00+00:00", {"content": "做文件"}),
        _row(
            "assistant",
            "2026-10-25T00:01:00+00:00",
            {
                "content": "另外还有 extra.pdf",
                "tool_calls": [
                    {
                        "function": {
                            "name": "complete",
                            "arguments": {
                                "attachments": ["a.pptx", "b.docx", "c.xlsx", "d.pdf"],
                            },
                        }
                    }
                ],
            },
        ),
    ]
    assert office_paths_from_turn(rows, None, "做文件") == ["a.pptx", "b.docx", "c.xlsx"]
