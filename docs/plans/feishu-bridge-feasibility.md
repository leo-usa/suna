# Feishu / Lark bridge — feasibility for Dobby

> **Status:** Research (May 2026)  
> **Context:** WeChat iLink is experimental and not production-ready. Hermes Agent and OpenClaw both ship mature Feishu integrations. This doc maps their approach onto Dobby’s existing `apps/bridges` + backend integration pattern.

---

## 1. How Dobby bridges work today

Dobby uses a **two-layer** design (documented in `apps/bridges/README.md`):

| Layer | Role | Examples |
|-------|------|----------|
| **Bridge worker** (`apps/bridges/src/*.mjs`) | Long-running Node process: receive IM events, call backend, send replies | `telegram.mjs`, `wechat-ilink.mjs` |
| **Backend API** (`backend/core/integrations/*/api.py`) | Pairing (JWT + 6-char code), `start_agent_run`, snapshot/finalize for long runs | `telegram_bot`, `wechat_ilink` |

Shared pieces:

- `bridge_reply_format.py` — plain-text replies for IM
- Pairing: user generates code on web → sends code in chat → link `peer_id` → `account_id` (+ optional `thread_id`)
- Bridge auth: shared secret header (`X-Telegram-Bridge-Secret`, `X-Wechat-Ilink-Bridge-Secret`)
- Agent runs: Telegram uses **start + snapshot + finalize** so Render/nginx never times out on long tool runs

**Telegram** = reference implementation (official Bot API, stable).  
**WeChat iLink** = unofficial QR + `ilinkai.weixin.qq.com` polling — fragile, not the model for Feishu.

---

## 2. How Hermes Agent connects to Feishu

