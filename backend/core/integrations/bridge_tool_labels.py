"""Tool display labels for IM bridges — synced from packages/shared/src/tools/display-names.ts."""
from __future__ import annotations

from typing import Dict

# Normalized keys: lowercase, underscores (hyphens folded to underscores).

_TOOL_COMPLETED: Dict[str, str] = {
    'crawl_webpage': 'Crawled Website',
    'create_file': 'Created File',
    'create_slide': 'Created Slide',
    'delete_file': 'Deleted File',
    'edit_file': 'Edited File',
    'execute_command': 'Executed Command',
    'image_search': 'Searched Images',
    'read_file': 'Read File',
    'scrape_webpage': 'Scraped Website',
    'web_search': 'Searched Web',
}

_TOOL_DISPLAY: Dict[str, str] = {
    'analyze_sheet': 'Analyzing Sheet',
    'ask': 'Ask',
    'browser_act': 'Performing Action',
    'browser_click_element': 'Clicking Element',
    'browser_close_tab': 'Closing Tab',
    'browser_extract_content': 'Extracting Content',
    'browser_input_text': 'Inputting Text',
    'browser_navigate_to': 'Navigating to Page',
    'browser_screenshot': 'Taking Screenshot',
    'browser_scroll_down': 'Scrolling Down',
    'browser_scroll_up': 'Scrolling Up',
    'browser_wait': 'Waiting',
    'build_project': 'Building Project',
    'call_data_provider': 'Calling Data Provider',
    'check_command_output': 'Checking Command Output',
    'clear_images_from_context': 'Clearing Images',
    'complete': 'Completing Task',
    'configure_agent_integration': 'Configuring Worker Integration',
    'configure_mcp_server': 'Configuring MCP Server',
    'configure_profile_for_agent': 'Adding Tools to Worker',
    'crawl_webpage': 'Crawling Website',
    'create_agent_scheduled_trigger': 'Creating Scheduled Trigger',
    'create_credential_profile': 'Creating Profile',
    'create_credential_profile_for_agent': 'Creating Credential Profile',
    'create_document': 'Creating Document',
    'create_event_trigger': 'Creating Event Trigger',
    'create_file': 'Creating File',
    'create_new_agent': 'Creating New Worker',
    'create_presentation': 'Creating Presentation',
    'create_presentation_outline': 'Creating Presentation Outline',
    'create_sheet': 'Creating Sheet',
    'create_slide': 'Creating Slide',
    'create_tasks': 'Creating Tasks',
    'delete_document': 'Deleting Document',
    'delete_file': 'Deleting File',
    'designer_create_or_edit': 'Designing',
    'discover_mcp_tools_for_agent': 'Discovering MCP Tools',
    'discover_user_mcp_servers': 'Discovering Tools',
    'edit_file': 'Editing File',
    'end_call': 'Ending Call',
    'execute_code': 'Executing Code',
    'execute_command': 'Executing Command',
    'execute_data_provider_call': 'Calling Data Provider',
    'expose_port': 'Exposing Port',
    'format_sheet': 'Formatting Sheet',
    'full_file_rewrite': 'Rewriting File',
    'get_author_details': 'Getting Author Details',
    'get_author_papers': 'Getting Author Papers',
    'get_call_details': 'Getting Call Details',
    'get_credential_profiles': 'Getting Profiles',
    'get_current_agent_config': 'Getting Worker Config',
    'get_data_provider_endpoints': 'Getting Endpoints',
    'get_mcp_server_tools': 'Getting MCP Server Tools',
    'get_paper_citations': 'Getting Paper Citations',
    'get_paper_details': 'Getting Paper Details',
    'get_paper_references': 'Getting Paper References',
    'get_popular_mcp_servers': 'Getting Popular MCP Servers',
    'get_project_structure': 'Getting Project Structure',
    'image_edit_or_generate': 'Generate Media',
    'image_search': 'Searching Images',
    'initialize_tools': 'Mode Activated',
    'list_agent_scheduled_triggers': 'Listing Scheduled Triggers',
    'list_app_event_triggers': 'Finding Event Triggers',
    'list_calls': 'Listing Calls',
    'list_commands': 'Listing Commands',
    'list_documents': 'Listing Documents',
    'load_image': 'Loaded Image',
    'load_template_design': 'Loading Template Design',
    'make_phone_call': 'Making Phone Call',
    'monitor_call': 'Monitoring Call',
    'paper_search': 'Searching for Papers',
    'parse_document': 'Parsing Document',
    'read_document': 'Reading Document',
    'read_file': 'Reading File',
    'scrape_webpage': 'Scraping Website',
    'search_authors': 'Searching Authors',
    'search_mcp_servers': 'Searching MCP Servers',
    'search_mcp_servers_for_agent': 'Searching MCP Servers',
    'spreadsheet_add_sheet': 'Adding Sheet',
    'spreadsheet_batch_update': 'Updating Spreadsheet',
    'spreadsheet_create': 'Creating Spreadsheet',
    'str_replace': 'Editing Text',
    'terminate_command': 'Terminating Command',
    'test_mcp_server_connection': 'Testing MCP Server Connection',
    'update_agent': 'Updating Worker',
    'update_document': 'Updating Document',
    'update_sheet': 'Updating Sheet',
    'update_tasks': 'Updating Tasks',
    'upload_file': 'Uploading File',
    'validate_slide': 'Validating Slide',
    'view_sheet': 'Viewing Sheet',
    'visualize_sheet': 'Visualizing Sheet',
    'wait': 'Wait',
    'wait_for_call_completion': 'Waiting for Completion',
    'web_search': 'Searching Web',
}


def _norm_tool_name(name: str) -> str:
    return (name or "").strip().lower().replace("-", "_")


def tool_started_label(function_name: str) -> str:
    k = _norm_tool_name(function_name)
    return _TOOL_DISPLAY.get(k) or _humanize_tool(function_name)


def tool_completed_label(function_name: str) -> str:
    k = _norm_tool_name(function_name)
    return _TOOL_COMPLETED.get(k) or tool_started_label(function_name)


def _humanize_tool(name: str) -> str:
    s = (name or "").strip().replace("_", "-").replace(" ", "-")
    parts = [p for p in s.split("-") if p]
    if not parts:
        return (name or "").strip() or "Tool"
    return " ".join(p.capitalize() for p in parts)
