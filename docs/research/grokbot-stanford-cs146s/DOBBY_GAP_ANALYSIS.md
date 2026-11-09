# Dobby vs Grok Bot — Gap Analysis & Build Suggestions

Based on Lee Robinson’s CS146S talk + current Dobby code (`backend/core/...`).  
Slide notes: [SLIDE_NOTES.md](./SLIDE_NOTES.md).

## Executive read

Dobby already has most of the **shape**: server-hosted loop, Daytona sandbox with auto-stop/archive, triggers (schedule/webhook/event), JIT `initialize_tools`, `ask`/`complete` as the user channel, AX-first computer use, context summarization + Anthropic prompt caching, memory extraction (fact/preference/context/summary), sub-agent-ish helpers via agent/worker creation.

What’s still thin relative to Grok Bot is mostly **product semantics of always-on**: silence-by-default, wake heuristics, durable mid-turn resume, cache-as-budget discipline, layered memory in the prompt, and auto-review on irreversible actions.

---

## Capability matrix

| Pattern (from talk) | Dobby today | Gap |
| --- | --- | --- |
| Thick server, thin clients | Yes — API + web/mobile/channels | — |
| Cloud computer + sleep | Daytona sandbox, `auto_stop_interval=15`, `auto_archive_interval=30` (`sandbox/sandbox.py`) | No first-class Firecracker snapshot-as-product story; OK if Daytona restore is reliable |
| Loop off the VM | Yes — agent loop on backend, tools hit sandbox | Keep this invariant |
| Event wakes | Triggers: schedule / webhook / event + Composio (`core/triggers/`) | Meeting/phone/Slack “ambient colleague” UX still weaker than Grok Bot narrative |
| Silence by default | `ask` / `complete` in `message_tool.py`; discourages raw text dupes | Chat turns still feel “always reply”; no strong **don’t call ask unless worth it** for background wakes |
| Single SendToUser | Close: `ask` + `complete` (+ attachments, follow-ups, await_login) | Unify channel delivery (WeChat/Slack/email/push) as renderers of one tool; add `end_turn` / “no message” path for routines |
| Message priority + batch | Partial thread control | Missing: user interrupt > group/routine queue; batch near-simultaneous wakes into one turn |
| Durable workflows | In-process / Redis-style workers; **no Temporal** | Crash mid-turn often replays or dies; helpers aren’t independently resumable workflows |
| Tool search | JIT `initialize_tools` (`core/jit/`, `expand_msg_tool.py`) | Still heavier than “names only + schema on demand”; many core tools stay hot in prompt |
| Cheapest-first ladder | Prompted in places (computer AX before screenshot) | Not a global policy tool/enforcer; connector-fail → silent browser workaround still possible |
| Computer-use as helper | `sb_computer_tool` AX-first; local runner | Screenshots can still land in main thread; dedicated CU helper workflow would match talk |
| Main + helpers | Workers / agent creation / some delegation | Helpers should return **short reports** into sparse master context; isolate token burn |
| Prompt cache as bug | `prompt_caching` + usage `cached_tokens` tracking | No section hashing / deploy-safe prefix contract; no typing pre-warm universally |
| Compaction while warm | `ContextManager` threshold ~120k (`agentpress/context_manager.py`) | Compaction mostly on next turn pressure, not **idle + warm-cache** background job |
| Layered memory | Types: fact / preference / context / conversation_summary (`memory/models.py`) | Not clearly: always-on profile ≤4k + dated logs + ephemeral scratch + search; GC rules weaker |
| Auto-review | Human/tool approval patterns; login handoff | No second-model auto-review with fail-closed timeout on irreversible sends |
| Untrusted input labeling | Partial | Email/webhook/trigger payloads should be wrapped as data, never instructions |
| Eval flywheel | `backend/evals/` exists | Not wired as daily “failure → eval → harness fix” product loop |

---

## What we already match (don’t rebuild)

