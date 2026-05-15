# IM bridges (unified)

One **Node** process runs every enabled outbound bridge (Telegram, WeChat iLink, …). Use this for **local dev** and **one Render Background Worker** instead of separate services per bridge.

## Which bridges run?

| Bridge | Enabled when |
|--------|----------------|
| **Telegram** | `TELEGRAM_BOT_TOKEN` and `TELEGRAM_BRIDGE_SECRET` are both set |
| **WeChat iLink** | `WECHAT_ILINK_BRIDGE_SECRET` is set |

If **none** are configured, the process exits with an error. If only one is configured, only that loop runs.

## Environment

**Local:** copy `.env.example` in this folder to **`.env`** (same directory as `package.json`). Git ignores `.env`; keep secrets out of commits.

**Production:** set the same variable names on your worker host (Render, etc.); a `.env` file is optional if the platform injects env vars.

Shared:

| Variable | Default | Description |
|----------|---------|-------------|
| `API_BASE` | `http://127.0.0.1:8000/v1` | Backend API base **including** `/v1`. |

Telegram:

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | for Telegram | From @BotFather |
| `TELEGRAM_BRIDGE_SECRET` | for Telegram | Same value as backend `TELEGRAM_BRIDGE_SECRET` |

WeChat iLink:

| Variable | Required | Description |
|----------|----------|-------------|
| `WECHAT_ILINK_BRIDGE_SECRET` | for iLink | Same value as backend `WECHAT_ILINK_BRIDGE_SECRET` |
| `ILINK_TOKEN_FILE` | no | Bot token JSON path after QR login (default `./bot_token.json`) |

## Run

**Monorepo:** Depend on the root `pnpm-lock.yaml`. From the repo root run `pnpm install` whenever you change `package.json` here, then commit the updated lockfile (CI uses `pnpm install --frozen-lockfile`).

Local, from this directory:

```bash
cd apps/bridges
cp .env.example .env   # first time only; then edit .env
npm install
npm start
```

`SIGINT` / `SIGTERM` aborts all bridge loops (graceful shutdown for deploys).

## Render

Create **one** Background Worker, root `apps/bridges`, build `npm install`, start `npm start`, set the env vars for whichever bridges you use. Same machine must reach `API_BASE` (your web service URL + `/v1`).

## Adding another bridge

1. Add `src/<name>.mjs` exporting `is<Name>Configured()` and `async run<Name>Bridge(signal)`.
2. Import it in `src/index.mjs` and push onto `workers` when configured.
