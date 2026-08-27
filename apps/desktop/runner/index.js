'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const WebSocket = require('ws');
const { WorkspaceEscapeError, resolveWorkspacePath, rewriteWorkspaceCommand, ensureWorkspace, deleteProjectWorkspace } = require('./workspace');
const { startPreviewServer } = require('./preview');
const { runComputerAction } = require('./computer');
const { shellPath, probeHostTools, missingToolHint } = require('./runtime');

const PREVIEW_PORT = Number(process.env.DOBBY_PREVIEW_PORT || 18080);
const HOME = process.env.DOBBY_HOME || os.homedir();
const AUTO_APPROVE = process.env.DOBBY_AUTO_APPROVE === '1';
const TOKEN = process.env.DOBBY_DEVICE_TOKEN || '';
const BACKEND_WS = process.env.DOBBY_BACKEND_WS || '';
const PING_MS = 15000;

const sessions = new Map();
const ptys = new Map();
const sessionAllow = new Set();
const permanentAllow = new Set((process.env.DOBBY_ALLOWLIST || '').split('\n').filter(Boolean));
const pendingApprovals = new Map();
const pendingComputer = new Map();
const hostTools = probeHostTools();
let audit = [];

function logAudit(entry) {
  const row = { at: new Date().toISOString(), ...entry };
  audit.push(row);
  if (audit.length > 200) audit = audit.slice(-200);
  sendParent({ type: 'audit', entry: row });
}

function sendParent(message) {
  if (typeof process.send === 'function') {
    process.send(message);
  }
}

function jsonrpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function jsonrpcError(id, message, code = -32000) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function accessMessage(err, target) {
  const code = err && err.code;
  if (code === 'EPERM' || code === 'EACCES') {
    return `macOS blocked access to ${target}. In System Settings → Privacy & Security → Files and Folders, enable Documents for Dobby, then fully quit (Cmd+Q) and reopen.`;
  }
  return err && err.message ? err.message : String(err);
}

function requireProject(params) {
  const projectId = params && params.project_id;
  if (!projectId) throw new Error('Missing project_id');
  try {
    ensureWorkspace(HOME, projectId, params.project_name);
  } catch (err) {
    throw new Error(accessMessage(err, path.join(HOME, 'Documents', 'Dobby')));
  }
  return projectId;
}

function localPath(params, virtualPath) {
  const projectId = requireProject(params);
  return resolveWorkspacePath(HOME, projectId, virtualPath || '/workspace', params.project_name);
}

function fileInfo(filePath) {
  const stat = fs.statSync(filePath);
  return {
    name: path.basename(filePath),
    is_dir: stat.isDirectory(),
    size: stat.size,
    mod_time: stat.mtime.toISOString(),
    permissions: (stat.mode & 0o777).toString(8),
  };
}

function commandShape(command) {
  const trimmed = String(command || '').trim();
  const first = trimmed.split(/\s+/)[0] || trimmed;
  return first;
}

function askHost(kind, payload) {
  if (typeof process.send !== 'function') {
    return runComputerAction(kind, payload);
  }
  const requestId = `cpu_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    pendingComputer.set(requestId, { resolve, reject });
    sendParent({ type: 'computer-request', requestId, kind, payload: payload || {} });
    setTimeout(() => {
      if (pendingComputer.has(requestId)) {
        pendingComputer.delete(requestId);
        reject(new Error('Computer request timed out'));
      }
    }, 120000);
  });
}

function waitForApproval(command) {
  if (AUTO_APPROVE || process.env.DOBBY_ALLOW_ALL === '1' || permanentAllow.has('*') || sessionAllow.has('*')) {
    return Promise.resolve('once');
  }
  const shape = commandShape(command);
  if (sessionAllow.has(shape) || permanentAllow.has(shape) || permanentAllow.has(command)) {
    return Promise.resolve('once');
  }
  if (typeof process.send !== 'function') {
    return Promise.resolve('once');
  }
  const requestId = `apr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    pendingApprovals.set(requestId, { resolve, reject });
    sendParent({ type: 'approval', requestId, command, shape });
    setTimeout(() => {
      if (pendingApprovals.has(requestId)) {
        pendingApprovals.delete(requestId);
        reject(new Error('Shell approval timed out'));
      }
    }, 120000);
  }).then((decision) => {
    if (decision === 'deny') throw new Error('Command denied');
    if (decision === 'always' || decision === 'allow-all') {
      sessionAllow.add('*');
      permanentAllow.add('*');
      sendParent({ type: 'allow-all' });
    } else if (decision === 'session') {
      sessionAllow.add(shape);
    }
    return decision;
  });
}

