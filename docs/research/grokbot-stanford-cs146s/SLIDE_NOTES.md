# Grok Bot / Always-on Agents — Slide Notes

**Talk:** Stanford CS146S — *How always-on agents work*  
**Speaker:** Lee Robinson (Grok Bot / SpaceX AI; ex-Cursor, ex-Vercel)  
**Date:** 2026-10-11 · ~45 min  
**Video:** https://www.youtube.com/watch?v=L1OBRtfPS34  
**Assets in this folder:**
- `frames/*.jpg` — one capture per major slide
- `raw/transcript_full.txt` — full timed transcript

Notes below are **distilled** (not verbatim). Each section maps to a slide image.

---

## 00:21 — You built this in week one
`frames/00m21s_week-one-loop.jpg`

Week-one harness: model ↔ tools in a loop. Powerful, but dies when the laptop closes. The talk is about extending that loop into something that survives crashes, sleeps, and weeks of work.

## 00:49 — Your agent vs an always-on agent
`frames/00m49s_your-agent-vs-always-on.jpg`

| Terminal agent | Always-on agent |
| --- | --- |
| Runs in your terminal | Runs on a server / cloud |
| Uses your laptop | Owns a cloud Linux computer (desktop, files, browser) |
| Remembers only the message list | Persists state, memory, skills |
| Prints every model reply | Speaks only when useful (colleague, not chatbot) |
| Starts when you type | Wakes on events: Slack, email, schedule, finished work |
| One task then exits | Can run for weeks/months with continuity |

## 02:06 — Agenda
`frames/02m06s_agenda.jpg`

Architecture → harness → how we got here → where it’s going → Q&A. Focus: proactive, persistent, instruction-following.

## 02:37 — Four eras of developers + AI
`frames/02m37s_how-devs-work-with-ai.jpg`

1. Copy-paste out of ChatGPT into an editor  
2. Terminal coding agent (edit files + shell in a loop)  
3. Dedicated apps, many agents in parallel — **you still approve every command**  
4. Always-on bots: own computer + memory + skills; keep working after you leave

## 04:08 — From approving every step to steering
`frames/04m08s_approving-to-steering.jpg`

Old: prompt → wait → approve shell → prompt → wait.  
New: steer mid-flight (“check this thread… also do it Thursday”); models tolerate rambling multi-intent.  
**Auto-review:** a second model checks risky commands — often better than human rubber-stamping hundreds of shells.

## 05:30 — As models get better, UI gets simpler
`frames/05m30s_interface-gets-simpler.jpg`

Product shape collapses to “text a coworker.” Bot goes do real work, not just Q&A. Many products converging on this because everyone already knows how to text.

## 06:20 — Six model capabilities that unlocked bots
`frames/06m20s_six-model-capabilities.jpg`

1. Long-horizon instruction following (hours/days with compaction)  
2. Sub-agents / helpers with fresh working memory → “infinite context” feel  
3. Reliable tool calling (hallucinations mostly “solved” in practice)  
4. Full computer: shell, files, browser, computer-use on any SaaS without API  
5. Knowledge in searchable files  
6. Learn skills / memories / routines from demonstration

## 08:29 — What the agent knows lives in files
`frames/08m29s_agent-knows-lives-in-files.jpg`

- **Profile** always in prompt (e. of style prefs)  
- **Working log** like a colleague’s daily notes; grep via shell  
- **Skills** = markdown playbooks (ecosystem + plugins)  
- **Routines** ≈ cron prompts  
Grok Bot: plugins = skills + MCP servers + schedules. “Everything is computer.”

## 10:10 — How does it stay always-on?
`frames/10m10s_how-it-stays-always-on.jpg`

Always-on ≠ always running. Server process and VM both **sleep**. Trigger loads state → optional wake computer → work → sleep. Persist conversation, memories, routines to DB. “Not enough computers in the world” to keep everyone hot.

## 11:13 — What wakes the agent
`frames/11m13s_what-wakes-the-agent.jpg`

