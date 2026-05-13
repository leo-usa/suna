# WeChat iLink → Suna bridge

Long-polls Tencent iLink (`getupdates`), forwards user text to the Suna backend (`POST /v1/integrations/wechat-ilink/bridge/chat`), and sends the reply back on WeChat.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `SUNA_API_BASE` | no | API base **including** `/v1`, e.g. `https://api.example.com/v1`. Default: `http://127.0.0.1:8000/v1`. |
| `SUNA_ILINK_BRIDGE_SECRET` | yes | Same value as backend `WECHAT_ILINK_BRIDGE_SECRET`. Sent as header `X-Wechat-Ilink-Bridge-Secret`. |
| `ILINK_TOKEN_FILE` | no | Where to store the iLink bot token after QR login. Default: `./bot_token.json` (working directory). |

## Run

```bash
cd apps/ilink-bridge
npm install
npm start
```

First run: scan the QR code with WeChat. Then in the Dobby dashboard (**user menu → WeChat**), pick a workspace, generate a 6-character code, and send **only** that code to the bot to bind.

## Pairing model

Each workspace has its own pairing code. The bridge sends `ilink_peer_id` (WeChat user id from iLink) and `message` to Suna; the backend maps the peer to the workspace after a valid code is consumed.
