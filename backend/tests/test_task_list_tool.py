from unittest.mock import AsyncMock, MagicMock

import pytest

from core.tools.task_list_tool import Section, Task, TaskListTool, TaskStatus


def _tool_with_tasks(*contents: str) -> TaskListTool:
    tool = TaskListTool("proj", MagicMock(), "thread-1")
    section = Section(title="Research")
    tool._sections = [section]
    tool._tasks = [Task(content=content, section_id=section.id) for content in contents]
    tool._loaded = True
    tool._save_data = AsyncMock()
    return tool


@pytest.mark.asyncio
async def test_update_tasks_accepts_in_progress_and_task_id_alias():
    tool = _tool_with_tasks("Clarify scope")
    task = tool._tasks[0]
    result = await tool.update_tasks(task_id=task.id, status="in_progress")
    assert result.success is True
    assert task.status == TaskStatus.IN_PROGRESS
    tool._save_data.assert_awaited_once()


@pytest.mark.asyncio
async def test_update_tasks_resolves_by_content_and_index():
    tool = _tool_with_tasks("Clarify scope", "Write the HTML report")
    by_content = await tool.update_tasks(task_ids="Clarify scope", status="completed")
    assert by_content.success is True
    assert tool._tasks[0].status == TaskStatus.COMPLETED

    by_index = await tool.update_tasks(task_ids="2", status="completed")
    assert by_index.success is True
    assert tool._tasks[1].status == TaskStatus.COMPLETED
