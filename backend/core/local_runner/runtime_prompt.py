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
    return f"""

<local_computer_runtime>
You are running on the user's {host}, not the cloud Linux sandbox. There is no preinstalled pandas, Playwright, tmux, or OCR image.

Host tools:
{_tool_line("python3", tools.get("python"), host)}
{_tool_line("node", tools.get("node"), host)}
{_tool_line("git", tools.get("git"), host)}

Rules:
- Use only programs installed on this computer.
- Install Python packages into the project with `{pip}` (or a venv under /workspace). Do not assume openpyxl, pandas, or python-pptx are already installed.
- {install_python} — or turn off "Run on this computer" to use the cloud sandbox.
- Playwright, OCR, wkhtmltopdf, and other sandbox-only tools are not available locally. For those, ask the user to switch to cloud.
- Prefer the user's existing apps ({apps}) via computer-use when that is simpler than installing new CLI tools.
{keys}- Computer tools are already loaded: computer_screenshot, computer_click, computer_type, computer_key, computer_scroll, computer_open. Do not call initialize_tools.
- Computer-use is generic. Follow the user's steps for the app on screen. Do not assume a search-first chat workflow.
- Keep only the latest screenshot. Before every click or type, set intent to what you are about to do and which visible control you will use. Actions so far is the memory. Do not repeat a listed action. The screenshot is only for the next unused control's coordinates. If the next item is off-screen, computer_scroll over that list (put x/y on the list itself, omit dy). One call is one page. Keep going.
</local_computer_runtime>
"""
