import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'About Dobby',
  description:
    'Most AI tools stop at thinking. Dobby is an AI worker that acts — research, slides, code, and follow-through.',
  path: '/about',
});

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
