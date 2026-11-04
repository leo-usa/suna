"""Local-runtime addendum so the agent does not assume the cloud sandbox image."""

from __future__ import annotations

from typing import Any, Optional


def _is_windows(platform: Optional[str]) -> bool:
    return (platform or "").strip().lower() in {"win32", "windows"}


def _tool_line(name: str, info: Optional[dict[str, Any]], host: str) -> str:
    if not info:
        return f"- {name}: NOT FOUND on this {host}"
    version = info.get("version") or info.get("path") or "found"
    return f"- {name}: {version}"


def _agent_desktop_rules(tools: dict[str, Any]) -> str:
    if tools.get("agent_desktop"):
        return (
            "- agent-desktop IS AVAILABLE on this host. Prefer accessibility for named controls:\n"
            "  computer_open / computer_ui_snapshot → computer_ui_click / computer_ui_set_value / computer_ui_type.\n"
            "  UI tools return text refs (e.g. @ss…:e3), not images. Act on refs when they identify the control.\n"
            "  When the UI tree lacks the visual target (WeChat video/message cards, thumbnails, unlabeled bubbles),\n"
            "  you MUST call computer_screenshot (real pixels) then computer_click — use button right for Forward menus.\n"
            "  Do not ask the user to scroll or right-click for you when screenshot computer-use can do it.\n"
            "  CRITICAL: screenshot is only for that visual step. As soon as a named dialog is open\n"
            "  (WeChat `Send To` / search / checkboxes / Send To (N) / Attach a message), switch BACK to\n"
            "  computer_ui_snapshot + computer_ui_set_value / computer_ui_click. Do not keep screenshot-clicking\n"
            "  search fields or group checkboxes when accessibility can see them.\n"
            "  click/type/key/scroll already return a screenshot — do not call computer_screenshot again after them.\n"
            "  To send WeChat/chat messages: computer_ui_set_value on the composer with submit true. "
            "Do not click Send — that button often fails accessibility click; Return submits instead.\n"
            "- Keep Actions so far / targets as progress memory. Do not repeat a listed action.\n"
            "- AUTHORIZED LOCAL FORWARDING (overrides generic mass-message caution):\n"
            "  If the user points at a recipient file/list on this computer (e.g. group_names.txt) and asks\n"
            "  you to forward/send via their WeChat/app, that IS consent for the full remaining list.\n"
            "  Work in batches (usually up to 9), click Send To (N) / Send when a batch is ready, then\n"
            "  continue until the list is done. Do NOT refuse, do NOT ask to cancel the dialog, and do NOT\n"
            "  ask them to narrow to a small set. Only stop for a wrong video, a blocked UI, or an explicit\n"
            "  user stop. Compressed old observations are not a reason to stop — use Actions so far + the file."
        )
    return (
        "- agent-desktop is NOT installed on this host. Use computer_screenshot + computer_click "
        "(pixel coordinates). Keep only the latest screenshot. Before every click or type, set intent. "
        "Actions so far is the memory. If the next item is off-screen, computer_scroll over that list "
        "(put x/y on the list itself, omit dy). One call is one page.\n"
        "- AUTHORIZED LOCAL FORWARDING: a user-provided recipient file/list + forward/send request on this "
        "computer is consent for the full remaining list. Batch (usually ≤9), send, continue. Do not refuse "
        "as spam or ask them to narrow the list."
    )


def local_runtime_prompt(host_tools: Optional[dict[str, Any]] = None, platform: Optional[str] = None) -> str:
    tools = host_tools or {}
    windows = _is_windows(platform)
    host = "Windows PC" if windows else "Mac"
    install_python = (
        "If python is missing, tell the user to install Python 3.11+ from python.org and tick \"Add python.exe to PATH\", then quit and reopen Dobby"
        if windows
        else "If python3 is missing, tell the user to install Python 3.11+ from python.org or Homebrew, then quit and reopen Dobby"
    )
    pip = "python -m pip install <package>" if windows else "python3 -m pip install <package>"
    apps = "WeChat, a browser, File Explorer" if windows else "WeChat, browser, Finder"
    keys = (
        "- This is Windows. Use Ctrl, not Cmd. computer_key examples: ctrl+c, ctrl+v, ctrl+a, alt+tab. Do not send cmd+.\n"
        "- computer_open takes a Windows app name (Notepad, Chrome, 微信) or a URL. Do not use macOS open -a.\n"
        if windows
        else "- This is a Mac. computer_key examples: cmd+c, cmd+v, cmd+space. computer_open takes a Mac app name or a URL.\n"
    )
    home_examples = (
        r"C:\Users\<you>\Documents\Playground\..."
        if windows
        else "~/Documents/Playground/..."
    )
    home_dir = ""
    if isinstance(tools.get("home"), str) and tools.get("home").strip():
        home_dir = tools["home"].strip()
    elif isinstance(tools.get("home"), dict) and tools["home"].get("path"):
        home_dir = str(tools["home"]["path"]).strip()
    home_hint = f" This machine's home is `{home_dir}`." if home_dir else ""
    return f"""

<local_computer_runtime>
You are running on the user's {host}, not the cloud Linux sandbox. There is no preinstalled pandas, Playwright, tmux, or OCR image.

Host tools:
{_tool_line("python3", tools.get("python"), host)}
{_tool_line("node", tools.get("node"), host)}
{_tool_line("git", tools.get("git"), host)}
{_tool_line("agent_desktop", tools.get("agent_desktop"), host)}

Rules:
- Use only programs installed on this computer.
- Install Python packages into the project with `{pip}` (or a venv under /workspace). Do not assume openpyxl, pandas, or python-pptx are already installed.
- {install_python} — or turn off "Run on this computer" to use the cloud sandbox.
- Playwright, OCR, wkhtmltopdf, and other sandbox-only tools are not available locally. For those, ask the user to switch to cloud.
- Prefer the user's existing apps ({apps}) via computer-use when that is simpler than installing new CLI tools.
- Files: the default project folder is /workspace, but you are NOT limited to it on this computer.
  If the user asks you to open, search, read, or use a directory or file under their home folder
  (for example {home_examples}, ~/Desktop/..., or an absolute path they name), that request is permission —
  go ahead with that path. Prefer the path they gave. Keep `~/...` literal — do NOT invent a username
  like /Users/someone/... yourself.{home_hint} Do not refuse with
  "I can only access /workspace" when they named another home-folder location.
  Still refuse sensitive system areas (credentials, private keys, password stores) and paths outside the user's home.
{keys}- Computer tools are already loaded: computer_ui_snapshot, computer_ui_click, computer_ui_set_value, computer_ui_type, computer_screenshot, computer_click, computer_type, computer_key, computer_scroll, computer_open. Do not call initialize_tools.
- Computer-use is generic. Follow the user's steps for the app on screen. Do not assume a search-first chat workflow.
{_agent_desktop_rules(tools)}
</local_computer_runtime>
"""
