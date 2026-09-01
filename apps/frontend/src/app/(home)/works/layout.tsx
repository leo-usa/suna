import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Dobby Works — Sites, slides, and videos people shipped',
  description: 'A gallery of sites, slides, docs, and videos created with Dobby.',
  path: '/works',
});

export default function WorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
