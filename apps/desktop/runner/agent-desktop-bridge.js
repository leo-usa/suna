'use strict';

/**
 * Thin wrapper around Vercel Labs agent-desktop (accessibility-tree computer use).
 * Optional: if the binary is missing, callers fall back to screenshot/click.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { shellPath } = require('./runtime');

const PLATFORM_BIN = {
  'darwin-arm64': 'agent-desktop-darwin-arm64',
  'darwin-x64': 'agent-desktop-darwin-x64',
  'linux-arm64': 'agent-desktop-linux-arm64',
  'linux-x64': 'agent-desktop-linux-x64',
  'win32-arm64': 'agent-desktop-win32-arm64.exe',
  'win32-x64': 'agent-desktop-win32-x64.exe',
};

let cachedBin = undefined; // undefined = not probed, null = missing, string = path

function platformKey() {
  return `${process.platform}-${process.arch}`;
}

function packagedBinRoots() {
  const roots = [];
  // Electron packaged app: Resources/agent-desktop (set by host or inferred).
  const resources = String(process.env.DOBBY_RESOURCES_PATH || '').trim();
  if (resources) roots.push(path.join(resources, 'agent-desktop'));
  // Dev / staged vendor next to the desktop app.
  roots.push(path.join(__dirname, '..', 'vendor', 'agent-desktop'));
  roots.push(path.join(__dirname, 'vendor', 'agent-desktop'));
  // npm-local install during development.
  roots.push(path.join(__dirname, '..', 'node_modules', 'agent-desktop', 'bin'));
  roots.push(path.join(__dirname, '..', '..', 'node_modules', 'agent-desktop', 'bin'));
  roots.push(path.join(__dirname, '..', '..', '..', 'node_modules', 'agent-desktop', 'bin'));
  return roots;
}

function macosHelperName() {
  if (process.platform !== 'darwin') return null;
  return process.arch === 'arm64'
    ? 'agent-desktop-macos-helper-darwin-arm64'
    : 'agent-desktop-macos-helper-darwin-x64';
}

function whichOnPath(name) {
  const dirs = String(shellPath()).split(path.delimiter).filter(Boolean);
  const names = process.platform === 'win32' ? [`${name}.cmd`, `${name}.exe`, name] : [name];
  for (const dir of dirs) {
    for (const candidateName of names) {
      const candidate = path.join(dir, candidateName);
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
      } catch (_) {
        /* ignore */
      }
    }
  }
  return null;
}

function resolveAgentDesktopBin() {
  if (cachedBin !== undefined) return cachedBin;

  const fromEnv = String(process.env.DOBBY_AGENT_DESKTOP_BIN || '').trim();
  if (fromEnv && fs.existsSync(fromEnv)) {
    cachedBin = fromEnv;
    return cachedBin;
  }

  const nativeName = PLATFORM_BIN[platformKey()];
  if (nativeName) {
    for (const root of packagedBinRoots()) {
      const candidate = path.join(root, nativeName);
      try {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          const helper = macosHelperName();
          if (helper && !process.env.AGENT_DESKTOP_MACOS_HELPER_PATH) {
            const helperPath = path.join(root, helper);
            if (fs.existsSync(helperPath)) {
              process.env.AGENT_DESKTOP_MACOS_HELPER_PATH = helperPath;
            }
          }
          cachedBin = candidate;
          return cachedBin;
        }
      } catch (_) {
        /* ignore */
      }
    }
  }

  // Prefer the native binary next to the npm launcher when installed globally
  // (developers only — end-user installs ship the binary inside the app).
  const launcher = whichOnPath('agent-desktop');
  if (launcher) {
    const sibling = nativeName ? path.join(path.dirname(launcher), nativeName) : null;
    if (sibling && fs.existsSync(sibling)) {
      cachedBin = sibling;
      return cachedBin;
    }
    cachedBin = launcher;
    return cachedBin;
  }

  cachedBin = null;
  return cachedBin;
}