function existingDir(candidate, fallback) {
  try {
    if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) return candidate;
  } catch (_) { /* ignore */ }
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

function execCommand(command, cwd, env, timeoutMs, projectRoot, onChild) {
  const root = projectRoot || cwd;
  try {
    fs.mkdirSync(root, { recursive: true });
  } catch (err) {
    const message = accessMessage(err, root);
    return Promise.resolve({
      exit_code: 1,
      stdout: '',
      stderr: message,
      result: '',
    });
  }
  const workdir = existingDir(cwd, root);
  const tmpDir = path.join(root, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const rewritten = rewriteWorkspaceCommand(String(command || ''), root).split('/tmp/').join(`${tmpDir}/`);
  return new Promise((resolve) => {
    const child = exec(rewritten, {
      cwd: workdir,
      env: { ...process.env, PATH: shellPath(), HOME, TMPDIR: tmpDir, ...(env || {}) },
      timeout: timeoutMs || 120000,
      maxBuffer: 8 * 1024 * 1024,
      shell: true,
    }, (error, stdout, stderr) => {
      const combined = `${stderr || ''}${error && !stderr ? `${error.message}\n` : ''}`;
      const hint = missingToolHint(rewritten, combined);
      resolve({
        exit_code: error && typeof error.code === 'number' ? error.code : (error ? 1 : 0),
        stdout: stdout || '',
        stderr: hint ? `${combined}${combined.endsWith('\n') ? '' : '\n'}${hint}` : combined,
        result: stdout || '',
      });
    });
    if (typeof onChild === 'function') onChild(child);
  });
}

class PtySession {
  constructor({ projectId, cwd, sessionId, projectRoot, projectName }) {
    this.projectId = projectId;
    this.cwd = cwd;
    this.sessionId = sessionId;
    this.projectRoot = projectRoot;
    this.projectName = projectName;
    this.buffer = '';
    this.queue = Promise.resolve();
    this.alive = true;
    this.child = null;
  }

  sendData(text) {
    if (text) sendEvent({ event: 'pty.data', session_id: this.sessionId, data: text });
  }

  write(data) {
    this.queue = this.queue.then(() => this._handle(String(data || ''))).catch((err) => {
      this.sendData(`\n${err && err.message ? err.message : String(err)}\n`);
    });
  }

  async _handle(text) {
    if (!this.alive) return;
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const trimmed = normalized.trim();
    const isCdOnly = /^cd(?:\s|$)/.test(trimmed) && !/[;&|]/.test(trimmed);
    if (!isCdOnly) this.sendData(rewriteWorkspaceCommand(text, this.projectRoot));
    this.buffer += normalized;
    await this._drain();
  }

  async _drain() {
    while (this.alive) {
      const firstLine = this.buffer.match(/^([^\n]*)\n/);
      if (firstLine && /^cd(?:\s|$)/.test(firstLine[1].trim()) && !/[;&|]/.test(firstLine[1])) {
        this.buffer = this.buffer.slice(firstLine[0].length);
        this._cd(firstLine[1].trim().replace(/^cd\s*/, '').trim());
        continue;
      }
      if (!this.buffer.includes('\n')) return;
      if (!this.buffer.includes('__CMD_DONE_') && /<<-?\s*['"]?\w+['"]?\s*$/m.test(this.buffer)) return;
      const command = this.buffer.replace(/\n$/, '');
      this.buffer = '';
      if (command.trim()) await this._exec(command);
      return;
    }
  }

  _cd(target) {
    const raw = String(target || '').replace(/^['"]|['"]$/g, '') || '/workspace';
    try {
      this.cwd = resolveWorkspacePath(HOME, this.projectId, raw, this.projectName);
      fs.mkdirSync(this.cwd, { recursive: true });
    } catch (err) {
      this.sendData(`cd: ${err.message}\n`);
      this.cwd = this.projectRoot;
    }
  }

  _complete(command, extra, exitCode) {
    if (extra) this.sendData(extra);
    const marker = String(command).match(/__CMD_DONE_[A-Za-z0-9]+__/);
    if (marker) this.sendData(`${marker[0]} ${exitCode}\n`);
  }

  async _exec(command) {
    try {
      await waitForApproval(command);
    } catch (err) {
      this._complete(command, `${err.message}\n`, 1);
      return;
    }
    if (!this.alive) return;
    logAudit({ method: 'process.pty_input', command, project_id: this.projectId });
    const result = await execCommand(command, this.cwd, null, 300000, this.projectRoot, (child) => {
      this.child = child;
    });
    this.child = null;
    if (!this.alive) return;
    const output = `${result.stdout || ''}${result.stderr || ''}`;
    if (output) this.sendData(output);
    if (!output.includes('__CMD_DONE_')) this._complete(command, '', result.exit_code);
  }

  kill() {
    this.alive = false;
    if (this.child) {
      try { this.child.kill('SIGKILL'); } catch (_) { /* ignore */ }
    }
  }
}

async function handleRpc(method, params) {
  params = params || {};
  switch (method) {
    case 'fs.download_file': {
      const target = localPath(params, params.path);
      const content = fs.readFileSync(target);
      return { content_b64: content.toString('base64') };
    }
    case 'fs.upload_file': {
      const target = localPath(params, params.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, Buffer.from(params.content_b64 || '', 'base64'));
      return { ok: true };
    }
    case 'fs.list_files': {
      const target = localPath(params, params.path);
      let names;
      try {
        fs.mkdirSync(target, { recursive: true });
        names = fs.readdirSync(target);
      } catch (err) {
        throw new Error(accessMessage(err, target));
      }
      return {
        files: names.map((name) => fileInfo(path.join(target, name))),
      };
    }
    case 'fs.create_folder':
    case 'fs.make_dir': {
      const target = localPath(params, params.path);
      fs.mkdirSync(target, { recursive: true });
      if (params.mode) {
        try { fs.chmodSync(target, parseInt(String(params.mode), 8)); } catch (_) { /* ignore */ }
      }
      return { ok: true };
    }
    case 'fs.delete_file': {
      const target = localPath(params, params.path);
      fs.rmSync(target, { recursive: true, force: true });
      return { ok: true };
    }
    case 'fs.get_file_info': {
      return fileInfo(localPath(params, params.path));
    }
    case 'fs.set_file_permissions': {
      const target = localPath(params, params.path);
      fs.chmodSync(target, parseInt(String(params.permissions), 8));
      return { ok: true };
    }
    case 'process.exec':
    case 'process.start': {
      const projectId = requireProject(params);
      const projectRoot = ensureWorkspace(HOME, projectId, params.project_name);
      const cwd = params.cwd
        ? resolveWorkspacePath(HOME, projectId, params.cwd, params.project_name)
        : projectRoot;
      await waitForApproval(params.command);
      logAudit({ method, command: params.command, project_id: projectId });
      return execCommand(params.command, cwd, params.env, undefined, projectRoot);
    }
    case 'process.create_session': {
      const projectId = requireProject(params);
      sessions.set(params.session_id, {
        projectId,
        projectName: params.project_name,
        cwd: ensureWorkspace(HOME, projectId, params.project_name),
        logs: new Map(),
      });
      return { ok: true };
    }
    case 'process.execute_session_command': {
      const session = sessions.get(params.session_id);
      if (!session) throw new Error('Unknown session');
      await waitForApproval(params.command);
      logAudit({ method, command: params.command, session_id: params.session_id });
      const projectRoot = ensureWorkspace(HOME, session.projectId, session.projectName);
      const cwd = params.cwd
        ? resolveWorkspacePath(HOME, session.projectId, params.cwd, session.projectName)
        : session.cwd;
      const result = await execCommand(params.command, cwd, null, undefined, projectRoot);
      const cmdId = params.command_id || `cmd_${Date.now()}`;
      session.logs.set(cmdId, `${result.stdout || ''}${result.stderr || ''}`);
      return { cmd_id: cmdId, exit_code: result.exit_code };
    }
    case 'process.get_session_command_logs': {
      const session = sessions.get(params.session_id);
      if (!session) throw new Error('Unknown session');
      return { output: session.logs.get(params.command_id) || '' };
    }
    case 'process.delete_session': {
      sessions.delete(params.session_id);
      return { ok: true };
    }
    case 'process.create_pty_session': {
      const projectId = requireProject(params);
      const projectRoot = ensureWorkspace(HOME, projectId, params.project_name);
      const cwd = params.cwd
        ? resolveWorkspacePath(HOME, projectId, params.cwd, params.project_name)
        : projectRoot;
      ptys.set(params.session_id, new PtySession({
        projectId,
        cwd,
        sessionId: params.session_id,
        projectRoot,
        projectName: params.project_name,
      }));
      return { ok: true };
    }
    case 'process.pty_input': {
      const session = ptys.get(params.session_id);
      if (session) session.write(params.data || '');
      return { ok: true };
    }
    case 'process.pty_kill': {
      const session = ptys.get(params.session_id);
      if (session) session.kill();
      ptys.delete(params.session_id);
      return { ok: true };
    }
    case 'process.pty_resize': {
      return { ok: true };
    }
    case 'computer.screenshot':
      logAudit({ method, project_id: params.project_id });
      return askHost('screenshot', params);
    case 'computer.click':
      logAudit({ method, project_id: params.project_id, x: params.x, y: params.y });
      return askHost('click', params);
    case 'computer.type':
      logAudit({ method, project_id: params.project_id });
      return askHost('type', params);
    case 'computer.key':
      logAudit({ method, project_id: params.project_id, key: params.key });
      return askHost('key', params);
    case 'computer.scroll':
      logAudit({ method, project_id: params.project_id });
      return askHost('scroll', params);
    case 'computer.open':
      logAudit({ method, project_id: params.project_id, target: params.target });
      return askHost('open', params);
    case 'workspace.delete': {
      const projectId = params.project_id;
      if (!projectId) throw new Error('Missing project_id');
      logAudit({ method, project_id: projectId });
      return deleteProjectWorkspace(HOME, projectId);
    }
    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

let socket = null;
let pingTimer = null;
let reconnectTimer = null;
let backoffMs = 1000;
let connectGeneration = 0;
let stopping = false;

function sendEvent(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'event', ...payload }));
  }
}

function sendJson(obj) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(obj));
  }
}

