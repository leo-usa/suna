/**
 * Feishu / Lark bot: WebSocket long connection → backend bridge API.
 *
 * Uses /bridge/chat/start + /snapshot + /finalize (same as Telegram).
 * Event handler returns within 3s; agent work runs in the background.
 */

import * as lark from "@larksuiteoapi/node-sdk";

const API_BASE = (process.env.API_BASE || "http://127.0.0.1:8000/v1").replace(/\/$/, "");
const FEISHU_BRIDGE_SECRET = (process.env.FEISHU_BRIDGE_SECRET || "").trim();
const FEISHU_APP_ID = (process.env.FEISHU_APP_ID || "").trim();
const FEISHU_APP_SECRET = (process.env.FEISHU_APP_SECRET || "").trim();
const FEISHU_DOMAIN =
  (process.env.FEISHU_DOMAIN || "feishu").toLowerCase() === "lark"
    ? lark.Domain.Lark
    : lark.Domain.Feishu;

const STREAM_POLL_MS = 2500;
const STREAM_MAX_MS = 25 * 60 * 1000;
const OUTBOUND_TEXT_CHUNK = 2000;

const THREAD_BROWSER_FOOTER = "\n\n────────\nOpen in browser (files & full reply):\n";

const MSG_NEED_TEXT =
  "请发送文字消息。首次使用请在 Dobby 网页端：用户菜单 → 飞书，生成 6 位验证码并单独发送以完成绑定。";

/** @type {import('@larksuiteoapi/node-sdk').Client | null} */
let client = null;

function bridgeHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Feishu-Bridge-Secret": FEISHU_BRIDGE_SECRET,
  };
}

