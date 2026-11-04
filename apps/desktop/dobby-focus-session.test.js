'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { DOBBY_RESTORE_IDLE_MS, createDobbyFocusSession } = require('./dobby-focus-session');

function makeSession(overrides = {}) {
  const windows = overrides.windows || [{ id: 1, visible: true, focused: false }];
  const timers = [];
  const shown = [];
  const session = createDobbyFocusSession({
    idleMs: overrides.idleMs || DOBBY_RESTORE_IDLE_MS,
    delay: async () => {},
    setTimer: (fn, ms) => {
      const entry = { fn, ms, cleared: false };
      timers.push(entry);
      return entry;
    },
    clearTimer: (entry) => {
      if (entry) entry.cleared = true;
    },
    listVisibleWindows: () => windows.filter((w) => w.visible),
    listAllWindows: () => windows,
    hideWindows: (wins) => {
      for (const win of wins) win.visible = false;
    },
    showWindows: (wins, { focus, tracked }) => {
      shown.push({ focus, trackedCount: tracked ? tracked.length : 0 });
      for (const win of wins) {
        const shouldShow = !win.visible || (tracked && tracked.includes(win));
        if (!shouldShow) continue;
        win.visible = true;
        win.focused = Boolean(focus);
      }
    },
    isAnyWindowHidden: () => windows.some((w) => !w.visible),
    ...overrides.session,
  });
  return { session, windows, timers, shown };
}

describe('dobby focus session', () => {
  it('waits long enough to cover LLM gaps but not so long the chat feels stuck', () => {
    assert.ok(DOBBY_RESTORE_IDLE_MS >= 15_000);
    assert.ok(DOBBY_RESTORE_IDLE_MS <= 45_000);
  });

  it('hides once, resets the restore timer on each step, then restores with focus', async () => {
    const { session, windows, timers, shown } = makeSession({ idleMs: 25_000 });

    await session.withHidden(async () => 'one');
    assert.equal(windows[0].visible, false);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].ms, 25_000);

    await session.withHidden(async () => 'two');
    assert.equal(timers[0].cleared, true);
    assert.equal(timers.length, 2);
    assert.equal(windows[0].visible, false);

    timers[1].fn();
    assert.equal(windows[0].visible, true);
    assert.equal(shown.at(-1).focus, true);
    assert.equal(windows[0].focused, true);
  });

  it('restores with focus when requested (dock / Cmd-Tab)', () => {
    const { session, windows } = makeSession();
    session.hide();
    assert.equal(windows[0].visible, false);
    session.restore({ focus: true });
    assert.equal(windows[0].visible, true);
    assert.equal(windows[0].focused, true);
  });
});
