/**
 * WeChat iLink: multi-session long poll → backend bridge (per Dobby account).
 *
 * Sessions (bot tokens) are stored encrypted in the backend after dashboard QR scan.
 * This worker loads active sessions and runs one getupdates loop per account.
 */

import crypto from "node:crypto";

const ILINK_BASE = "https://ilinkai.weixin.qq.com";
const CHANNEL_VERSION = "1.0.2";
const POLL_TIMEOUT_MS = 40_000;
const API_TIMEOUT_MS = 15_000;
const SESSIONS_REFRESH_MS = 30_000;

const API_BASE = (process.env.API_BASE || "http://127.0.0.1:8000/v1").replace(/\/$/, "");
const WECHAT_ILINK_BRIDGE_SECRET = (process.env.WECHAT_ILINK_BRIDGE_SECRET || "").trim();

const STREAM_POLL_MS = 2500;
const STREAM_MAX_MS = 25 * 60 * 1000;

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

function bridgeHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Wechat-Ilink-Bridge-Secret": WECHAT_ILINK_BRIDGE_SECRET,
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function mergeAbortSignals(...signals) {
  const controller = new AbortController();
  for (const sig of signals) {
    if (!sig) continue;
    if (sig.aborted) {
      controller.abort();
      return controller.signal;
    }
    sig.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

async function fetchBridgeSessions() {
  const url = `${API_BASE}/integrations/wechat-ilink/bridge/sessions`;
  const res = await fetch(url, { headers: bridgeHeaders() });
  const data = await readBridgeJson(res);
  return Array.isArray(data.sessions) ? data.sessions : [];
}

async function patchSessionCursor(accountId, getUpdatesBuf) {
  const url = `${API_BASE}/integrations/wechat-ilink/bridge/sessions/${encodeURIComponent(accountId)}/cursor`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: bridgeHeaders(),
    body: JSON.stringify({ get_updates_buf: getUpdatesBuf || "" }),
  });
  await readBridgeJson(res);
}

async function postSessionExpired(accountId) {
  const url = `${API_BASE}/integrations/wechat-ilink/bridge/sessions/${encodeURIComponent(accountId)}/expired`;
  const res = await fetch(url, { method: "POST", headers: bridgeHeaders() });
  await readBridgeJson(res);
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
  return apiPost(
    baseUrl,
    "ilink/bot/sendtyping",
    {
      ilink_user_id: ilinkUserId,
      typing_ticket: typingTicket,
      status,
      base_info: baseInfo(),
    },
    token,
  );
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

const MSG_TYPES = { 1: "text", 2: "image", 3: "voice", 4: "file", 5: "video" };

function extractText(msg) {
  return (msg.item_list || [])
    .filter((item) => item.type === 1 && item.text_item)
    .map((item) => item.text_item.text)
    .join("");
}

async function postBridgeChatStart(accountId, ilinkPeerId, message) {
  const url = `${API_BASE}/integrations/wechat-ilink/bridge/chat/start`;
  const res = await fetch(url, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({ account_id: accountId, ilink_peer_id: ilinkPeerId, message }),
  });
  return readBridgeJson(res);
}

async function postBridgeSnapshot(accountId, ilinkPeerId, agentRunId, threadId, message) {
  const url = `${API_BASE}/integrations/wechat-ilink/bridge/chat/snapshot`;
  const res = await fetch(url, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      account_id: accountId,
      ilink_peer_id: ilinkPeerId,
      agent_run_id: agentRunId,
      thread_id: threadId,
      message,
    }),
  });
  return readBridgeJson(res);
}

async function postBridgeFinalize(accountId, ilinkPeerId, agentRunId, threadId, message) {
  const url = `${API_BASE}/integrations/wechat-ilink/bridge/chat/finalize`;
  const res = await fetch(url, {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      account_id: accountId,
      ilink_peer_id: ilinkPeerId,
      agent_run_id: agentRunId,
      thread_id: threadId,
      message,
    }),
  });
  return readBridgeJson(res);
}