function resetAgentDesktopCache() {
  cachedBin = undefined;
}

function isAgentDesktopAvailable() {
  return Boolean(resolveAgentDesktopBin());
}

function runAgentDesktop(args, options = {}) {
  const bin = resolveAgentDesktopBin();
  if (!bin) {
    const err = new Error(
      'Accessibility computer-use (agent-desktop) is not available in this Dobby build. Use screenshot computer tools, or reinstall a build that includes agent-desktop.',
    );
    err.code = 'AGENT_DESKTOP_MISSING';
    return Promise.reject(err);
  }

  const timeout = Number(options.timeout) || 20000;
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      {
        timeout,
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        env: {
          ...process.env,
          PATH: shellPath(),
          // Prefer semantic (non-headed) delivery so we do not steal the cursor.
        },
      },
      (error, stdout, stderr) => {
        const text = String(stdout || '').trim();
        let envelope = null;
        if (text) {
          try {
            envelope = JSON.parse(text);
          } catch (_) {
            /* fall through */
          }
        }

        if (envelope && envelope.ok === false) {
          const code = envelope.error && envelope.error.code;
          const message =
            (envelope.error && (envelope.error.message || envelope.error.suggestion)) ||
            `agent-desktop ${args[0] || 'command'} failed`;
          const err = new Error(message);
          err.code = code || 'AGENT_DESKTOP_ERROR';
          err.envelope = envelope;
          reject(err);
          return;
        }

        if (error && !envelope) {
          const err = new Error(
            String(stderr || error.message || 'agent-desktop failed').trim() || 'agent-desktop failed',
          );
          err.code = error.killed ? 'AGENT_DESKTOP_TIMEOUT' : error.code || 'AGENT_DESKTOP_ERROR';
          reject(err);
          return;
        }

        if (!envelope) {
          reject(new Error('agent-desktop returned no JSON'));
          return;
        }

        resolve(envelope);
      },
    );
  });
}

function flattenNodes(node, out = []) {
  if (!node || typeof node !== 'object') return out;
  if (node.ref_id) {
    out.push({
      ref: node.ref_id,
      role: node.role || '',
      name: node.name || '',
      value: node.value == null ? '' : String(node.value),
      states: Array.isArray(node.states) ? node.states : [],
      actions: Array.isArray(node.available_actions) ? node.available_actions : [],
      children_count: node.children_count,
    });
  }
  const children = node.children;
  if (Array.isArray(children)) {
    for (const child of children) flattenNodes(child, out);
  }
  return out;
}

function formatElements(elements, limit = 120) {
  const rows = (elements || []).slice(0, limit).map((el, i) => {
    const bits = [`${i + 1}. ${el.ref}`, el.role || 'element'];
    if (el.name) bits.push(`name=${JSON.stringify(el.name)}`);
    if (el.value) bits.push(`value=${JSON.stringify(el.value)}`);
    if (el.states && el.states.length) bits.push(`states=${el.states.join(',')}`);
    if (el.children_count) bits.push(`children_count=${el.children_count}`);
    return bits.join(' ');
  });
  if ((elements || []).length > limit) {
    rows.push(`… ${elements.length - limit} more elements omitted`);
  }
  return rows.join('\n');
}

async function axStatus() {
  const bin = resolveAgentDesktopBin();
  if (!bin) {
    return { available: false, reason: 'not_installed' };
  }
  try {
    const envelope = await runAgentDesktop(['status'], { timeout: 8000 });
    const data = envelope.data || {};
    return {
      available: true,
      bin,
      version: data.version || null,
      platform: data.platform || process.platform,
      permissions: data.permissions || null,
      supported_surfaces: data.supported_surfaces || [],
    };
  } catch (err) {
    return {
      available: false,
      bin,
      reason: err && err.message ? err.message : String(err),
      code: err && err.code,
    };
  }
}

