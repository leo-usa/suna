import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'REST API reference',
  description:
    'How to call the Dobby API at dobby.now: authentication, JSON requests, and examples.',
  path: '/docs/api',
});

export default function DocsApiLayout({ children }: { children: React.ReactNode }) {
  return children;
}
