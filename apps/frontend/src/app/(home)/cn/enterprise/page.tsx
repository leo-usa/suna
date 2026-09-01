import type { Metadata } from 'next';
import { CnLandingPage } from '@/components/landing/cn/cn-landing-page';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Dobby 企业 — 团队 AI Worker 与自动化',
  description:
    'Dobby 面向企业团队：可配置 AI Worker、100+ 集成、定时与事件触发、统一账单。托管云沙箱，更快落地。',
  path: '/cn/enterprise',
  locale: 'zh_CN',
  absoluteTitle: true,
});

export default function CnEnterprisePage() {
  return <CnLandingPage variant="enterprise" />;
}
