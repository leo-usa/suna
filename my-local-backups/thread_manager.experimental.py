"""
Conversation thread management system for AgentPress.
This module provides comprehensive conversation management, including:
- Thread creation and persistence
- Message handling with support for text and images
- Tool registration and execution
- LLM interaction with streaming support
- Error handling and cleanup
- Context summarization to manage token limits
"""

import uuid
import datetime
from typing import List, Dict, Any, Optional, Type, Union, AsyncGenerator, Literal
import json
from agentpress.tool import Tool
from agentpress.tool_registry import ToolRegistry
from agentpress.response_processor import (
    ResponseProcessor,
    ProcessorConfig
)
from agentpress.context_manager import ContextManager
from services.supabase import DBConnection
from utils.logger import logger
from langfuse.client import StatefulGenerationClient, StatefulTraceClient
from services.langfuse import langfuse
from services.llm import make_llm_api_call
from litellm import token_counter

# Type alias for tool choice
ToolChoice = Literal["auto", "required", "none"]

class ThreadManager:
    """Manages conversation threads with LLM models and tool execution."""

    def __init__(self, trace: Optional[StatefulTraceClient] = None, is_agent_builder: bool = False, target_agent_id: Optional[str] = None):
        """Initialize ThreadManager."""
        self.db = DBConnection()
        self.tool_registry = ToolRegistry()
        self.trace = trace
        self.is_agent_builder = is_agent_builder
        self.target_agent_id = target_agent_id
        if not self.trace:
            self.trace = langfuse.trace(name="anonymous:thread_manager")
        self.response_processor = ResponseProcessor(
            tool_registry=self.tool_registry,
            add_message_callback=self.add_message,
            trace=self.trace,
            is_agent_builder=self.is_agent_builder,
            target_agent_id=self.target_agent_id
        )
        self.context_manager = ContextManager()

    def _is_tool_result_message(self, msg: Dict[str, Any]) -> bool:
        if not ("content" in msg and msg['content']):
            return False
        content = msg['content']
        if isinstance(content, str) and "ToolResult" in content: return True
        if isinstance(content, dict) and "tool_execution" in content: return True
        if isinstance(content, dict) and "interactive_elements" in content: return True
        if isinstance(content, str):
            try:
                parsed_content = json.loads(content)
                if isinstance(parsed_content, dict) and "tool_execution" in parsed_content: return True
                if isinstance(parsed_content, dict) and "interactive_elements" in content: return True
            except (json.JSONDecodeError, TypeError):
                pass
        return False
    
    def _compress_message(self, msg_content: Union[str, dict], message_id: Optional[str] = None, max_length: int = 3000) -> Union[str, dict]:
        """Compress the message content."""
        if isinstance(msg_content, str):
            if len(msg_content) > max_length:
                return f"{msg_content[:max_length]}... (truncated)\\n\\nmessage_id \"{message_id}\"\\nUse expand-message tool to see contents"
            else:
                return msg_content
        elif isinstance(msg_content, dict):
            json_str = json.dumps(msg_content)
            if len(json_str) > max_length:
                return f"{json_str[:max_length]}... (truncated)\\n\\nmessage_id \"{message_id}\"\\nUse expand-message tool to see contents"
            else:
                return msg_content
        return msg_content
        
    def _safe_truncate(self, msg_content: Union[str, dict], max_length: int = 100000) -> Union[str, dict]:
        """Truncate the message content safely by removing the middle portion."""
        max_length = min(max_length, 100000)
        if isinstance(msg_content, str):
            if len(msg_content) > max_length:
                keep_length = max_length - 150
                start_length = keep_length // 2
                end_length = keep_length - start_length
                start_part = msg_content[:start_length]
                end_part = msg_content[-end_length:] if end_length > 0 else ""
                return f"{start_part}\\n\\n... (middle truncated) ...\\n\\n{end_part}\\n\\nThis message is too long, repeat relevant information in your response to remember it"
            else:
                return msg_content
        elif isinstance(msg_content, dict):
            json_str = json.dumps(msg_content)
            if len(json_str) > max_length:
                keep_length = max_length - 150
                start_length = keep_length // 2
                end_length = keep_length - start_length
                start_part = json_str[:start_length]
                end_part = json_str[-end_length:] if end_length > 0 else ""
                return f"{start_part}\\n\\n... (middle truncated) ...\\n\\n{end_part}\\n\\nThis message is too long, repeat relevant information in your response to remember it"
            else:
                return msg_content
        return msg_content
  
    def _compress_tool_result_messages(self, messages: List[Dict[str, Any]], llm_model: str, max_tokens: Optional[int], token_threshold: Optional[int] = 1000) -> List[Dict[str, Any]]:
        """Compress the tool result messages except the most recent one."""
        uncompressed_total_token_count = token_counter(model=llm_model, messages=messages)
        if uncompressed_total_token_count > (max_tokens or (100 * 1000)):
            _i = 0
            for msg in reversed(messages):
                if self._is_tool_result_message(msg):
                    _i += 1
                    msg_token_count = token_counter(messages=[msg])
                    if msg_token_count > token_threshold:
                        if _i > 1:
                            message_id = msg.get('message_id')
                            if message_id:
                                msg["content"] = self._compress_message(msg["content"], message_id, token_threshold * 3)
                            else:
                                logger.warning(f"UNEXPECTED: Message has no message_id {str(msg)[:100]}")
                        else:
                            msg["content"] = self._safe_truncate(msg["content"], int(max_tokens * 2))
        return messages

    def _compress_user_messages(self, messages: List[Dict[str, Any]], llm_model: str, max_tokens: Optional[int], token_threshold: Optional[int] = 1000) -> List[Dict[str, Any]]:
        """Compress the user messages except the most recent one."""
        uncompressed_total_token_count = token_counter(model=llm_model, messages=messages)
        if uncompressed_total_token_count > (max_tokens or (100 * 1000)):
            _i = 0
            for msg in reversed(messages):
                if msg.get('role') == 'user':
                    _i += 1
                    msg_token_count = token_counter(messages=[msg])
                    if msg_token_count > token_threshold:
                        if _i > 1:
                            message_id = msg.get('message_id')
                            if message_id:
                                msg["content"] = self._compress_message(msg["content"], message_id, token_threshold * 3)
                            else:
                                logger.warning(f"UNEXPECTED: Message has no message_id {str(msg)[:100]}")
                        else:
                            msg["content"] = self._safe_truncate(msg["content"], int(max_tokens * 2))
        return messages

    def _compress_assistant_messages(self, messages: List[Dict[str, Any]], llm_model: str, max_tokens: Optional[int], token_threshold: Optional[int] = 1000) -> List[Dict[str, Any]]:
        """Compress the assistant messages except the most recent one."""
        uncompressed_total_token_count = token_counter(model=llm_model, messages=messages)
        if uncompressed_total_token_count > (max_tokens or (100 * 1000)):
            _i = 0
            for msg in reversed(messages):
                if msg.get('role') == 'assistant':
                    _i += 1
                    msg_token_count = token_counter(messages=[msg])
                    if msg_token_count > token_threshold:
                        if _i > 1:
                            message_id = msg.get('message_id')
                            if message_id:
                                msg["content"] = self._compress_message(msg["content"], message_id, token_threshold * 3)
                            else:
                                logger.warning(f"UNEXPECTED: Message has no message_id {str(msg)[:100]}")
                        else:
                            msg["content"] = self._safe_truncate(msg["content"], int(max_tokens * 2))
        return messages

    def _remove_meta_messages(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Remove meta messages from the messages."""
        result: List[Dict[str, Any]] = []
        for msg in messages:
            msg_content = msg.get('content')
            if isinstance(msg_content, str):
                try: msg_content = json.loads(msg_content)
                except json.JSONDecodeError: pass
            if isinstance(msg_content, dict):
                msg_content_copy = msg_content.copy()
                if "tool_execution" in msg_content_copy:
                    tool_execution = msg_content_copy["tool_execution"].copy()
                    if "arguments" in tool_execution:
                        del tool_execution["arguments"]
                    msg_content_copy["tool_execution"] = tool_execution
                new_msg = msg.copy()
                new_msg["content"] = json.dumps(msg_content_copy)
                result.append(new_msg)
            else:
                result.append(msg)
        return result

    def _compress_messages(self, messages: List[Dict[str, Any]], llm_model: str, max_tokens: Optional[int] = 41000, token_threshold: Optional[int] = 4096, max_iterations: int = 5) -> List[Dict[str, Any]]:
        """Compress the messages."""
        if 'sonnet' in llm_model.lower():
            max_tokens = 200 * 1000 - 64000 - 28000
        elif 'gpt' in llm_model.lower():
            max_tokens = 128 * 1000 - 28000
        elif 'gemini' in llm_model.lower():
            max_tokens = 1000 * 1000 - 300000
        elif 'deepseek' in llm_model.lower():
            max_tokens = 128 * 1000 - 28000
        else:
            max_tokens = 41 * 1000 - 10000

        result = messages
        result = self._remove_meta_messages(result)
        result = self._compress_tool_result_messages(result, llm_model, max_tokens, token_threshold)
        result = self._compress_user_messages(result, llm_model, max_tokens, token_threshold)
        result = self._compress_assistant_messages(result, llm_model, max_tokens, token_threshold)

        return result

    def add_tool(self, tool_class: Type[Tool], function_names: Optional[List[str]] = None, **kwargs):
        self.tool_registry.register_tool(tool_class, function_names, **kwargs)

    async def add_message(
        self,
        thread_id: str,
        type: str,
        content: Union[Dict[str, Any], List[Any], str],
        is_llm_message: bool = False,
        metadata: Optional[Dict[str, Any]] = None
    ):
        client = await self.db.client
        message_id = str(uuid.uuid4())
        
        role = "user" if type == "user" else "assistant" if type == "assistant" else "tool"

        message_content = {"role": role, "content": content}
        
        insert_data = {
            "message_id": message_id,
            "thread_id": thread_id,
            "type": type,
            "is_llm_message": is_llm_message,
            "content": json.dumps(message_content),
            "created_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "metadata": metadata
        }
        await client.table('messages').insert(insert_data).execute()
        return message_id

    async def get_llm_messages(self, thread_id: str) -> List[Dict[str, Any]]:
        """Retrieve and format messages for the LLM."""
        client = await self.db.client
        messages_res = await client.table('messages').select('*').eq('thread_id', thread_id).order('created_at').execute()
        
        llm_messages = []
        for msg in messages_res.data:
            if msg.get('is_llm_message'):
                try:
                    content_data = json.loads(msg['content'])
                    if isinstance(content_data, dict):
                         llm_messages.append(content_data)
                    else:
                        llm_messages.append({"role": "user", "content": str(content_data)})
                except (json.JSONDecodeError, TypeError):
                    llm_messages.append({"role": "user", "content": msg['content']})
        return llm_messages

    async def run(
        self,
        thread_id: str,
        system_prompt: Dict[str, Any],
        stream: bool = True,
        temporary_message: Optional[Dict[str, Any]] = None,
        llm_model: str = "gpt-4o",
        llm_temperature: float = 0,
        llm_max_tokens: Optional[int] = None,
        processor_config: Optional[ProcessorConfig] = None,
        tool_choice: ToolChoice = "auto",
        native_max_auto_continues: int = 25,
        max_xml_tool_calls: int = 0,
        include_xml_examples: bool = False,
        enable_thinking: Optional[bool] = False,
        reasoning_effort: Optional[str] = 'low',
        enable_context_manager: bool = True,
        generation: Optional[StatefulGenerationClient] = None,
    ) -> Union[Dict[str, Any], AsyncGenerator]:
        
        if not processor_config:
            processor_config = ProcessorConfig()

        async def _run_once(temp_msg=None):
            nonlocal processor_config
            
            messages = await self.get_llm_messages(thread_id)
            if temp_msg:
                messages.append(temp_msg)
            
            prepared_messages = self.context_manager.prepare_messages(
                system_prompt=system_prompt,
                messages=messages,
                tools=self.tool_registry.get_tools_schema(include_xml_examples),
                tool_choice=tool_choice
            )
            
            prepared_messages = self._compress_messages(prepared_messages, llm_model)

            try:
                response = await make_llm_api_call(
                    messages=prepared_messages,
                    model_name=llm_model,
                    temperature=llm_temperature,
                    max_tokens=llm_max_tokens,
                    stream=stream,
                    generation=generation,
                    thread_id=thread_id
                )
                return response
            except Exception as e:
                logger.error(f"Error in LLM API call: {e}")
                raise

        async def auto_continue_wrapper():
            num_auto_continues = 0
            while num_auto_continues < native_max_auto_continues:
                response = await _run_once()
                if stream:
                    is_tool_call, final_chunk = False, None
                    async for chunk in self.response_processor.process_stream(
                        response,
                        processor_config
                    ):
                        if chunk.get("type") == "tool_calls":
                            is_tool_call = True
                        final_chunk = chunk
                        yield chunk
                    if not is_tool_call:
                        break
                else:
                    processed_response = await self.response_processor.process_response(
                        response,
                        processor_config
                    )
                    yield processed_response
                    if not processed_response.get("tool_calls"):
                        break
                num_auto_continues += 1
                if num_auto_continues >= native_max_auto_continues:
                    logger.warning("Max auto-continues reached.")

        if stream:
            return auto_continue_wrapper()
        else:
            return await auto_continue_wrapper().__anext__() 