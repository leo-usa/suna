/**
 * WeChat iLink: QR login, long poll, forward user text to backend bridge API.
 */

import crypto from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ILINK_BASE = "https://ilinkai.weixin.qq.com";
const TOKEN_FILE = process.env.ILINK_TOKEN_FILE || "./bot_token.json";
const CHANNEL_VERSION = "1.0.2";
const POLL_TIMEOUT_MS = 40_000;
const API_TIMEOUT_MS = 15_000;

const API_BASE = (process.env.API_BASE || "http://127.0.0.1:8000/v1").replace(/\/$/, "");
const WECHAT_ILINK_BRIDGE_SECRET = (process.env.WECHAT_ILINK_BRIDGE_SECRET || "").trim();

/** Match backend `append_thread_workspace_link` footer (strip before chunking). */
const THREAD_BROWSER_FOOTER = "\n\n────────\nOpen in browser (files & full reply):\n";
const OUTBOUND_TEXT_CHUNK = Number(process.env.WECHAT_ILINK_TEXT_CHUNK) || 3500;

function stripThreadBrowserFooter(text, openUrl) {
  if (!openUrl || typeof text !== "string") return text;
  const suffix = `${THREAD_BROWSER_FOOTER}${openUrl}`;
  if (text.endsWith(suffix)) return text.slice(0, -suffix.length).trimEnd();
  return text;
}

function baseInfo() {
  return { channel_version: CHANNEL_VERSION };
}

function randomUin() {
  const uint32 = crypto.randomBytes(4).readUInt32BE(0);
  return Buffer.from(String(uint32), "utf-8").toString("base64");
}