Wakes: direct prompt, Slack ping, phone/meeting join (notes bot), routine/background job finishing. Router dedupes → conversation. Then a **heuristic: do I bug the user?** Most progress updates should stay quiet (daily status, not every micro-step).

## 12:19 — The agent’s computer (Firecracker)
`frames/12m19s_agents-computer-firecracker.jpg`

Per-agent Firecracker VM: snapshot / stop / restore. Files, live view, shell, Chrome, virtual desktops so many bots don’t share one browser session. Shared infra pool.

## 13:14 — Three parts of the system
`frames/13m14s_three-parts-of-the-system.jpg`

1. **Thin clients / channels** (apps, Slack, email) — send input, show updates  
2. **Server** — queue, agent loop, DB  
3. **Computer** — files, commands, browser  

Agent loop is still “model + tools,” with product power coming from tools + triggers around it.

## 14:06 — Why the agent runs on the server
`frames/14m06s_why-agent-runs-on-server.jpg`

Thin client / thick server: ship agent updates without App Store; heavy work (transcription, image gen) server-side; scale known patterns.  
**Critical:** if the loop lived *inside* the VM, you couldn’t shut the VM down independently.

## 15:05 — Save everything on the server
`frames/15m05s_save-everything-on-server.jpg`

VM is disposable. Zero-day Linux patch → rebuild VM without killing agent identity/state.

## 15:26 — What happens when you hit send
`frames/15m26s_what-happens-on-send.jpg`

Ack immediately → durable turn (tools in loop, persist every step) → clients subscribe to signals → fetch latest; dedupe retries so UI doesn’t double-render.

## 16:17 — Durable workflows vs job queues
`frames/16m17s_durable-workflows-vs-job-queues.jpg`

Job queue crash at step 3 → replay 1–3 (bad for side effects).  
Durable workflow → resume at step 3. They use **Temporal**. Idempotent steps + timers + cancellation built-in.

## 17:19 — Rules for handling new messages
`frames/17m19s_rules-for-new-messages.jpg`

- **User → own bot:** interrupt running turn; highest priority  
- **Group / Slack / routine:** queue behind; batch nearby messages into one turn  

## 18:20 — One tool for talking to you: SendToUser
`frames/18m20s_one-tool-sendtouser.jpg`

Biggest harness difference: **only one client↔server tool = `send_to_user`**. Regular model text is not shown. Silence is default. Same tool works for mobile, desktop, email, Slack — client chooses rich UI.

## 19:14 — Pairing tools with the right UI
`frames/19m14s_pairing-tools-with-ui.jpg`

One tool, many renderers: sign-in + 1Password, Stripe/X Money pay, irreversible email/Slack draft approve, emoji-only ack.

## 19:59 — Load tool details only when needed
`frames/19m59s_load-tool-details-on-demand.jpg`

Don’t jam every MCP schema into the window. Put **tool names** in prompt; **tool search / dynamic discovery** loads full schema on demand (files all the way down). Saves tokens, cost, room to think.

## 21:31 — Try the cheapest option first
`frames/21m31s_cheapest-option-first.jpg`

Ladder: conversation knowledge → connector/API → web search → browser → full desktop → **only then** ask the user.  
Hard rule: if a connector is broken, don’t silently browser-workaround — tell the user.

## 22:36 — Three ways to use a computer
`frames/22m36s_three-ways-to-use-computer.jpg`

Prefer: accessibility tree → HTML → screenshot/pixel click → user (2FA/CAPTCHA). Computer-use runs as a **helper** so screenshots don’t bloat main context.

## 23:30 — One main agent, many helpers
`frames/23m30s_main-agent-many-helpers.jpg`

Main agent = sparse orchestrator + todo list. Helpers (general, computer-use, video, cloud coding) are **separate durable workflows** returning short reports. Feels like infinite context; modeled after scaling an eng team.

## 25:12 — Tips for designing agent tools
`frames/25m12s_tool-design-tips.jpg`

- Don’t add/remove tools mid-turn (cache + stability)  
- Keep schema/description short (~4k chars)  
- Frequent shell patterns → dedicated tools (efficiency + reviewability)  
- Errors must tell the agent **what to do next**

