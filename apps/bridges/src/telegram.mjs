/**
 * Telegram Bot API long poll → backend bridge.
 *
 * Uses /bridge/chat/start + /snapshot (short requests, live edits) + /finalize
 * so reverse proxies do not cut off long tool runs.
 */

const API_BASE = (process.env.API_BASE || "http://127.0.0.1:8000/v1").replace(/\/$/, "");
const TELEGRAM_BRIDGE_SECRET = (process.env.TELEGRAM_BRIDGE_SECRET || "").trim();
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();

const TG = TELEGRAM_BOT_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}` : "";

const STREAM_POLL_MS = 2500;
const STREAM_MAX_MS = 25 * 60 * 1000;

async function tgPost(method, body) {
  const res = await fetch(`${TG}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(`${method}: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data.result;
}

async function tgEditMessageText(chatId, messageId, text, extra = {}) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text.slice(0, 4096),
  };
  if (extra.reply_markup) payload.reply_markup = extra.reply_markup;
  const res = await fetch(`${TG}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const desc = String(data.description || "").toLowerCase();
    if (desc.includes("message is not modified")) return null;
    throw new Error(`editMessageText: ${JSON.stringify(data).slice(0, 400)}`);
  }
  return data.result;
}

function bridgeHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Telegram-Bridge-Secret": TELEGRAM_BRIDGE_SECRET,
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

async function postBridgeChatStart(telegramUserId, message) {
  const url = `${API_BASE}/integrations/telegram-bot/bridge/chat/start`;
  const res = await fetch(url, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({ telegram_user_id: telegramUserId, message }),
  });
  return readBridgeJson(res);
}

async function postBridgeSnapshot(telegramUserId, agentRunId, threadId, message) {
  const url = `${API_BASE}/integrations/telegram-bot/bridge/chat/snapshot`;
  const res = await fetch(url, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      telegram_user_id: telegramUserId,
      agent_run_id: agentRunId,
      thread_id: threadId,
      message,
    }),
  });
  return readBridgeJson(res);
}

