/**
 * WeChat iLink → Suna: QR login, long poll, forward user text to Suna bridge API.
 * Protocol shapes align with @tencent-weixin / x1ah wechat-ilink-demo (api.ts).
 */

import crypto from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ILINK_BASE = "https://ilinkai.weixin.qq.com";
const TOKEN_FILE = process.env.ILINK_TOKEN_FILE || "./bot_token.json";
const CHANNEL_VERSION = "1.0.2";
const POLL_TIMEOUT_MS = 40_000;
const API_TIMEOUT_MS = 15_000;

const SUNA_API_BASE = (process.env.SUNA_API_BASE || "http://127.0.0.1:8000/v1").replace(/\/$/, "");
const SUNA_ILINK_BRIDGE_SECRET = (process.env.SUNA_ILINK_BRIDGE_SECRET || "").trim();

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
  console.log("[✓] Token saved to", TOKEN_FILE);
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
      client_id: `suna-${crypto.randomUUID()}`,
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
  console.log(`[→] ${to}: ${text.slice(0, 120)}${text.length > 120 ? "…" : ""}`);
}

async function getConfig(baseUrl, token, ilinkUserId, contextToken) {
  return apiPost(baseUrl, "ilink/bot/getconfig", {
    ilink_user_id: ilinkUserId,
    context_token: contextToken,
    base_info: baseInfo(),
  }, token);
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
    console.log(`[typing] skip: ${err.message}`);
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

async function login() {
  const saved = loadToken();
  if (saved) {
    console.log("[i] Reusing saved token…");
    return saved;
  }

  console.log("\n========== iLink QR login ==========\n");
  console.log("[1/3] Fetching QR…");
  const qrRes = await fetch(`${ILINK_BASE}/ilink/bot/get_bot_qrcode?bot_type=3`, { headers: makeHeaders() });
  const qrData = await qrRes.json();

  if (!qrData.qrcode_img_content) {
    console.error("[✗] QR failed:", JSON.stringify(qrData, null, 2));
    process.exit(1);
  }

  const qrcodeUrl = qrData.qrcode_img_content;
  const qrcodeKey = qrData.qrcode;

  console.log("[2/3] Scan with WeChat:\n");
  try {
    const qrterm = await import("qrcode-terminal");
    qrterm.default.generate(qrcodeUrl, { small: true });
  } catch {
    console.log("QR URL:", qrcodeUrl);
  }

  console.log("\n[3/3] Waiting for confirm…");
  for (;;) {
    await sleep(2000);
    try {
      const statusRes = await fetch(
        `${ILINK_BASE}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcodeKey)}`,
        { headers: makeHeaders() },
      );
      const statusData = await statusRes.json();

      if (statusData.status === "confirmed" || statusData.bot_token) {
        console.log("\n[✓] Logged in");
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
        process.stdout.write("\r[...] scanned, confirming…");
      } else if (statusData.status === "expired") {
        console.error("\n[✗] QR expired, restart");
        process.exit(1);
      } else {
        process.stdout.write("\r[...] waiting for scan…");
      }
    } catch {
      /* continue */
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

async function callSunaBridge(ilinkPeerId, message) {
  if (!SUNA_ILINK_BRIDGE_SECRET) {
    throw new Error("SUNA_ILINK_BRIDGE_SECRET is not set");
  }
  const url = `${SUNA_API_BASE}/integrations/wechat-ilink/bridge/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Wechat-Ilink-Bridge-Secret": SUNA_ILINK_BRIDGE_SECRET,
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
    throw new Error(data.detail || data.reply || `Suna HTTP ${res.status}: ${text.slice(0, 200)}`);
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

  console.log(`[← ${types}] ${from}: ${(text || "(no text)").slice(0, 100)}`);

  if (!contextToken) {
    console.log("[!] missing context_token, skip");
    return;
  }

  if (!text) {
    await sendText(base, token, from, contextToken, `收到你的非文本消息（${types}），请发文字与 Dobby 对话。`);
    return;
  }

  await startTyping(base, token, from, contextToken);
  try {
    const data = await callSunaBridge(from, text);
    const reply = typeof data.reply === "string" ? data.reply : JSON.stringify(data);
    await sendText(base, token, from, contextToken, reply || "（无回复）");
  } catch (err) {
    console.error("[!] Suna bridge:", err.message);
    await sendText(base, token, from, contextToken, `服务暂时不可用：${err.message.slice(0, 200)}`);
  } finally {
    await stopTyping(base, token, from);
  }
}

async function pollLoop(tokenData, onMessage) {
  const base = tokenData.baseurl || ILINK_BASE;
  const token = tokenData.bot_token;
  let cursor = "";

  console.log("\n========== Long poll (iLink) ==========");
  console.log(`Suna: ${SUNA_API_BASE}/integrations/wechat-ilink/bridge/chat\n`);

  for (;;) {
    try {
      const data = await getUpdates(base, token, cursor);

      if (data.ret && data.ret !== 0) {
        console.error(`[!] getupdates ret=${data.ret} errmsg=${data.errmsg || ""}`);
        if (data.errcode === -14) {
          console.error("[✗] Session expired — delete token file and restart");
          process.exit(1);
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
          console.error("[!] handler:", err.message);
        }
      }
    } catch (err) {
      if (err.name === "AbortError") continue;
      console.error("[!] poll:", err.message, "— retry in 3s");
      await sleep(3000);
    }
  }
}

async function main() {
  console.log("Suna WeChat iLink bridge\n");
  if (!SUNA_ILINK_BRIDGE_SECRET) {
    console.error("[✗] Set SUNA_ILINK_BRIDGE_SECRET (same as backend WECHAT_ILINK_BRIDGE_SECRET)");
    process.exit(1);
  }

  const tokenData = await login();
  await pollLoop(tokenData, handleMessage);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
