import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Careers at Dobby',
  description: 'Join Dobby and build AI workers people use for real work.',
  path: '/careers',
});

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