async function readBridgeJson(res) {
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, reply: text || `HTTP ${res.status}` };
  }
  if (!res.ok) {
    const detail =
      typeof data.detail === "string" ? data.detail : data.detail ? JSON.stringify(data.detail) : "";
    throw new Error(detail || data.reply || `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return data;
}

async function postBridgeChatStart(feishuOpenId, message) {
  const url = `${API_BASE}/integrations/feishu-bot/bridge/chat/start`;
  const res = await fetch(url, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({ feishu_open_id: feishuOpenId, message }),
  });
  return readBridgeJson(res);
}

async function postBridgeSnapshot(feishuOpenId, agentRunId, threadId, message) {
  const url = `${API_BASE}/integrations/feishu-bot/bridge/chat/snapshot`;
  const res = await fetch(url, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      feishu_open_id: feishuOpenId,
      agent_run_id: agentRunId,
      thread_id: threadId,
      message,
    }),
  });
  return readBridgeJson(res);
}

async function postBridgeFinalize(feishuOpenId, agentRunId, threadId, message) {
  const url = `${API_BASE}/integrations/feishu-bot/bridge/chat/finalize`;
  const res = await fetch(url, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      feishu_open_id: feishuOpenId,
      agent_run_id: agentRunId,
      thread_id: threadId,
      message,
    }),
  });
  return readBridgeJson(res);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function callbackCommand(data) {
  if (data === "master") return "/master";
  if (data === "enter") return "/enter";
  const match = /^use:(\d{1,2})$/.exec(String(data || ""));
  return match ? `/use ${match[1]}` : "";
}

function feishuCard(text, replyMarkup, openUrl = "") {
  const actions = [];
  for (const row of replyMarkup?.inline_keyboard || []) {
    for (const btn of row) {
      const cmd = btn.callback_data ? callbackCommand(btn.callback_data) : "";
      if (cmd) {
        actions.push({
          tag: "button",
          text: { tag: "plain_text", content: String(btn.text || cmd).slice(0, 30) },
          type: "default",
          value: { cmd },
        });
      } else if (btn.url) {
        actions.push({
          tag: "button",
          text: { tag: "plain_text", content: String(btn.text || "Open").slice(0, 30) },
          type: "default",
          url: btn.url,
        });
      }
    }
  }
  if (openUrl) {
    actions.push({
      tag: "button",
      text: { tag: "plain_text", content: "在浏览器打开" },
      type: "default",
      url: openUrl,
    });
  }
  const elements = [{ tag: "markdown", content: String(text || " ").slice(0, 4000) }];
  for (let i = 0; i < actions.length; i += 3) {
    elements.push({ tag: "action", actions: actions.slice(i, i + 3) });
  }
  return { config: { wide_screen_mode: true }, elements };
}

function stripThreadBrowserFooter(text, openUrl) {
  if (!openUrl || typeof text !== "string") return text;
  const suffix = `${THREAD_BROWSER_FOOTER}${openUrl}`;
  if (text.endsWith(suffix)) return text.slice(0, -suffix.length).trimEnd();
  return text;
}

function parseTextContent(content) {
  if (!content) return "";
  try {
    const parsed = JSON.parse(content);
    return (parsed.text || "").trim();
  } catch {
    return String(content).trim();
  }
}

async function sendText(chatId, text, options = {}) {
  if (!client) throw new Error("Feishu client not initialized");
  const openUrl = options.openUrl && String(options.openUrl).trim() ? String(options.openUrl).trim() : "";
  const replyMarkup = options.replyMarkup && typeof options.replyMarkup === "object" ? options.replyMarkup : null;
  let body = typeof text === "string" ? text : JSON.stringify(text);
  if (openUrl) body = stripThreadBrowserFooter(body, openUrl);
  if (!body.trim() && openUrl) {
    body = `${THREAD_BROWSER_FOOTER}${openUrl}`;
  }

  if (replyMarkup && body.length <= OUTBOUND_TEXT_CHUNK) {
    await client.im.message.create({
      params: { receive_id_type: "chat_id" },
      data: {
        receive_id: chatId,
        msg_type: "interactive",
        content: JSON.stringify(feishuCard(body, replyMarkup, openUrl)),
      },
    });
    return;
  }

  let rest = body;
  while (rest.length > 0) {
    const part = rest.slice(0, OUTBOUND_TEXT_CHUNK);
    rest = rest.slice(OUTBOUND_TEXT_CHUNK);
    const last = rest.length === 0;
    const segment = last && openUrl && !replyMarkup ? `${part}${THREAD_BROWSER_FOOTER}${openUrl}` : part;
    if (last && replyMarkup) {
      await client.im.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          msg_type: "interactive",
          content: JSON.stringify(feishuCard(segment, replyMarkup, openUrl)),
        },
      });
    } else {
      await client.im.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          msg_type: "text",
          content: JSON.stringify({ text: segment || " " }),
        },
      });
    }
    if (rest.length > 0) await sleep(300);
  }
}

async function updateText(chatId, messageId, text) {
  if (!client || !messageId) return false;
  const vis = (text || "…").slice(0, OUTBOUND_TEXT_CHUNK);
  try {
    await client.im.message.update({
      path: { message_id: messageId },
      data: {
        msg_type: "text",
        content: JSON.stringify({ text: vis }),
      },
    });
    return true;
  } catch (e) {
    console.error("[feishu] message.update:", e.message);
    return false;
  }
}

async function applyFinalReply(chatId, previewMessageId, fin) {
  const openUrl = typeof fin.thread_browser_url === "string" ? fin.thread_browser_url.trim() : "";
  const replyMarkup = fin.reply_markup && typeof fin.reply_markup === "object" ? fin.reply_markup : null;
  const reply = typeof fin.reply === "string" ? fin.reply : JSON.stringify(fin);

  if (!fin.ok) {
    const errText = (reply || "（失败）").slice(0, OUTBOUND_TEXT_CHUNK);
    if (previewMessageId) {
      const ok = await updateText(chatId, previewMessageId, errText);
      if (!ok) await sendText(chatId, errText);
    } else {
      await sendText(chatId, errText);
    }
    return;
  }

  let body = reply;
  if (openUrl) body = stripThreadBrowserFooter(body, openUrl);
  if (!body.trim()) body = "（无回复）";

  if (previewMessageId) {
    const first = body.slice(0, OUTBOUND_TEXT_CHUNK);
    const updated = await updateText(chatId, previewMessageId, first);
    if (!updated) {
      await sendText(chatId, body, { openUrl, replyMarkup });
      return;
    }
    const rest = body.slice(OUTBOUND_TEXT_CHUNK);
    if (rest.length > 0) {
      await sendText(chatId, rest, { openUrl });
    } else if (openUrl) {
      await sendText(chatId, `${THREAD_BROWSER_FOOTER}${openUrl}`);
    }
    if (replyMarkup) {
      await sendText(chatId, "要进入刚才那个项目，点下面的按钮，或回复「切进去」。", { replyMarkup });
    }
    return;
  }

  await sendText(chatId, body, { openUrl, replyMarkup });
}

async function handleFeishuChatTurn(chatId, openId, text) {
  const started = await postBridgeChatStart(openId, text);
  if (!started.agent_run_id) {
    const reply = typeof started.reply === "string" ? started.reply : JSON.stringify(started);
    const replyMarkup = started.reply_markup && typeof started.reply_markup === "object" ? started.reply_markup : null;
    await sendText(chatId, reply || "（无回复）", { replyMarkup });
    return;
  }

  const tid = started.thread_id;
  const rid = started.agent_run_id;
  const userMsg =
    typeof started.message === "string" && started.message.trim() ? started.message.trim() : text;

  const t0 = Date.now();
  let previewId = null;
  let lastShown = "";
  let sawTerminal = false;

  while (Date.now() - t0 < STREAM_MAX_MS) {
    let snap;
    try {
      snap = await postBridgeSnapshot(openId, rid, tid, userMsg);
    } catch (e) {
      console.error("[feishu] snapshot:", e.message);
      await sleep(STREAM_POLL_MS);
      continue;
    }

    if (!snap.ok) {
      const errReply = typeof snap.reply === "string" ? snap.reply : "快照失败";
      if (previewId) {
        await updateText(chatId, previewId, errReply.slice(0, OUTBOUND_TEXT_CHUNK));
      } else {
        await sendText(chatId, errReply);
      }
      return;
    }

    const snapText = (snap.reply || "").trim() || "…";
    const vis = snapText.slice(0, OUTBOUND_TEXT_CHUNK);
    if (previewId == null) {
      const res = await client.im.message.create({
        params: { receive_id_type: "chat_id" },
        data: {
          receive_id: chatId,
          msg_type: "text",
          content: JSON.stringify({ text: vis }),
        },
      });
      previewId = res?.message_id || res?.data?.message_id || res?.data?.message?.message_id || null;
      lastShown = vis;
    } else if (vis !== lastShown) {
      if (await updateText(chatId, previewId, vis)) {
        lastShown = vis;
      }
    }

    if (snap.terminal) {
      sawTerminal = true;
      break;
    }
    await sleep(STREAM_POLL_MS);
  }

  if (previewId != null && !sawTerminal) {
    await updateText(chatId, previewId, "等待超时，请在网页端查看完整回复。");
    return;
  }

  if (!sawTerminal) return;

  const fin = await postBridgeFinalize(openId, rid, tid, userMsg);
  await applyFinalReply(chatId, previewId, fin);
}

/** Per-user queue so Feishu 3s ack is not blocked and messages serialize per open_id. */
const userQueues = new Map();

function enqueueUserTurn(openId, fn) {
  const prev = userQueues.get(openId) || Promise.resolve();
  const next = prev
    .catch(() => {})
    .then(fn)
    .catch((err) => {
      console.error("[feishu] turn error:", err.message);
    });
  userQueues.set(openId, next);
  return next;
}

function extractIncomingText(data) {
  const message = data?.message;
  if (!message || message.message_type !== "text") return null;
  if (message.chat_type !== "p2p") return null;

  const openId = data?.sender?.sender_id?.open_id;
  const chatId = message.chat_id;
  if (!openId || !chatId) return null;

  const text = parseTextContent(message.content);
  if (!text) return null;

  return { openId, chatId, text };
}

export function isFeishuBridgeConfigured() {
  return Boolean(FEISHU_APP_ID && FEISHU_APP_SECRET && FEISHU_BRIDGE_SECRET);
}

/**
 * @param {AbortSignal} [signal]
 */
export async function runFeishuBridge(signal) {
  if (!isFeishuBridgeConfigured()) {
    throw new Error("Feishu bridge: FEISHU_APP_ID, FEISHU_APP_SECRET, and FEISHU_BRIDGE_SECRET are required");
  }

  const baseConfig = {
    appId: FEISHU_APP_ID,
    appSecret: FEISHU_APP_SECRET,
    domain: FEISHU_DOMAIN,
  };

  client = new lark.Client(baseConfig);
  const wsClient = new lark.WSClient({
    ...baseConfig,
    loggerLevel: lark.LoggerLevel.info,
  });

  const eventDispatcher = new lark.EventDispatcher({}).register({
    "card.action.trigger": async (data) => {
      const openId = data?.operator?.open_id || data?.operator?.operator_id?.open_id;
      const chatId = data?.context?.open_chat_id;
      const cmd = typeof data?.action?.value?.cmd === "string" ? data.action.value.cmd.trim() : "";
      if (openId && chatId && cmd) {
        void enqueueUserTurn(openId, async () => {
          try {
            await handleFeishuChatTurn(chatId, openId, cmd);
          } catch (err) {
            console.error("[feishu] card:", err.message);
          }
        });
      }
      return { toast: { type: "info", content: "已收到" } };
    },
    "im.message.receive_v1": async (data) => {
      const incoming = extractIncomingText(data);
      if (!incoming) return;

      const { openId, chatId, text } = incoming;
      // Feishu requires handler to finish within ~3s — queue work, return immediately.
      void enqueueUserTurn(openId, async () => {
        try {
          await handleFeishuChatTurn(chatId, openId, text);
        } catch (err) {
          console.error("[feishu] bridge:", err.message);
          await sendText(
            chatId,
            `服务暂时不可用：${String(err.message || err).slice(0, 400)}`,
          ).catch(() => {});
        }
      });
    },
  });

  console.log("[feishu] bridge");
  console.log(`[feishu] domain: ${FEISHU_DOMAIN === lark.Domain.Lark ? "lark" : "feishu"}`);
  console.log(`[feishu] API: ${API_BASE}/integrations/feishu-bot/bridge/chat/start (+ snapshot, finalize)\n`);

  wsClient.start({ eventDispatcher });

  await new Promise((resolve) => {
    if (signal?.aborted) {
      try {
        wsClient.close?.();
      } catch (_) {}
      resolve();
      return;
    }
    signal?.addEventListener(
      "abort",
      () => {
        try {
          wsClient.close?.();
        } catch (_) {}
        console.log("[feishu] stopped (signal)");
        resolve();
      },
      { once: true },
    );
  });
}