## 26:28 — How we keep it safe
`frames/26m28s_how-we-keep-it-safe.jpg`

Auto-review on shell; label email/webhook as **untrusted** (not instructions); irreversible actions need user approve; secrets in env, never in model context. Prompt injection still an open industry problem. Review timeout → **block** (e.g. 15s no answer).

## 27:46 — Keep the start of the prompt the same
`frames/27m46s_stable-prompt-prefix.jpg`

Prompt caching is the budget for month-long agents. Stable prefix: tools + system + early messages. Only the newest message is the uncached delta.

## 28:46 — Keep the main context small
`frames/28m46s_keep-main-context-small.jpg`

Long outputs → files. Screenshots / expensive work → helpers. Continuously garden/trim context for cost **and** quality.

## 29:51 — Treat a cache miss like a bug
`frames/29m51s_cache-miss-is-a-bug.jpg`

Fixed section order; hash each section to debug busts; deploys that change tools leave a **note**, don’t rewrite prefix for live chats; **pre-warm cache** when user opens chat / starts typing (like link prefetch). OpenClaw-era subscription burn was largely cache-miss pain.

## 31:31 — Summarize while you’re away
`frames/31m31s_summarize-while-away.jpg`

When past ~100k tokens and user idle, compact **while provider cache is still warm** (cheaper). Next return starts from summary. Keep last few user-facing messages verbatim — all compression is lossy.

## 32:50 — How the agent remembers (layers)
`frames/32m50s_how-the-agent-remembers.jpg`

| Layer | Content | Load |
| --- | --- | --- |
| Profile / core facts | Always-on prefs, ≤~100 facts / 4k chars | Always in prompt |
| Dated logs | Past events | Top relevant recent |
| Scratch notes | Ephemeral (minutes–hour) | Fade fast |
| Everything else | Files / search tool | On demand |

Post-turn GC: add/replace facts; only delete facts that were shown. Old prompt instructions → skills with a one-line pointer left behind.

## 34:29 — Training the model for the product
`frames/34m29s_training-the-model.jpg`

Pretrain → SFT (behave in *this* harness) → RL (instruction following, skill pick, click targets). Inference split: main agent low-latency; helpers can be slow (10 vs 12 min doesn’t matter).

## 36:05 — Product and model improve together
`frames/36m05s_product-and-model-improve.jpg`

**Inner loop (daily):** failure → eval → fix harness/prompt/inference → ship.  
**Outer loop (months):** train next model on harness + evals → drop in. Multi-agent group chat still fragile (Moltbook / HF-style incidents).

## 37:44 — Delete the product
`frames/37m44s_delete-the-product.jpg`

Assume today’s models are the **worst they’ll ever be**. Build the thinnest UI/harness that works; expect rebuild in 6 months. Prefer process written down so agents can run it.

## 38:35 — 6–12 month expectations
`frames/38m35s_6-12-month-predictions.jpg`

Week/month-long agents; better recall representations; org-wide tool access like onboarding a human; speech-first UIs; skills learned on the job; companies write processes agent-legibly.

## 40:21 — Open problems
`frames/40m21s_open-problems.jpg`

1. Eval agents that run a month when models ship monthly  
2. Memory correctness  
3. Secure harness / prompt injection  
4. Silence vs proactive “bug the user” heuristics  
5. Multi-agent coordination  
6. Token/cost efficiency as volume explodes  

## 42:04 — The new building blocks
`frames/42m04s_new-building-blocks.jpg`

Same as “everyone has a DB + CRUD in 2005”: durable workflows, sandboxes, memory, skills, connectors, voice, payments, identity, evals, observability — each a category; every product becomes agentic or agent-data.

## 43:22 — What to take away
`frames/43m22s_what-to-take-away.jpg`

System design compounds; try building a personal always-on harness; learn enough LLM training/inference to make good harness decisions.

---

## Sources

- Video: Lee Robinson, Stanford CS146S  
- Transcript mirror: https://www.peterp.me/transcripts/how-grok-bot-works/  
- Architecture writeup: https://apurvkhare.com/articles/ai/how-grok-bot-works/  