async function handleWechatChatTurn(accountId, ilinkPeerId, text, tokenData) {
  const base = tokenData.baseurl || ILINK_BASE;
  const token = tokenData.bot_token;
  const contextToken = tokenData._contextToken;
  const to = ilinkPeerId;

  const started = await postBridgeChatStart(accountId, ilinkPeerId, text);
  if (!started.agent_run_id) {
    const reply = typeof started.reply === "string" ? started.reply : JSON.stringify(started);
    await sendTextChunked(base, token, to, contextToken, reply || "（无回复）", "");
    return;
  }

  const tid = started.thread_id;
  const rid = started.agent_run_id;
  const userMsg = typeof started.message === "string" && started.message.trim() ? started.message.trim() : text;

  const t0 = Date.now();
  let lastShown = "";
  let sawTerminal = false;

  while (Date.now() - t0 < STREAM_MAX_MS) {
    let snap;
    try {
      snap = await postBridgeSnapshot(accountId, ilinkPeerId, rid, tid, userMsg);
    } catch (e) {
      console.error(`[wechat-ilink] [${accountId.slice(0, 8)}] snapshot:`, e.message);
      await sleep(STREAM_POLL_MS);
      continue;
    }

    if (snap.reply && snap.reply !== lastShown) {
      lastShown = snap.reply;
      try {
        await sendTextChunked(base, token, to, contextToken, lastShown || "…", "");
      } catch (e) {
        console.error(`[wechat-ilink] [${accountId.slice(0, 8)}] live reply:`, e.message);
      }
    }

    if (snap.terminal) {
      sawTerminal = true;
      break;
    }
    await sleep(STREAM_POLL_MS);
  }

  let fin;
  try {
    fin = await postBridgeFinalize(accountId, ilinkPeerId, rid, tid, userMsg);
  } catch (e) {
    console.error(`[wechat-ilink] [${accountId.slice(0, 8)}] finalize:`, e.message);
    await sendText(base, token, to, contextToken, `服务暂时不可用：${e.message.slice(0, 200)}`);
    return;
  }

  const openUrl = typeof fin.thread_browser_url === "string" ? fin.thread_browser_url.trim() : "";
  const finalReply = typeof fin.reply === "string" ? fin.reply : JSON.stringify(fin);
  if (sawTerminal && finalReply === lastShown) {
    if (openUrl) {
      await sendText(base, token, to, contextToken, `${THREAD_BROWSER_FOOTER}${openUrl}`);
    }
    return;
  }
  await sendTextChunked(base, token, to, contextToken, finalReply || "（无回复）", openUrl);
}

async function handleMessage(msg, session, signal) {
  if (signal?.aborted) return;

  const tokenData = {
    bot_token: session.bot_token,
    baseurl: session.baseurl || ILINK_BASE,
  };
  const base = tokenData.baseurl;
  const token = tokenData.bot_token;
  const from = msg.from_user_id || "unknown";
  const contextToken = msg.context_token;
  const text = extractText(msg);
  const types = (msg.item_list || []).map((i) => MSG_TYPES[i.type] || `t${i.type}`).join("+");
  const accountId = session.account_id;

  console.log(`[wechat-ilink] [${accountId.slice(0, 8)}] [← ${types}] ${from}: ${(text || "(no text)").slice(0, 100)}`);

  if (!contextToken) {
    console.log(`[wechat-ilink] [${accountId.slice(0, 8)}] [!] missing context_token, skip`);
    return;
  }

  tokenData._contextToken = contextToken;

  if (!text) {
    await sendText(base, token, from, contextToken, `收到你的非文本消息（${types}），请发文字继续对话。`);
    return;
  }

  await startTyping(base, token, from, contextToken);
  try {
    await handleWechatChatTurn(accountId, from, text, tokenData);
  } catch (err) {
    console.error(`[wechat-ilink] [${accountId.slice(0, 8)}] bridge:`, err.message);
    await sendText(base, token, from, contextToken, `服务暂时不可用：${err.message.slice(0, 200)}`);
  } finally {
    await stopTyping(base, token, from);
  }
}

