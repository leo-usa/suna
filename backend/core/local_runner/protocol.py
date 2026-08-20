"""JSON-RPC protocol between the backend and a local Dobby runner.

The runner dials out over WebSocket to `/v1/local-runner/ws`. After auth,
the backend sends JSON-RPC requests and the runner replies. Unsolicited
frames use `type: "event"`.

Handshake
---------
Client -> { "type": "auth", "device_token": "<plaintext token>" }
Client -> { "type": "hello", "capabilities": [...], "preview_port": 18080, "platform": "darwin", "host_tools": { ... } }
Server -> { "type": "ready", "device_id": "<uuid>" }

Heartbeat
---------
Either side may send { "type": "ping" }; the other replies { "type": "pong" }.
The backend treats a missing ping/pong for 45s as a disconnect.

RPC request (backend -> runner)
-------------------------------
{
  "jsonrpc": "2.0",
  "id": "<uuid>",
  "method": "<name>",
  "params": { ... }
}

RPC result / error
------------------
{ "jsonrpc": "2.0", "id": "<uuid>", "result": { ... } }
{ "jsonrpc": "2.0", "id": "<uuid>", "error": { "code": -32000, "message": "..." } }

Events (runner -> backend)
--------------------------
{ "type": "event", "event": "pty.data", "session_id": "...", "data": "..." }
{ "type": "event", "event": "pty.exit", "session_id": "...", "exit_code": 0 }
{ "type": "event", "event": "approval.needed", "request_id": "...", "kind": "shell", "command": "..." }
"""

from typing import FrozenSet

JSONRPC_VERSION = "2.0"

AUTH_TYPE = "auth"
HELLO_TYPE = "hello"
READY_TYPE = "ready"
PING_TYPE = "ping"
PONG_TYPE = "pong"
EVENT_TYPE = "event"

EVENT_PTY_DATA = "pty.data"
EVENT_PTY_EXIT = "pty.exit"
EVENT_APPROVAL_NEEDED = "approval.needed"

FS_DOWNLOAD_FILE = "fs.download_file"
FS_UPLOAD_FILE = "fs.upload_file"
FS_LIST_FILES = "fs.list_files"
FS_CREATE_FOLDER = "fs.create_folder"
FS_DELETE_FILE = "fs.delete_file"
FS_GET_FILE_INFO = "fs.get_file_info"
FS_SET_FILE_PERMISSIONS = "fs.set_file_permissions"
FS_MAKE_DIR = "fs.make_dir"

PROCESS_EXEC = "process.exec"
PROCESS_START = "process.start"
PROCESS_CREATE_SESSION = "process.create_session"
PROCESS_EXECUTE_SESSION_COMMAND = "process.execute_session_command"
PROCESS_GET_SESSION_COMMAND_LOGS = "process.get_session_command_logs"
PROCESS_DELETE_SESSION = "process.delete_session"
PROCESS_CREATE_PTY_SESSION = "process.create_pty_session"
PROCESS_PTY_INPUT = "process.pty_input"
PROCESS_PTY_KILL = "process.pty_kill"
PROCESS_PTY_RESIZE = "process.pty_resize"

COMPUTER_SCREENSHOT = "computer.screenshot"
COMPUTER_CLICK = "computer.click"
COMPUTER_TYPE = "computer.type"
COMPUTER_KEY = "computer.key"
COMPUTER_SCROLL = "computer.scroll"
COMPUTER_OPEN = "computer.open"

WORKSPACE_DELETE = "workspace.delete"

RPC_METHODS: FrozenSet[str] = frozenset(
    {
        FS_DOWNLOAD_FILE,
        FS_UPLOAD_FILE,
        FS_LIST_FILES,
        FS_CREATE_FOLDER,
        FS_DELETE_FILE,
        FS_GET_FILE_INFO,
        FS_SET_FILE_PERMISSIONS,
        FS_MAKE_DIR,
        PROCESS_EXEC,
        PROCESS_START,
        PROCESS_CREATE_SESSION,
        PROCESS_EXECUTE_SESSION_COMMAND,
        PROCESS_GET_SESSION_COMMAND_LOGS,
        PROCESS_DELETE_SESSION,
        PROCESS_CREATE_PTY_SESSION,
        PROCESS_PTY_INPUT,
        PROCESS_PTY_KILL,
        PROCESS_PTY_RESIZE,
        COMPUTER_SCREENSHOT,
        COMPUTER_CLICK,
        COMPUTER_TYPE,
        COMPUTER_KEY,
        COMPUTER_SCROLL,
        COMPUTER_OPEN,
        WORKSPACE_DELETE,
    }
)

CAPABILITY_FS = "fs"
CAPABILITY_PROCESS = "process"
CAPABILITY_PTY = "pty"
CAPABILITY_PREVIEW = "preview"
CAPABILITY_COMPUTER_USE = "computer_use"

DEFAULT_PREVIEW_PORT = 18080
INBOX_KEY = "local-runner:inbox:{device_id}"
REPLY_KEY = "local-runner:reply:{request_id}"
ONLINE_KEY = "local-runner:online:{device_id}"
PTY_KEY = "local-runner:pty:{session_id}"
ONLINE_TTL_SECONDS = 45
RPC_TIMEOUT_SECONDS = 120
PTY_STREAM_TTL_SECONDS = 3600
