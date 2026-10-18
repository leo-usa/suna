/**
 * Official QQ bot (单聊 / C2C) → backend bridge.
 *
 * Receives C2C_MESSAGE_CREATE over the QQ bot WebSocket gateway, runs the turn through
 * /integrations/qq-bot/bridge/chat/start + /snapshot + /finalize, and replies with
 * passive messages (msg_id). Master-assistant reports arrive through the outbox and
 * are sent as active messages.
 */

const API_BASE = (process.env.API_BASE || "http://127.0.0.1:8000/v1").replace(/\/$/, "");
const QQ_BOT_APP_ID = (process.env.QQ_BOT_APP_ID || "").trim();
const QQ_BOT_APP_SECRET = (process.env.QQ_BOT_APP_SECRET || "").trim();
const QQ_BRIDGE_SECRET = (process.env.QQ_BRIDGE_SECRET || "").trim();
const QQ_BOT_SANDBOX = ["1", "true", "yes"].includes((process.env.QQ_BOT_SANDBOX || "").trim().toLowerCase());
const QQ_BOT_ENABLED = ["1", "true", "yes"].includes((process.env.QQ_BOT_ENABLED || "").trim().toLowerCase());
const QQ_API = (
  process.env.QQ_BOT_API_BASE || (QQ_BOT_SANDBOX ? "https://sandbox.api.sgroup.qq.com" : "https://api.sgroup.qq.com")
).replace(/\/$/, "");

const INTENT_GROUP_AND_C2C = 1 << 25;
const STREAM_POLL_MS = 2500;
const PASSIVE_WINDOW_MS = 55 * 60 * 1000;
const STREAM_MAX_MS = 25 * 60 * 1000;
const OUTBOX_POLL_MS = 5000;
const CHUNK = 1800;
const MAX_PASSIVE_REPLIES = 4;

const MSG_NEED_TEXT =
  "请发送文字消息。首次使用请在 Dobby 网页端：左下角头像菜单 → QQ 生成 6 位验证码，然后在这里单独发送该验证码完成绑定。";
const URL_BLOCKED_HINT = "（链接请在 Dobby 网页端查看）";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function isQqBridgeConfigured() {
  return QQ_BOT_ENABLED && Boolean(QQ_BOT_APP_ID && QQ_BOT_APP_SECRET && QQ_BRIDGE_SECRET);
}

// ---------------------------------------------------------------- access token

let accessToken = "";
let accessTokenExpiresAt = 0;

async function getAccessToken() {
  if (accessToken && Date.now() < accessTokenExpiresAt - 60_000) return accessToken;
  const res = await fetch("https://bots.qq.com/app/getAppAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId: QQ_BOT_APP_ID, clientSecret: QQ_BOT_APP_SECRET }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(`getAppAccessToken failed: ${JSON.stringify(data).slice(0, 300)}`);
  }
  accessToken = data.access_token;
  accessTokenExpiresAt = Date.now() + Number(data.expires_in || 7200) * 1000;
  return accessToken;
}

