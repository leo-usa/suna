import type { Metadata } from 'next';
import { CnLandingPage } from '@/components/landing/cn/cn-landing-page';

export const metadata: Metadata = {
  title: 'Dobby 个人用户 — 云端 AI 员工，微信也能用',
  description:
    'Dobby 面向个人用户：中文界面、支付宝与微信预付、微信机器人绑定。免安装云端 AI 员工，对比 OpenClaw 更易上手。',
  openGraph: {
    title: 'Dobby 个人用户 — 云端 AI 员工',
    description: '中文原生、支付宝微信预付、微信里直接聊。注册即用，无需自建 OpenClaw。',
    locale: 'zh_CN',
  },
};

export default function CnConsumerPage() {
  return <CnLandingPage variant="consumer" />;
}
