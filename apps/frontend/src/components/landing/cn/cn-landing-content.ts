import { SUPPORT_MAILTO } from '@/lib/site-config';
import type { CnLandingContent } from './cn-landing-types';

export const cnConsumerLanding: CnLandingContent = {
  badge: '个人用户 · 中文原生',
  title: '你的云端 AI 员工，\n微信里也能用',
  subtitle:
    '免安装、中文界面、支付宝与微信预付。做调研、写文档、生成演示文稿——Dobby 在云端真实执行任务，而不只是聊天。',
  primaryCta: { label: '免费开始使用', href: '/auth' },
  secondaryCta: { label: '查看套餐', href: '/pricing' },
  featuresTitle: '为什么选择 Dobby',
  features: [
    {
      icon: 'sparkles',
      title: '注册即用',
      description: '无需自建服务器或配置 Gateway。打开 dobby.now，登录即可开始任务。',
    },
    {
      icon: 'globe',
      title: '完整中文体验',
      description: '工作台、账单、模式选择与绑定流程均为简体中文，适合国内用户习惯。',
    },
    {
      icon: 'wallet',
      title: '支付宝 · 微信预付',
      description: '支持国内常用支付方式购买不过期积分，Basic 用户预付期间可解锁 Plus 级能力。',
    },
    {
      icon: 'message-circle',
      title: '微信里直接聊',
      description: '通过 iLink 绑定共享 Dobby 微信机器人，在熟悉的微信对话里下达任务。',
    },
    {
      icon: 'smartphone',
      title: '手机 App',
      description: 'iOS / Android 客户端，随时随地继续对话与查看结果。',
    },
    {
      icon: 'zap',
      title: '多场景一键开始',
      description: '调研、文档、数据、演示文稿、图像等模式，从首页即可快速启动。',
    },
  ],
  comparisonTitle: 'Dobby 和 OpenClaw 有什么不同？',
  comparisonSubtitle:
    'OpenClaw 适合喜欢自建 Gateway、住在聊天软件里的技术用户。Dobby 适合想要「开箱即用、云端干活」的个人用户。',
  comparisonRows: [
    { label: '上手', dobby: '注册即用', openClaw: '需安装配置' },
    { label: '界面', dobby: '中文 Web / App 工作台', openClaw: 'Control UI + 聊天频道' },
    { label: '执行环境', dobby: '托管云沙箱（浏览器/文件）', openClaw: '自管运行时' },
    { label: '支付', dobby: '支付宝 / 微信 / 套餐', openClaw: '自备模型 API Key' },
    { label: '微信', dobby: '官方机器人 + 验证码绑定', openClaw: '需自行桥接' },
  ],
  closingTitle: '今天就开始你的第一个任务',
  closingBody: '免费注册，体验 Super Worker。需要更多积分时，可在账单页使用支付宝或微信预付。',
};

export const cnEnterpriseLanding: CnLandingContent = {
  badge: '企业团队 · 云端 AI 员工',
  title: '为团队部署\n可执行的 AI Worker',
  subtitle:
    '自定义智能体、100+ 业务集成、定时与事件自动化——统一账单与用量管理。无需像 OpenClaw 那样自建 Gateway 与沙箱基础设施。',
  primaryCta: { label: '团队免费试用', href: '/auth' },
  secondaryCta: { label: '联系商务', href: SUPPORT_MAILTO },
  featuresTitle: '企业级能力',
  features: [
    {
      icon: 'bot',
      title: '可配置 AI Worker',
      description: '为销售、运营、研究、客服等场景定制指令、工具、知识库与集成权限。',
    },
    {
      icon: 'cloud',
      title: '托管云沙箱',
      description: '浏览器自动化、文件处理、Shell 任务在隔离环境中执行，IT 无需维护执行节点。',
    },
    {
      icon: 'plug',
      title: '100+ 集成',
      description: 'Gmail、Slack、GitHub、Notion 等通过 Composio/MCP 连接企业现有工具链。',
    },
    {
      icon: 'timer',
      title: '定时与事件触发',
      description: '日报、周报、监控、表单/邮件事件——让 Worker 7×24 自动运行。',
    },
    {
      icon: 'users',
      title: '统一账户与用量',
      description: '项目、线程、积分与订阅集中管理，适合小团队到部门级试点。',
    },
    {
      icon: 'shield',
      title: '相比自建更省运维',
      description: '相对 OpenClaw 自建方案，无需部署 Gateway、频道桥接与模型路由维护。',
    },
  ],
  comparisonTitle: '企业选型：Dobby vs OpenClaw',
  comparisonSubtitle:
    '若团队需要「业务同学今天就能用」的 AI 员工，Dobby 托管模式通常比 OpenClaw 自建更快落地。',
  comparisonRows: [
    { label: '部署', dobby: 'SaaS，dobby.now', openClaw: '自建 Gateway / VPS' },
    { label: '交付周期', dobby: '天级上线试点', openClaw: '周级运维与集成' },
    { label: '可视化', dobby: 'Dobby Computer 实时查看', openClaw: '偏日志与聊天' },
    { label: '国内支付', dobby: '支付宝 / 微信预付', openClaw: '无产品化方案' },
    { label: '微信触达', dobby: 'iLink 企业用户绑定', openClaw: '需 IT 自建' },
    { label: '数据控制', dobby: '云端托管', openClaw: '完全自管（优势）' },
  ],
  closingTitle: '安排团队试点',
  closingBody:
    '从 Super Worker 或小范围自定义 Worker 开始。如需发票、批量采购或私有化讨论，请邮件联系 support@dobby.now。',
};

export function getCnLandingContent(variant: 'consumer' | 'enterprise'): CnLandingContent {
  return variant === 'enterprise' ? cnEnterpriseLanding : cnConsumerLanding;
}
