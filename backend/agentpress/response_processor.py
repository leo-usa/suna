"""
LLM Response Processor for AgentPress.

This module handles processing of LLM responses including:
- Parsing of content for both streaming and non-streaming responses
- Detection and extraction of tool calls (both XML-based and native function calling)
- Tool execution with different strategies
- Adding tool results back to the conversation thread
"""

import json
import asyncio
import re
import uuid
from typing import List, Dict, Any, Optional, Tuple, AsyncGenerator, Callable, Union, Literal
from dataclasses import dataclass
from datetime import datetime, timezone

from litellm import completion_cost, token_counter

from agentpress.tool import Tool, ToolResult
from agentpress.tool_registry import ToolRegistry
from utils.logger import logger

# Type alias for XML result adding strategy
XmlAddingStrategy = Literal["user_message", "assistant_message", "inline_edit"]

# Type alias for tool execution strategy
ToolExecutionStrategy = Literal["sequential", "parallel"]

@dataclass
class ToolExecutionContext:
    """Context for a tool execution including call details, result, and display info."""
    tool_call: Dict[str, Any]
    tool_index: int
    result: Optional[ToolResult] = None
    function_name: Optional[str] = None
    xml_tag_name: Optional[str] = None
    error: Optional[Exception] = None
    assistant_message_id: Optional[str] = None
    parsing_details: Optional[Dict[str, Any]] = None

@dataclass
class ProcessorConfig:
    """
    Configuration for response processing and tool execution.
    
    This class controls how the LLM's responses are processed, including how tool calls
    are detected, executed, and their results handled.
    
    Attributes:
        xml_tool_calling: Enable XML-based tool call detection (<tool>...</tool>)
        native_tool_calling: Enable OpenAI-style function calling format
        execute_tools: Whether to automatically execute detected tool calls
        execute_on_stream: For streaming, execute tools as they appear vs. at the end
        tool_execution_strategy: How to execute multiple tools ("sequential" or "parallel")
        xml_adding_strategy: How to add XML tool results to the conversation
        max_xml_tool_calls: Maximum number of XML tool calls to process (0 = no limit)
    """

    xml_tool_calling: bool = True  
    native_tool_calling: bool = False

    execute_tools: bool = True
    execute_on_stream: bool = False
    tool_execution_strategy: ToolExecutionStrategy = "sequential"
    xml_adding_strategy: XmlAddingStrategy = "assistant_message"
    max_xml_tool_calls: int = 0  # 0 means no limit
    
    def __post_init__(self):
        """Validate configuration after initialization."""
        if self.xml_tool_calling is False and self.native_tool_calling is False and self.execute_tools:
            raise ValueError("At least one tool calling format (XML or native) must be enabled if execute_tools is True")
            
        if self.xml_adding_strategy not in ["user_message", "assistant_message", "inline_edit"]:
            raise ValueError("xml_adding_strategy must be 'user_message', 'assistant_message', or 'inline_edit'")
        
        if self.max_xml_tool_calls < 0:
            raise ValueError("max_xml_tool_calls must be a non-negative integer (0 = no limit)")

