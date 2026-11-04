'use strict';

/**
 * Keep Dobby out of the way for a whole computer-use stretch.
 *
 * LLM gaps between tool calls are often a few seconds; restoring too soon
 * flickers Dobby back over WeChat. Waiting forever (or restoring without
 * focus) leaves the chat hidden after the agent stops with a message.
 *
 * Idle restore therefore waits long enough to cover typical step gaps, then
 * brings Dobby back WITH focus so the user can read the stop/ask message.
 * Dock / Cmd-Tab can also call restore({ focus: true }) immediately.
 */
// Backup only — the web UI also calls restoreUi IPC as soon as the agent stops.
const DOBBY_RESTORE_IDLE_MS = 20_000;

function createDobbyFocusSession({
  listVisibleWindows,
  listAllWindows,
  hideWindows,
  showWindows,
  isAnyWindowHidden,
  idleMs = DOBBY_RESTORE_IDLE_MS,
  delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let hiddenWindows = null;
  let restoreTimer = null;

  function cancelRestore() {
    if (restoreTimer) {
      clearTimer(restoreTimer);
      restoreTimer = null;
    }
  }

  function hide() {
    cancelRestore();
    if (hiddenWindows) return false;
    const windows = typeof listVisibleWindows === 'function' ? listVisibleWindows() : [];
    if (!windows.length) return false;
    hiddenWindows = windows;
    if (typeof hideWindows === 'function') hideWindows(windows);
    return true;
  }

  function restore({ focus = false } = {}) {
    cancelRestore();
    const tracked = hiddenWindows;
    hiddenWindows = null;
    const windows = typeof listAllWindows === 'function' ? listAllWindows() : [];
    if (typeof showWindows === 'function') {
      showWindows(windows, { focus, tracked });
    }
  }

  function scheduleRestore() {
    const stillHidden = Boolean(hiddenWindows)
      || (typeof isAnyWindowHidden === 'function' && isAnyWindowHidden());
    if (!stillHidden) return;
    cancelRestore();
    // Auto-return after the computer-use stretch settles, focused so the user
    // can see the agent's message instead of a hidden window.
    restoreTimer = setTimer(() => restore({ focus: true }), idleMs);
  }

  async function withHidden(fn) {
    // Always clear a pending restore so a mid-gap next step cannot race it.
    cancelRestore();
    if (hide()) await delay(200);
    try {
      return await fn();
    } finally {
      scheduleRestore();
    }
  }

  return {
    hide,
    restore,
    scheduleRestore,
    cancelRestore,
    withHidden,
    get hiddenWindows() { return hiddenWindows; },
    get pendingRestore() { return Boolean(restoreTimer); },
    idleMs,
  };
}

module.exports = {
  DOBBY_RESTORE_IDLE_MS,
  createDobbyFocusSession,
};