async function onMessage(raw) {
  let message;
  try {
    message = JSON.parse(raw.toString());
  } catch (_) {
    return;
  }
  if (message.type === 'pong' || message.type === 'ping') {
    if (message.type === 'ping') sendJson({ type: 'pong' });
    return;
  }
  if (message.type === 'ready') {
    sendParent({ type: 'status', status: 'online', deviceId: message.device_id });
    backoffMs = 1000;
    return;
  }
  if (message.jsonrpc === '2.0' && message.method) {
    try {
      const result = await handleRpc(message.method, message.params);
      sendJson(jsonrpcResult(message.id, result));
    } catch (err) {
      const safe = err instanceof WorkspaceEscapeError ? err.message : (err.message || String(err));
      sendJson(jsonrpcError(message.id, safe));
    }
  }
}

function closeSocket() {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  const old = socket;
  socket = null;
  if (!old) return;
  try { old.removeAllListeners(); } catch (_) { /* ignore */ }
  try { old.terminate(); } catch (_) {
    try { old.close(); } catch (__) { /* ignore */ }
  }
}

function connect() {
  if (stopping || !TOKEN || !BACKEND_WS) {
    if (!TOKEN || !BACKEND_WS) {
      sendParent({ type: 'status', status: 'error', error: 'Missing device token or backend URL' });
    }
    return;
  }
  const gen = ++connectGeneration;
  closeSocket();
  sendParent({ type: 'status', status: 'connecting' });
  const ws = new WebSocket(BACKEND_WS);
  socket = ws;
  ws.on('open', () => {
    if (gen !== connectGeneration || socket !== ws) return;
    sendJson({ type: 'auth', device_token: TOKEN });
    sendJson({
      type: 'hello',
      capabilities: ['fs', 'process', 'pty', 'preview', 'computer_use'],
      preview_port: PREVIEW_PORT,
      platform: process.platform,
      host_tools: hostTools,
    });
    if (pingTimer) clearInterval(pingTimer);
    pingTimer = setInterval(() => sendJson({ type: 'ping' }), PING_MS);
  });
  ws.on('message', onMessage);
  ws.on('close', () => {
    if (gen !== connectGeneration || stopping) return;
    sendParent({ type: 'status', status: 'offline' });
    scheduleReconnect();
  });
  ws.on('error', (err) => {
    if (gen !== connectGeneration || stopping) return;
    sendParent({ type: 'status', status: 'error', error: err.message });
  });
}

function scheduleReconnect() {
  if (stopping) return;
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, backoffMs);
  backoffMs = Math.min(backoffMs * 2, 15000);
}

function shutdown() {
  stopping = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  closeSocket();
}

process.on('message', (message) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'approval-result') {
    const pending = pendingApprovals.get(message.requestId);
    if (pending) {
      pendingApprovals.delete(message.requestId);
      pending.resolve(message.decision);
    }
  }
  if (message.type === 'computer-result') {
    const pending = pendingComputer.get(message.requestId);
    if (pending) {
      pendingComputer.delete(message.requestId);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
    }
  }
  if (message.type === 'stop') {
    shutdown();
    process.exit(0);
  }
});

process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

startPreviewServer({ port: PREVIEW_PORT, home: HOME })
  .then(() => {
    sendParent({ type: 'status', status: 'preview', previewPort: PREVIEW_PORT });
    connect();
  })
  .catch((err) => {
    sendParent({ type: 'status', status: 'error', error: `Preview server failed: ${err.message}` });
    connect();
  });