function makeHeaders(token, bodyStr) {
  const headers = {
    "Content-Type": "application/json",
    AuthorizationType: "ilink_bot_token",
    "X-WECHAT-UIN": randomUin(),
  };
  if (bodyStr) {
    headers["Content-Length"] = String(Buffer.byteLength(bodyStr, "utf-8"));
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

async function apiPost(baseUrl, endpoint, payload, token, timeoutMs = API_TIMEOUT_MS) {
  const url = new URL(endpoint, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  const bodyStr = JSON.stringify(payload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: makeHeaders(token, bodyStr),
      body: bodyStr,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`${endpoint} HTTP ${res.status}: ${text}`);
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timer);
  }
}

function saveToken(data) {
  writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  console.log("[wechat-ilink] [✓] Token saved to", TOKEN_FILE);
}

function loadToken() {
  if (!existsSync(TOKEN_FILE)) return null;
  try {
    const data = JSON.parse(readFileSync(TOKEN_FILE, "utf-8"));
    if (data.bot_token) return data;
  } catch {
    /* ignore */
  }
  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function getUpdates(baseUrl, token, cursor) {
  return apiPost(
    baseUrl,
    "ilink/bot/getupdates",
    {
      get_updates_buf: cursor || "",
      base_info: baseInfo(),
    },
    token,
    POLL_TIMEOUT_MS,
  );
}

async function sendMessageApi(baseUrl, token, msgBody) {
  return apiPost(baseUrl, "ilink/bot/sendmessage", { ...msgBody, base_info: baseInfo() }, token);
}

function buildSendTextBody(to, text, contextToken) {
  return {
    msg: {
      from_user_id: "",
      to_user_id: to,
      client_id: `bridge-${crypto.randomUUID()}`,
      message_type: 2,
      message_state: 2,
      context_token: contextToken,
      item_list: [{ type: 1, text_item: { text } }],
    },
  };
}

async function sendText(baseUrl, token, to, contextToken, text) {
  const body = buildSendTextBody(to, text, contextToken);
  await sendMessageApi(baseUrl, token, body);
  console.log(`[wechat-ilink] [→] ${to}: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`);
}

async function sendTextChunked(baseUrl, token, to, contextToken, text, openUrl) {
  const url = openUrl && String(openUrl).trim() ? String(openUrl).trim() : "";
  let body = typeof text === "string" ? text : JSON.stringify(text);
  if (url) body = stripThreadBrowserFooter(body, url);
  if (!body.trim() && url) {
    await sendText(baseUrl, token, to, contextToken, `${THREAD_BROWSER_FOOTER}${url}`);
    return;
  }
  let chunkIndex = 0;
  for (let i = 0; i < body.length; i += OUTBOUND_TEXT_CHUNK) {
    const part = body.slice(i, i + OUTBOUND_TEXT_CHUNK);
    const isLast = i + OUTBOUND_TEXT_CHUNK >= body.length;
    const segment = isLast && url ? `${part}${THREAD_BROWSER_FOOTER}${url}` : part;
    await sendText(baseUrl, token, to, contextToken, segment.length ? segment : " ");
    chunkIndex += 1;
    if (!isLast) await sleep(350);
  }
  if (chunkIndex > 1) {
    const total = body.length + (url ? THREAD_BROWSER_FOOTER.length + url.length : 0);
    console.log(`[wechat-ilink] [→] ${to} sent ${chunkIndex} chunks, ~${total} chars`);
  }
}

async function getConfig(baseUrl, token, ilinkUserId, contextToken) {
  return apiPost(
    baseUrl,
    "ilink/bot/getconfig",
    {
      ilink_user_id: ilinkUserId,
      context_token: contextToken,
      base_info: baseInfo(),
    },
    token,
  );
}

async function sendTypingApi(baseUrl, token, ilinkUserId, typingTicket, status = 1) {
  return apiPost(baseUrl, "ilink/bot/sendtyping", {
    ilink_user_id: ilinkUserId,
    typing_ticket: typingTicket,
    status,
    base_info: baseInfo(),
  }, token);
}

const typingTicketCache = {};

async function startTyping(baseUrl, token, userId, contextToken) {
  try {
    if (!typingTicketCache[userId]) {
      const cfg = await getConfig(baseUrl, token, userId, contextToken);
      if (cfg.typing_ticket) typingTicketCache[userId] = cfg.typing_ticket;
    }
    const ticket = typingTicketCache[userId];
    if (ticket) await sendTypingApi(baseUrl, token, userId, ticket, 1);
  } catch (err) {
    console.log(`[wechat-ilink] [typing] skip: ${err.message}`);
  }
}

async function stopTyping(baseUrl, token, userId) {
  try {
    const ticket = typingTicketCache[userId];
    if (ticket) await sendTypingApi(baseUrl, token, userId, ticket, 2);
  } catch {
    /* ignore */
  }
}

/**
 * @param {AbortSignal} [signal]
 */
async function login(signal) {
  const saved = loadToken();
  if (saved) {
    console.log("[wechat-ilink] [i] Reusing saved token…");
    return saved;
  }

  console.log("\n[wechat-ilink] ========== iLink QR login ==========\n");
  console.log("[wechat-ilink] [1/3] Fetching QR…");
  const qrRes = await fetch(`${ILINK_BASE}/ilink/bot/get_bot_qrcode?bot_type=3`, { headers: makeHeaders() });
  const qrData = await qrRes.json();

  if (!qrData.qrcode_img_content) {
    console.error("[wechat-ilink] [✗] QR failed:", JSON.stringify(qrData, null, 2));
    throw new Error("WeChat iLink: QR login failed");
  }

  const qrcodeUrl = qrData.qrcode_img_content;
  const qrcodeKey = qrData.qrcode;

  console.log("[wechat-ilink] [2/3] Scan with WeChat:\n");
  try {
    const qrterm = await import("qrcode-terminal");
    qrterm.default.generate(qrcodeUrl, { small: true });
  } catch {
    console.log("[wechat-ilink] QR URL:", qrcodeUrl);
  }

  console.log("\n[wechat-ilink] [3/3] Waiting for confirm…");
  for (;;) {
    if (signal?.aborted) {
      throw new Error("WeChat iLink: login aborted");
    }
    await sleep(2000);
    let statusData;
    try {
      const statusRes = await fetch(
        `${ILINK_BASE}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcodeKey)}`,
        { headers: makeHeaders() },
      );
      statusData = await statusRes.json();
    } catch {
      continue;
    }

    if (statusData.status === "confirmed" || statusData.bot_token) {
      console.log("\n[wechat-ilink] [✓] Logged in");
      const tokenData = {
        bot_token: statusData.bot_token,
        baseurl: statusData.baseurl || ILINK_BASE,
        bot_id: statusData.bot_id || "",
        login_time: new Date().toISOString(),
      };
      saveToken(tokenData);
      return tokenData;
    }

    if (statusData.status === "scanned") {
      process.stdout.write("\r[wechat-ilink] [...] scanned, confirming…");
    } else if (statusData.status === "expired") {
      console.error("\n[wechat-ilink] [✗] QR expired, restart");
      throw new Error("WeChat iLink: QR expired");
    } else {
      process.stdout.write("\r[wechat-ilink] [...] waiting for scan…");
    }
  }
}

const MSG_TYPES = { 1: "text", 2: "image", 3: "voice", 4: "file", 5: "video" };

function extractText(msg) {
  return (msg.item_list || [])
    .filter((item) => item.type === 1 && item.text_item)
    .map((item) => item.text_item.text)
    .join("");
}

async function postBridgeChat(ilinkPeerId, message) {
  if (!WECHAT_ILINK_BRIDGE_SECRET) {
    throw new Error("WECHAT_ILINK_BRIDGE_SECRET is not set");
  }
  const url = `${API_BASE}/integrations/wechat-ilink/bridge/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Wechat-Ilink-Bridge-Secret": WECHAT_ILINK_BRIDGE_SECRET,
    },
    body: JSON.stringify({ ilink_peer_id: ilinkPeerId, message }),
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

async function handleMessage(msg, tokenData) {
  const base = tokenData.baseurl || ILINK_BASE;
  const token = tokenData.bot_token;
  const from = msg.from_user_id || "unknown";
  const contextToken = msg.context_token;
  const text = extractText(msg);
  const types = (msg.item_list || []).map((i) => MSG_TYPES[i.type] || `t${i.type}`).join("+");

  console.log(`[wechat-ilink] [← ${types}] ${from}: ${(text || "(no text)").slice(0, 100)}`);

  if (!contextToken) {
    console.log("[wechat-ilink] [!] missing context_token, skip");
    return;
  }

  if (!text) {
    await sendText(base, token, from, contextToken, `收到你的非文本消息（${types}），请发文字继续对话。`);
    return;
  }

  await startTyping(base, token, from, contextToken);
  try {
    const data = await postBridgeChat(from, text);
    const reply = typeof data.reply === "string" ? data.reply : JSON.stringify(data);
    const openUrl = typeof data.thread_browser_url === "string" ? data.thread_browser_url.trim() : "";
    await sendTextChunked(base, token, from, contextToken, reply || "（无回复）", openUrl);
  } catch (err) {
    console.error("[wechat-ilink] [!] bridge:", err.message);
    await sendText(base, token, from, contextToken, `服务暂时不可用：${err.message.slice(0, 200)}`);
  } finally {
    await stopTyping(base, token, from);
  }
}

/**
 * @param {AbortSignal} [signal]
 */
async function pollLoop(tokenData, onMessage, signal) {
  const base = tokenData.baseurl || ILINK_BASE;
  const token = tokenData.bot_token;
  let cursor = "";

  console.log("\n[wechat-ilink] ========== Long poll (iLink) ==========");
  console.log(`[wechat-ilink] API: ${API_BASE}/integrations/wechat-ilink/bridge/chat\n`);

  for (;;) {
    if (signal?.aborted) {
      console.log("[wechat-ilink] stopped (signal)");
      return;
    }
    try {
      const data = await getUpdates(base, token, cursor);

      if (data.ret && data.ret !== 0) {
        console.error(`[wechat-ilink] [!] getupdates ret=${data.ret} errmsg=${data.errmsg || ""}`);
        if (data.errcode === -14) {
          console.error("[wechat-ilink] [✗] Session expired — delete token file and restart");
          throw new Error("WeChat iLink: session expired (errcode -14)");
        }
        await sleep(3000);
        continue;
      }

      if (data.get_updates_buf) {
        cursor = data.get_updates_buf;
      }

      const messages = data.msgs || [];
      for (const msg of messages) {
        if (msg.message_type === 2) continue;
        if (msg.from_user_id?.endsWith("@im.bot")) continue;
        try {
          await onMessage(msg, tokenData);
        } catch (err) {
          console.error("[wechat-ilink] [!] handler:", err.message);
        }
      }
    } catch (err) {
      if (err.name === "AbortError") continue;
      console.error("[wechat-ilink] [!] poll:", err.message, "— retry in 3s");
      await sleep(3000);
    }
  }
}

export function isWechatIlinkBridgeConfigured() {
  return Boolean(WECHAT_ILINK_BRIDGE_SECRET);
}

/**
 * @param {AbortSignal} [signal]
 */
export async function runWechatIlinkBridge(signal) {
  if (!isWechatIlinkBridgeConfigured()) {
    throw new Error("WeChat iLink: set WECHAT_ILINK_BRIDGE_SECRET (same as backend)");
  }

  console.log("[wechat-ilink] bridge\n");
  const tokenData = await login(signal);
  await pollLoop(tokenData, handleMessage, signal);
}