async function axSnapshot(payload = {}) {
  const args = ['snapshot'];
  if (payload.root) {
    args.push('--root', String(payload.root));
  } else if (payload.app) {
    args.push('--app', String(payload.app));
  } else if (payload.window_id) {
    args.push('--window-id', String(payload.window_id));
  }

  const skeleton = payload.skeleton !== false && !payload.root;
  if (skeleton) args.push('--skeleton');
  if (payload.interactive !== false) args.push('-i');
  if (payload.compact !== false) args.push('--compact');
  if (payload.max_depth != null) args.push('--max-depth', String(payload.max_depth));

  const envelope = await runAgentDesktop(args, { timeout: Number(payload.timeout_ms) || 20000 });
  const data = envelope.data || {};
  const elements = flattenNodes(data.tree);
  return {
    ok: true,
    mode: 'ax',
    app: data.app || payload.app || null,
    snapshot_id: data.snapshot_id || null,
    complete: data.complete !== false,
    truncated: Boolean(data.truncated),
    ref_count: data.ref_count != null ? data.ref_count : elements.length,
    elements,
    text: formatElements(elements),
  };
}

function needsHeadedRetry(err) {
  if (!err || (err && err.__headedAttempted)) return false;
  const code = String(err.code || '');
  const message = String(err.message || '');
  // Semantic AX delivery failed and headless mode blocked moving the real cursor.
  if (/physical fallback is denied/i.test(message)) return true;
  if (/not actionable/i.test(message) && /semantic/i.test(message)) return true;
  if (code === 'POLICY_DENIED') return true;
  if (/supported_action/i.test(message) && /unavailable/i.test(message)) return true;
  return false;
}

async function withHeadedFallback(actionName, payload, runOnce) {
  try {
    const result = await runOnce(Boolean(payload.headed));
    if (payload.headed) result.headed = true;
    return result;
  } catch (err) {
    if (payload.headed || !needsHeadedRetry(err)) throw err;
    console.warn(`[agent-desktop] ${actionName} semantic path failed; retrying with --headed:`, err.message || err);
    try {
      const result = await runOnce(true);
      result.headed = true;
      result.headed_fallback = true;
      return result;
    } catch (headedErr) {
      headedErr.__headedAttempted = true;
      throw headedErr;
    }
  }
}

async function axClick(payload = {}) {
  const ref = String(payload.ref || '').trim();
  if (!ref) throw new Error('Missing ref');
  try {
    return await withHeadedFallback('click', payload, async (headed) => {
      const args = ['click', ref];
      if (headed) args.push('--headed');
      const envelope = await runAgentDesktop(args, { timeout: 15000 });
      return { ok: true, mode: 'ax', ref, data: envelope.data || {} };
    });
  } catch (err) {
    // WeChat/Electron "Send" often has a broken AX click target. Return/Enter
    // submits the focused composer instead.
    const allowReturn =
      payload.submit_fallback !== false &&
      (payload.submit_fallback === true ||
        isSendLikeIntent(payload.intent) ||
        /owning window|not actionable|physical fallback/i.test(String(err && err.message || '')));
    if (!allowReturn) throw err;
    console.warn('[agent-desktop] click failed; pressing Return to submit:', err.message || err);
    const pressed = await axPress({
      key: 'return',
      app: payload.app,
      headed: true,
    });
    return {
      ok: true,
      mode: 'ax',
      ref,
      data: pressed.data || {},
      submit_fallback: 'return',
      click_error: String(err.message || err),
    };
  }
}

async function axSetValue(payload = {}) {
  const ref = String(payload.ref || '').trim();
  if (!ref) throw new Error('Missing ref');
  const value = payload.value == null ? '' : String(payload.value);
  return withHeadedFallback('set-value', payload, async (headed) => {
    const args = ['set-value', ref, value];
    if (headed) args.push('--headed');
    const envelope = await runAgentDesktop(args, { timeout: 15000 });
    return { ok: true, mode: 'ax', ref, value, data: envelope.data || {} };
  });
}

