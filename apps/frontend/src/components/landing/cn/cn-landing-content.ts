import type { CnLandingContent } from './cn-landing-types';

export const cnLandingContent: CnLandingContent = {
  badge: '中文介绍 · 个人与团队',
  title: '你的云端 AI 员工，\n国内用上 GPT、Claude，不需翻墙',
  subtitle:
    '打开 dobby.now 即可开始，国内直连 GPT 与 Claude，不用翻墙。同一段对话里每一轮都可以换模型，也可用国内开源模型。桌面端用这台电脑，云端沙箱关电脑也能继续跑。微信和飞书入口正在内测。',
  primaryCta: { label: '免费开始使用', href: '/auth' },
  secondaryCta: { label: '查看套餐', href: '/pricing' },
  featuresTitle: 'Dobby 能帮你做什么',
  features: [
    {
      icon: 'globe',
      title: '国内用上 GPT、Claude，不需翻墙',
      description:
        '在国内打开 dobby.now 就能用 GPT 和 Claude，不必翻墙、不必自备海外账号。',
    },
    {
      icon: 'sparkles',
      title: '全球与国产模型，对话中途可换',
      description:
        'Claude、GPT，以及国内开源模型都能用。同一段对话里，每一轮都可以换模型，不必锁死在一家。',
    },
    {
      icon: 'wallet',
      title: '中文即用，国内支付',
      description:
        '工作台、账单与绑定流程都是简体中文。可用支付宝、微信支付购买不过期积分，不必先配海外卡。',
    },
    {
      icon: 'monitor',
      title: '这台电脑也能干活',
      description:
        '安装桌面端，选择「这台电脑」，Dobby 可以读写本机文件、调用本机应用。适合要处理本地资料的任务。',
    },
    {
      icon: 'cloud',
      title: '云端接着跑',
      description:
        '不想占用这台电脑时，用托管云沙箱：浏览网页、处理文件、跑脚本。合上笔记本，任务仍可继续。',
    },
    {
      icon: 'presentation',
      title: '幻灯片、调研、文档、视频',
      description:
        '不只是聊天。从首页即可启动调研、文档、数据、演示文稿、图像和视频等真实交付，而不是一堆建议。',
    },
    {
      icon: 'message-circle',
      title: '微信、飞书（内测）',
      description:
        '微信和飞书机器人正在内测，可在对话里下达任务。网页和桌面端是现在就可用的正式入口。',
    },
  ],
  comparisonTitle: '和 WorkBuddy、Codex / Claude Code、OpenClaw 有什么不同',
  comparisonSubtitle:
    '国内打开就能用 GPT 和 Claude，不用翻墙——这是第一差别。然后才是模型选择：Dobby 每一轮对话都能换，也可用国内开源模型。WorkBuddy 主要用国内模型；Codex 与 Claude Code 各自只用自家模型，官方入口在国内常需翻墙。OpenClaw 能接很多模型，但要自己搭 Gateway，上手太重。',
  comparisonHeaders: {
    dimension: '维度',
    dobby: 'Dobby',
    workbuddy: '腾讯 WorkBuddy',
    codingAgents: 'Codex / Claude Code',
    openClaw: 'OpenClaw',
  },
  comparisonRows: [
    {
      label: '国内访问',
      dobby: '国内直连 GPT、Claude，不需翻墙',
      workbuddy: '主要用国内模型，没有 GPT / Claude',
      codingAgents: '官方入口在国内常需翻墙',
      openClaw: '自备海外 API，通常需翻墙',
    },
    {
      label: '模型',
      dobby: 'Claude、GPT、国内开源模型；每一轮对话可换',
      workbuddy: '主要用国内模型',
      codingAgents: '各自只用自家模型',
      openClaw: '可接多家，需自备 Key、自行配置',
    },
    {
      label: '上手',
      dobby: '打开 dobby.now，登录即可',
      workbuddy: '安装客户端，腾讯云账号',
      codingAgents: '安装 CLI，绑定代码仓库',
      openClaw: '自建 Gateway，配置重、上手慢',
    },
    {
      label: '定位',
      dobby: '通用 AI 员工，网页注册即用',
      workbuddy: '腾讯系 AI 办公工作台',
      codingAgents: '开发者编程助手（终端 / IDE）',
      openClaw: '自托管智能体框架',
    },
    {
      label: '这台电脑',
      dobby: '桌面端可操作本机文件与应用',
      workbuddy: '授权本地文件夹后读写',
      codingAgents: '以本地代码仓库为主',
      openClaw: '自管运行时与本机环境',
    },
    {
      label: '关掉电脑后',
      dobby: '云端沙箱可继续执行',
      workbuddy: '部分云端任务可继续；本机任务需电脑在线',
      codingAgents: '本机会话结束即停',
      openClaw: '取决于你自己怎么部署',
    },
    {
      label: '日常产出',
      dobby: '幻灯片、调研、文档、视频、数据',
      workbuddy: '文档、表格、PPT、办公数据处理',
      codingAgents: '代码、补丁、仓库改动',
      openClaw: '取决于你接的工具与频道',
    },
    {
      label: '支付',
      dobby: '支付宝 / 微信支付预付积分',
      workbuddy: '腾讯云 / 腾讯生态计费',
      codingAgents: 'API 或订阅',
      openClaw: '自备模型 API Key',
    },
    {
      label: '微信 / 飞书',
      dobby: '入口内测中，网页与桌面端可先用',
      workbuddy: '可通过微信等远程控制本机客户端',
      codingAgents: '不是产品入口',
      openClaw: '需自行桥接频道',
    },
  ],
  faqTitle: '常见问题',
  faq: [
    {
      q: 'Dobby 是什么？',
      a: 'Dobby 是会实际执行任务的 AI 员工，而不只是聊天。你可以让它做幻灯片、调研、文档、视频，或在这台电脑和云端沙箱里跟进多步工作。',
    },
    {
      q: '国内能直接用 GPT、Claude 吗？要翻墙吗？',
      a: '能。打开 dobby.now 即可在国内使用 GPT 和 Claude，不需要翻墙，也不必自备海外账号。',
    },
    {
      q: '还可以用哪些模型？中途能换吗？',
      a: '还可以用国内开源模型。同一段对话里，每一轮都可以换模型，不必整段锁死在一家。',
    },
    {
      q: '和腾讯 WorkBuddy 有什么不同？',
      a: 'WorkBuddy 主要用国内模型，用不了 GPT / Claude。Dobby 在国内就能用 GPT 和 Claude，不用翻墙；同一段对话里每一轮也都能换模型。打开网页即可，也支持支付宝与微信支付。',
    },
    {
      q: '和 Codex、Claude Code 有什么不同？',
      a: 'Codex 与 Claude Code 各自只能用自家模型，官方入口在国内常需翻墙，而且主要帮开发者写代码。Dobby 国内直连、不锁模型，面向幻灯片、调研、文档、视频，以及这台电脑上的任务。',
    },
    {
      q: '和 OpenClaw 有什么不同？',
      a: 'OpenClaw 也能接很多模型，但要自己搭 Gateway、配频道和海外 API，上手太重，在国内通常还要翻墙。Dobby 打开 dobby.now 登录即可。',
    },
    {
      q: '能在我自己的电脑上干活吗？',
      a: '可以。安装桌面端后，发起任务时选择「这台电脑」，Dobby 可以处理本机文件和应用。也可以改用云端沙箱，不占用这台电脑。',
    },
    {
      q: '微信和飞书能用吗？',
      a: '微信和飞书入口正在内测。现在请先用网页或桌面端；账单页可用支付宝或微信支付预付积分。',
    },
  ],
  closingTitle: '今天开始第一个任务',
  closingBody:
    '免费注册即可体验。国内直连 GPT 与 Claude，不用翻墙；同一段对话里随时换模型。需要更多积分时，在账单页用支付宝或微信预付。',
  closingChecks: [
    '国内用上 GPT、Claude，不需翻墙',
    '每一轮对话可换模型，也可用国内开源模型',
    '微信、飞书入口内测中',
  ],
};

export function getCnLandingContent(): CnLandingContent {
  return cnLandingContent;
}