1. **Server loop + disposable sandbox** — correct architecture; preserve “state on server.”  
2. **Triggers** — schedule/webhook/event are the right wake primitives.  
3. **JIT tools** — same idea as tool search; invest in making the *default* prompt even thinner.  
4. **`ask` / `complete`** — already the Grok `SendToUser` family (choices, attachments, login UI).  
5. **AX before pixels** — computer tool guidance already matches “three ways to use a computer.”  
6. **Context manager + caching** — foundation for month-long threads; harden, don’t replace.

---

## Suggested build order (missing / weak features)

### P0 — Always-on product semantics (1–2 weeks)

**1. Background turn mode + silence policy**  
- Trigger / routine / channel-wake runs with `delivery_mode=proactive`.  
- Model may finish with **zero** `ask` calls; only call `ask` when heuristic says “worth interrupting.”  
- Add optional `notify` severity on `ask` (silent log / push / interrupt).  
- Prompt: “You are a colleague. Progress without pinging. Daily digest beats micro-updates.”

**2. Unify outbound as one tool contract**  
- Treat `ask`/`complete` as the only user-visible channel; map WeChat / Slack / email / mobile push to the same payload (text, choices, draft-to-approve, await_login).  
- Background jobs must not stream assistant prose into chat unless via that tool.

**3. Wake router: priority + batch**  
- Priority: user message interrupts; group/trigger enqueue; coalesce events within N seconds into one turn.  
- Dedup identical webhooks (already partly in trigger path — harden).

### P1 — Cost & long-horizon harness (2–4 weeks)

**4. Idle warm-cache compaction**  
- After thread > ~100k and idle ~10 min (provider cache still warm), run summarization job reusing same prefix.  
- Preserve last K user-visible `ask` texts verbatim.

**5. Cache contract**  
- Fixed ordered prompt sections; hash log per section on every LLM call.  
- Never add/remove tools mid-turn; deploy tool-desc changes via “note” not prefix rewrite for live threads.  
- Pre-warm on thread open / first keystroke (extend `prewarm_user_context`).

**6. Thinner tool surface**  
- Push more schemas behind `initialize_tools` / name-only index (true tool-search).  
- Cap tool description size; promote hot shell patterns to dedicated tools.

**7. Layered memory v2**  
- `profile` block always injected (hard char budget).  
- `log` = dated entries, retrieve top-N by recency/relevance.  
- `scratch` TTL minutes.  
- Rest via memory search / files. Post-turn extract may only delete facts that were in context.

### P2 — Reliability & trust (parallel / next)

**8. Durable turns (Temporal or equivalent)**  
- Persist step boundaries (LLM call, tool call, helper) so crash resumes mid-turn.  
- Each helper = child workflow returning a short report.  
- Start with helper isolation even before full Temporal if needed.

**9. Auto-review gate**  
- Irreversible: send email/Slack/tweet/payment → secondary model (or policy) review; **15s timeout = block**.  
- Label trigger/email body as `<untrusted_data>`.

**10. Computer-use helper isolation**  
- Route screenshot-heavy paths through a sub-run whose transcript is archived; master only gets DOM/AX summary + outcome.

### P3 — Flywheel

**11. Failure → eval**  
- Sample bad tool calls / bad proactive pings into `backend/evals`; weekly harness diffs measured.  
- Track proactive precision: “pinged user / user engaged within 24h.”

---

## Concrete first tickets (recommended)

1. **`proactive` run flag** on trigger execution → silence-default system prompt + allow turn end without `ask`.  
2. **Event coalescing** in `TriggerService` / execution path (batch window).  
3. **Background compaction worker** hooked to idle threads + prompt-cache reuse.  
4. **Memory profile budget** always in system/user context (4k chars hard cap).  
5. **Untrusted wrapper** for webhook/email trigger payloads in the agent prompt.

These five get Dobby closest to the talk’s *product* feeling without requiring Temporal on day one.

---

## Explicit non-goals (for now)

- Training our own model on the harness (Grok/SpaceX flywheel) — stay harness/product focused.  
- Replacing Daytona with Firecracker in-house — only matters if snapshot/restore UX or density fails.  
- Cloning Grok Bot UI — keep Dobby’s channels; borrow the **tool/silence/cache** semantics.