async function axType(payload = {}) {
  const ref = String(payload.ref || '').trim();
  if (!ref) throw new Error('Missing ref');
  const text = payload.text == null ? '' : String(payload.text);
  return withHeadedFallback('type', payload, async (headed) => {
    const args = ['type', ref, text];
    if (headed) args.push('--headed');
    const envelope = await runAgentDesktop(args, { timeout: 15000 });
    return { ok: true, mode: 'ax', ref, text, data: envelope.data || {} };
  });
}

async function resolveWindowTarget(appName) {
  const name = String(appName || '').trim();
  if (!name) return null;
  try {
    const envelope = await runAgentDesktop(['list-windows', '--app', name], { timeout: 10000 });
    const windows = Array.isArray(envelope.data) ? envelope.data : (envelope.data && envelope.data.windows) || [];
    if (!windows.length) return null;
    const preferred =
      windows.find((w) => w && w.is_focused) ||
      windows.find((w) => w && w.visible && !w.minimized) ||
      windows[0];
    if (!preferred) return null;
    return {
      window_id: preferred.id || preferred.window_id || null,
      pid: preferred.pid || null,
      title: preferred.title || null,
      app_name: preferred.app_name || name,
    };
  } catch (err) {
    console.warn('[agent-desktop] list-windows failed for', name, err.message || err);
    return null;
  }
}

async function axPress(payload = {}) {
  const combo = String(payload.key || payload.combo || 'return').trim();
  if (!combo) throw new Error('Missing key');

  // WeChat registers multiple helper processes under the same name. Prefer a
  // concrete window id so press does not fail with "Multiple application instances".
  let windowId = payload.window_id || null;
  if (!windowId && payload.app) {
    const target = await resolveWindowTarget(payload.app);
    windowId = target && target.window_id;
  }

  return withHeadedFallback('press', payload, async (headed) => {
    const args = ['press', combo];
    if (windowId) args.push('--window-id', String(windowId));
    else if (payload.app) args.push('--app', String(payload.app));
    if (headed) args.push('--headed');
    try {
      const envelope = await runAgentDesktop(args, { timeout: 15000 });
      return {
        ok: true,
        mode: 'ax',
        key: combo,
        window_id: windowId || null,
        data: envelope.data || {},
      };
    } catch (err) {
      const message = String(err && err.message || '');
      // Last resort: no app/window scoping — physical key to the frontmost app.
      if (headed && /multiple application instances/i.test(message) && (windowId || payload.app)) {
        console.warn('[agent-desktop] press scoped target failed; retrying frontmost headed key');
        const envelope = await runAgentDesktop(['press', combo, '--headed'], { timeout: 15000 });
        return {
          ok: true,
          mode: 'ax',
          key: combo,
          window_id: null,
          frontmost_fallback: true,
          data: envelope.data || {},
        };
      }
      throw err;
    }
  });
}

function isSendLikeIntent(intent) {
  const text = String(intent || '').toLowerCase();
  return /send|提交|发送|送出|发出/.test(text);
}

function probeAgentDesktopHostTool() {
  const bin = resolveAgentDesktopBin();
  if (!bin) return null;
  return {
    path: bin,
    version: path.basename(bin),
    home: path.join(os.homedir(), '.agent-desktop'),
  };
}

module.exports = {
  PLATFORM_BIN,
  resolveAgentDesktopBin,
  resetAgentDesktopCache,
  isAgentDesktopAvailable,
  runAgentDesktop,
  flattenNodes,
  formatElements,
  needsHeadedRetry,
  withHeadedFallback,
  axStatus,
  axSnapshot,
  axClick,
  axSetValue,
  axType,
  axPress,
  resolveWindowTarget,
  isSendLikeIntent,
  probeAgentDesktopHostTool,
};
