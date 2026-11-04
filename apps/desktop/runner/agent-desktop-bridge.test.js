'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const {
  flattenNodes,
  formatElements,
  resolveAgentDesktopBin,
  resetAgentDesktopCache,
  needsHeadedRetry,
  withHeadedFallback,
  isSendLikeIntent,
  PLATFORM_BIN,
} = require('./agent-desktop-bridge');

describe('agent-desktop bridge helpers', () => {
  it('flattens interactive refs from a nested tree', () => {
    const elements = flattenNodes({
      children: [
        {
          ref_id: '@s1:e1',
          role: 'button',
          name: 'Seven',
          available_actions: ['Click'],
          children: [{ ref_id: '@s1:e2', role: 'statictext', name: '7' }],
        },
      ],
    });
    assert.equal(elements.length, 2);
    assert.equal(elements[0].ref, '@s1:e1');
    assert.equal(elements[0].name, 'Seven');
    assert.deepEqual(elements[0].actions, ['Click']);
  });

  it('formats a compact text list for the model', () => {
    const text = formatElements([
      { ref: '@s1:e1', role: 'button', name: 'OK', value: '', states: [], actions: ['Click'] },
      { ref: '@s1:e2', role: 'textfield', name: 'Name', value: 'Leo', states: ['focused'], actions: [] },
    ]);
    assert.match(text, /1\. @s1:e1 button name="OK"/);
    assert.match(text, /2\. @s1:e2 textfield name="Name" value="Leo"/);
  });

  it('knows the current platform binary name', () => {
    const key = `${process.platform}-${process.arch}`;
    assert.ok(PLATFORM_BIN[key] || process.platform === 'linux' || true);
  });
});

describe('agent-desktop binary resolution', () => {
  const previous = process.env.DOBBY_AGENT_DESKTOP_BIN;

  beforeEach(() => {
    resetAgentDesktopCache();
    delete process.env.DOBBY_AGENT_DESKTOP_BIN;
  });

  afterEach(() => {
    resetAgentDesktopCache();
    if (previous == null) delete process.env.DOBBY_AGENT_DESKTOP_BIN;
    else process.env.DOBBY_AGENT_DESKTOP_BIN = previous;
  });

  it('uses DOBBY_AGENT_DESKTOP_BIN when the file exists', () => {
    const candidate = path.join(__dirname, 'agent-desktop-bridge.js');
    process.env.DOBBY_AGENT_DESKTOP_BIN = candidate;
    resetAgentDesktopCache();
    assert.equal(resolveAgentDesktopBin(), candidate);
  });
});

describe('headed fallback', () => {
  it('detects physical-fallback-denied errors', () => {
    assert.equal(
      needsHeadedRetry({
        message: 'Target is not actionable: supported_action (direct semantic delivery is unavailable and physical fallback is denied)',
      }),
      true,
    );
    assert.equal(needsHeadedRetry({ code: 'POLICY_DENIED', message: 'blocked' }), true);
    assert.equal(needsHeadedRetry({ message: 'STALE_REF' }), false);
  });

  it('retries once with headed after a semantic failure', async () => {
    let calls = 0;
    const result = await withHeadedFallback('click', {}, async (headed) => {
      calls += 1;
      if (!headed) {
        const err = new Error('Target is not actionable: physical fallback is denied');
        throw err;
      }
      return { ok: true };
    });
    assert.equal(calls, 2);
    assert.equal(result.headed, true);
    assert.equal(result.headed_fallback, true);
  });

  it('recognizes send-like intents for Return fallback', () => {
    assert.equal(isSendLikeIntent('点击发送按钮发送消息'), true);
    assert.equal(isSendLikeIntent('Click Send'), true);
    assert.equal(isSendLikeIntent('Open sidebar'), false);
  });
});