async function qqApi(method, path, body) {
  const token = await getAccessToken();
  const res = await fetch(`${QQ_API}${path}`, {
    method,
    headers: { Authorization: `QQBot ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path}: HTTP ${res.status} ${text.slice(0, 300)}`);
    err.qq = data;
    throw err;
  }
  return data;
}

// ---------------------------------------------------------------- sending

function stripUrls(text) {
  return text.replace(/https?:\/\/\S+/g, "").replace(/\n{3,}/g, "\n\n").trim() + `\n${URL_BLOCKED_HINT}`;
}

function looksLikeUrlRejection(err) {
  const s = `${err?.message || ""} ${JSON.stringify(err?.qq || {})}`.toLowerCase();
  return s.includes("url") || s.includes("链接");
}

async function sendC2C(openid, content, { msgId, msgSeq } = {}) {
  const body = { content, msg_type: 0 };
  if (msgId) {
    body.msg_id = msgId;
    body.msg_seq = msgSeq || 1;
  }
  try {
    return await qqApi("POST", `/v2/users/${encodeURIComponent(openid)}/messages`, body);
  } catch (err) {
    if (looksLikeUrlRejection(err) && /https?:\/\//.test(content)) {
      return qqApi("POST", `/v2/users/${encodeURIComponent(openid)}/messages`, { ...body, content: stripUrls(content) });
    }
    throw err;
  }
}

async function sendTyping(openid, msgId, msgSeq) {
  try {
    await qqApi("POST", `/v2/users/${encodeURIComponent(openid)}/messages`, {
      msg_type: 6,
      input_notify: { input_type: 1, input_second: 60 },
      msg_id: msgId,
      msg_seq: msgSeq,
    });
    return true;
  } catch {
    return false;
  }
}

function splitChunks(text, maxChunks) {
  const chunks = [];
  let rest = text;
  while (rest.length > 0 && chunks.length < maxChunks) {
    if (rest.length <= CHUNK || chunks.length === maxChunks - 1) {
      chunks.push(rest.length <= CHUNK ? rest : `${rest.slice(0, CHUNK - 30)}…\n（内容较长，请在网页端查看完整回复）`);
      break;
    }
    let cut = rest.lastIndexOf("\n", CHUNK);
    if (cut < CHUNK / 2) cut = CHUNK;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  return chunks;
}

/** Reply to one inbound message; falls back to active messages once passive replies run out. */
class Replier {
  constructor(openid, msgId) {
    this.openid = openid;
    this.msgId = msgId;
    this.receivedAt = Date.now();
    this.seq = 0;
  }

  passiveLeft() {
    return Date.now() - this.receivedAt < PASSIVE_WINDOW_MS ? MAX_PASSIVE_REPLIES - this.seq : 0;
  }

  async typing() {
    if (this.passiveLeft() <= 1) return;
    this.seq += 1;
    if (!(await sendTyping(this.openid, this.msgId, this.seq))) this.seq -= 1;
  }

  async send(text) {
    const body = (text || "").trim() || "（无回复）";
    const passive = this.passiveLeft();
    const chunks = splitChunks(body, passive > 0 ? passive : 3);
    for (const chunk of chunks) {
      if (this.passiveLeft() > 0) {
        this.seq += 1;
        await sendC2C(this.openid, chunk, { msgId: this.msgId, msgSeq: this.seq });
      } else {
        await sendC2C(this.openid, chunk);
      }
    }
  }
}

// ---------------------------------------------------------------- backend bridge

function bridgeHeaders() {
  return { "Content-Type": "application/json", "X-QQ-Bridge-Secret": QQ_BRIDGE_SECRET };
}

async function bridgePost(path, body) {
  const res = await fetch(`${API_BASE}/integrations/qq-bot${path}`, {
    method: "POST",
    headers: bridgeHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { ok: false, reply: text || `HTTP ${res.status}` };
  }
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : data.detail ? JSON.stringify(data.detail) : "";
    throw new Error(detail || data.reply || `HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return data;
}

async function handleTurn(openid, msgId, text) {
  const replier = new Replier(openid, msgId);
  const started = await bridgePost("/bridge/chat/start", { user_openid: openid, message: text });
  if (!started.agent_run_id) {
    await replier.send(typeof started.reply === "string" ? started.reply : "（无回复）");
    return;
  }

  await replier.typing();
  const session = {
    user_openid: openid,
    agent_run_id: started.agent_run_id,
    thread_id: started.thread_id,
    message: (started.message || text).trim(),
  };

  const t0 = Date.now();
  let terminal = false;
  while (Date.now() - t0 < STREAM_MAX_MS) {
    await sleep(STREAM_POLL_MS);
    try {
      const snap = await bridgePost("/bridge/chat/snapshot", session);
      if (!snap.ok) {
        await replier.send(snap.reply || "处理失败");
        return;
      }
      if (snap.terminal) {
        terminal = true;
        break;
      }
    } catch (e) {
      console.error("[qq] snapshot:", e.message);
    }
  }

  const fin = await bridgePost("/bridge/chat/finalize", session);
  if (!terminal && fin.ok) {
    await replier.send("处理时间较长，完成后请在 Dobby 网页端查看完整回复。");
    return;
  }
  await replier.send(typeof fin.reply === "string" ? fin.reply : "（无回复）");
}

// ---------------------------------------------------------------- per-user queue + dedupe

const userQueues = new Map();
const seenMessageIds = new Set();

function rememberMessage(id) {
  if (!id) return true;
  if (seenMessageIds.has(id)) return false;
  seenMessageIds.add(id);
  if (seenMessageIds.size > 2000) {
    const first = seenMessageIds.values().next().value;
    seenMessageIds.delete(first);
  }
  return true;
}

function enqueueForUser(openid, task) {
  const prev = userQueues.get(openid) || Promise.resolve();
  const next = prev.then(task, task).finally(() => {
    if (userQueues.get(openid) === next) userQueues.delete(openid);
  });
  userQueues.set(openid, next);
}

function onC2CMessage(d) {
  const openid = d?.author?.user_openid;
  const msgId = d?.id;
  if (!openid || !msgId || !rememberMessage(msgId)) return;
  const text = (d.content || "").trim();
  enqueueForUser(openid, async () => {
    try {
      if (!text) {
        await new Replier(openid, msgId).send(MSG_NEED_TEXT);
        return;
      }
      await handleTurn(openid, msgId, text);
    } catch (err) {
      console.error("[qq] turn:", err.message);
      try {
        await new Replier(openid, msgId).send(`服务暂时不可用：${String(err.message || "").slice(0, 300)}`);
      } catch (_) {}
    }
  });
}

// ---------------------------------------------------------------- gateway

async function connectGateway(signal) {
  const WS = globalThis.WebSocket;
  if (!WS) throw new Error("QQ bridge needs Node.js 22+ (global WebSocket)");

  let sessionId = null;
  let lastSeq = null;

  while (!signal?.aborted) {
    let gatewayUrl;
    try {
      gatewayUrl = (await qqApi("GET", "/gateway")).url;
    } catch (e) {
      console.error("[qq] gateway lookup:", e.message);
      await sleep(5000);
      continue;
    }

    await new Promise((resolve) => {
      const ws = new WS(gatewayUrl);
      let heartbeat = null;
      const stop = () => {
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        try {
          ws.close();
        } catch (_) {}
      };
      const onAbort = () => stop();
      signal?.addEventListener("abort", onAbort, { once: true });

      ws.addEventListener("message", async (ev) => {
        let payload;
        try {
          payload = JSON.parse(typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString());
        } catch {
          return;
        }
        if (payload.s != null) lastSeq = payload.s;

        if (payload.op === 10) {
          const interval = payload.d?.heartbeat_interval || 41250;
          heartbeat = setInterval(() => {
            try {
              ws.send(JSON.stringify({ op: 1, d: lastSeq }));
            } catch (_) {}
          }, interval);
          const token = `QQBot ${await getAccessToken()}`;
          if (sessionId) {
            ws.send(JSON.stringify({ op: 6, d: { token, session_id: sessionId, seq: lastSeq } }));
          } else {
            ws.send(
              JSON.stringify({
                op: 2,
                d: { token, intents: INTENT_GROUP_AND_C2C, shard: [0, 1], properties: {} },
              }),
            );
          }
          return;
        }
        if (payload.op === 7) {
          stop();
          return;
        }
        if (payload.op === 9) {
          sessionId = null;
          lastSeq = null;
          stop();
          return;
        }
        if (payload.op === 0) {
          if (payload.t === "READY") {
            sessionId = payload.d?.session_id || null;
            console.log(`[qq] gateway ready${QQ_BOT_SANDBOX ? " (sandbox)" : ""}`);
          } else if (payload.t === "RESUMED") {
            console.log("[qq] gateway resumed");
          } else if (payload.t === "C2C_MESSAGE_CREATE") {
            onC2CMessage(payload.d);
          }
        }
      });

      ws.addEventListener("close", (ev) => {
        if (heartbeat) clearInterval(heartbeat);
        signal?.removeEventListener("abort", onAbort);
        if (ev.code === 4004 || ev.code === 4914 || ev.code === 4915) {
          console.error(`[qq] gateway closed with code ${ev.code} — check QQ_BOT_APP_ID / QQ_BOT_APP_SECRET, IP whitelist and bot status`);
          sessionId = null;
        } else if (ev.code === 4009 || ev.code === 4007 || ev.code === 4006) {
          sessionId = null;
          lastSeq = null;
        }
        resolve();
      });
      ws.addEventListener("error", (ev) => {
        console.error("[qq] gateway error:", ev?.message || "socket error");
      });
    });

    if (!signal?.aborted) await sleep(3000);
  }
}

// ---------------------------------------------------------------- outbox (active messages)

async function drainOutbox(signal) {
  while (!signal?.aborted) {
    try {
      const { items = [] } = await bridgePost("/bridge/outbox/claim");
      const sent = [];
      for (const item of items) {
        try {
          for (const chunk of splitChunks(item.text || "", 3)) {
            await sendC2C(item.user_openid, chunk);
          }
          sent.push(item.id);
        } catch (e) {
          console.error(`[qq] outbox send to ${item.user_openid}:`, e.message);
        }
      }
      if (sent.length) await bridgePost("/bridge/outbox/ack", { ids: sent });
    } catch (e) {
      console.error("[qq] outbox:", e.message);
    }
    await sleep(OUTBOX_POLL_MS);
  }
}

/**
 * @param {AbortSignal} [signal]
 */
export async function runQqBridge(signal) {
  if (!isQqBridgeConfigured()) {
    throw new Error("QQ bridge: QQ_BOT_APP_ID, QQ_BOT_APP_SECRET and QQ_BRIDGE_SECRET are required");
  }
  await getAccessToken();
  console.log(`[qq] bridge → ${API_BASE}/integrations/qq-bot (QQ API ${QQ_API})`);
  await Promise.all([connectGateway(signal), drainOutbox(signal)]);
}
