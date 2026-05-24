/**
 * Unified long-poll workers: Telegram, WeChat iLink, (add more here).
 *
 * Each bridge is optional via env. At least one must be enabled.
 *
 * Loads `apps/bridges/.env` when present (same idea as `backend/.env`, `apps/frontend/.env`).
 * Production: set the same variable names on the host / worker; no file required.
 */

import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const bridgeEnv = path.resolve(__dirname, "../.env");
if (existsSync(bridgeEnv)) {
  config({ path: bridgeEnv });
}

const { isTelegramBridgeConfigured, runTelegramBridge } = await import("./telegram.mjs");
const { isWechatIlinkBridgeConfigured, runWechatIlinkBridge } = await import("./wechat-ilink.mjs");
const { isFeishuBridgeConfigured, runFeishuBridge } = await import("./feishu.mjs");

function waitForShutdown(signal) {
  return new Promise((resolve) => {
    if (signal.aborted) resolve();
    else signal.addEventListener("abort", () => resolve(), { once: true });
  });
}

const ac = new AbortController();
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`\n[i] ${sig} — shutting down bridges…`);
    ac.abort();
  });
}

const workers = [];

if (isTelegramBridgeConfigured()) {
  workers.push(
    (async () => {
      try {
        await runTelegramBridge(ac.signal);
      } catch (e) {
        console.error("[telegram] fatal:", e.message);
        console.error(
          "[i] Telegram stopped; other bridges keep running. Fix TELEGRAM_BOT_TOKEN in apps/bridges/.env and restart.",
        );
        await waitForShutdown(ac.signal);
      }
    })(),
  );
} else {
  console.log("[i] Telegram bridge: disabled (set TELEGRAM_BOT_TOKEN + TELEGRAM_BRIDGE_SECRET)");
}

if (isWechatIlinkBridgeConfigured()) {
  workers.push(
    (async () => {
      try {
        await runWechatIlinkBridge(ac.signal);
      } catch (e) {
        console.error("[wechat-ilink] fatal:", e.message);
        console.error("[i] WeChat iLink stopped; other bridges keep running. Restart this process after fixing QR or config.");
        await waitForShutdown(ac.signal);
      }
    })(),
  );
} else {
  console.log("[i] WeChat iLink bridge: disabled (set WECHAT_ILINK_BRIDGE_SECRET)");
}

if (isFeishuBridgeConfigured()) {
  workers.push(
    runFeishuBridge(ac.signal).catch((e) => {
      console.error("[feishu] fatal:", e.message);
      throw e;
    }),
  );
} else {
  console.log("[i] Feishu bridge: disabled (set FEISHU_APP_ID + FEISHU_APP_SECRET + FEISHU_BRIDGE_SECRET)");
}

if (workers.length === 0) {
  console.error("[✗] No bridges enabled. Set Telegram, Feishu, and/or WeChat iLink env vars (see README).");
  process.exit(1);
}

console.log(`\n[i] bridges: starting ${workers.length} worker(s)\n`);

try {
  await Promise.all(workers);
} catch (err) {
  console.error("[✗] A bridge exited with error:", err.message);
  process.exit(1);
}

console.log("[i] All bridges stopped.");
process.exit(0);