Docs: [飞书 / Lark | Hermes Agent](https://hermes-agent.lzw.me/docs/user-guide/messaging/feishu)

| Aspect | Hermes approach |
|--------|-----------------|
| **Credentials** | `FEISHU_APP_ID`, `FEISHU_APP_SECRET` from Feishu Open Platform (self-built app) |
| **Transport** | **WebSocket (recommended)** — outbound long connection, no public URL. Optional **webhook** via `aiohttp` on `/feishu/webhook` |
| **SDK** | Python `lark-oapi` (+ `websockets` / `aiohttp`) |
| **Gateway** | Feishu is a **channel plugin** inside Hermes gateway; messages flow through same agent runtime as Telegram |
| **Pairing** | `FEISHU_ALLOWED_USERS` (open_id allowlist); wizard can QR-create app |
| **Features** | DM + group, text/images/audio/files, cron → home channel, streaming cards (community plugins) |

Hermes does **not** use a separate “bridge HTTP API” like Dobby — the Feishu listener lives inside the gateway process. Dobby can still copy the **Feishu-side** pieces: app credentials, WebSocket events, message send API.

---

## 3. How OpenClaw connects to Feishu

Docs: [Feishu channel | OpenClaw](https://docs.openclaw.ai/channels/feishu)

| Aspect | OpenClaw approach |
|--------|-----------------|
| **Credentials** | `appId` + `appSecret` per account (manual or QR wizard) |
| **Transport** | **WebSocket default**; optional webhook (`verificationToken`, `encryptKey`, `/feishu/events`) |
| **SDK / plugin** | Official `@larksuite/openclaw-lark` (Node); community plugins align with same semantics |
| **Pairing** | `dmPolicy`: `pairing` \| `allowlist` \| `open` — CLI `openclaw pairing approve feishu <CODE>` |
| **Groups** | `groupPolicy`, `requireMention` (@bot in groups), per-group overrides |
| **Replies** | Streaming **interactive cards** (CardKit), typing reactions, chunk limit ~2000 chars |
| **Events** | `im.message.receive_v1`; bot must be published + permissions granted |

OpenClaw is **closer to Dobby’s product shape** than raw Hermes for pairing policy: explicit DM allowlist / pairing codes map well to Dobby’s dashboard 6-char flow.

---

## 4. Comparison: Feishu vs our current channels

| | Telegram (Dobby today) | WeChat iLink (Dobby today) | Feishu (target) |
|---|------------------------|----------------------------|-----------------|
| API official? | ✅ BotFather | ❌ Unofficial iLink | ✅ Open Platform |
| Worker transport | HTTPS long poll | HTTPS long poll | **WebSocket** (or webhook) |
| Peer ID | `telegram_user_id` | `ilink_peer_id` | `open_id` (DM) / `chat_id` (group) |
| Pairing | 6-char code on web | 6-char code on web | Same pattern ✅ |
| Group chat | DMs focus | DMs focus | **@mention** in groups (configurable) |
| Streaming UI | Edit message text | Chunk text | Cards or plain text (MVP: text) |
| China enterprise | Weak | WeChat native | **Strong (飞书)** |

**Conclusion:** Feishu should be implemented like **Telegram + OpenClaw transport**, not like WeChat iLink.

---

## 5. Can Feishu plug into `apps/bridges`?

**Yes.** The README already describes the extension contract:

1. Add `src/feishu.mjs` with `isFeishuBridgeConfigured()` and `runFeishuBridge(signal)`.
2. Register in `src/index.mjs`.
3. Add backend module `backend/core/integrations/feishu_bot/` mirroring `telegram_bot`.

### Recommended architecture

```
┌─────────────────────┐     WebSocket (outbound)      ┌──────────────────┐
│  Feishu Open        │ ◄────────────────────────── │ apps/bridges     │
│  Platform           │     im.message.receive_v1    │ feishu.mjs       │
└─────────────────────┘                               └────────┬─────────┘
                                                                 │ HTTPS + secret
                                                                 ▼
                        ┌──────────────────────────────────────────────┐
                        │ backend /v1/integrations/feishu-bot/       │
                        │  • POST /pairing/code (JWT)                  │
                        │  • POST /bridge/chat/start                   │
                        │  • POST /bridge/chat/snapshot|finalize       │
                        │  • tables: feishu_bot_links, pairing_codes   │
                        └──────────────────────────────────────────────┘
                                                                 │
                                                                 ▼
                        start_agent_run (same as Telegram / WeChat)
```

### Environment variables (proposed)

**Bridge worker (`apps/bridges/.env`):**

| Variable | Description |
|----------|-------------|
| `FEISHU_APP_ID` | `cli_xxx` from Feishu console |
| `FEISHU_APP_SECRET` | App secret |
| `FEISHU_DOMAIN` | `feishu` (China) or `lark` (international) |
| `FEISHU_CONNECTION_MODE` | `websocket` (default) or `webhook` |
| `FEISHU_BRIDGE_SECRET` | Shared with backend |
| `API_BASE` | Same as other bridges |

**Backend (`backend/.env`):**

| Variable | Description |
|----------|-------------|
| `FEISHU_BRIDGE_SECRET` | Same as bridge |
| (optional) `FEISHU_WEBHOOK_*` | Only if webhook mode on API instead of worker |

### Feishu Open Platform setup (from Hermes + OpenClaw)

1. Create **企业自建应用** on [open.feishu.cn](https://open.feishu.cn).
2. Enable **Bot** capability.
3. Permissions (minimum MVP):
   - `im:message`
   - `im:message:send_as_bot`
   - `im:message.p2p_msg:readonly` (DM read)
   - `im:message.group_at_msg:readonly` (group @bot) — if groups in phase 2
4. Event subscription: **`im.message.receive_v1`**
5. Connection: **长连接 / WebSocket** (not request URL) for worker on Render.
6. Publish app to tenant (or test mode with test users).

### Node SDK

Use official **`@larksuite/oapi`** (same family as OpenClaw Lark plugin). WebSocket client maintains outbound connection — fits Render Background Worker without exposing a new public route.

**Alternative:** Webhook mode on `dobby.now` (`POST /v1/integrations/feishu-bot/events`) — simpler bridge code but requires URL verification, encrypt key, and stable public HTTPS (you already have this for Stripe webhooks).

---

## 6. Implementation phases

### Phase A — MVP (DM, text only) — ~1–2 weeks

- [ ] Migration: `feishu_bot_pairing_codes`, `feishu_bot_links` (`feishu_open_id` PK, same shape as Telegram)
- [ ] Backend: copy `telegram_bot/api.py` → `feishu_bot/api.py` (rename peer field)
- [ ] Bridge: `feishu.mjs` — WebSocket receive text → `/bridge/chat/start` + poll snapshot/finalize → reply via `im/v1/messages`
- [ ] Frontend: `/dashboard/feishu` pairing page (clone `wechatIlinkPage` / Telegram page)
- [ ] Config: `FEISHU_*` in `config.py`, CORS header for bridge secret
- [ ] Docs: `apps/bridges/README.md` + `.env.example`

**User flow:** Dashboard → generate 6-char code → DM bot on Feishu → send code → chat with Dobby.

### Phase B — Production parity with Telegram

- [ ] Voice/image → reuse `bridge/transcribe` pattern
- [ ] `/newchat` command → clear `thread_id` on link
- [ ] Chunk long replies (2000 char Feishu limit)
- [ ] `bridge_reply_format` footer strip (browser link)

### Phase C — OpenClaw-like group support

- [ ] `requireMention: true` default in groups
- [ ] `groupPolicy: allowlist` via config
- [ ] Peer key: `chat_id` for groups (store in links or separate table)

### Phase D — Polish (optional)

- [ ] Streaming interactive cards (CardKit) like OpenClaw/Hermes plugins
- [ ] Typing indicator (emoji reaction API)
- [ ] Multi-tenant: one Dobby Feishu app vs per-customer apps (enterprise)

---

## 7. What not to do

| Avoid | Why |
|-------|-----|
| Copy WeChat iLink HTTP hacks | Feishu has official APIs |
| Block on WeChat iLink “working” | Independent track; Feishu is more viable for enterprise CN |
| Put Feishu webhook only on worker without TLS | Use WebSocket from worker, or webhook on main API |
| Skip app publish / permission review | Bot silent until Feishu admin approves scopes |

---

## 8. Hermes vs OpenClaw — what to borrow

| Borrow from | Use in Dobby |
|-------------|--------------|
| **Hermes** | WebSocket-first deployment story; env var naming; `lark-oapi` usage |
| **OpenClaw** | Pairing/allowlist semantics; group @mention; streaming cards (later); permission checklist |
| **Dobby Telegram** | Backend bridge API shape, DB tables, snapshot/finalize, dashboard pairing UX |

---

## 9. Risk summary

| Risk | Mitigation |
|------|------------|
| Feishu app audit / tenant admin | Start with test tenant + published test users |
| WebSocket disconnect on Render | SDK auto-reconnect; health log in bridge worker |
| Group spam | Default DM-only MVP; `requireMention` when enabling groups |
| CardKit complexity | Phase A plain text only |
| Duplicate code vs Telegram | Later refactor shared `bridge_integration_base.py` |

---

## 10. Recommendation

**Add Feishu to the bridge framework using the Telegram template + Feishu WebSocket (Hermes/OpenClaw pattern).**  

This gives Dobby a **credible enterprise IM channel in China** without depending on WeChat iLink, while reusing 80%+ of existing backend bridge logic and the unified `apps/bridges` worker.

**Next step when ready to build:** Phase A migration + `feishu.mjs` skeleton + one Feishu test app in a dev tenant.

---

## References

- Dobby: `apps/bridges/README.md`, `backend/core/integrations/telegram_bot/api.py`
- Hermes: https://hermes-agent.lzw.me/docs/user-guide/messaging/feishu
- OpenClaw: https://docs.openclaw.ai/channels/feishu
- OpenClaw official Lark plugin: https://github.com/larksuite/openclaw-lark
- Product comparison doc: `docs/marketing/dobby-product-overview-and-openclaw-comparison.md`
