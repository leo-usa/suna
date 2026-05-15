/**
 * Telegram Bot API long poll → backend bridge.
 */

const API_BASE = (process.env.API_BASE || "http://127.0.0.1:8000/v1").replace(/\/$/, "");
const TELEGRAM_BRIDGE_SECRET = (process.env.TELEGRAM_BRIDGE_SECRET || "").trim();
const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || "").trim();

const TG = TELEGRAM_BOT_TOKEN ? `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}` : "";

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

async function postBridgeChat(telegramUserId, message) {
  const url = `${API_BASE}/integrations/telegram-bot/bridge/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bridge-Secret": TELEGRAM_BRIDGE_SECRET,
    },
    body: JSON.stringify({ telegram_user_id: telegramUserId, message }),
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, reply: text || `HTTP ${res.status}` };
  }
  if (!res.ok) {
    throw new Error(data.detail || data.reply || `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return data;
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
  console.log(`[telegram] API: ${API_BASE}/integrations/telegram-bot/bridge/chat\n`);

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
          const data2 = await postBridgeChat(uid, text);
          const reply = typeof data2.reply === "string" ? data2.reply : JSON.stringify(data2);
          const openUrl = typeof data2.thread_browser_url === "string" ? data2.thread_browser_url.trim() : "";
          await sendReply(chatId, reply || "（无回复）", { openUrl });
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
