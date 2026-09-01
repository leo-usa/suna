import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Dobby Tutorials',
  description: 'Short tutorials on how to run an AI worker in Dobby — browser, desktop, and WeChat.',
  path: '/tutorials',
});

export default function TutorialsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