async function postBridgeFinalize(telegramUserId, agentRunId, threadId, message) {
  const url = `${API_BASE}/integrations/telegram-bot/bridge/chat/finalize`;
  const res = await fetch(url, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      telegram_user_id: telegramUserId,
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

const THREAD_BROWSER_FOOTER = "\n\n────────\nOpen in browser (files & full reply):\n";

function stripThreadBrowserFooter(text, openUrl) {
  if (!openUrl || typeof text !== "string") return text;
  const suffix = `${THREAD_BROWSER_FOOTER}${openUrl}`;
  if (text.endsWith(suffix)) return text.slice(0, -suffix.length).trimEnd();
  return text;
}

async function sendReply(chatId, text, options = {}) {
  const openUrl = options.openUrl && String(options.openUrl).trim() ? String(options.openUrl).trim() : "";
  const chunk = 4096;
  let body = typeof text === "string" ? text : JSON.stringify(text);
  if (openUrl) body = stripThreadBrowserFooter(body, openUrl);
  let rest = body;
  while (rest.length > 0) {
    const part = rest.slice(0, chunk);
    rest = rest.slice(chunk);
    const payload = { chat_id: chatId, text: part };
    if (openUrl && rest.length === 0) {
      payload.reply_markup = {
        inline_keyboard: [[{ text: "Open in browser", url: openUrl }]],
      };
    }
    await tgPost("sendMessage", payload);
  }
}

/** Apply final reply without deleting the live preview (avoids empty gap while finalize runs). */
async function applyFinalReply(chatId, previewMessageId, fin) {
  const openUrl = typeof fin.thread_browser_url === "string" ? fin.thread_browser_url.trim() : "";
  const reply = typeof fin.reply === "string" ? fin.reply : JSON.stringify(fin);
  const chunkSize = 4096;
  const browserKb = openUrl
    ? { inline_keyboard: [[{ text: "Open in browser", url: openUrl }]] }
    : undefined;

  if (!fin.ok) {
    const errText = (reply || "（失败）").slice(0, chunkSize);
    if (previewMessageId != null) {
      try {
        await tgEditMessageText(chatId, previewMessageId, errText);
      } catch {
        await sendReply(chatId, reply || "（失败）", {});
      }
    } else {
      await sendReply(chatId, reply || "（失败）", {});
    }
    return;
  }

  let body = typeof fin.reply === "string" ? fin.reply : JSON.stringify(fin);
  if (openUrl) body = stripThreadBrowserFooter(body, openUrl);
  if (!body.trim()) body = "（无回复）";

  const first = body.slice(0, chunkSize);
  const rest = body.slice(chunkSize);

  if (previewMessageId != null) {
    try {
      await tgEditMessageText(chatId, previewMessageId, first, {
        reply_markup: rest.length === 0 ? browserKb : undefined,
      });
      if (rest.length === 0 && browserKb) {
        try {
          await tgPost("editMessageReplyMarkup", {
            chat_id: chatId,
            message_id: previewMessageId,
            reply_markup: browserKb,
          });
        } catch (_) {}
      }
    } catch (e) {
      console.error("[telegram] applyFinalReply edit:", e.message);
      await sendReply(chatId, (openUrl ? stripThreadBrowserFooter(fin.reply, openUrl) : fin.reply) || "（无回复）", {
        openUrl,
      });
      return;
    }
  } else {
    const payload = { chat_id: chatId, text: first };
    if (rest.length === 0 && browserKb) payload.reply_markup = browserKb;
    await tgPost("sendMessage", payload);
  }

  let remaining = rest;
  while (remaining.length > 0) {
    const part = remaining.slice(0, chunkSize);
    remaining = remaining.slice(chunkSize);
    const payload = { chat_id: chatId, text: part };
    if (openUrl && remaining.length === 0) payload.reply_markup = browserKb;
    await tgPost("sendMessage", payload);
  }
}

export function isTelegramBridgeConfigured() {
  return Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_BRIDGE_SECRET);
}

/**
 * @param {AbortSignal} [signal]
 */
export async function runTelegramBridge(signal) {
  if (!isTelegramBridgeConfigured()) {
    throw new Error("Telegram bridge: TELEGRAM_BOT_TOKEN and TELEGRAM_BRIDGE_SECRET are required");
  }

  let offset = 0;
  console.log("[telegram] bridge");
  console.log(`[telegram] API: ${API_BASE}/integrations/telegram-bot/bridge/chat/start (+ snapshot, finalize)\n`);

  for (;;) {
    if (signal?.aborted) {
      console.log("[telegram] stopped (signal)");
      return;
    }
    try {
      const url = new URL(`${TG}/getUpdates`);
      url.searchParams.set("timeout", "50");
      if (offset) url.searchParams.set("offset", String(offset));

      const res = await fetch(url.toString());
      const data = await res.json();
      if (!data.ok) {
        console.error("[telegram] getUpdates:", JSON.stringify(data).slice(0, 300));
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }

      for (const u of data.result || []) {
        offset = u.update_id + 1;
        const msg = u.message || u.edited_message;
        if (!msg || msg.chat?.type !== "private") continue;

        const from = msg.from;
        if (!from?.id) continue;

        const uid = String(from.id);
        const chatId = msg.chat.id;
        const text = (msg.text || "").trim();
        if (!text) {
          await sendReply(
            chatId,
            "请发送文字消息。首次使用请在网页端：用户菜单 → Telegram 生成 6 位验证码，并单独发送该验证码完成绑定。",
          );
          continue;
        }

        try {
          const started = await postBridgeChatStart(uid, text);
          if (!started.agent_run_id) {
            const reply = typeof started.reply === "string" ? started.reply : JSON.stringify(started);
            await sendReply(chatId, reply || "（无回复）", {});
            continue;
          }

          const tid = started.thread_id;
          const rid = started.agent_run_id;
          const userMsg = typeof started.message === "string" && started.message.trim() ? started.message.trim() : text;

          const t0 = Date.now();
          let previewId = null;
          let lastShown = "";
          let sawTerminal = false;

          while (Date.now() - t0 < STREAM_MAX_MS) {
            let snap;
            try {
              snap = await postBridgeSnapshot(uid, rid, tid, userMsg);
            } catch (e) {
              console.error("[telegram] snapshot:", e.message);
              await sleep(STREAM_POLL_MS);
              continue;
            }

            if (!snap.ok) {
              const errReply = typeof snap.reply === "string" ? snap.reply : "快照失败";
              const errSlice = errReply.slice(0, 4096);
              if (previewId != null) {
                try {
                  await tgEditMessageText(chatId, previewId, errSlice);
                } catch {
                  await sendReply(chatId, errReply, {});
                }
              } else {
                await sendReply(chatId, errReply, {});
              }
              continue;
            }

            const snapText = (snap.reply || "").trim() || "…";
            const vis = snapText.slice(0, 4096);
            if (previewId == null) {
              const sent = await tgPost("sendMessage", { chat_id: chatId, text: vis });
              previewId = sent.message_id;
              lastShown = vis;
            } else if (vis !== lastShown) {
              try {
                await tgEditMessageText(chatId, previewId, vis);
                lastShown = vis;
              } catch (e) {
                console.error("[telegram] editMessage:", e.message);
              }
            }

            if (snap.terminal) {
              sawTerminal = true;
              break;
            }
            await sleep(STREAM_POLL_MS);
          }

          if (previewId != null && !sawTerminal) {
            try {
              await tgEditMessageText(chatId, previewId, "等待超时，请在网页端查看完整回复。");
            } catch {
              await sendReply(chatId, "等待超时，请在网页端查看完整回复。", {});
            }
            continue;
          }

          if (!sawTerminal) continue;

          const fin = await postBridgeFinalize(uid, rid, tid, userMsg);
          await applyFinalReply(chatId, previewId, fin);
        } catch (err) {
          console.error("[telegram] bridge:", err.message);
          await sendReply(chatId, `服务暂时不可用：${err.message.slice(0, 500)}`);
        }
      }
    } catch (err) {
      console.error("[telegram] loop:", err.message);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}
