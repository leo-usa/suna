# Amazon Bedrock access / quota request template (Dobby)

Use this when AWS asks for model access or a quota increase. Fill **Account ID** and **Region** from the console you are applying in. Copy one **Model** block per model.

**Product:** Dobby (https://dobby.now) — hosted autonomous AI worker. Users describe a task in web/app/WeChat/Feishu; the agent runs tools in a sandbox or on the user’s Mac (browser, files, shell, computer use).

**Current production load (last 30 days, all models):** ~1,040 agent runs (~34/day, peak 95/day); ~6,960 billed LLM calls; peak hours ~00:00–02:00 UTC. Numbers below include headroom so Claude on Bedrock can take a share of that traffic and grow.

**Endpoint:** `bedrock-runtime` (Converse), not Mantle.  
**Limit type:** On Demand (not Provisioned Throughput).  
**CRIS:** US geo (`us.anthropic.*`). Not Global — keep inference in US/Canada.

Models to request: Claude Sonnet 5, Claude Fable 5, Claude Opus 5, Claude Haiku 4.5.

---

## Shared fields

| Field | Value |
|---|---|
| Account ID | *(you have this)* |
| Region | `us-west-2` (Oregon). If the API key was created in N. Virginia, use `us-east-1` — both are valid **source** regions for US geo CRIS. |
| Limit Type | On Demand |
| Input Modality | Text and Image (screenshots / uploads for computer use and vision) |
| Output Modality | Text (including tool/function calls; no image/video out from these Claude models) |
| CRIS enabled | **Yes — US geo.** Not Global: customer task content and files should stay in US/Canada. |

---

## Model: Claude Sonnet 5

Daily workhorse for coding, agents, reports, PPT, computer use.

| Field | Value |
|---|---|
| Model Name | Anthropic Claude Sonnet 5 (`anthropic.claude-sonnet-5` / `us.anthropic.claude-sonnet-5`) |
| Steady State TPM | 500,000 |
| Peak State TPM | 2,000,000 |
| Steady RPM | 50 |
| Peak RPM | 200 |
| Average Input Tokens Per Request | 30,000 |
| Average Output Tokens Per Request | 2,500 |

TPM is input + output combined on `bedrock-runtime`. One user task is a tool loop (~5–15 Converse calls). Prompt caching is on; later steps still count tokens against TPM.

---

## Model: Claude Fable 5

Paid / high-capability path. Lower QPS, longer thinking, larger outputs.

| Field | Value |
|---|---|
| Model Name | Anthropic Claude Fable 5 (`anthropic.claude-fable-5` / `us.anthropic.claude-fable-5`) |
| Steady State TPM | 200,000 |
| Peak State TPM | 800,000 |
| Steady RPM | 20 |
| Peak RPM | 80 |
| Average Input Tokens Per Request | 40,000 |
| Average Output Tokens Per Request | 6,000 |

---

## Model: Claude Opus 5

Paid / hardest tasks (long agents, complex coding). Lower QPS than Sonnet.

| Field | Value |
|---|---|
| Model Name | Anthropic Claude Opus 5 (`anthropic.claude-opus-5` / `us.anthropic.claude-opus-5`) |
| Steady State TPM | 200,000 |
| Peak State TPM | 800,000 |
| Steady RPM | 15 |
| Peak RPM | 60 |
| Average Input Tokens Per Request | 40,000 |
| Average Output Tokens Per Request | 4,000 |

---

## Model: Claude Haiku 4.5

Fast/cheap path (short tasks, high step count). Highest RPM of the four.

| Field | Value |
|---|---|
| Model Name | Anthropic Claude Haiku 4.5 (`anthropic.claude-haiku-4-5-20251001-v1:0` / `us.anthropic.claude-haiku-4-5-20251001-v1:0`) |
| Steady State TPM | 800,000 |
| Peak State TPM | 3,000,000 |
| Steady RPM | 80 |
| Peak RPM | 400 |
| Average Input Tokens Per Request | 20,000 |
| Average Output Tokens Per Request | 1,500 |

---

## Use Case Description

(Paste as-is; one paragraph is enough if they have a short box.)

Dobby (dobby.now) is a B2C/B2B SaaS AI worker. End users submit natural-language tasks (research, documents, slides, data, coding, browser/computer use). Our backend orchestrates multi-step tool calling via Amazon Bedrock Converse: web browsing, file I/O, shell, and optional on-device Mac control (screenshots + click/type). We are moving Anthropic Claude Haiku 4.5, Sonnet 5, Opus 5, and Fable 5 from a third-party router onto Bedrock in us-west-2 with US geo cross-region inference for capacity and US/Canada data residency. Haiku handles high-volume short steps; Sonnet is the default agent; Opus and Fable are paid/high-capability paths.

Traffic is interactive and bursty, not batch. A single task typically issues 5–15 sequential/parallel model calls with a growing context (system prompt, tools, history, tool results). We use prompt caching. Users are authenticated; generation is for their own work product (docs, code, analysis), not unrestricted public anonymous completion. We do not use the models to train weapons, scrape indiscriminately for resale, or provide unfiltered open proxies. Safety: platform terms of service, credit-based rate limits, and human-initiated tasks (plus optional scheduled jobs the user configured).

Company: Dobby. Contact: support@dobby.now. Website: https://dobby.now.

---

## How the TPM/RPM numbers were chosen

- Today: ~34 agent runs/day, peak 95; ~7k LLM calls/30d across all models.
- Peak minute if Claude takes the busy hour: tens of in-flight Converse calls, not hundreds.
- Requested peak is roughly 10× current all-model traffic so AWS does not have to re-approve immediately after cutover.
- If they only grant default on-demand quota, that is enough to **start localhost and a small production canary**; raise later with measured CloudWatch `Invocations` / `InvocationThrottles`.

## Notes for the next request

- One form per model if they ask you to split.
- Do not use Provisioned Throughput unless they require a commitment.
- After approval: Playground one prompt per model (Anthropic first-time use case + Marketplace subscribe), then API.
- Later models (GPT on Bedrock Mantle, etc.): duplicate a Model block; keep On Demand + US geo unless residency changes.

---

## Copy-paste blocks (AWS form format)

Account ID: leave blank / fill yourself.

### Claude Sonnet 5

• Account ID:
• Region: us-west-2
• Limit Type (On Demand/Provisioned): On Demand
• Model Name: Anthropic Claude Sonnet 5
• Input Modality (Text/Image): Text/Image
• Output Modality: Text
• CRIS enabled (global or geo)? If not, provide reason: Yes, US geo (us.anthropic.claude-sonnet-5). Not Global — keep inference in US/Canada for customer task content and files.
• Steady State TPM: 500000
• Peak State TPM: 2000000
• Steady RPM: 50
• Peak RPM: 200
• Average Input Tokens Per Request: 30000
• Average Output Tokens Per Request: 2500
Use Case Description:
Dobby (dobby.now) is a B2C/B2B SaaS AI worker. End users submit natural-language tasks (research, documents, slides, data, coding, browser/computer use). Our backend orchestrates multi-step tool calling via Amazon Bedrock Converse: web browsing, file I/O, shell, and optional on-device Mac control (screenshots + click/type). We are moving Anthropic Claude Haiku 4.5, Sonnet 5, Opus 5, and Fable 5 from a third-party router onto Bedrock in us-west-2 with US geo cross-region inference for capacity and US/Canada data residency. Haiku handles high-volume short steps; Sonnet is the default agent; Opus and Fable are paid/high-capability paths. Traffic is interactive and bursty, not batch. A single task typically issues 5–15 sequential/parallel model calls with a growing context (system prompt, tools, history, tool results). We use prompt caching. Users are authenticated; generation is for their own work product (docs, code, analysis), not unrestricted public anonymous completion. We do not use the models to train weapons, scrape indiscriminately for resale, or provide unfiltered open proxies. Safety: platform terms of service, credit-based rate limits, and human-initiated tasks (plus optional scheduled jobs the user configured). Company: Dobby. Contact: support@dobby.now. Website: https://dobby.now.

### Claude Fable 5

• Account ID:
• Region: us-west-2
• Limit Type (On Demand/Provisioned): On Demand
• Model Name: Anthropic Claude Fable 5
• Input Modality (Text/Image): Text/Image
• Output Modality: Text
• CRIS enabled (global or geo)? If not, provide reason: Yes, US geo (us.anthropic.claude-fable-5). Not Global — keep inference in US/Canada for customer task content and files.
• Steady State TPM: 200000
• Peak State TPM: 800000
• Steady RPM: 20
• Peak RPM: 80
• Average Input Tokens Per Request: 40000
• Average Output Tokens Per Request: 6000
Use Case Description:
(same as Sonnet 5)

### Claude Opus 5

• Account ID:
• Region: us-west-2
• Limit Type (On Demand/Provisioned): On Demand
• Model Name: Anthropic Claude Opus 5
• Input Modality (Text/Image): Text/Image
• Output Modality: Text
• CRIS enabled (global or geo)? If not, provide reason: Yes, US geo (us.anthropic.claude-opus-5). Not Global — keep inference in US/Canada for customer task content and files.
• Steady State TPM: 200000
• Peak State TPM: 800000
• Steady RPM: 15
• Peak RPM: 60
• Average Input Tokens Per Request: 40000
• Average Output Tokens Per Request: 4000
Use Case Description:
(same as Sonnet 5)

### Claude Haiku 4.5

• Account ID:
• Region: us-west-2
• Limit Type (On Demand/Provisioned): On Demand
• Model Name: Anthropic Claude Haiku 4.5
• Input Modality (Text/Image): Text/Image
• Output Modality: Text
• CRIS enabled (global or geo)? If not, provide reason: Yes, US geo (us.anthropic.claude-haiku-4-5-20251001-v1:0). Not Global — keep inference in US/Canada for customer task content and files.
• Steady State TPM: 800000
• Peak State TPM: 3000000
• Steady RPM: 80
• Peak RPM: 400
• Average Input Tokens Per Request: 20000
• Average Output Tokens Per Request: 1500
Use Case Description:
(same as Sonnet 5)