async function pollSessionLoop(session, signal) {
  const accountId = session.account_id;
  const base = session.baseurl || ILINK_BASE;
  const token = session.bot_token;
  let cursor = session.get_updates_buf || "";

  console.log(`[wechat-ilink] [${accountId.slice(0, 8)}] poll started`);

  for (;;) {
    if (signal.aborted) {
      console.log(`[wechat-ilink] [${accountId.slice(0, 8)}] poll stopped`);
      return;
    }

    try {
      const data = await getUpdates(base, token, cursor);

      if (data.ret && data.ret !== 0) {
        console.error(
          `[wechat-ilink] [${accountId.slice(0, 8)}] getupdates ret=${data.ret} errmsg=${data.errmsg || ""}`,
        );
        if (data.errcode === -14) {
          console.error(`[wechat-ilink] [${accountId.slice(0, 8)}] session expired (errcode -14)`);
          try {
            await postSessionExpired(accountId);
          } catch (e) {
            console.error(`[wechat-ilink] mark expired failed: ${e.message}`);
          }
          return;
        }
        await sleep(3000);
        continue;
      }

      if (data.get_updates_buf && data.get_updates_buf !== cursor) {
        cursor = data.get_updates_buf;
        patchSessionCursor(accountId, cursor).catch((e) => {
          console.error(`[wechat-ilink] [${accountId.slice(0, 8)}] cursor sync:`, e.message);
        });
      }

      const messages = data.msgs || [];
      for (const msg of messages) {
        if (msg.message_type === 2) continue;
        if (msg.from_user_id?.endsWith("@im.bot")) continue;
        try {
          await handleMessage(msg, session, signal);
        } catch (err) {
          console.error(`[wechat-ilink] [${accountId.slice(0, 8)}] handler:`, err.message);
        }
      }
    } catch (err) {
      if (err.name === "AbortError" || signal.aborted) return;
      console.error(`[wechat-ilink] [${accountId.slice(0, 8)}] poll:`, err.message, "— retry in 3s");
      await sleep(3000);
    }
  }
}

/**
 * @param {AbortSignal} rootSignal
 */
async function runSessionManager(rootSignal) {
  /** @type {Map<string, { abort: AbortController, promise: Promise<void> }>} */
  const loops = new Map();

  const refresh = async () => {
    if (rootSignal.aborted) return;
    let sessions;
    try {
      sessions = await fetchBridgeSessions();
    } catch (e) {
      console.error("[wechat-ilink] fetch sessions:", e.message);
      return;
    }

    const activeIds = new Set(sessions.map((s) => s.account_id));

    for (const [id, loop] of loops) {
      if (!activeIds.has(id)) {
        loop.abort.abort();
        loops.delete(id);
        console.log(`[wechat-ilink] removed session ${id.slice(0, 8)}`);
      }
    }

    for (const session of sessions) {
      if (loops.has(session.account_id)) continue;
      const abort = new AbortController();
      const combined = mergeAbortSignals(rootSignal, abort.signal);
      const promise = pollSessionLoop(session, combined).catch((e) => {
        if (!combined.aborted) {
          console.error(`[wechat-ilink] [${session.account_id.slice(0, 8)}] loop fatal:`, e.message);
        }
      });
      loops.set(session.account_id, { abort, promise });
      console.log(`[wechat-ilink] added session ${session.account_id.slice(0, 8)} (${sessions.length} active)`);
    }
  };

  await refresh();
  const timer = setInterval(refresh, SESSIONS_REFRESH_MS);
  rootSignal.addEventListener(
    "abort",
    () => {
      clearInterval(timer);
      for (const loop of loops.values()) loop.abort.abort();
    },
    { once: true },
  );

  await new Promise((resolve) => {
    if (rootSignal.aborted) resolve();
    else rootSignal.addEventListener("abort", () => resolve(), { once: true });
  });
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

  console.log("[wechat-ilink] multi-session bridge");
  console.log(`[wechat-ilink] API: ${API_BASE}/integrations/wechat-ilink/bridge/sessions\n`);
  await runSessionManager(signal || new AbortController().signal);
}
