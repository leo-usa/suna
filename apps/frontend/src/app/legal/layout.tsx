import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Legal — Privacy, Terms, and Imprint',
  description: 'Dobby privacy policy, terms of service, and imprint.',
  path: '/legal',
});

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