class ResponseProcessor:
    """Processes LLM responses, extracting and executing tool calls."""
    
    def __init__(self, tool_registry: ToolRegistry, add_message_callback: Callable):
        """Initialize the ResponseProcessor.
        
        Args:
            tool_registry: Registry of available tools
            add_message_callback: Callback function to add messages to the thread.
                MUST return the full saved message object (dict) or None.
        """
        self.tool_registry = tool_registry
        self.add_message = add_message_callback
        
    async def process_streaming_response(
        self,
        llm_response: AsyncGenerator,
        thread_id: str,
        prompt_messages: List[Dict[str, Any]],
        llm_model: str,
        config: ProcessorConfig = ProcessorConfig(),
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Process a streaming LLM response, handling tool calls and execution.
        
        Args:
            llm_response: Streaming response from the LLM
            thread_id: ID of the conversation thread
            prompt_messages: List of messages sent to the LLM (the prompt)
            llm_model: The name of the LLM model used
            config: Configuration for parsing and execution
            
        Yields:
            Complete message objects matching the DB schema, except for content chunks.
        """
        accumulated_content = ""
        tool_calls_buffer = {}
        current_xml_content = ""
        xml_chunks_buffer = []
        pending_tool_executions = []
        yielded_tool_indices = set() # Stores indices of tools whose *status* has been yielded
        tool_index = 0
        xml_tool_call_count = 0
        finish_reason = None
        last_assistant_message_object = None # Store the final saved assistant message object
        tool_result_message_objects = {} # tool_index -> full saved message object
        has_printed_thinking_prefix = False # Flag for printing thinking prefix only once

        logger.info(f"Streaming Config: XML={config.xml_tool_calling}, Native={config.native_tool_calling}, "
                   f"Execute on stream={config.execute_on_stream}, Strategy={config.tool_execution_strategy}")

        thread_run_id = str(uuid.uuid4())

        try:
            # --- Save and Yield Start Events ---
            start_content = {"status_type": "thread_run_start", "thread_run_id": thread_run_id}
            start_msg_obj = await self.add_message(
                thread_id=thread_id, type="status", content=start_content, 
                is_llm_message=False, metadata={"thread_run_id": thread_run_id}
            )
            if start_msg_obj: yield start_msg_obj

            assist_start_content = {"status_type": "assistant_response_start"}
            assist_start_msg_obj = await self.add_message(
                thread_id=thread_id, type="status", content=assist_start_content, 
                is_llm_message=False, metadata={"thread_run_id": thread_run_id}
            )
            if assist_start_msg_obj: yield assist_start_msg_obj
            # --- End Start Events ---

            async for chunk in llm_response:
                if hasattr(chunk, 'choices') and chunk.choices and hasattr(chunk.choices[0], 'finish_reason') and chunk.choices[0].finish_reason:
                    finish_reason = chunk.choices[0].finish_reason
                    logger.debug(f"Detected finish_reason: {finish_reason}")

                if hasattr(chunk, 'choices') and chunk.choices:
                    delta = chunk.choices[0].delta if hasattr(chunk.choices[0], 'delta') else None
                    
                    # Check for and log Anthropic thinking content
                    if delta and hasattr(delta, 'reasoning_content') and delta.reasoning_content:
                        if not has_printed_thinking_prefix:
                            # print("[THINKING]: ", end='', flush=True)
                            has_printed_thinking_prefix = True
                        # print(delta.reasoning_content, end='', flush=True)
                        # Append reasoning to main content to be saved in the final message
                        accumulated_content += delta.reasoning_content

                    # Process content chunk
                    if delta and hasattr(delta, 'content') and delta.content:
                        chunk_content = delta.content
                        # print(chunk_content, end='', flush=True)
                        accumulated_content += chunk_content
                        current_xml_content += chunk_content

                        if not (config.max_xml_tool_calls > 0 and xml_tool_call_count >= config.max_xml_tool_calls):
                            # Yield ONLY content chunk (don't save)
                            now_chunk = datetime.now(timezone.utc).isoformat()
                            yield {
                                "message_id": None, "thread_id": thread_id, "type": "assistant",
                                "is_llm_message": True,
                                "content": json.dumps({"role": "assistant", "content": chunk_content}),
                                "metadata": json.dumps({"stream_status": "chunk", "thread_run_id": thread_run_id}),
                                "created_at": now_chunk, "updated_at": now_chunk
                            }
                        else:
                            logger.info("XML tool call limit reached - not yielding more content chunks")

                        # --- Process XML Tool Calls (if enabled and limit not reached) ---
                        if config.xml_tool_calling and not (config.max_xml_tool_calls > 0 and xml_tool_call_count >= config.max_xml_tool_calls):
                            xml_chunks = self._extract_xml_chunks(current_xml_content)
                            for xml_chunk in xml_chunks:
                                current_xml_content = current_xml_content.replace(xml_chunk, "", 1)
                                xml_chunks_buffer.append(xml_chunk)
                                result = self._parse_xml_tool_call(xml_chunk)
                                if result:
                                    tool_call, parsing_details = result
                                    xml_tool_call_count += 1
                                    current_assistant_id = last_assistant_message_object['message_id'] if last_assistant_message_object else None
                                    context = self._create_tool_context(
                                        tool_call, tool_index, current_assistant_id, parsing_details
                                    )

                                    if config.execute_tools and config.execute_on_stream:
                                        # Save and Yield tool_started status
                                        started_msg_obj = await self._yield_and_save_tool_started(context, thread_id, thread_run_id)
                                        if started_msg_obj: yield started_msg_obj
                                        yielded_tool_indices.add(tool_index) # Mark status as yielded

                                        execution_task = asyncio.create_task(self._execute_tool(tool_call))
                                        pending_tool_executions.append({
                                            "task": execution_task, "tool_call": tool_call,
                                            "tool_index": tool_index, "context": context
                                        })
                                        tool_index += 1

                                    if config.max_xml_tool_calls > 0 and xml_tool_call_count >= config.max_xml_tool_calls:
                                        logger.debug(f"Reached XML tool call limit ({config.max_xml_tool_calls})")
                                        finish_reason = "xml_tool_limit_reached"
                                        break # Stop processing more XML chunks in this delta

                    # --- Process Native Tool Call Chunks ---
                    if config.native_tool_calling and delta and hasattr(delta, 'tool_calls') and delta.tool_calls:
                        for tool_call_chunk in delta.tool_calls:
                            # Yield Native Tool Call Chunk (transient status, not saved)
                            # ... (safe extraction logic for tool_call_data_chunk) ...
                            tool_call_data_chunk = {} # Placeholder for extracted data
                            if hasattr(tool_call_chunk, 'model_dump'): tool_call_data_chunk = tool_call_chunk.model_dump()
                            else: # Manual extraction...
                                if hasattr(tool_call_chunk, 'id'): tool_call_data_chunk['id'] = tool_call_chunk.id
                                if hasattr(tool_call_chunk, 'index'): tool_call_data_chunk['index'] = tool_call_chunk.index
                                if hasattr(tool_call_chunk, 'type'): tool_call_data_chunk['type'] = tool_call_chunk.type
                                if hasattr(tool_call_chunk, 'function'):
                                    tool_call_data_chunk['function'] = {}
                                    if hasattr(tool_call_chunk.function, 'name'): tool_call_data_chunk['function']['name'] = tool_call_chunk.function.name
                                    if hasattr(tool_call_chunk.function, 'arguments'): tool_call_data_chunk['function']['arguments'] = tool_call.function.arguments


                            now_tool_chunk = datetime.now(timezone.utc).isoformat()
                            yield {
                                "message_id": None, "thread_id": thread_id, "type": "status", "is_llm_message": True,
                                "content": json.dumps({"role": "assistant", "status_type": "tool_call_chunk", "tool_call_chunk": tool_call_data_chunk}),
                                "metadata": json.dumps({"thread_run_id": thread_run_id}),
                                "created_at": now_tool_chunk, "updated_at": now_tool_chunk
                            }

                            # --- Buffer and Execute Complete Native Tool Calls ---
                            if not hasattr(tool_call_chunk, 'function'): continue
                            idx = tool_call_chunk.index if hasattr(tool_call_chunk, 'index') else 0
                            # ... (buffer update logic remains same) ...
                            # ... (check complete logic remains same) ...
                            has_complete_tool_call = False # Placeholder
                            if (tool_calls_buffer.get(idx) and
                                tool_calls_buffer[idx]['id'] and
                                tool_calls_buffer[idx]['function']['name'] and
                                tool_calls_buffer[idx]['function']['arguments']):
                                try:
                                    json.loads(tool_calls_buffer[idx]['function']['arguments'])
                                    has_complete_tool_call = True
                                except json.JSONDecodeError: pass


                            if has_complete_tool_call and config.execute_tools and config.execute_on_stream:
                                current_tool = tool_calls_buffer[idx]
                                tool_call_data = {
                                    "function_name": current_tool['function']['name'],
                                    "arguments": json.loads(current_tool['function']['arguments']),
                                    "id": current_tool['id']
                                }
                                current_assistant_id = last_assistant_message_object['message_id'] if last_assistant_message_object else None
                                context = self._create_tool_context(
                                    tool_call_data, tool_index, current_assistant_id
                                )

                                # Save and Yield tool_started status
                                started_msg_obj = await self._yield_and_save_tool_started(context, thread_id, thread_run_id)
                                if started_msg_obj: yield started_msg_obj
                                yielded_tool_indices.add(tool_index) # Mark status as yielded

                                execution_task = asyncio.create_task(self._execute_tool(tool_call_data))
                                pending_tool_executions.append({
                                    "task": execution_task, "tool_call": tool_call_data,
                                    "tool_index": tool_index, "context": context
                                })
                                tool_index += 1

                if finish_reason == "xml_tool_limit_reached":
                    logger.info("Stopping stream processing after loop due to XML tool call limit")
                    break

            # print() # Add a final newline after the streaming loop finishes

            # --- After Streaming Loop ---

            # Wait for pending tool executions from streaming phase
            tool_results_buffer = [] # Stores (tool_call, result, tool_index, context)
            if pending_tool_executions:
                logger.info(f"Waiting for {len(pending_tool_executions)} pending streamed tool executions")
                # ... (asyncio.wait logic) ...
                pending_tasks = [execution["task"] for execution in pending_tool_executions]
                done, _ = await asyncio.wait(pending_tasks)

                for execution in pending_tool_executions:
                    tool_idx = execution.get("tool_index", -1)
                    context = execution["context"]
                    # Check if status was already yielded during stream run
                    if tool_idx in yielded_tool_indices:
                         logger.debug(f"Status for tool index {tool_idx} already yielded.")
                         # Still need to process the result for the buffer
                         try:
                             if execution["task"].done():
                                 result = execution["task"].result()
                                 context.result = result
                                 tool_results_buffer.append((execution["tool_call"], result, tool_idx, context))
                             else: # Should not happen with asyncio.wait
                                logger.warning(f"Task for tool index {tool_idx} not done after wait.")
                         except Exception as e:
                             logger.error(f"Error getting result for pending tool execution {tool_idx}: {str(e)}")
                             context.error = e
                             # Save and Yield tool error status message (even if started was yielded)
                             error_msg_obj = await self._yield_and_save_tool_error(context, thread_id, thread_run_id)
                             if error_msg_obj: yield error_msg_obj
                         continue # Skip further status yielding for this tool index

                    # If status wasn't yielded before (shouldn't happen with current logic), yield it now
                    try:
                        if execution["task"].done():
                            result = execution["task"].result()
                            context.result = result
                            tool_results_buffer.append((execution["tool_call"], result, tool_idx, context))
                            # Save and Yield tool completed/failed status
                            completed_msg_obj = await self._yield_and_save_tool_completed(
                                context, None, thread_id, thread_run_id
                            )
                            if completed_msg_obj: yield completed_msg_obj
                            yielded_tool_indices.add(tool_idx)
                    except Exception as e:
                        logger.error(f"Error getting result/yielding status for pending tool execution {tool_idx}: {str(e)}")
                        context.error = e
                        # Save and Yield tool error status
                        error_msg_obj = await self._yield_and_save_tool_error(context, thread_id, thread_run_id)
                        if error_msg_obj: yield error_msg_obj
                        yielded_tool_indices.add(tool_idx)


            # Save and yield finish status if limit was reached
            if finish_reason == "xml_tool_limit_reached":
                finish_content = {"status_type": "finish", "finish_reason": "xml_tool_limit_reached"}
                finish_msg_obj = await self.add_message(
                    thread_id=thread_id, type="status", content=finish_content, 
                    is_llm_message=False, metadata={"thread_run_id": thread_run_id}
                )
                if finish_msg_obj: yield finish_msg_obj
                logger.info(f"Stream finished with reason: xml_tool_limit_reached after {xml_tool_call_count} XML tool calls")

            # --- SAVE and YIELD Final Assistant Message ---
            if accumulated_content:
                # ... (Truncate accumulated_content logic) ...
                if config.max_xml_tool_calls > 0 and xml_tool_call_count >= config.max_xml_tool_calls and xml_chunks_buffer:
                    last_xml_chunk = xml_chunks_buffer[-1]
                    last_chunk_end_pos = accumulated_content.find(last_xml_chunk) + len(last_xml_chunk)
                    if last_chunk_end_pos > 0:
                        accumulated_content = accumulated_content[:last_chunk_end_pos]

                # ... (Extract complete_native_tool_calls logic) ...
                complete_native_tool_calls = []
                if config.native_tool_calling:
                    for idx, tc_buf in tool_calls_buffer.items():
                        if tc_buf['id'] and tc_buf['function']['name'] and tc_buf['function']['arguments']:
                            try:
                                args = json.loads(tc_buf['function']['arguments'])
                                complete_native_tool_calls.append({
                                    "id": tc_buf['id'], "type": "function",
                                    "function": {"name": tc_buf['function']['name'],"arguments": args}
                                })
                            except json.JSONDecodeError: continue

                message_data = { # Dict to be saved in 'content'
                    "role": "assistant", "content": accumulated_content,
                    "tool_calls": complete_native_tool_calls or None
                }

                last_assistant_message_object = await self.add_message(
                    thread_id=thread_id, type="assistant", content=message_data,
                    is_llm_message=True, metadata={"thread_run_id": thread_run_id}
                )

                if last_assistant_message_object:
                    # Yield the complete saved object, adding stream_status metadata just for yield
                    yield_metadata = json.loads(last_assistant_message_object.get('metadata', '{}'))
                    yield_metadata['stream_status'] = 'complete'
                    yield {**last_assistant_message_object, 'metadata': json.dumps(yield_metadata)}
                else:
                    logger.error(f"Failed to save final assistant message for thread {thread_id}")
                    # Save and yield an error status
                    err_content = {"role": "system", "status_type": "error", "message": "Failed to save final assistant message"}
                    err_msg_obj = await self.add_message(
                        thread_id=thread_id, type="status", content=err_content, 
                        is_llm_message=False, metadata={"thread_run_id": thread_run_id}
                    )
                    if err_msg_obj: yield err_msg_obj

            # --- Process All Tool Results Now ---
            if config.execute_tools:
                final_tool_calls_to_process = []
                # ... (Gather final_tool_calls_to_process from native and XML buffers) ...
                 # Gather native tool calls from buffer
                if config.native_tool_calling and complete_native_tool_calls:
                    for tc in complete_native_tool_calls:
                        final_tool_calls_to_process.append({
                            "function_name": tc["function"]["name"],
                            "arguments": tc["function"]["arguments"], # Already parsed object
                            "id": tc["id"]
                        })
                 # Gather XML tool calls from buffer (up to limit)
                parsed_xml_data = []
                if config.xml_tool_calling:
                    # Reparse remaining content just in case (should be empty if processed correctly)
                    xml_chunks = self._extract_xml_chunks(current_xml_content)
                    xml_chunks_buffer.extend(xml_chunks)
                    # Process only chunks not already handled in the stream loop
                    remaining_limit = config.max_xml_tool_calls - xml_tool_call_count if config.max_xml_tool_calls > 0 else len(xml_chunks_buffer)
                    xml_chunks_to_process = xml_chunks_buffer[:remaining_limit] # Ensure limit is respected

                    for chunk in xml_chunks_to_process:
                         parsed_result = self._parse_xml_tool_call(chunk)
                         if parsed_result:
                             tool_call, parsing_details = parsed_result
                             # Avoid adding if already processed during streaming
                             if not any(exec['tool_call'] == tool_call for exec in pending_tool_executions):
                                 final_tool_calls_to_process.append(tool_call)
                                 parsed_xml_data.append({'tool_call': tool_call, 'parsing_details': parsing_details})


                all_tool_data_map = {} # tool_index -> {'tool_call': ..., 'parsing_details': ...}
                 # Add native tool data
                native_tool_index = 0
                if config.native_tool_calling and complete_native_tool_calls:
                     for tc in complete_native_tool_calls:
                         # Find the corresponding entry in final_tool_calls_to_process if needed
                         # For now, assume order matches if only native used
                         exec_tool_call = {
                             "function_name": tc["function"]["name"],
                             "arguments": tc["function"]["arguments"],
                             "id": tc["id"]
                         }
                         all_tool_data_map[native_tool_index] = {"tool_call": exec_tool_call, "parsing_details": None}
                         native_tool_index += 1

                 # Add XML tool data
                xml_tool_index_start = native_tool_index
                for idx, item in enumerate(parsed_xml_data):
                    all_tool_data_map[xml_tool_index_start + idx] = item


                tool_results_map = {} # tool_index -> (tool_call, result, context)

                # Populate from buffer if executed on stream
                if config.execute_on_stream and tool_results_buffer:
                    logger.info(f"Processing {len(tool_results_buffer)} buffered tool results")
                    for tool_call, result, tool_idx, context in tool_results_buffer:
                        if last_assistant_message_object: context.assistant_message_id = last_assistant_message_object['message_id']
                        tool_results_map[tool_idx] = (tool_call, result, context)

                # Or execute now if not streamed
                elif final_tool_calls_to_process and not config.execute_on_stream:
                    logger.info(f"Executing {len(final_tool_calls_to_process)} tools ({config.tool_execution_strategy}) after stream")
                    results_list = await self._execute_tools(final_tool_calls_to_process, config.tool_execution_strategy)
                    current_tool_idx = 0
                    for tc, res in results_list:
                       # Map back using all_tool_data_map which has correct indices
                       if current_tool_idx in all_tool_data_map:
                           tool_data = all_tool_data_map[current_tool_idx]
                           context = self._create_tool_context(
                               tc, current_tool_idx,
                               last_assistant_message_object['message_id'] if last_assistant_message_object else None,
                               tool_data.get('parsing_details')
                           )
                           context.result = res
                           tool_results_map[current_tool_idx] = (tc, res, context)
                       else: logger.warning(f"Could not map result for tool index {current_tool_idx}")
                       current_tool_idx += 1

                # Save and Yield each result message
                if tool_results_map:
                    logger.info(f"Saving and yielding {len(tool_results_map)} final tool result messages")
                    for tool_idx in sorted(tool_results_map.keys()):
                        tool_call, result, context = tool_results_map[tool_idx]
                        context.result = result
                        if not context.assistant_message_id and last_assistant_message_object:
                            context.assistant_message_id = last_assistant_message_object['message_id']

                        # Yield start status ONLY IF executing non-streamed (already yielded if streamed)
                        if not config.execute_on_stream and tool_idx not in yielded_tool_indices:
                            started_msg_obj = await self._yield_and_save_tool_started(context, thread_id, thread_run_id)
                            if started_msg_obj: yield started_msg_obj
                            yielded_tool_indices.add(tool_idx) # Mark status yielded

                        # Save the tool result message to DB
                        saved_tool_result_object = await self._add_tool_result( # Returns full object or None
                            thread_id, tool_call, result, config.xml_adding_strategy,
                            context.assistant_message_id, context.parsing_details
                        )

                        # Yield completed/failed status (linked to saved result ID if available)
                        completed_msg_obj = await self._yield_and_save_tool_completed(
                            context,
                            saved_tool_result_object['message_id'] if saved_tool_result_object else None,
                            thread_id, thread_run_id
                        )
                        if completed_msg_obj: yield completed_msg_obj
                        # Don't add to yielded_tool_indices here, completion status is separate yield

                        # Yield the saved tool result object
                        if saved_tool_result_object:
                            tool_result_message_objects[tool_idx] = saved_tool_result_object
                            yield saved_tool_result_object
                        else:
                             logger.error(f"Failed to save tool result for index {tool_idx}, not yielding result message.")
                             # Optionally yield error status for saving failure?

            # --- Calculate and Store Cost ---
            if last_assistant_message_object: # Only calculate if assistant message was saved
                try:
                    # Use accumulated_content for streaming cost calculation
                    final_cost = completion_cost(
                        model=llm_model,
                        messages=prompt_messages, # Use the prompt messages provided
                        completion=accumulated_content
                    )
                    if final_cost is not None and final_cost > 0:
                        logger.info(f"Calculated final cost for stream: {final_cost}")
                        await self.add_message(
                            thread_id=thread_id,
                            type="cost",
                            content={"cost": final_cost},
                            is_llm_message=False, # Cost is metadata
                            metadata={"thread_run_id": thread_run_id} # Keep track of the run
                        )
                        logger.info(f"Cost message saved for stream: {final_cost}")
                    else:
                         logger.info("Stream cost calculation resulted in zero or None, not storing cost message.")
                except Exception as e:
                    logger.error(f"Error calculating final cost for stream: {str(e)}")


            # --- Final Finish Status ---
            if finish_reason and finish_reason != "xml_tool_limit_reached":
                finish_content = {"status_type": "finish", "finish_reason": finish_reason}
                finish_msg_obj = await self.add_message(
                    thread_id=thread_id, type="status", content=finish_content, 
                    is_llm_message=False, metadata={"thread_run_id": thread_run_id}
                )
                if finish_msg_obj: yield finish_msg_obj

        except Exception as e:
            logger.error(f"Error processing stream: {str(e)}", exc_info=True)
            # Save and yield error status message
            err_content = {"role": "system", "status_type": "error", "message": str(e)}
            err_msg_obj = await self.add_message(
                thread_id=thread_id, type="status", content=err_content, 
                is_llm_message=False, metadata={"thread_run_id": thread_run_id if 'thread_run_id' in locals() else None}
            )
            if err_msg_obj: yield err_msg_obj # Yield the saved error message

        finally:
            # Save and Yield the final thread_run_end status
            end_content = {"status_type": "thread_run_end"}
            end_msg_obj = await self.add_message(
                thread_id=thread_id, type="status", content=end_content, 
                is_llm_message=False, metadata={"thread_run_id": thread_run_id if 'thread_run_id' in locals() else None}
            )
            if end_msg_obj: yield end_msg_obj

    async def process_non_streaming_response(
        self,
        llm_response: Any,
        thread_id: str,
        prompt_messages: List[Dict[str, Any]],
        llm_model: str,
        config: ProcessorConfig = ProcessorConfig()
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Process a non-streaming LLM response, handling tool calls and execution.
        
        Args:
            llm_response: Response from the LLM
            thread_id: ID of the conversation thread
            prompt_messages: List of messages sent to the LLM (the prompt)
            llm_model: The name of the LLM model used
            config: Configuration for parsing and execution
            
        Yields:
            Complete message objects matching the DB schema.
        """
        content = ""
        thread_run_id = str(uuid.uuid4())
        all_tool_data = [] # Stores {'tool_call': ..., 'parsing_details': ...}
        tool_index = 0
        assistant_message_object = None
        tool_result_message_objects = {}
        finish_reason = None
        native_tool_calls_for_message = []

        try:
            # Save and Yield thread_run_start status message
            start_content = {"status_type": "thread_run_start", "thread_run_id": thread_run_id}
            start_msg_obj = await self.add_message(
                thread_id=thread_id, type="status", content=start_content,
                is_llm_message=False, metadata={"thread_run_id": thread_run_id}
            )
            if start_msg_obj: yield start_msg_obj

            # Extract finish_reason, content, tool calls
            if hasattr(llm_response, 'choices') and llm_response.choices:
                 if hasattr(llm_response.choices[0], 'finish_reason'):
                     finish_reason = llm_response.choices[0].finish_reason
                     logger.info(f"Non-streaming finish_reason: {finish_reason}")
                 response_message = llm_response.choices[0].message if hasattr(llm_response.choices[0], 'message') else None
                 if response_message:
                     if hasattr(response_message, 'content') and response_message.content:
                         content = response_message.content
                         if config.xml_tool_calling:
                             parsed_xml_data = self._parse_xml_tool_calls(content)
                             if config.max_xml_tool_calls > 0 and len(parsed_xml_data) > config.max_xml_tool_calls:
                                 # Truncate content and tool data if limit exceeded
                                 # ... (Truncation logic similar to streaming) ...
                                 if parsed_xml_data:
                                     xml_chunks = self._extract_xml_chunks(content)[:config.max_xml_tool_calls]
                                     if xml_chunks:
                                         last_chunk = xml_chunks[-1]
                                         last_chunk_pos = content.find(last_chunk)
                                         if last_chunk_pos >= 0: content = content[:last_chunk_pos + len(last_chunk)]
                                 parsed_xml_data = parsed_xml_data[:config.max_xml_tool_calls]
                                 finish_reason = "xml_tool_limit_reached"
                             all_tool_data.extend(parsed_xml_data)

                     if config.native_tool_calling and hasattr(response_message, 'tool_calls') and response_message.tool_calls:
                          for tool_call in response_message.tool_calls:
                             if hasattr(tool_call, 'function'):
                                 exec_tool_call = {
                                     "function_name": tool_call.function.name,
                                     "arguments": json.loads(tool_call.function.arguments) if isinstance(tool_call.function.arguments, str) else tool_call.function.arguments,
                                     "id": tool_call.id if hasattr(tool_call, 'id') else str(uuid.uuid4())
                                 }
                                 logger.info(f"[TOOL DISPATCH] Parsed native tool call: function={exec_tool_call['function_name']}, arguments={exec_tool_call['arguments']}, id={exec_tool_call['id']}")
                                 all_tool_data.append({"tool_call": exec_tool_call, "parsing_details": None})
                                 native_tool_calls_for_message.append({
                                     "id": exec_tool_call["id"], "type": "function",
                                     "function": {
                                         "name": tool_call.function.name,
                                         "arguments": tool_call.function.arguments if isinstance(tool_call.function.arguments, str) else json.dumps(tool_call.function.arguments)
                                     }
                                 })


            # --- SAVE and YIELD Final Assistant Message ---
            message_data = {"role": "assistant", "content": content, "tool_calls": native_tool_calls_for_message or None}
            assistant_message_object = await self.add_message(
                thread_id=thread_id, type="assistant", content=message_data,
                is_llm_message=True, metadata={"thread_run_id": thread_run_id}
            )
            if assistant_message_object:
                 yield assistant_message_object
            else:
                 logger.error(f"Failed to save non-streaming assistant message for thread {thread_id}")
                 err_content = {"role": "system", "status_type": "error", "message": "Failed to save assistant message"}
                 err_msg_obj = await self.add_message(
                     thread_id=thread_id, type="status", content=err_content, 
                     is_llm_message=False, metadata={"thread_run_id": thread_run_id}
                 )
                 if err_msg_obj: yield err_msg_obj

            # --- Calculate and Store Cost ---
            if assistant_message_object: # Only calculate if assistant message was saved
                try:
                    # Use the full llm_response object for potentially more accurate cost calculation
                    final_cost = None
                    if hasattr(llm_response, '_hidden_params') and 'response_cost' in llm_response._hidden_params and llm_response._hidden_params['response_cost'] is not None and llm_response._hidden_params['response_cost'] != 0.0:
                        final_cost = llm_response._hidden_params['response_cost']
                        logger.info(f"Using response_cost from _hidden_params: {final_cost}")

                    if final_cost is None: # Fall back to calculating cost if direct cost not available or zero
                        logger.info("Calculating cost using completion_cost function.")
                        # Note: litellm might need 'messages' kwarg depending on model/provider
                        final_cost = completion_cost(
                            completion_response=llm_response,
                            model=llm_model, # Explicitly pass the model name
                            # messages=prompt_messages # Pass prompt messages if needed by litellm for this model
                        )

                    if final_cost is not None and final_cost > 0:
                        logger.info(f"Calculated final cost for non-stream: {final_cost}")
                        await self.add_message(
                            thread_id=thread_id,
                            type="cost",
                            content={"cost": final_cost},
                            is_llm_message=False, # Cost is metadata
                            metadata={"thread_run_id": thread_run_id} # Keep track of the run
                        )
                        logger.info(f"Cost message saved for non-stream: {final_cost}")
                    else:
                        logger.info("Non-stream cost calculation resulted in zero or None, not storing cost message.")

                except Exception as e:
                    logger.error(f"Error calculating final cost for non-stream: {str(e)}")

            # --- Execute Tools and Yield Results ---
            tool_calls_to_execute = [item['tool_call'] for item in all_tool_data]
            if config.execute_tools and tool_calls_to_execute:
                logger.info(f"Executing {len(tool_calls_to_execute)} tools with strategy: {config.tool_execution_strategy}")
                tool_results = await self._execute_tools(tool_calls_to_execute, config.tool_execution_strategy)

                for i, (returned_tool_call, result) in enumerate(tool_results):
                    original_data = all_tool_data[i]
                    tool_call_from_data = original_data['tool_call']
                    parsing_details = original_data['parsing_details']
                    current_assistant_id = assistant_message_object['message_id'] if assistant_message_object else None

                    context = self._create_tool_context(
                        tool_call_from_data, tool_index, current_assistant_id, parsing_details
                    )
                    context.result = result

                    # Save and Yield start status
                    started_msg_obj = await self._yield_and_save_tool_started(context, thread_id, thread_run_id)
                    if started_msg_obj: yield started_msg_obj

                    # Save tool result
                    saved_tool_result_object = await self._add_tool_result(
                        thread_id, tool_call_from_data, result, config.xml_adding_strategy,
                        current_assistant_id, parsing_details
                    )

                    # Save and Yield completed/failed status
                    completed_msg_obj = await self._yield_and_save_tool_completed(
                        context,
                        saved_tool_result_object['message_id'] if saved_tool_result_object else None,
                        thread_id, thread_run_id
                    )
                    if completed_msg_obj: yield completed_msg_obj

                    # Yield the saved tool result object
                    if saved_tool_result_object:
                        tool_result_message_objects[tool_index] = saved_tool_result_object
                        yield saved_tool_result_object
                    else:
                         logger.error(f"Failed to save tool result for index {tool_index}")

                    tool_index += 1

            # --- Save and Yield Final Status ---
            if finish_reason:
                finish_content = {"status_type": "finish", "finish_reason": finish_reason}
                finish_msg_obj = await self.add_message(
                    thread_id=thread_id, type="status", content=finish_content, 
                    is_llm_message=False, metadata={"thread_run_id": thread_run_id}
                )
                if finish_msg_obj: yield finish_msg_obj

        except Exception as e:
             logger.error(f"Error processing non-streaming response: {str(e)}", exc_info=True)
             # Save and yield error status
             err_content = {"role": "system", "status_type": "error", "message": str(e)}
             err_msg_obj = await self.add_message(
                 thread_id=thread_id, type="status", content=err_content, 
                 is_llm_message=False, metadata={"thread_run_id": thread_run_id if 'thread_run_id' in locals() else None}
             )
             if err_msg_obj: yield err_msg_obj

        finally:
             # Save and Yield the final thread_run_end status
            end_content = {"status_type": "thread_run_end"}
            end_msg_obj = await self.add_message(
                thread_id=thread_id, type="status", content=end_content, 
                is_llm_message=False, metadata={"thread_run_id": thread_run_id if 'thread_run_id' in locals() else None}
            )
            if end_msg_obj: yield end_msg_obj

    # XML parsing methods
    def _extract_tag_content(self, xml_chunk: str, tag_name: str) -> Tuple[Optional[str], Optional[str]]:
        """Extract content between opening and closing tags, handling nested tags."""
        start_tag = f'<{tag_name}'
        end_tag = f'</{tag_name}>'
        
        try:
            # Find start tag position
            start_pos = xml_chunk.find(start_tag)
            if start_pos == -1:
                return None, xml_chunk
                
            # Find end of opening tag
            tag_end = xml_chunk.find('>', start_pos)
            if tag_end == -1:
                return None, xml_chunk
                
            # Find matching closing tag
            content_start = tag_end + 1
            nesting_level = 1
            pos = content_start
            
            while nesting_level > 0 and pos < len(xml_chunk):
                next_start = xml_chunk.find(start_tag, pos)
                next_end = xml_chunk.find(end_tag, pos)
                
                if next_end == -1:
                    return None, xml_chunk
                    
                if next_start != -1 and next_start < next_end:
                    nesting_level += 1
                    pos = next_start + len(start_tag)
                else:
                    nesting_level -= 1
                    if nesting_level == 0:
                        content = xml_chunk[content_start:next_end]
                        remaining = xml_chunk[next_end + len(end_tag):]
                        return content, remaining
                    else:
                        pos = next_end + len(end_tag)
            
            return None, xml_chunk
            
        except Exception as e:
            logger.error(f"Error extracting tag content: {e}")
            return None, xml_chunk

    def _extract_attribute(self, opening_tag: str, attr_name: str) -> Optional[str]:
        """Extract attribute value from opening tag."""
        try:
            # Handle both single and double quotes with raw strings
            patterns = [
                fr'{attr_name}="([^"]*)"',  # Double quotes
                fr"{attr_name}='([^']*)'",  # Single quotes
                fr'{attr_name}=([^\s/>;]+)'  # No quotes - fixed escape sequence
            ]
            
            for pattern in patterns:
                match = re.search(pattern, opening_tag)
                if match:
                    value = match.group(1)
                    # Unescape common XML entities
                    value = value.replace('&quot;', '"').replace('&apos;', "'")
                    value = value.replace('&lt;', '<').replace('&gt;', '>')
                    value = value.replace('&amp;', '&')
                    return value
            
            return None
            
        except Exception as e:
            logger.error(f"Error extracting attribute: {e}")
            return None

    def _extract_xml_chunks(self, content: str) -> List[str]:
        """Extract complete XML chunks using start and end pattern matching, including self-closing tags."""
        chunks = []
        pos = 0
        try:
            while pos < len(content):
                next_tag_start = -1
                current_tag = None
                self_closing_found = False
                self_closing_start = None
                self_closing_end = None
                # --- Check for self-closing tags for all registered tags ---
                for tag_name in self.tool_registry.xml_tools.keys():
                    # Regex for self-closing tag: <tag ... />
                    self_closing_pattern = rf'<{tag_name}(\s[^<>]*?)?/>'
                    match = re.search(self_closing_pattern, content[pos:])
                    if match:
                        start = pos + match.start()
                        end = pos + match.end()
                        # Only add if this is the earliest match
                        if self_closing_start is None or start < self_closing_start:
                            self_closing_found = True
                            self_closing_start = start
                            self_closing_end = end
                if self_closing_found and (self_closing_start is not None):
                    chunks.append(content[self_closing_start:self_closing_end])
                    pos = self_closing_end
                    continue  # Go to next chunk
                # --- Otherwise, look for normal <tag>...</tag> ---
                for tag_name in self.tool_registry.xml_tools.keys():
                    start_pattern = f'<{tag_name}'
                    tag_pos = content.find(start_pattern, pos)
                    if tag_pos != -1 and (next_tag_start == -1 or tag_pos < next_tag_start):
                        next_tag_start = tag_pos
                        current_tag = tag_name
                if next_tag_start == -1 or not current_tag:
                    break
                # Find the matching end tag
                end_pattern = f'</{current_tag}>'
                tag_stack = []
                chunk_start = next_tag_start
                current_pos = next_tag_start
                while current_pos < len(content):
                    next_start = content.find(f'<{current_tag}', current_pos + 1)
                    next_end = content.find(end_pattern, current_pos)
                    if next_end == -1:
                        break
                    if next_start != -1 and next_start < next_end:
                        tag_stack.append(next_start)
                        current_pos = next_start + 1
                    else:
                        if not tag_stack:
                            chunk_end = next_end + len(end_pattern)
                            chunk = content[chunk_start:chunk_end]
                            chunks.append(chunk)
                            pos = chunk_end
                            break
                        else:
                            tag_stack.pop()
                            current_pos = next_end + 1
                if current_pos >= len(content):
                    break
                pos = max(pos + 1, current_pos)
        except Exception as e:
            logger.error(f"Error extracting XML chunks: {e}")
            logger.error(f"Content was: {content}")
        return chunks

    def _parse_xml_tool_call(self, xml_chunk: str) -> Optional[Tuple[Dict[str, Any], Dict[str, Any]]]:
        """Parse XML chunk into tool call format and return parsing details.
        
        Returns:
            Tuple of (tool_call, parsing_details) or None if parsing fails.
            - tool_call: Dict with 'function_name', 'xml_tag_name', 'arguments'
            - parsing_details: Dict with 'attributes', 'elements', 'text_content', 'root_content'
        """
        try:
            # --- AUTO-FIX for malformed <str-replace> XML ---
            if '<str-replace' in xml_chunk:
                # Case 1: Two <old_str> tags, no <new_str>
                if '<old_str>' in xml_chunk and xml_chunk.count('<old_str>') == 2 and '<new_str>' not in xml_chunk:
                    first = xml_chunk.find('<old_str>')
                    second = xml_chunk.find('<old_str>', first + 1)
                    end_second = xml_chunk.find('</old_str>', second)
                    if second != -1 and end_second != -1:
                        new_str_content = xml_chunk[second + len('<old_str>'):end_second]
                        fixed_chunk = (
                            xml_chunk[:second] +
                            '<new_str>' + new_str_content + '</new_str>' +
                            xml_chunk[end_second + len('</old_str>'):]
                        )
                        logger.warning(f"Auto-fixed malformed <str-replace> XML: replaced second <old_str> with <new_str>")
                        xml_chunk = fixed_chunk
                # Case 2: <new_str> is present but closed with </old_str>
                elif '<new_str>' in xml_chunk and '</old_str>' in xml_chunk:
                    new_str_start = xml_chunk.find('<new_str>')
                    old_str_close_after_new = xml_chunk.find('</old_str>', new_str_start)
                    if new_str_start != -1 and old_str_close_after_new != -1:
                        fixed_chunk = (
                            xml_chunk[:old_str_close_after_new] +
                            '</new_str>' +
                            xml_chunk[old_str_close_after_new + len('</old_str>'):]
                        )
                        logger.warning(f"Auto-fixed malformed <str-replace> XML: replaced </old_str> with </new_str> after <new_str>")
                        xml_chunk = fixed_chunk
            # --- END AUTO-FIX ---
            
            # Extract tag name and validate
            tag_match = re.match(r'<([^\s>]+)', xml_chunk)
            if not tag_match:
                logger.error(f"No tag found in XML chunk: {xml_chunk}")
                return None
            
            # This is the XML tag as it appears in the text (e.g., "create-file")
            xml_tag_name = tag_match.group(1)
            logger.info(f"Found XML tag: {xml_tag_name}")
            
            # Get tool info and schema from registry
            tool_info = self.tool_registry.get_xml_tool(xml_tag_name)
            if not tool_info or not tool_info['schema'].xml_schema:
                logger.error(f"No tool or schema found for tag: {xml_tag_name}")
                return None
            
            # This is the actual function name to call (e.g., create_file)
            function_name = tool_info['method']
            
            schema = tool_info['schema'].xml_schema
            params = {}
            remaining_chunk = xml_chunk
            
            # --- Store detailed parsing info ---
            parsing_details = {
                "attributes": {},
                "elements": {},
                "text_content": None,
                "root_content": None,
                "raw_chunk": xml_chunk # Store the original chunk for reference
            }
            # ---
            
            # Process each mapping
            for mapping in schema.mappings:
                try:
                    if mapping.node_type == "attribute":
                        # Extract attribute from opening tag
                        opening_tag = remaining_chunk.split('>', 1)[0]
                        value = self._extract_attribute(opening_tag, mapping.param_name)
                        if value is not None:
                            params[mapping.param_name] = value
                            parsing_details["attributes"][mapping.param_name] = value # Store raw attribute
                            logger.info(f"Found attribute {mapping.param_name} -> {mapping.param_name}: {value}")
                
                    elif mapping.node_type == "element":
                        # Extract element content
                        content, remaining_chunk = self._extract_tag_content(remaining_chunk, mapping.path)
                        if content is not None:
                            params[mapping.param_name] = content.strip()
                            parsing_details["elements"][mapping.path] = content.strip() # Store raw element content
                            logger.info(f"Found element {mapping.path} -> {mapping.param_name}")
                
                    elif mapping.node_type == "text":
                        # Extract text content
                        content, _ = self._extract_tag_content(remaining_chunk, xml_tag_name)
                        if content is not None:
                            params[mapping.param_name] = content.strip()
                            parsing_details["text_content"] = content.strip() # Store raw text content
                            logger.info(f"Found text content for {mapping.param_name}")
                
                    elif mapping.node_type == "content":
                        # Extract root content
                        content, _ = self._extract_tag_content(remaining_chunk, xml_tag_name)
                        if content is not None:
                            params[mapping.param_name] = content.strip()
                            parsing_details["root_content"] = content.strip() # Store raw root content
                            logger.info(f"Found root content for {mapping.param_name}")
                
                except Exception as e:
                    logger.error(f"Error processing mapping {mapping}: {e}")
                    continue
            
            # Validate required parameters
            missing = [mapping.param_name for mapping in schema.mappings if getattr(mapping, 'required', False) and mapping.param_name not in params]
            if missing:
                logger.error(f"Missing required parameters: {missing}")
                logger.error(f"Current params: {params}")
                logger.error(f"XML chunk: {xml_chunk}")
                return None
            
            logger.info(f"[TOOL DISPATCH] Final arguments for {function_name}: {params}")
            # Create tool call with clear separation between function_name and xml_tag_name
            tool_call = {
                "function_name": function_name,  # The actual method to call (e.g., create_file)
                "xml_tag_name": xml_tag_name,    # The original XML tag (e.g., create-file)
                "arguments": params              # The extracted parameters
            }
            
            logger.info(f"[TOOL DISPATCH] Parsed XML tool call: tag={xml_tag_name}, function={function_name}, arguments={params}")
            return tool_call, parsing_details # Return both dicts
            
        except Exception as e:
            logger.error(f"Error parsing XML chunk: {e}")
            logger.error(f"XML chunk was: {xml_chunk}")
            return None

    def _parse_xml_tool_calls(self, content: str) -> List[Dict[str, Any]]:
        """Parse XML tool calls from content string.
        
        Returns:
            List of dictionaries, each containing {'tool_call': ..., 'parsing_details': ...}
        """
        parsed_data = []
        
        try:
            xml_chunks = self._extract_xml_chunks(content)
            
            for xml_chunk in xml_chunks:
                result = self._parse_xml_tool_call(xml_chunk)
                if result:
                    tool_call, parsing_details = result
                    parsed_data.append({
                        "tool_call": tool_call,
                        "parsing_details": parsing_details
                    })
                    
        except Exception as e:
            logger.error(f"Error parsing XML tool calls: {e}", exc_info=True)
        
        return parsed_data

    # Tool execution methods
    async def _execute_tool(self, tool_call: Dict[str, Any]) -> ToolResult:
        """Execute a single tool call and return the result."""
        try:
            function_name = tool_call["function_name"]
            arguments = tool_call["arguments"]
            logger.info(f"[TOOL DISPATCH] About to execute tool: {function_name} with arguments: {arguments} (tool_call id: {tool_call.get('id', 'N/A')})")
            
            if isinstance(arguments, str):
                try:
                    arguments = json.loads(arguments)
                except json.JSONDecodeError:
                    arguments = {"text": arguments}
            
            # Get available functions from tool registry
            available_functions = self.tool_registry.get_available_functions()
            
            # Look up the function by name
            tool_fn = available_functions.get(function_name)
            if not tool_fn:
                logger.error(f"Tool function '{function_name}' not found in registry")
                return ToolResult(success=False, output=f"Tool function '{function_name}' not found")
            
            logger.debug(f"Found tool function for '{function_name}', executing...")
            result = await tool_fn(**arguments)
            logger.info(f"Tool execution complete: {function_name} -> {result}")
            return result
        except Exception as e:
            logger.error(f"Error executing tool {tool_call['function_name']}: {str(e)}", exc_info=True)
            return ToolResult(success=False, output=f"Error executing tool: {str(e)}")

    async def _execute_tools(
        self, 
        tool_calls: List[Dict[str, Any]], 
        execution_strategy: ToolExecutionStrategy = "sequential"
    ) -> List[Tuple[Dict[str, Any], ToolResult]]:
        """Execute tool calls with the specified strategy.
        
        This is the main entry point for tool execution. It dispatches to the appropriate
        execution method based on the provided strategy.
        
        Args:
            tool_calls: List of tool calls to execute
            execution_strategy: Strategy for executing tools:
                - "sequential": Execute tools one after another, waiting for each to complete
                - "parallel": Execute all tools simultaneously for better performance 
                
        Returns:
            List of tuples containing the original tool call and its result
        """
        logger.info(f"Executing {len(tool_calls)} tools with strategy: {execution_strategy}")
            
        if execution_strategy == "sequential":
            return await self._execute_tools_sequentially(tool_calls)
        elif execution_strategy == "parallel":
            return await self._execute_tools_in_parallel(tool_calls)
        else:
            logger.warning(f"Unknown execution strategy: {execution_strategy}, falling back to sequential")
            return await self._execute_tools_sequentially(tool_calls)

    async def _execute_tools_sequentially(self, tool_calls: List[Dict[str, Any]]) -> List[Tuple[Dict[str, Any], ToolResult]]:
        """Execute tool calls sequentially and return results.
        
        This method executes tool calls one after another, waiting for each tool to complete
        before starting the next one. This is useful when tools have dependencies on each other.
        
        Args:
            tool_calls: List of tool calls to execute
            
        Returns:
            List of tuples containing the original tool call and its result
        """
        if not tool_calls:
            logger.info("No tool calls to execute (empty list)")
            return []
        
        # --- ENFORCE replicate-generate-image/complete rule ---
        tool_names = [t.get('function_name', 'unknown') for t in tool_calls]
        logger.info(f"Tool calls parsed for execution: {tool_names}")
        if 'replicate-generate-image' in tool_names and 'complete' in tool_names:
            logger.warning("Both 'replicate-generate-image' and 'complete' tool calls found in the same message. Skipping 'complete' until image is generated.")
            filtered_tool_calls = []
            for t in tool_calls:
                if t.get('function_name') == 'complete':
                    continue
                filtered_tool_calls.append(t)
            tool_calls = filtered_tool_calls
            logger.info(f"Tool calls after filtering: {[t.get('function_name', 'unknown') for t in tool_calls]}")
        else:
            logger.info(f"Tool calls after filtering: {tool_names}")
        
        # Log available functions in the tool registry
        available_functions = self.tool_registry.get_available_functions()
        logger.info(f"Available functions in tool registry: {list(available_functions.keys())}")
        
        try:
            results = []
            for index, tool_call in enumerate(tool_calls):
                tool_name = tool_call.get('function_name', 'unknown')
                logger.info(f"About to execute tool {index+1}/{len(tool_calls)}: {tool_name} with args: {tool_call.get('arguments')}")
                try:
                    result = await self._execute_tool(tool_call)
                    logger.info(f"Executed tool {tool_name} with result: {result}")
                    results.append((tool_call, result))
                    logger.debug(f"Completed tool {tool_name} with success={result.success}")
                except Exception as e:
                    logger.error(f"Error executing tool {tool_name}: {str(e)}")
                    error_result = ToolResult(success=False, output=f"Error executing tool: {str(e)}")
                    results.append((tool_call, error_result))
            logger.info(f"Sequential execution completed for {len(tool_calls)} tools")
            return results
        except Exception as e:
            logger.error(f"Error in sequential tool execution: {str(e)}", exc_info=True)
            completed_tool_names = [r[0].get('function_name', 'unknown') for r in results] if 'results' in locals() else []
            remaining_tools = [t for t in tool_calls if t.get('function_name', 'unknown') not in completed_tool_names]
            error_results = [(tool, ToolResult(success=False, output=f"Execution error: {str(e)}")) 
                            for tool in remaining_tools]
            return (results if 'results' in locals() else []) + error_results

    async def _execute_tools_in_parallel(self, tool_calls: List[Dict[str, Any]]) -> List[Tuple[Dict[str, Any], ToolResult]]:
        """Execute tool calls in parallel and return results.
        
        This method executes all tool calls simultaneously using asyncio.gather, which
        can significantly improve performance when executing multiple independent tools.
        
        Args:
            tool_calls: List of tool calls to execute
            
        Returns:
            List of tuples containing the original tool call and its result
        """
        if not tool_calls:
            return []
            
        try:
            tool_names = [t.get('function_name', 'unknown') for t in tool_calls]
            logger.info(f"Executing {len(tool_calls)} tools in parallel: {tool_names}")
            
            # Create tasks for all tool calls
            tasks = [self._execute_tool(tool_call) for tool_call in tool_calls]
            
            # Execute all tasks concurrently with error handling
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results and handle any exceptions
            processed_results = []
            for i, (tool_call, result) in enumerate(zip(tool_calls, results)):
                if isinstance(result, Exception):
                    logger.error(f"Error executing tool {tool_call.get('function_name', 'unknown')}: {str(result)}")
                    # Create error result
                    error_result = ToolResult(success=False, output=f"Error executing tool: {str(result)}")
                    processed_results.append((tool_call, error_result))
                else:
                    processed_results.append((tool_call, result))
            
            logger.info(f"Parallel execution completed for {len(tool_calls)} tools")
            return processed_results
        
        except Exception as e:
            logger.error(f"Error in parallel tool execution: {str(e)}", exc_info=True)
            # Return error results for all tools if the gather itself fails
            return [(tool_call, ToolResult(success=False, output=f"Execution error: {str(e)}")) 
                    for tool_call in tool_calls]

    async def _add_tool_result(
        self, 
        thread_id: str, 
        tool_call: Dict[str, Any], 
        result: ToolResult,
        strategy: Union[XmlAddingStrategy, str] = "assistant_message",
        assistant_message_id: Optional[str] = None,
        parsing_details: Optional[Dict[str, Any]] = None
    ) -> Optional[str]: # Return the message ID
        """Add a tool result to the conversation thread based on the specified format.
        
        This method formats tool results and adds them to the conversation history,
        making them visible to the LLM in subsequent interactions. Results can be 
        added either as native tool messages (OpenAI format) or as XML-wrapped content
        with a specified role (user or assistant).
        
        Args:
            thread_id: ID of the conversation thread
            tool_call: The original tool call that produced this result
            result: The result from the tool execution
            strategy: How to add XML tool results to the conversation
                     ("user_message", "assistant_message", or "inline_edit")
            assistant_message_id: ID of the assistant message that generated this tool call
            parsing_details: Detailed parsing info for XML calls (attributes, elements, etc.)
        """
        try:
            message_id = None # Initialize message_id
            
            # Create metadata with assistant_message_id if provided
            metadata = {}
            if assistant_message_id:
                metadata["assistant_message_id"] = assistant_message_id
                logger.info(f"Linking tool result to assistant message: {assistant_message_id}")
            
            # --- Add parsing details to metadata if available ---
            if parsing_details:
                metadata["parsing_details"] = parsing_details
                logger.info("Adding parsing_details to tool result metadata")
            # ---
            
            # Check if this is a native function call (has id field)
            if "id" in tool_call:
                # Format as a proper tool message according to OpenAI spec
                function_name = tool_call.get("function_name", "")
                
                # Format the tool result content - tool role needs string content
                if isinstance(result, str):
                    content = result
                elif hasattr(result, 'output'):
                    # If it's a ToolResult object
                    if isinstance(result.output, dict) or isinstance(result.output, list):
                        # If output is already a dict or list, convert to JSON string
                        content = json.dumps(result.output)
                    else:
                        # Otherwise just use the string representation
                        content = str(result.output)
                else:
                    # Fallback to string representation of the whole result
                    content = str(result)
                
                logger.info(f"Formatted tool result content: {content[:100]}...")
                
                # Create the tool response message with proper format
                tool_message = {
                    "role": "tool",
                    "tool_call_id": tool_call["id"],
                    "name": function_name,
                    "content": content
                }
                
                logger.info(f"Adding native tool result for tool_call_id={tool_call['id']} with role=tool")
                
                # Add as a tool message to the conversation history
                # This makes the result visible to the LLM in the next turn
                message_id = await self.add_message(
                    thread_id=thread_id,
                    type="tool",  # Special type for tool responses
                    content=tool_message,
                    is_llm_message=True,
                    metadata=metadata
                )
                return message_id # Return the message ID
            
            # For XML and other non-native tools, continue with the original logic
            # Determine message role based on strategy
            result_role = "user" if strategy == "user_message" else "assistant"
            
            # Create a context for consistent formatting
            context = self._create_tool_context(tool_call, 0, assistant_message_id, parsing_details)
            context.result = result
            
            # Format the content using the formatting helper
            content = self._format_xml_tool_result(tool_call, result)
            
            # Add the message with the appropriate role to the conversation history
            # This allows the LLM to see the tool result in subsequent interactions
            result_message = {
                "role": result_role,
                "content": content
            }
            message_id = await self.add_message(
                thread_id=thread_id, 
                type="tool",
                content=result_message,
                is_llm_message=True,
                metadata=metadata
            )
            return message_id # Return the message ID
        except Exception as e:
            logger.error(f"Error adding tool result: {str(e)}", exc_info=True)
            # Fallback to a simple message
            try:
                fallback_message = {
                    "role": "user",
                    "content": str(result)
                }
                message_id = await self.add_message(
                    thread_id=thread_id, 
                    type="tool", 
                    content=fallback_message,
                    is_llm_message=True,
                    metadata={"assistant_message_id": assistant_message_id} if assistant_message_id else {}
                )
                return message_id # Return the message ID
            except Exception as e2:
                logger.error(f"Failed even with fallback message: {str(e2)}", exc_info=True)
                return None # Return None on error

    def _format_xml_tool_result(self, tool_call: Dict[str, Any], result: ToolResult) -> str:
        """Format a tool result wrapped in a <tool_result> tag.

        Args:
            tool_call: The tool call that was executed
            result: The result of the tool execution

        Returns:
            String containing the formatted result wrapped in <tool_result> tag
        """
        # Always use xml_tag_name if it exists
        if "xml_tag_name" in tool_call:
            xml_tag_name = tool_call["xml_tag_name"]
            return f"<tool_result> <{xml_tag_name}> {str(result)} </{xml_tag_name}> </tool_result>"
        
        # Non-XML tool, just return the function result
        function_name = tool_call["function_name"]
        return f"Result for {function_name}: {str(result)}"

    def _create_tool_context(self, tool_call: Dict[str, Any], tool_index: int, assistant_message_id: Optional[str] = None, parsing_details: Optional[Dict[str, Any]] = None) -> ToolExecutionContext:
        """Create a tool execution context with display name and parsing details populated."""
        context = ToolExecutionContext(
            tool_call=tool_call,
            tool_index=tool_index,
            assistant_message_id=assistant_message_id,
            parsing_details=parsing_details
        )
        
        # Set function_name and xml_tag_name fields
        if "xml_tag_name" in tool_call:
            context.xml_tag_name = tool_call["xml_tag_name"]
            context.function_name = tool_call.get("function_name", tool_call["xml_tag_name"])
        else:
            # For non-XML tools, use function name directly
            context.function_name = tool_call.get("function_name", "unknown")
            context.xml_tag_name = None
        
        return context
        
    async def _yield_and_save_tool_started(self, context: ToolExecutionContext, thread_id: str, thread_run_id: str) -> Optional[Dict[str, Any]]:
        """Formats, saves, and returns a tool started status message."""
        tool_name = context.xml_tag_name or context.function_name
        content = {
            "role": "assistant", "status_type": "tool_started",
            "function_name": context.function_name, "xml_tag_name": context.xml_tag_name,
            "message": f"Starting execution of {tool_name}", "tool_index": context.tool_index,
            "tool_call_id": context.tool_call.get("id") # Include tool_call ID if native
        }
        metadata = {"thread_run_id": thread_run_id}
        saved_message_obj = await self.add_message(
            thread_id=thread_id, type="status", content=content, is_llm_message=False, metadata=metadata
        )
        return saved_message_obj # Return the full object (or None if saving failed)

    async def _yield_and_save_tool_completed(self, context: ToolExecutionContext, tool_message_id: Optional[str], thread_id: str, thread_run_id: str) -> Optional[Dict[str, Any]]:
        """Formats, saves, and returns a tool completed/failed status message."""
        if not context.result:
            # Delegate to error saving if result is missing (e.g., execution failed)
            return await self._yield_and_save_tool_error(context, thread_id, thread_run_id)

        tool_name = context.xml_tag_name or context.function_name
        status_type = "tool_completed" if context.result.success else "tool_failed"
        message_text = f"Tool {tool_name} {'completed successfully' if context.result.success else 'failed'}"

        content = {
            "role": "assistant", "status_type": status_type,
            "function_name": context.function_name, "xml_tag_name": context.xml_tag_name,
            "message": message_text, "tool_index": context.tool_index,
            "tool_call_id": context.tool_call.get("id")
        }
        metadata = {"thread_run_id": thread_run_id}
        # Add the *actual* tool result message ID to the metadata if available and successful
        if context.result.success and tool_message_id:
            metadata["linked_tool_result_message_id"] = tool_message_id
            
        # <<< ADDED: Signal if this is a terminating tool >>>
        if context.function_name in ['ask', 'complete']:
            metadata["agent_should_terminate"] = True
            logger.info(f"Marking tool status for '{context.function_name}' with termination signal.")
        # <<< END ADDED >>>

        saved_message_obj = await self.add_message(
            thread_id=thread_id, type="status", content=content, is_llm_message=False, metadata=metadata
        )
        return saved_message_obj

    async def _yield_and_save_tool_error(self, context: ToolExecutionContext, thread_id: str, thread_run_id: str) -> Optional[Dict[str, Any]]:
        """Formats, saves, and returns a tool error status message."""
        error_msg = str(context.error) if context.error else "Unknown error during tool execution"
        tool_name = context.xml_tag_name or context.function_name
        content = {
            "role": "assistant", "status_type": "tool_error",
            "function_name": context.function_name, "xml_tag_name": context.xml_tag_name,
            "message": f"Error executing tool {tool_name}: {error_msg}",
            "tool_index": context.tool_index,
            "tool_call_id": context.tool_call.get("id")
        }
        metadata = {"thread_run_id": thread_run_id}
        # Save the status message with is_llm_message=False
        saved_message_obj = await self.add_message(
            thread_id=thread_id, type="status", content=content, is_llm_message=False, metadata=metadata
        )
        return saved_message_obj