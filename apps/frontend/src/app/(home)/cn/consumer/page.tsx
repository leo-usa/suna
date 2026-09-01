import type { Metadata } from 'next';
import { CnLandingPage } from '@/components/landing/cn/cn-landing-page';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Dobby 个人用户 — 云端 AI 员工，微信也能用',
  description:
    'Dobby 面向个人用户：中文界面、支付宝与微信预付、微信机器人绑定。免安装云端 AI 员工。',
  path: '/cn/consumer',
  locale: 'zh_CN',
  absoluteTitle: true,
});

export default function CnConsumerPage() {
  return <CnLandingPage variant="consumer" />;
}
