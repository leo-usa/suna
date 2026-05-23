import type { Metadata } from 'next';
import { CnLandingPage } from '@/components/landing/cn/cn-landing-page';

export const metadata: Metadata = {
  title: 'Dobby 企业 — 团队 AI Worker 与自动化',
  description:
    'Dobby 面向企业团队：可配置 AI Worker、100+ 集成、定时与事件触发、统一账单。托管云沙箱，相比 OpenClaw 自建更快落地。',
  openGraph: {
    title: 'Dobby 企业 — 团队 AI Worker',
    description: '为团队部署可执行的 AI Worker。集成、自动化、国内支付，无需自建 Gateway。',
    locale: 'zh_CN',
  },
};

export default function CnEnterprisePage() {
  return <CnLandingPage variant="enterprise" />;
}
