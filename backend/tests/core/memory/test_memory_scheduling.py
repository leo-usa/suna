from unittest.mock import AsyncMock, patch

import pytest

from core.memory.background_jobs import schedule_memory_extraction_for_thread


@pytest.mark.asyncio
async def test_schedule_skips_when_memory_disabled():
    with patch("core.utils.config.config") as mock_config, \
         patch("core.memory.background_jobs.start_memory_extraction") as start:
        mock_config.ENABLE_MEMORY = False
        await schedule_memory_extraction_for_thread("thread-1", "account-1")
        start.assert_not_called()


@pytest.mark.asyncio
async def test_schedule_skips_when_user_disabled_memory():
    with patch("core.utils.config.config") as mock_config, \
         patch("core.threads.repo.get_user_memory_enabled", new_callable=AsyncMock, return_value=False) as user_flag, \
         patch("core.threads.repo.get_thread_memory_enabled", new_callable=AsyncMock) as thread_flag, \
         patch("core.memory.background_jobs.start_memory_extraction") as start:
        mock_config.ENABLE_MEMORY = True
        await schedule_memory_extraction_for_thread("thread-1", "account-1")
        user_flag.assert_awaited_once_with("account-1")
        thread_flag.assert_not_called()
        start.assert_not_called()


@pytest.mark.asyncio
async def test_schedule_starts_extraction_for_recent_messages():
    with patch("core.utils.config.config") as mock_config, \
         patch("core.threads.repo.get_user_memory_enabled", new_callable=AsyncMock, return_value=True), \
         patch("core.threads.repo.get_thread_memory_enabled", new_callable=AsyncMock, return_value=True), \
         patch("core.threads.repo.get_recent_conversation_message_ids", new_callable=AsyncMock, return_value=["m1", "m2"]) as get_ids, \
         patch("core.memory.background_jobs.start_memory_extraction") as start:
        mock_config.ENABLE_MEMORY = True
        await schedule_memory_extraction_for_thread("thread-1", "account-1")
        get_ids.assert_awaited_once_with("thread-1")
        start.assert_called_once_with("thread-1", "account-1", ["m1", "m2"])
