import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Dobby Support',
  description: 'Get help with Dobby — billing, desktop app, WeChat, and account questions.',
  path: '/support',
});

export default function SupportLayout({ children }: { children: React.ReactNode }) {
  return children;
}
