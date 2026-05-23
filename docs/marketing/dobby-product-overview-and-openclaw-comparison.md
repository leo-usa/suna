# Dobby 产品概览与 OpenClaw 对比

> 最后更新：2026-05-21  
> 适用版本：含中文界面、微信/支付宝预付、WeChat iLink 集成的 Dobby 产品线

---

## 一句话定位

| 产品 | 定位 |
|------|------|
| **Dobby** | 云端托管的自主 AI 员工平台——在浏览器或微信里下达任务，在云端沙箱中真实执行（浏览网页、写文件、调集成）。 |
| **OpenClaw** | 开源自建的个人 AI 网关——在你自己的机器上运行，通过 WhatsApp / Telegram 等聊天软件与助手对话。 |

**记忆口诀：** OpenClaw = 自己养龙虾、住在你的聊天里；Dobby = 云端 AI 员工、带完整工位（Dobby Computer）。

---

## Dobby 核心能力

### 1. 自主 AI Worker（智能体）

- **Super Worker**：开箱即用的通用 AI 员工，研究、分析、自动化、内容生成。
- **自定义 Worker**：按业务配置人设、工具、知识库、集成。
- **Dobby Computer**：实时查看 Agent 在浏览器、文件、工具中的执行过程。

### 2. 云端执行环境

- **浏览器自动化**：访问网站、填表、抓取、多步网页工作流。
- **文件与文档**：创建/编辑文档、表格、演示文稿、代码。
- **Shell 与 DevOps**：命令行、脚本、部署相关任务（沙箱内）。
- **Canvas / 演示文稿 / 图像**：可视化产出与幻灯片生成。

### 3. 集成与自动化

- **100+ 应用集成**（Composio / MCP）：Gmail、Slack、GitHub、Notion 等。
- **定时触发器**：每日报告、周期任务。
- **事件触发器**：新邮件、表单提交等事件驱动。

### 4. 模型与模式

- **Dobby Basic / Advanced**：按订阅档位切换速度与智力模式。
- **多模型选择**：Claude、GPT、Kimi、DeepSeek 等（按套餐开放）。

### 5. 多端触达

| 渠道 | 说明 |
|------|------|
| Web 工作台 | 完整功能：项目、线程、Worker 配置、账单 |
| iOS / Android App | 移动聊天、设置、升级（Web 结账） |
| **微信（iLink）** | 共享 Dobby 微信机器人 + 验证码绑定，无需自建桥接 |
| Telegram | 验证码绑定 @dobby3_telegram_bot |

### 6. 计费与商业化（近期重点）

| 能力 | 说明 |
|------|------|
| 订阅套餐 | Basic → Plus → Pro → Ultra，含月度积分与功能上限 |
| 积分制 | 按任务消耗；日/月/额外（不过期）积分 |
| **预付充值** | 额外积分包，**不过期** |
| **支付宝 / 微信支付** | 通过 Stripe 支持国内常用支付方式 |
| **Prepaid Unlock** | Basic 用户在持有预付积分时可享受 Plus 级限制/模型 |

### 7. 中文与本地化（近期）

- 完整 **简体中文** UI（工作台、账单、设置、模式菜单等）。
- 微信/Telegram 绑定流程中文化。
- 语音输入（含 iOS Safari 录音兼容）。

---

## Dobby vs OpenClaw 对比表

| 维度 | Dobby | OpenClaw |
|------|-------|----------|
| **部署** | 托管 SaaS（dobby.now）；上游 Suna 栈可自建 | 以自建为主，本地/VPS 运行 Gateway |
| **上手成本** | 注册即用 | 需安装、配置 Provider、频道、插件 |
| **主界面** | Web/App **工作台** + Dobby Computer | 聊天 App + Control UI |
| **任务执行** | **托管云沙箱**（浏览器/文件/Shell） | 本地/插件工具链，偏 Gateway 运维 |
| **集成** | Composio/MCP 产品化 | 插件/npm 生态、MCP 迁移工具 |
| **自动化** | Dashboard 内 Worker + 触发器 | Cron、频道、Gateway 任务 |
| **计费** | 平台积分 + **支付宝/微信** | BYOK，直接向模型商付费 |
| **中国市场** | **中文 UI、微信付费、微信机器人** | 需自行搭建，无产品化国内支付 |
| **数据控制** | 云端账户与沙箱 | 数据留在自管环境 |
| **适合谁** | 要**结果**、少运维的团队与个人 | 要**完全自控**、聊天原生的技术用户 |

---

## Dobby 明显优势（相对 OpenClaw）

1. **零运维云端 Agent** — 无需维护 Gateway、频道桥接、模型配置。
2. **可视化「工位」** — Dobby Computer、文件预览、演示文稿等产出物。
3. **中国市场** — 中文界面、支付宝/微信预付、微信 iLink 一键绑定。
4. **商业就绪** — 套餐、积分、预付解锁、支持邮箱、法务页。
5. **多入口** — 同一账户：Web、App、微信、Telegram。

## OpenClaw 明显优势（相对 Dobby）

1. **自建与隐私** — 数据与 Gateway 完全自管。
2. **聊天原生** — WhatsApp 等频道深度整合（OpenClaw 核心场景）。
3. **可 hack** — 插件、Compaction/Memory 调优、Claude Code 迁移。
4. **成本模型** — 无平台积分，仅模型 API 费用（自建运营时可更省）。
5. **Voice / Talk** — 成熟的实时语音插件路径。

---

## 受众话术

### 面向个人用户（Consumer）

> Dobby 是「注册就能用的云端 AI 员工」：中文界面，支持微信和支付宝充值，在微信里也能聊。做调研、写文档、做 PPT、处理图片，不用装 OpenClaw、不用自己搭服务器。

### 面向企业（Enterprise）

> Dobby 为团队提供可配置的 AI Worker、100+ 业务集成、定时/事件自动化，以及统一的积分与账单管理。相比 OpenClaw 自建，IT 无需维护 Gateway 与沙箱基础设施，业务同学通过 Web 或微信即可使用。

---

## 相关链接

- 产品：https://www.dobby.now
- 中文个人落地页：`/cn/consumer`
- 中文企业落地页：`/cn/enterprise`
- 定价：`/pricing`
- 支持：support@dobby.now

---

## English summary (for international stakeholders)

**Dobby** is a hosted autonomous AI worker platform with cloud sandboxes, visual execution (Dobby Computer), Composio integrations, triggers, and multi-channel access (web, mobile, WeChat iLink, Telegram). Recent additions include full **Simplified Chinese UI**, **Alipay/WeChat Pay prepaid credits**, and **prepaid unlock** for Basic-tier users.

**OpenClaw** is an open-source, self-hosted personal AI gateway focused on messaging channels (WhatsApp, Telegram, etc.), plugins, and local control with BYOK billing.

**Positioning:** OpenClaw = run your own agent on your hardware in your chats. Dobby = cloud AI employees with a Chinese-ready product surface and no ops burden.
